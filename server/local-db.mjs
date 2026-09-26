import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
export function createLocalDB(path = ':memory:') {
  if (path !== ':memory:') mkdirSync('.local', { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for (const name of readdirSync('drizzle').filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)) continue;
    db.exec(readFileSync(`drizzle/${name}`, 'utf8'));
    db.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);
  }
  return {
    close: () => db.close(),
    prepare(sql) {
      let args = [];
      return { bind(...values) { args = values; return this; },
        async first() { return db.prepare(sql).get(...args) || null; },
        async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = []; for (const s of statements) results.push(await s.run()); db.exec('COMMIT'); return results; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
