import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = await readFile(new URL('../versio-nova/script.js', import.meta.url), 'utf8');
await mkdir(new URL('../.generated/', import.meta.url), { recursive: true });
const prefix = `import { createGameDOM } from '../server/game-dom.mjs';
export function runGame(state, action, config = {}) {
const document = createGameDOM();
const window = { addEventListener() {}, location: { search: '' }, matchMedia: () => ({ matches: true }) };
const localStorage = { getItem: () => null, setItem() {} };
`;
const suffix = `
if (state) {
  if (!restoreGame(state)) throw new Error('Estat de partida no vàlid.');
  setupDialog.close();
} else {
  initialServerInput.value = config.initialServer === 'right' ? 'right' : 'left';
  matchBestOfInput.value = String([1,3,5].includes(config.bestOf) ? config.bestOf : 3);
  nameLeftInput.value = String(config.leftName || 'Ferran').slice(0,40);
  nameRightInput.value = String(config.rightName || 'Joan Albert').slice(0,40);
  startNewGame({ preventDefault() {} });
}
const requireRule = (allowed) => { if (!allowed) throw new Error('Aquesta acció no està disponible ara.'); };
if (action) {
  requireRule(!matchWinner());
  const pendingHit = lastHitSide && hitStateByPlayer[lastHitSide];
  const beforeShot = turn.phase === 'return' && !turn.ballPlaced && !turn.hitReady;
  switch (action.type) {
    case 'serveDifficulty':
      requireRule(turn.phase === 'serve' && !turn.ballPlaced && Number.isInteger(action.value) && action.value >= 1 && action.value <= 99);
      serveDifficultyInput.value = String(action.value); setServeDifficulty(); break;
    case 'move':
      requireRule(beforeShot && !playerCanReachBall(turn.activeSide) && movementCost() <= energyForPlayer(turn.activeSide));
      acceptMovement(); break;
    case 'renounce':
      requireRule(beforeShot && !playerCanReachBall(turn.activeSide)); renounceMovement(); break;
    case 'volley':
      requireRule(canAttemptVolley()); attemptVolley(); break;
    case 'placeBall': {
      const cell = action.cell;
      requireRule(turn.phase === 'return' && !pendingHit?.forcedError &&
        (turn.ballPlaced || playerCanReachBall(turn.activeSide)) && cell &&
        Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.col <= 5 && cell.row >= 0 && cell.row <= 1 &&
        (cell.col < 3 ? 'left' : 'right') !== turn.activeSide);
      placeShotBall(cell); break;
    }
    case 'hit': requireRule(!hitActionBtn.disabled); handleHit(); break;
    case 'removeMinus':
      requireRule(turn.hitReady && lastHitSide === turn.activeSide && canRescueHit(pendingHit, turn.activeSide));
      handleRemoveMinus({currentTarget: {closest: () => document.querySelector('.player-card[data-player="' + turn.activeSide + '"]')}}); break;
    case 'resolve': requireRule(turn.hitReady && pendingHit && !pendingHit.resolved); resolveHit(); break;
    case 'reposition':
      requireRule(turn.phase === 'reposition' && postHitDestination(action.colStep, action.rowStep));
      finishPostHitMovement(action.colStep, action.rowStep); break;
    default: throw new Error('Acció desconeguda.');
  }
}
return JSON.parse(JSON.stringify(getGameState()));
}
`;
await writeFile(new URL('../.generated/game-engine.mjs', import.meta.url), prefix + source + suffix);

const reserveRules = await readFile(new URL('../reserva-daus/reserve.js', import.meta.url), 'utf8');
const reserveSource = await readFile(new URL('../reserva-daus/script.js', import.meta.url), 'utf8');
const reserveSuffix = suffix
  .replace("case 'serveDifficulty':", `case 'selectDie':
      requireRule(['serve', 'return'].includes(turn.phase) && !turn.hitReady && Number.isInteger(action.index) &&
        action.index >= 0 && action.index < 4 && reserve.pools[turn.activeSide][action.index] !== null);
      selectReserveDie(action.index); break;
    case 'serveDifficulty':`)
  .replace('placeShotBall(cell); break;', 'requireRule(canPlaceReserveBall(cell)); placeShotBall(cell); break;');
await writeFile(new URL('../.generated/reserve-engine.mjs', import.meta.url), prefix + reserveRules + '\n' + reserveSource + reserveSuffix);
