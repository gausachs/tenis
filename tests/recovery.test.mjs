import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { runGame } from '../.generated/game-engine.mjs';
import { createGameDOM } from '../server/game-dom.mjs';
const resolve = state => runGame(structuredClone(state), { type: 'resolve' });

function beforeGamePoint() {
  const state = runGame(null, null);
  state.score.right.points = 3;
  state.score.pointsInCurrentGame = 3;
  state.turn = { ...state.turn, phase: 'serve', serveAttempt: 2, hitReady: true, ballPlaced: true };
  state.lastHitSide = 'left';
  state.hitStateByPlayer.left = { statName: 'Saque', statValue: 2, rolls: [-1, -1, -1, -1], resolved: false };
  state.playerCards[0].energy = '1';
  state.playerCards[1].energy = '2';
  return state;
}

test('short games recover the configured fraction of missing energy, rounded down', () => {
  const state = beforeGamePoint();
  const result = resolve(state);
  assert.equal(result.score.right.games, 1);
  assert.deepEqual(result.playerCards.map(c => c.energy), ['3', '3']);
  assert.deepEqual(result.recoveryEvent.recovered, { left: 2, right: 1 });
  assert.equal(result.recoveryEvent.context, 'Fi de joc');
  state.playerCards[0].recoveryPercent = '100';
  state.playerCards[1].recoveryPercent = '0';
  const custom = resolve(state);
  assert.deepEqual(custom.playerCards.map(c => c.energy), ['5', '2']);
  state.playerCards.forEach(c => { c.energy = '5'; });
  assert.deepEqual(resolve(state).recoveryEvent.recovered, { left: 0, right: 0 });
});

test('long games report zero recovery; set and tie-break endings recover once', () => {
  const state = beforeGamePoint();
  state.score.left.points = 3;
  state.score.right.points = 4;
  state.score.pointsInCurrentGame = 7;
  const longGame = resolve(state);
  assert.deepEqual(longGame.playerCards.map(c => c.energy), ['1', '2']);
  assert.deepEqual(longGame.recoveryEvent.recovered, { left: 0, right: 0 });
  assert.match(longGame.recoveryEvent.reason, /7 punts/);
  state.score.right.games = 5;
  const set = resolve(state);
  assert.equal(set.score.right.sets, 1);
  assert.deepEqual(set.recoveryEvent.recovered, { left: 2, right: 1 });
  assert.equal(set.recoveryEvent.context, 'Fi de set');
  state.score.tieBreak = true;
  state.score.right.tieBreakPoints = 6;
  const tieBreak = resolve(state);
  assert.equal(tieBreak.score.right.sets, 1);
  assert.deepEqual(tieBreak.recoveryEvent.recovered, { left: 2, right: 1 });
});

test('local and shared recovery notices show once and survive state synchronization', () => {
  const document = createGameDOM();
  const context = vm.createContext({ document, URLSearchParams,
    localStorage: { getItem: () => null, setItem() {} },
    window: { location: { search: '' }, addEventListener() {}, matchMedia: () => ({ matches: true }) },
  });
  vm.runInContext(readFileSync('versio-nova/script.js', 'utf8'), context);
  const dialog = document.getElementById('recovery-dialog');
  const initial = beforeGamePoint();
  context.restoreGame(structuredClone(initial));
  context.resolveHit();
  assert.equal(dialog.open, true);
  assert.match(document.getElementById('recovery-dialog-message').textContent, /Ferran: \+2/);
  assert.match(document.getElementById('recovery-dialog-message').textContent, /Joan Albert: \+1/);
  dialog.close();
  context.restoreGame(initial);
  const next = resolve(initial);
  context.restoreGame(next, { notifyRecovery: true });
  assert.equal(dialog.open, true);
  dialog.close();
  context.restoreGame(next, { notifyRecovery: true });
  assert.equal(dialog.open, false, 'polling must not reopen an acknowledged notice');
  assert.match(document.getElementById('recovery-status').textContent, /Ferran \+2/);
  context.restoreGame(initial);
  context.restoreGame(next);
  assert.equal(dialog.open, false, 'loading an existing match must not show an old notification');
});
