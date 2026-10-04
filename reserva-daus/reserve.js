// Independent rules and saved state for the consumable-dice edition.
const reserve = {
  pools: { left: [], right: [] }, selected: { left: null, right: null },
  batches: { left: 0, right: 0 }, fatigue: { left: 0, right: 0 }, notice: '', lossId: 0
};

function refillReserve(side, renewed = false) {
  reserve.pools[side] = rollFourFate().rolls;
  reserve.selected[side] = null;
  reserve.batches[side]++;
  if (renewed) reserve.fatigue[side]++;
}

function resetReserves() {
  reserve.fatigue = { left: 0, right: 0 };
  for (const side of ['left', 'right']) refillReserve(side);
}

function ensureReserve(side) {
  if (!reserve.pools[side].some(value => value !== null)) refillReserve(side, reserve.pools[side].length === 4);
}

function restoreReserve(state) {
  if (state.variant !== 'reserve' || !state.reserve) return false;
  for (const side of ['left', 'right']) {
    const pool = state.reserve.pools?.[side];
    if (!Array.isArray(pool) || pool.length !== 4 || pool.some(v => ![-1, 0, 1, null].includes(v))) return false;
  }
  for (const side of ['left', 'right']) {
    reserve.pools[side] = [...state.reserve.pools[side]];
    const index = state.reserve.selected?.[side];
    reserve.selected[side] = Number.isInteger(index) && index >= 0 && index < 4 && reserve.pools[side][index] !== null ? index : null;
    reserve.batches[side] = Number(state.reserve.batches?.[side]) || 1;
    reserve.fatigue[side] = Math.max(0, Math.floor(Number(state.reserve.fatigue?.[side]) || 0));
  }
  reserve.notice = state.reserve.notice || '';
  reserve.lossId = Number(state.reserve.lossId) || 0;
  return true;
}

function reserveStat(side = turn.activeSide, name = activeHitStatName()) {
  return Number(document.querySelector(`.player-card[data-player="${side}"]`)
    .querySelector(`[data-stat-name="${name}"]`).querySelector('.stat-input').value);
}

function chosenDie() {
  const index = reserve.selected[turn.activeSide];
  return Number.isInteger(index) ? reserve.pools[turn.activeSide][index] : null;
}

function dieMaximum(value, side = turn.activeSide, energy = energyForPlayer(side), skill = reserveStat(side)) {
  return skill + (value === -1 && energy > 0 ? 0 : value);
}

function shotModifier(cell, playerCell = getGridCell(activePlayerEl()), side = turn.activeSide) {
  const targetSide = oppositeSide(side);
  const opponent = getGridCell(targetSide === 'left' ? playerLeftEl : playerRightEl);
  const depth = depthFromBaseline(side, playerCell.col);
  const targetDepth = depthFromBaseline(targetSide, cell.col);
  let increase = cell.row !== turn.previousShotRow ? 1 : 0;
  if (targetDepth < depthFromBaseline(targetSide, opponent.col)) increase++;
  if (depth === 0 && targetDepth === 1) increase++;
  if (depth === 0 && targetDepth === 2) increase += 2;
  if (depth === 1 && targetDepth === 2) increase++;
  return increase;
}

function shotDifficulty(cell) {
  return (turn.baseDifficulty ?? ballValue) + shotModifier(cell) + reserve.fatigue[turn.activeSide];
}

function requiredHitTotal(state, side) {
  return ballValue + (state.statName === 'Saque' ? reserve.fatigue[side] : 0);
}

function negativeServe(state) {
  return state.statName === 'Saque' && (state.originalDie ?? state.rolls[0]) === -1;
}

function reserveTargets({ anyDie = false } = {}) {
  if (turn.phase !== 'return' || turn.hitReady || (!turn.ballPlaced && !playerCanReachBall(turn.activeSide))) return [];
  const selected = chosenDie();
  const dice = !anyDie && selected !== null ? [selected] : reserve.pools[turn.activeSide].filter(v => v !== null);
  const maximum = Math.max(...dice.map(value => dieMaximum(value)));
  const start = turn.activeSide === 'left' ? 3 : 0;
  const result = [];
  for (let col = start; col < start + 3; col++) for (let row = 0; row < 2; row++) {
    const cell = { col, row }, difficulty = shotDifficulty(cell);
    result.push({ cell, difficulty, available: maximum >= difficulty });
  }
  return result;
}

function canPlaceReserveBall(cell) {
  return reserveTargets().some(target => cellsMatch(target.cell, cell) && target.available);
}

function selectReserveDie(index) {
  if (window.multiplayer?.dispatch('selectDie', { index })) return;
  if (!Number.isInteger(index) || index < 0 || index > 3 || turn.hitReady || !['serve', 'return'].includes(turn.phase) || reserve.pools[turn.activeSide][index] === null) return;
  // Changing the die restores the incoming ball before recomputing destinations.
  if (turn.phase === 'return' && turn.ballPlaced) {
    ballValue = turn.baseDifficulty;
    setBallToCell(getGridCell(activePlayerEl()));
    turn.ballPlaced = false;
    turn.currentShotRow = null;
    turn.baseDifficulty = null;
    turn.positionModifier = 0;
    renderBallValue();
  }
  reserve.selected[turn.activeSide] = index;
  updateHitButtons(); updateTurnUI(); saveGame();
}

function settleReserveTurn() {
  if (turn.phase !== 'return' || turn.hitReady) return;
  const targets = reserveTargets({ anyDie: true });
  if (targets.length && !targets.some(target => target.available)) {
    reserve.notice = `${getPlayerLabel(turn.activeSide)} no pot enviar la pilota a cap casella amb els daus i l’energia disponibles. Punt per a ${getPlayerLabel(oppositeSide(turn.activeSide))}.`;
    reserve.lossId++;
    awardPoint(oppositeSide(turn.activeSide));
    updateScoreUI();
    resetCourtAfterPoint();
    saveGame();
  }
}

function renderReserve() {
  const computerTurn = window.computer?.ownsTurn();
  const onlineLocked = window.multiplayer?.active && !window.multiplayer.canAct();
  for (const side of ['left', 'right']) {
    const box = document.getElementById(`reserve-${side}`);
    box.replaceChildren();
    const title = document.createElement('strong');
    const remaining = reserve.pools[side].filter(value => value !== null).length;
    title.textContent = `${getPlayerLabel(side)} · ${remaining}/4 daus disponibles · Fatiga +${reserve.fatigue[side]}`;
    box.append(title);
    const dice = document.createElement('div'); dice.className = 'reserve-dice';
    reserve.pools[side].forEach((value, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = value === null ? 'reserve-die spent' : 'reserve-die';
      button.textContent = value === null ? 'Gastat' : value === 1 ? '+1' : String(value);
      button.setAttribute('aria-label', `${getPlayerLabel(side)}, dau ${index + 1}: ${value === null ? 'gastat' : button.textContent}`);
      button.setAttribute('aria-pressed', String(reserve.selected[side] === index));
      button.disabled = value === null || side !== turn.activeSide || turn.hitReady || !['serve', 'return'].includes(turn.phase) || Boolean(computerTurn || onlineLocked || matchWinner());
      button.addEventListener('click', () => selectReserveDie(index));
      dice.append(button);
    });
    box.append(dice);
    const status = document.createElement('p');
    status.className = 'reserve-count';
    status.textContent = remaining === 4
      ? reserve.fatigue[side] === 0 ? 'Punt nou: reserva de 4 daus.' : 'Reserva renovada després de gastar els 4 daus.'
      : `${4 - remaining} gastat${remaining === 3 ? '' : 's'} · ${remaining} restant${remaining === 1 ? '' : 's'}. Els daus gastats no es poden tornar a jugar.`;
    box.append(status);
  }
  document.getElementById('reserve-notice').textContent = reserve.notice;
  const targets = document.getElementById('reserve-targets');
  targets.replaceChildren();
  for (const target of reserveTargets()) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `reserve-target ${target.available ? 'available' : 'unavailable'}`;
    const vertical = court.dataset.orientation === 'vertical';
    button.style.left = `${vertical ? (1 - target.cell.row) * 50 : target.cell.col / 6 * 100}%`;
    button.style.top = `${vertical ? target.cell.col / 6 * 100 : target.cell.row * 50}%`;
    button.style.width = vertical ? '50%' : `${100 / 6}%`;
    button.style.height = vertical ? `${100 / 6}%` : '50%';
    button.textContent = `${target.available ? '' : '× '}D${target.difficulty}`;
    button.setAttribute('aria-label', `Casella ${target.cell.col + 1}, fila ${target.cell.row + 1}: dificultat ${target.difficulty}${target.available ? '' : ', impossible'}`);
    button.disabled = !target.available || Boolean(computerTurn || onlineLocked);
    button.addEventListener('click', () => {
      if (window.multiplayer?.dispatch('placeBall', { cell: target.cell })) return;
      placeShotBall(target.cell); saveGame();
    });
    targets.append(button);
  }
  const help = document.getElementById('reserve-help');
  help.textContent = turn.phase === 'reposition' ? 'Cop resolt. Tria el moviment gratuït o queda’t al lloc.'
    : turn.phase === 'finished' ? 'Partit acabat. Pots començar una nova partida.'
    : turn.hitReady ? 'Dau gastat. Revisa el resultat i prem Resoldre.'
    : turn.phase === 'serve' ? 'Tria un dau: el −1 és sempre falta de servei i no es pot corregir amb energia. Cal igualar la dificultat més la fatiga.'
    : chosenDie() === null ? 'Tria un dau de la teva reserva. Les caselles indiquen la dificultat (D); × vol dir impossible.'
      : `Dau triat: ${chosenDie() > 0 ? '+' : ''}${chosenDie()}. Les caselles disponibles ja compten l’energia per anul·lar un −1.`;
}

function initializeReserveUI() {
  renderReserve();
}
