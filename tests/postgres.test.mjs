import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDB } from '../server/postgres-db.mjs';
import { handleAPI } from '../server/api.mjs';
import vercelAPI from '../api/index.js';

test('PostgreSQL preserves shared state, participant counts and concurrent action protection', async () => {
  const postgres = new PGlite();
  const pool = {
    async query(sql, values) {
      const result = await postgres.query(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
    async connect() { return { query: pool.query, release() {} }; },
  };
  try {
    await postgres.exec(await readFile('db/postgres.sql', 'utf8'));
    const db = createPostgresDB(pool);
    const tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64);
    const call = (path, method = 'GET', body, token = tokenA) => handleAPI(new Request(`https://tenis.test${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }), { DB: db });
    const created = await call('/api/rooms', 'POST', { token: tokenA });
    assert.equal(created.status, 201);
    const room = await created.json();
    const path = `/api/rooms/${room.room}`;
    const joined = await call(`${path}/join`, 'POST', {}, tokenB);
    assert.equal(joined.status, 200);
    assert.equal((await joined.json()).participants, 2);
    const results = await Promise.all([
      call(`${path}/actions`, 'POST', { revision: 0, action: { type: 'hit' } }),
      call(`${path}/actions`, 'POST', { revision: 0, action: { type: 'hit' } }, tokenB),
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const a = await (await call(path)).json();
    const b = await (await call(path, 'GET', null, tokenB)).json();
    assert.equal(a.revision, 1);
    assert.deepEqual(a.state, b.state);
    assert.equal((await call(path, 'GET', null, 'c'.repeat(64))).status, 403);
    // Creation must roll back if membership insertion fails.
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO rooms (id, state, created_at, updated_at) VALUES (?, ?, ?, ?)').bind('rollback', '{}', Date.now(), Date.now()),
      db.prepare('INSERT INTO members (room_id, token_hash, last_seen) VALUES (?, ?, ?)').bind('missing-room', tokenA, Date.now()),
    ]));
    assert.equal(await db.prepare('SELECT * FROM rooms WHERE id = ?').bind('rollback').first(), null);
  } finally { await postgres.close(); }
});

test('Vercel entrypoint returns a clear JSON response before database configuration', async () => {
  const databaseURL = process.env.DATABASE_URL, postgresURL = process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
  try {
    const response = await vercelAPI.fetch(new Request('https://tenis.test/api/index?path=rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /configurat/);
  } finally {
    if (databaseURL !== undefined) process.env.DATABASE_URL = databaseURL;
    if (postgresURL !== undefined) process.env.POSTGRES_URL = postgresURL;
  }
});
