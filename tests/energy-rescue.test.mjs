import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createGameDOM } from '../server/game-dom.mjs';
import { runGame } from '../.generated/game-engine.mjs';

function hit({ rolls = [-1, 0, 0, 1], energy = 5, difficulty = 4 } = {}) {
  const document = createGameDOM();
  const context = vm.createContext({ document, URLSearchParams,
    localStorage: { getItem: () => null, setItem() {} },
    window: { location: { search: '' }, addEventListener() {}, matchMedia: () => ({ matches: true }) },
  });
  vm.runInContext(readFileSync('versio-nova/script.js', 'utf8'), context);
  const state = runGame(null, null);
  state.turn = { ...state.turn, phase: 'return', activeSide: 'left', ballPlaced: true, hitReady: false };
  state.ballValue = difficulty;
  state.playerCards[0].energy = String(energy);
  context.restoreGame(state);
  context.rollFourFate = () => ({ rolls, total: rolls.reduce((sum, value) => sum + value, 0), symbolsText: '' });
  context.handleHit();
  return { context, document, state: JSON.parse(JSON.stringify(context.getGameState())) };
}
const action = (state, type) => runGame(structuredClone(state), { type });

test('a failed return can be saved with one negative die and energy, locally and on the server', () => {
  const { context, document, state } = hit({ energy: 1 });
  assert.equal(state.hitStateByPlayer.left.forcedError, false);
  assert.equal(document.getElementById('hit-panel-remove').hidden, false);
  assert.equal(document.getElementById('hit-panel-remove').disabled, false);
  context.handleRemoveMinus({ currentTarget: { closest: () => document.querySelector('.player-card[data-player="left"]') } });
  context.resolveHit();
  assert.equal(context.getGameState().turn.phase, 'reposition');
  assert.equal(context.getGameState().ballValue, 3);
  const waiting = action(state, 'resolve');
  assert.equal(waiting.hitStateByPlayer.left.resolved, false);
  assert.deepEqual(waiting.score, state.score);
  const improved = action(waiting, 'removeMinus');
  assert.equal(improved.playerCards[0].energy, '0');
  assert.deepEqual(improved.hitStateByPlayer.left.rolls, [0, 0, 0, 1]);
  const resolved = action(improved, 'resolve');
  assert.equal(resolved.turn.phase, 'reposition');
  assert.equal(resolved.ballValue, 3);
});

test('saving a return may require several energy points; insufficient energy or dice remains an error', () => {
  const state = hit({ rolls: [-1, -1, 1, 1], energy: 2, difficulty: 5 }).state;
  const first = action(state, 'removeMinus');
  assert.equal(action(first, 'resolve').hitStateByPlayer.left.resolved, false);
  const second = action(first, 'removeMinus');
  assert.equal(action(second, 'resolve').turn.phase, 'reposition');
  assert.equal(second.playerCards[0].energy, '0');
  for (const config of [
    { rolls: [-1, -1, 1, 1], energy: 1, difficulty: 5 },
    { energy: 0 },
    { rolls: [0, 0, 0, 0], energy: 5 },
  ]) {
    const failed = hit(config);
    assert.equal(failed.state.hitStateByPlayer.left.forcedError, true);
    assert.equal(failed.document.getElementById('hit-panel-remove').hidden, true);
    assert.throws(() => action(failed.state, 'removeMinus'));
    assert.equal(action(failed.state, 'resolve').score.right.points, 1);
  }
});

test('existing saved matches with the old forced-error flag can also be rescued', () => {
  const { context, document, state } = hit();
  state.hitStateByPlayer.left.forcedError = true;
  state.hitStateByPlayer.left.outcome = 'Tir erroni. Prem Resoldre.';
  context.restoreGame(structuredClone(state));
  assert.equal(context.getGameState().hitStateByPlayer.left.forcedError, false);
  assert.equal(document.getElementById('hit-panel-remove').disabled, false);
  const rescued = action(state, 'removeMinus');
  assert.equal(rescued.playerCards[0].energy, '4');
  assert.equal(action(rescued, 'resolve').turn.phase, 'reposition');
});

test('improvement is offered only until a failed shot is saved, including serves and restored matches', () => {
  for (const statName of ['Saque', 'Restada', 'General', 'Voleia']) {
    for (const config of [
      { target: 2, energy: 2, visible: false }, // Already valid despite negative dice.
      { target: 3, energy: 2, visible: true },
      { target: 4, energy: 2, visible: true }, // Requires both improvements.
      { target: 4, energy: 1, visible: false },
      { target: 5, energy: 5, visible: false }, // Not enough negative dice.
      { target: 3, energy: 0, visible: false },
    ]) {
      const { context, document, state } = hit();
      state.turn.phase = statName === 'Saque' ? 'serve' : 'return';
      state.ballValue = config.target + (statName === 'Saque' ? 0 : 1);
      state.playerCards[0].energy = String(config.energy);
      state.hitStateByPlayer.left = { statName, statValue: 2, rolls: [-1,-1,1,1], resolved: false, forcedError: false, outcome: '' };
      context.restoreGame(structuredClone(state));
      const button = document.getElementById('hit-panel-remove');
      const card = document.querySelector('.player-card[data-player="left"]');
      assert.equal(button.hidden, !config.visible, `${statName} target ${config.target} energy ${config.energy}`);
      assert.equal(card.querySelector('.remove-minus-btn').disabled, !config.visible);
      if (!config.visible) {
        assert.throws(() => action(state, 'removeMinus'));
        const before = JSON.stringify(context.getGameState());
        context.handleRemoveMinus({ currentTarget: { closest: () => card } });
        assert.equal(JSON.stringify(context.getGameState()), before);
      } else {
        let shared = state;
        for (let i = 0; i < config.target - 2; i++) {
          assert.equal(button.hidden, false);
          context.handleRemoveMinus({ currentTarget: { closest: () => card } });
          shared = action(shared, 'removeMinus');
        }
        assert.equal(button.hidden, true, 'stop offering energy as soon as the shot is safe');
        assert.equal(card.querySelector('.remove-minus-btn').disabled, true);
        assert.throws(() => action(shared, 'removeMinus'));
        assert.equal(action(shared, 'resolve').turn.phase, 'reposition');
      }
    }
  }
});
