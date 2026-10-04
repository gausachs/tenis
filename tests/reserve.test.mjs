import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createGameDOM } from '../server/game-dom.mjs';
import { runGame } from '../.generated/reserve-engine.mjs';
import { runGame as classic } from '../.generated/game-engine.mjs';
import { handleAPI } from '../server/api.mjs';
import { createLocalDB } from '../server/local-db.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
function client(state = runGame(null, null), random = 0.8) {
  const document = createGameDOM(), stored = new Map(), timers = [];
  const context = vm.createContext({ document, URLSearchParams,
    Math: Object.assign(Object.create(Math), { random: () => random }),
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key,value) => stored.set(key,value) },
    window: { location: { search: '' }, addEventListener() {}, matchMedia: () => ({ matches: true }) },
    setTimeout: callback => { timers.push(callback); return timers.length; }
  });
  vm.runInContext(readFileSync('reserva-daus/reserve.js','utf8') + '\n' + readFileSync('reserva-daus/script.js','utf8'), context);
  assert.equal(context.restoreGame(state), true);
  document.getElementById('setup-dialog').close();
  return { context, document, stored, timers };
}
function returning({ pool = [-1,0,1,1], energy = 1, difficulty = 2 } = {}) {
  const state = runGame(null,null);
  Object.assign(state.turn, { phase:'return', activeSide:'left', ballPlaced:false, hitReady:false, previousShotRow:0, currentShotRow:null, baseDifficulty:null });
  state.playerPositions.left = { left:'8%', top:'25%' };
  state.playerPositions.right = { left:'92%', top:'75%' };
  state.ballPosition = { ...state.playerPositions.left };
  state.ballValue = difficulty;
  state.reserve.pools.left = [...pool];
  state.reserve.selected.left = null;
  state.playerCards[0].energy = String(energy);
  return state;
}

test('reserve edition is isolated; each shot consumes exactly the selected die', () => {
  let state = runGame(null,null);
  assert.equal(state.variant, 'reserve');
  assert.equal(classic(null,null).variant, undefined);
  assert.deepEqual(state.reserve.batches, {left:1,right:1});
  state.reserve.pools.left = [-1,0,1,1];
  const original = structuredClone(state.reserve.pools);
  assert.throws(() => runGame(state,{type:'hit'}));
  state = runGame(state,{type:'selectDie',index:2});
  assert.deepEqual(state.reserve.pools, original);
  state = runGame(state,{type:'hit'});
  assert.deepEqual(state.hitStateByPlayer.left.rolls,[1]);
  assert.deepEqual(state.reserve.pools.left,[-1,0,null,1]);
  assert.deepEqual(state.reserve.pools.right,original.right);
  assert.throws(() => runGame(state,{type:'selectDie',index:2}));
  const {context,stored} = client(state);
  context.saveGame();
  assert.ok(stored.has('tenis-reserva-daus-partida-v1'));
  assert.equal(stored.has('tenis-versio-nova-partida-v1'),false);
  assert.equal(context.restoreGame(classic(null,null)),false);
  assert.deepEqual(plain(context.getGameState()),state);
});

test('second serve retains dice; a new point refreshes both reserves', () => {
  let state = runGame(null,null);
  state.reserve.pools.left = [-1,0,1,1];
  state.playerCards[0].energy = '0';
  const right = [...state.reserve.pools.right];
  state = runGame(state,{type:'serveDifficulty',value:9});
  state = runGame(state,{type:'selectDie',index:0});
  state = runGame(state,{type:'hit'});
  state = runGame(state,{type:'resolve'});
  assert.equal(state.turn.serveAttempt,2);
  assert.deepEqual(state.reserve.pools.left,[null,0,1,1]);
  assert.deepEqual(state.reserve.pools.right,right);
  state = runGame(state,{type:'selectDie',index:1});
  state = runGame(state,{type:'hit'});
  state = runGame(state,{type:'resolve'});
  assert.equal(state.score.right.points,1);
  assert.equal(state.reserve.pools.left.filter(v=>v!==null).length,4);
  assert.equal(state.reserve.pools.right.filter(v=>v!==null).length,4);
  assert.deepEqual(state.reserve.batches,{left:2,right:2});
});

test('last die refills only on the next own turn, without changing the opponent pool', () => {
  const state = returning({pool:[null,null,null,1]});
  const {context:c} = client(state);
  c.selectReserveDie(3); c.placeShotBall({col:5,row:0}); c.handleHit();
  assert.deepEqual(plain(c.getGameState().reserve.pools.left),[null,null,null,null]);
  c.resolveHit(); c.finishPostHitMovement(0,0);
  const right = plain(c.getGameState().reserve.pools.right);
  c.beginTurn('left','serve');
  assert.equal(c.getGameState().reserve.pools.left.filter(v=>v!==null).length,4);
  assert.deepEqual(plain(c.getGameState().reserve.pools.right),right);
});

test('destinations follow current position penalties and selected die, including rescue energy', () => {
  const state = returning();
  const {context:c} = client(state);
  c.selectReserveDie(0);
  let targets = plain(c.reserveTargets());
  const at = (col,row) => targets.find(t=>t.cell.col===col&&t.cell.row===row);
  assert.equal(at(5,0).difficulty,2);
  assert.equal(at(5,1).difficulty,3);
  assert.equal(at(4,0).difficulty,3);
  assert.equal(at(3,0).difficulty,4);
  assert.equal(at(5,1).available,true,'negative die may use one energy to reach 2');
  assert.equal(at(3,0).available,false);
  let selected = runGame(state,{type:'selectDie',index:0});
  assert.throws(()=>runGame(selected,{type:'placeBall',cell:{col:3,row:0}}));
  selected = runGame(selected,{type:'placeBall',cell:{col:5,row:1}});
  selected = runGame(selected,{type:'hit'});
  selected = runGame(selected,{type:'removeMinus'});
  assert.equal(selected.playerCards[0].energy,'0');
  assert.equal(selected.hitStateByPlayer.left.rolls[0],0);
  assert.equal(runGame(selected,{type:'resolve'}).turn.phase,'reposition');
  c.selectReserveDie(2);
  targets = plain(c.reserveTargets());
  assert.equal(at(3,0).available,true);
  c.placeShotBall({col:3,row:0});
  c.selectReserveDie(0);
  assert.equal(c.getGameState().ballValue,2,'changing die restores incoming difficulty');
  assert.equal(c.getGameState().turn.ballPlaced,false);
  assert.equal(c.getGameState().reserve.pools.left[0],-1);
});

test('no legal target loses exactly one point, but a bad selection does not', () => {
  const {context:c} = client(returning({pool:[-1,0,1,1],energy:0,difficulty:4}));
  c.selectReserveDie(0); c.settleReserveTurn();
  assert.equal(c.getGameState().score.right.points,0,'other dice can still save the ball');
  const impossible = returning({pool:[-1,-1,-1,-1],energy:0,difficulty:4});
  c.restoreGame(impossible); c.settleReserveTurn();
  assert.equal(c.getGameState().score.right.points,1);
  assert.match(c.getGameState().reserve.notice,/cap casella/);
  c.settleReserveTurn();
  assert.equal(c.getGameState().score.right.points,1);
});

test('movement costs are applied before determining if any return is possible', () => {
  const state = returning({pool:[-1,-1,-1,-1],energy:1,difficulty:3});
  state.playerPositions.left = {left:'42%',top:'75%'};
  assert.throws(()=>runGame(state,{type:'move'}));
  state.playerCards[0].energy='2';
  const result = runGame(state,{type:'move'});
  assert.equal(result.score.right.points,1);
  assert.equal(result.playerCards[0].energy,'0');
  assert.match(result.reserve.notice,/cap casella/);
});

test('computer selects real reserve dice and makes only affordable returns in both views', () => {
  for (const random of [.1,.8]) for (const view of ['horizontal','vertical']) {
    const state = returning({difficulty:1});
    state.score.mode='computer'; state.turn.activeSide='right';
    state.ballPosition={...state.playerPositions.right};
    state.reserve.pools.right=[-1,0,1,1];
    const {context:c,timers,document} = client(state,random);
    c.setCourtOrientation(view);
    vm.runInContext(readFileSync('reserva-daus/computer.js','utf8'),c);
    timers.shift()();
    const result=c.getGameState();
    assert.equal(result.reserve.pools.right.filter(v=>v===null).length,1);
    assert.match(result.score.computerReport,/Tria el dau/);
    assert.match(result.score.computerReport,/Reserva restant/);
    assert.equal(document.getElementById('computer-dialog').open,true);
    assert.equal(result.turn.activeSide,'left');
  }
});

test('shared reserve rooms use their own rules and reject cross-edition access', async () => {
  const db=createLocalDB(),token='a'.repeat(64);
  const call=(path,body)=>handleAPI(new Request('https://game.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)}),{DB:db});
  try {
    const created=await call('/api/reserve/rooms',{token});
    assert.equal(created.status,201);
    const room=await created.json(),path=`/api/reserve/rooms/${room.room}`;
    assert.equal(room.state.variant,'reserve');
    assert.equal((await call(`/api/rooms/${room.room}/join`,{})).status,409);
    const first=await call(path+'/actions',{revision:0,action:{type:'selectDie',index:0}});
    assert.equal(first.status,200);
    const hit=await call(path+'/actions',{revision:1,action:{type:'hit'}});
    assert.equal(hit.status,200);
    const snapshot=await hit.json();
    assert.equal(snapshot.state.hitStateByPlayer.left.rolls.length,1);
    assert.equal(snapshot.state.reserve.pools.left[0],null);
    assert.equal((await call(path+'/actions',{revision:1,action:{type:'hit'}})).status,409);
    const old=await (await call('/api/rooms',{token})).json();
    assert.equal((await call(`/api/reserve/rooms/${old.room}/join`,{})).status,409);
  } finally {db.close();}
});
