import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createGameDOM } from '../server/game-dom.mjs';
import { runGame } from '../.generated/game-engine.mjs';

test('movement and volley recover after joining, saving and reconnecting', async () => {
  const document = createGameDOM();
  const move = document.getElementById('move-to-ball');
  const volley = document.getElementById('attempt-volley');
  const queryAll = document.querySelectorAll;
  document.querySelectorAll = selector => selector === '.action-panels button, #serve-difficulty'
    ? [move, volley, document.getElementById('hit-action'), document.getElementById('serve-difficulty')]
    : queryAll(selector);
  const state = runGame(null, null);
  state.turn = { ...state.turn, phase: 'return', activeSide: 'left', ballPlaced: false, hitReady: false };
  state.playerPositions.left = { left: '40%', top: '25%' };
  state.ballPosition = { left: '8%', top: '75%' };
  const room = 'a'.repeat(32);
  const snapshot = { room, revision: 0, state, participants: 2 };
  const location = { hostname: 'tenis-fate.vercel.app', href: `https://tenis-fate.vercel.app/?room=${room}`, search: `?room=${room}` };
  let failAction;
  let poll;
  const context = vm.createContext({
    document, location, URL, URLSearchParams, AbortSignal, crypto,
    window: { location, addEventListener() {}, matchMedia: () => ({ matches: true }) },
    history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => 'b'.repeat(64), setItem() {} },
    setInterval(callback) { poll = callback; },
    fetch: async path => path.endsWith('/actions')
      ? new Promise((resolve, reject) => { failAction = reject; })
      : Response.json(snapshot),
  });
  vm.runInContext(readFileSync('versio-nova/script.js', 'utf8'), context);
  vm.runInContext(readFileSync('versio-nova/multiplayer.js', 'utf8'), context);
  const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(setImmediate); };
  await settle();
  assert.equal(context.window.multiplayer.canAct(), true);
  assert.equal(move.hidden, false);
  assert.equal(volley.hidden, false);
  assert.equal(move.disabled, false, 'movement must be enabled after the join request');
  assert.equal(volley.disabled, false, 'volley must be enabled after the join request');
  context.window.multiplayer.dispatch('move');
  assert.equal(move.disabled, true, 'saving must still lock controls');
  assert.equal(volley.disabled, true);
  context.setCourtOrientation('vertical');
  assert.equal(move.disabled, true, 'changing view must not unlock controls while saving');
  assert.equal(volley.disabled, true);
  failAction(new TypeError('Connection lost'));
  await settle();
  assert.equal(context.window.multiplayer.canAct(), true);
  assert.equal(move.disabled, false, 'reconnecting with the same revision must unlock movement');
  assert.equal(volley.disabled, false);
  snapshot.revision++;
  snapshot.state = runGame(state, { type: 'move' });
  poll();
  await settle();
  assert.equal(move.hidden, true, 'movement must disappear after reaching the ball');
  assert.equal(move.disabled, true);
  assert.equal(volley.hidden, true);
  assert.equal(volley.disabled, true);
});
