import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createGameDOM } from '../server/game-dom.mjs';
import { runGame } from '../.generated/game-engine.mjs';

function opponent({ phase = 'serve', random = 0.8, rolls = [0,0,0,0], energy = 5, difficulty = 1 } = {}) {
  const document = createGameDOM();
  const callbacks = new Map();
  for (const id of ['computer-dialog','setup-dialog','recovery-dialog']) {
    document.getElementById(id).addEventListener = (type, callback) => callbacks.set(`${id}:${type}`, callback);
  }
  const timers = [];
  const context = vm.createContext({ document, URLSearchParams,
    Math: Object.assign(Object.create(Math), { random: () => random }),
    setTimeout: callback => { timers.push(callback); return timers.length; },
    localStorage: { getItem: () => null, setItem() {} },
    window: { location: { search: '' }, addEventListener() {}, matchMedia: () => ({ matches: true }) }
  });
  vm.runInContext(readFileSync('versio-nova/script.js', 'utf8'), context);
  const state = runGame(null, null, { initialServer: 'right' });
  state.score.mode = 'computer';
  state.turn.phase = phase;
  state.ballValue = difficulty;
  state.playerCards[1].energy = String(energy);
  context.restoreGame(state);
  document.getElementById('setup-dialog').close();
  context.rollFourFate = () => ({ rolls: [...rolls], total: rolls.reduce((a,b) => a+b,0), symbolsText: rolls.join(',') });
  vm.runInContext(readFileSync('versio-nova/computer.js', 'utf8'), context);
  const next = () => { const callback = timers.shift(); if (callback) callback(); };
  const continueTurn = () => {
    document.getElementById('computer-dialog').close();
    callbacks.get('computer-dialog:close')();
  };
  return { context, document, next, continueTurn, timers };
}

test('computer varies serve risk, uses real dice, explains its turn and waits for Continue', () => {
  for (const random of [0.1, 0.8]) {
    const game = opponent({ random, rolls: [1,1,0,0] });
    game.next();
    const state = game.context.getGameState();
    assert.equal(state.turn.activeSide, 'left');
    assert.equal(state.score.computerReportPending, true);
    assert.equal(game.document.getElementById('computer-dialog').open, true);
    assert.match(state.score.computerReport, /Daus: \+1, \+1, 0, 0/);
    assert.match(state.score.computerReport, random < 0.35 ? /arriscada/ : /prudent/);
    assert.equal(state.ballValue, random < 0.35 ? 3 : 1);
    assert.match(state.score.computerReport, /Després del cop/);
    game.continueTurn();
    assert.equal(game.context.getGameState().score.computerReportPending, false);
    assert.equal(game.timers.length, 0);
  }
});

test('failed first serve pauses before second serve; double fault awards the human a point', () => {
  const game = opponent({ rolls: [-1,-1,-1,-1], energy: 0 });
  game.next();
  assert.equal(game.context.getGameState().turn.serveAttempt, 2);
  assert.match(game.context.getGameState().score.computerReport, /Falta de primer saque/);
  assert.equal(game.timers.length, 0);
  game.continueTurn(); game.next();
  assert.equal(game.context.getGameState().score.left.points, 1);
  assert.match(game.context.getGameState().score.computerReport, /punt és teu/);
  assert.equal(game.timers.length, 0);
});

test('computer rescues a return with energy and reports the improvement', () => {
  const game = opponent({ phase: 'return', difficulty: 4, rolls: [-1,0,0,1], energy: 1 });
  const state = JSON.parse(JSON.stringify(game.context.getGameState()));
  state.turn.ballPlaced = true;
  state.ballPosition = { left: '8%', top: '25%' };
  game.context.restoreGame(state);
  game.next();
  const result = game.context.getGameState();
  assert.equal(result.playerCards[1].energy, '0');
  assert.equal(result.turn.activeSide, 'left');
  assert.match(result.score.computerReport, /Gasta 1 d’energia/);
  assert.match(result.score.computerReport, /Cop vàlid/);
});

test('computer cannot reach an unaffordable ball and cannot spend nonexistent energy', () => {
  const game = opponent({ phase: 'return', energy: 0 });
  const state = JSON.parse(JSON.stringify(game.context.getGameState()));
  state.ballPosition = { left: '58%', top: '25%' };
  game.context.restoreGame(state);
  game.next();
  const result = game.context.getGameState();
  assert.equal(result.score.left.points, 1);
  assert.match(result.score.computerReport, /No pot arribar/);
  assert.equal(result.playerCards[1].energy, '0');
});

test('reloaded reports survive, and computer does not act in shared or two-person matches', () => {
  const game = opponent();
  const state = JSON.parse(JSON.stringify(game.context.getGameState()));
  state.score.computerReport = 'Torn anterior'; state.score.computerReportPending = true;
  game.context.restoreGame(state);
  assert.equal(game.document.getElementById('computer-dialog').open, true);
  for (const mode of ['local', 'computer']) {
    state.score.mode = mode; state.score.computerReportPending = false;
    game.context.window.multiplayer = { active: mode === 'computer', canAct: () => false };
    game.context.restoreGame(state);
    const before = JSON.stringify(game.context.getGameState());
    game.context.window.computer.playTurn();
    assert.equal(JSON.stringify(game.context.getGameState()), before);
  }
});

test('return choices, movement and volleys obey the same rules in either orientation', () => {
  for (const orientation of ['horizontal', 'vertical']) for (const random of [0.1, 0.8]) {
    const game = opponent({ phase: 'return', random, rolls: [1,1,1,1] });
    const state = JSON.parse(JSON.stringify(game.context.getGameState()));
    // Computer near the net, incoming ball at its baseline: volley is available.
    state.playerPositions.right = { left: '58%', top: '25%' };
    state.ballPosition = { left: '92%', top: '75%' };
    state.turn.previousShotRow = 1;
    game.context.restoreGame(state);
    game.context.setCourtOrientation(orientation);
    game.next();
    const result = game.context.getGameState();
    assert.equal(result.turn.activeSide, 'left');
    assert.equal(result.turn.phase, 'return');
    assert.equal(result.score.left.points, 0);
    assert.equal(result.score.right.points, 0);
    assert.equal(result.playerCards[1].energy, random < 0.35 ? '4' : '3');
    assert.match(result.score.computerReport, random < 0.35 ? /Intenta una volea/ : /S’apropa a la pilota/);
    assert.match(result.score.computerReport, /Envia la pilota/);
    assert.match(result.score.computerReport, /Cop vàlid/);
    assert.ok(parseFloat(result.ballPosition.left) < 50);
    assert.ok(parseFloat(result.playerPositions.right.left) > 50);
  }
});
