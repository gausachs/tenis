import test from 'node:test';
import assert from 'node:assert/strict';
import { runGame } from '../.generated/game-engine.mjs';
import { handleAPI } from '../server/api.mjs';
import { createLocalDB } from '../server/local-db.mjs';
const tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64);
const call = (db, path, method = 'GET', body, token = tokenA) => handleAPI(new Request(`https://game.test${path}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  ...(body ? { body: JSON.stringify(body) } : {}),
}), { DB: db });
test('two people share a match, reload it, and cannot overwrite a concurrent action', async () => {
  const db = createLocalDB();
  try {
    const created = await call(db, '/api/rooms', 'POST', { token: tokenA, config: { initialServer: 'right', bestOf: 5 } });
    assert.equal(created.status, 201); const room = await created.json();
    assert.equal(room.state.turn.activeSide, 'right');
    assert(room.state.playerCards.every(c => c.energy === '5' && c.stats.every(n => n === '2')));
    const path = `/api/rooms/${room.room}`;
    const joined = await call(db, `${path}/join`, 'POST', {}, tokenB); assert.equal(joined.status, 200);
    assert.equal((await joined.json()).participants, 2);
    const requests = await Promise.all([
      call(db, `${path}/actions`, 'POST', { revision: 0, action: { type: 'hit' } }),
      call(db, `${path}/actions`, 'POST', { revision: 0, action: { type: 'hit' } }, tokenB),
    ]);
    assert.deepEqual(requests.map(r => r.status).sort(), [200, 409]);
    const a = await (await call(db, path)).json();
    const b = await (await call(db, path, 'GET', null, tokenB)).json();
    assert.deepEqual(a.state, b.state); assert.equal(a.revision, 1);
    assert.equal(a.state.hitStateByPlayer.right.rolls.length, 4);
    assert.equal((await call(db, `${path}/actions`, 'POST', { revision: 1, action: { type: 'hit' } })).status, 422);
    assert.equal((await call(db, path, 'GET', null, 'c'.repeat(64))).status, 403);
    // A lost response cannot cause a duplicate roll when the old request is retried.
    assert.equal((await call(db, `${path}/actions`, 'POST', { revision: 0, action: { type: 'hit' } })).status, 409);
    assert.equal((await (await call(db, path)).json()).revision, 1);
    const another = await (await call(db, '/api/rooms', 'POST', { token: tokenA })).json();
    assert.equal(another.state.turn.hitReady, false);
    assert.notEqual(another.room, room.room);
  } finally { db.close(); }
});
test('server rejects forged actions and cross-origin writes', async () => {
  const db=createLocalDB();
  try {
    const room=await (await call(db,'/api/rooms','POST',{token:tokenA})).json();
    for(const action of [{type:'volley'},{type:'reposition',colStep:2,rowStep:0},{type:'placeBall',cell:{col:3,row:0}},{type:'serveDifficulty',value:-1},{type:'cheat'}]){
      assert.equal((await call(db,`/api/rooms/${room.room}/actions`,'POST',{revision:0,action})).status,422);
    }
    const r=await handleAPI(new Request('https://game.test/api/rooms',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:'{}'}),{DB:db});
    assert.equal(r.status,403);
  }finally{db.close();}
});
test('volley costs energy and uses the existing rules in the shared engine', () => {
  let s=runGame(null,null,{});
  s.turn={...s.turn,activeSide:'left',phase:'return',ballPlaced:false,hitReady:false,returningServe:false};
  s.playerPositions.left={left:'40%',top:'25%'};
  s.ballPosition={left:'8%',top:'75%'};
  s.ballValue=2;
  const moved=runGame(s,{type:'volley'});
  assert.equal(moved.ballValue,3);assert.equal(moved.playerCards[0].energy,'4');assert.equal(moved.turn.volley,true);
  assert.deepEqual(moved.playerPositions,s.playerPositions);
  assert.throws(()=>runGame(moved,{type:'volley'}));
  const placed=runGame(moved,{type:'placeBall',cell:{col:5,row:0}});
  const hit=runGame(placed,{type:'hit'});assert.equal(hit.hitStateByPlayer.left.statName,'Voleia');
  s.playerCards[0].energy='0';assert.throws(()=>runGame(s,{type:'volley'}));
});
test('successful serve cannot spend energy to remove a minus',()=>{
  let s=runGame(null,null,{});s.turn.hitReady=true;s.turn.ballPlaced=true;s.lastHitSide='left';
  s.hitStateByPlayer.left={statName:'Saque',statValue:2,rolls:[-1,0,0,0],resolved:false,forcedError:false};s.ballValue=1;
  assert.throws(()=>runGame(s,{type:'removeMinus'}));
  s=runGame(s,{type:'resolve'});assert.equal(s.turn.phase,'reposition');
  s=runGame(s,{type:'reposition',colStep:0,rowStep:0});assert.equal(s.turn.activeSide,'right');assert.equal(s.turn.returningServe,true);
});

test('GitHub Pages can create and join rooms through CORS without exposing other origins', async () => {
  const db = createLocalDB();
  const origin = 'https://gausachs.github.io';
  const request = (path, method, body, token = tokenA) => new Request(`https://game.test${path}`, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const preflight = await handleAPI(new Request('https://game.test/api/rooms', { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
    } }), { DB: db });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
    const created = await handleAPI(request('/api/rooms', 'POST', { token: tokenA }), { DB: db });
    assert.equal(created.status, 201); assert.equal(created.headers.get('access-control-allow-origin'), origin);
    const room = await created.json();
    const joined = await handleAPI(request(`/api/rooms/${room.room}/join`, 'POST', {}, tokenB), { DB: db });
    assert.equal(joined.status, 200); assert.equal((await joined.json()).participants, 2);
    const snapshot = await handleAPI(request(`/api/rooms/${room.room}`, 'GET'), { DB: db });
    assert.equal(snapshot.status, 200); assert.equal(snapshot.headers.get('access-control-allow-origin'), origin);
    const denied = await handleAPI(request(`/api/rooms/${room.room}`, 'GET', null, 'c'.repeat(64)), { DB: db });
    assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), origin);
    const other = await handleAPI(new Request('https://game.test/api/rooms', { method: 'OPTIONS', headers: {
      Origin: 'https://other.test', 'Access-Control-Request-Method': 'POST',
    } }), { DB: db });
    assert.equal(other.status, 403); assert.equal(other.headers.get('access-control-allow-origin'), null);
  } finally { db.close(); }
});
