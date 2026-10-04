import { runGame } from '../.generated/game-engine.mjs';
import { runGame as runReserveGame } from '../.generated/reserve-engine.mjs';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const tokenPattern = /^[a-f0-9]{64}$/;
async function hashToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
const makeID = () => crypto.randomUUID().replaceAll('-', '');
async function readBody(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('Cal enviar dades JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Falten les dades.');
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new Error('La petició és massa gran.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function snapshot(db, room, now) {
  const result = await db.prepare('SELECT count(*) AS total FROM members WHERE room_id = ? AND last_seen > ?').bind(room.id, now - 15000).first();
  return { room: room.id, revision: room.revision, mode: room.mode, state: JSON.parse(room.state), participants: result.total };
}
// GitHub Pages serves the interface; the API owns shared matches.
const githubPagesOrigin = 'https://gausachs.github.io';
export async function handleAPI(request, env) {
  const origin = request.headers.get('origin');
  const sameOrigin = new URL(request.url).origin;
  if (origin && origin !== sameOrigin && origin !== githubPagesOrigin) {
    return json({ error: 'Origen no permès.' }, 403);
  }
  const corsHeaders = { Vary: 'Origin' };
  if (origin) corsHeaders['Access-Control-Allow-Origin'] = origin;
  if (request.method === 'OPTIONS') {
    const method = request.headers.get('access-control-request-method');
    const requestedHeaders = (request.headers.get('access-control-request-headers') || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!['GET', 'POST'].includes(method) || requestedHeaders.some(name => !['authorization', 'content-type'].includes(name))) {
      return new Response(null, { status: 403, headers: corsHeaders });
    }
    return new Response(null, { status: 204, headers: {
      ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600',
    } });
  }
  const response = await handleRoomAPI(request, env);
  const responseHeaders = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) responseHeaders.set(name, value);
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

async function handleRoomAPI(request, env) {
  const url = new URL(request.url);
  const reserveEdition = url.pathname.startsWith('/api/reserve/');
  if (reserveEdition) url.pathname = url.pathname.replace('/api/reserve/', '/api/');
  const engine = reserveEdition ? runReserveGame : runGame;
  const db = env.DB;
  if (!db) return json({ error: 'El servei de partides encara no està configurat.' }, 503);
  const now = Date.now();
  try {
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const { token, config = {} } = await readBody(request);
      if (!tokenPattern.test(token || '')) return json({ error: 'Sessió no vàlida.' }, 400);
      const id = makeID(), hash = await hashToken(token);
      const state = engine(null, null, config);
      await db.batch([
        db.prepare('INSERT INTO rooms (id, state, revision, mode, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)').bind(id, JSON.stringify(state), 'shared', now, now),
        db.prepare('INSERT INTO members (room_id, token_hash, last_seen) VALUES (?, ?, ?)').bind(id, hash, now),
      ]);
      return json({ room: id, revision: 0, mode: 'shared', state, participants: 1 }, 201);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})(?:\/(join|actions))?$/);
    if (!match) return json({ error: 'Partida no trobada.' }, 404);
    const [, id, endpoint] = match;
    const room = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first();
    if (!room) return json({ error: 'Aquesta partida no existeix. Revisa l’enllaç.' }, 404);
    if ((JSON.parse(room.state).variant === 'reserve') !== reserveEdition) {
      return json({ error: 'Aquesta partida pertany a una altra versió. Obre l’enllaç original del Clàssic o de Reserva de daus.' }, 409);
    }
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (!tokenPattern.test(token)) return json({ error: 'Torna a entrar a la partida.' }, 401);
    const hash = await hashToken(token);
    if (endpoint === 'join' && request.method === 'POST') {
      await db.prepare('INSERT INTO members (room_id, token_hash, last_seen) VALUES (?, ?, ?) ON CONFLICT(room_id, token_hash) DO UPDATE SET last_seen = excluded.last_seen').bind(id, hash, now).run();
      return json(await snapshot(db, room, now));
    }
    const member = await db.prepare('SELECT last_seen FROM members WHERE room_id = ? AND token_hash = ?').bind(id, hash).first();
    if (!member) return json({ error: 'Primer has d’entrar a la partida.' }, 403);
    if (now - member.last_seen > 5000) await db.prepare('UPDATE members SET last_seen = ? WHERE room_id = ? AND token_hash = ?').bind(now, id, hash).run();
    if (!endpoint && request.method === 'GET') return json(await snapshot(db, room, now));
    if (endpoint === 'actions' && request.method === 'POST') {
      const body = await readBody(request);
      if (!Number.isInteger(body.revision) || body.revision !== room.revision) return json({ error: 'Un altre usuari ja ha fet una acció. S’ha actualitzat la partida.', ...(await snapshot(db, room, now)) }, 409);
      let state;
      try { state = engine(JSON.parse(room.state), body.action); }
      catch (error) { return json({ error: error.message }, 422); }
      const result = await db.prepare('UPDATE rooms SET state = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(state), now, id, body.revision).run();
      if (result.meta.changes !== 1) {
        const current = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first();
        return json({ error: 'Un altre usuari s’ha avançat. Revisa el torn.', ...(await snapshot(db, current, now)) }, 409);
      }
      return json(await snapshot(db, { ...room, state: JSON.stringify(state), revision: room.revision + 1 }, now));
    }
    return json({ error: 'Acció no permesa.' }, 405);
  } catch (error) {
    if (error instanceof SyntaxError || /JSON|petició|Falten/.test(error.message)) return json({ error: 'La petició no és vàlida.' }, 400);
    console.error('Room API failed', error.name);
    return json({ error: 'No s’ha pogut desar. Reconnecta abans de tornar-ho a provar.' }, 500);
  }
}
