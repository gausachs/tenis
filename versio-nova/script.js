const court = document.getElementById('court');
const draggables = document.querySelectorAll('.draggable');
const ballEl = document.getElementById('ball');
const ballValueEl = document.getElementById('ball-value');
const playerLeftEl = document.querySelector('.player-left');
const playerRightEl = document.querySelector('.player-right');
const statInputs = document.querySelectorAll('.stat-input');
const hitResultEls = document.querySelectorAll('.hit-result');
const removeMinusButtons = document.querySelectorAll('.remove-minus-btn');
const playerCards = document.querySelectorAll('.player-card');

const hitPanelPlayerEl = document.getElementById('hit-panel-player');
const hitPanelStatEl = document.getElementById('hit-panel-stat');
const hitPanelDiceEl = document.getElementById('hit-panel-dice');
const hitPanelTotalEl = document.getElementById('hit-panel-total');
const hitPanelRemoveBtn = document.getElementById('hit-panel-remove');
const hitPanelResolveBtn = document.getElementById('hit-panel-resolve');
const hitPanelInfoEl = document.getElementById('hit-panel-info');
const turnStatusEl = document.getElementById('turn-status');
const turnHintEl = document.getElementById('turn-hint');
const moveToBallBtn = document.getElementById('move-to-ball');
const attemptVolleyBtn = document.getElementById('attempt-volley');
const hitActionBtn = document.getElementById('hit-action');
const postHitMovementEl = document.getElementById('post-hit-movement');
const postHitMovementButtons = postHitMovementEl.querySelectorAll('button');
const movementDialog = document.getElementById('movement-dialog');
const movementDialogMessage = document.getElementById('movement-dialog-message');
const movementConfirmBtn = document.getElementById('movement-confirm');
const movementCancelBtn = document.getElementById('movement-cancel');
const serveDifficultyControlEl = document.getElementById('serve-difficulty-control');
const serveDifficultyInput = document.getElementById('serve-difficulty');
const newGameBtn = document.getElementById('new-game');
const setupDialog = document.getElementById('setup-dialog');
const setupForm = document.getElementById('setup-form');
const initialServerInput = document.getElementById('initial-server');
const matchBestOfInput = document.getElementById('match-best-of');
const resumeGameBtn = document.getElementById('resume-game');

const diceText = document.getElementById('fate-dice');
const totalText = document.getElementById('fate-total');

const nameLeftInput = document.getElementById('name-left');
const nameRightInput = document.getElementById('name-right');
const scoreNameLeftEl = document.getElementById('score-name-left');
const scoreNameRightEl = document.getElementById('score-name-right');

const setsLeftEl = document.getElementById('sets-left');
const setsRightEl = document.getElementById('sets-right');
const gamesLeftEl = document.getElementById('games-left');
const gamesRightEl = document.getElementById('games-right');
const pointsLeftEl = document.getElementById('points-left');
const pointsRightEl = document.getElementById('points-right');
const matchStatusEl = document.getElementById('match-status');
const recoveryStatusEl = document.getElementById('recovery-status');

let active = null;
let offsetX = 0;
let offsetY = 0;
let movedWhileDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let ballValue = 1;
let dragStartCell = null;
const initialPositions = {
  left: {
    x: Number.parseFloat(playerLeftEl.style.left) || 10,
    y: Number.parseFloat(playerLeftEl.style.top) || 24
  },
  right: {
    x: Number.parseFloat(playerRightEl.style.left) || 90,
    y: Number.parseFloat(playerRightEl.style.top) || 76
  }
};

const score = {
  left: { points: 0, games: 0, sets: 0, tieBreakPoints: 0 },
  right: { points: 0, games: 0, sets: 0, tieBreakPoints: 0 },
  server: 'left',
  initialServer: 'left',
  bestOf: 3,
  configured: false,
  tieBreak: false,
  tieBreakStartServer: null,
  pointsInCurrentGame: 0
};
const hitStateByPlayer = {
  left: null,
  right: null
};
const ballMemory = {
  previousShotRow: null
};
const GAME_STORAGE_KEY = 'tenis-versio-nova-partida-v1';
let lastHitSide = null;
const turn = {
  activeSide: 'left',
  phase: 'serve',
  ballPlaced: false,
  hitReady: false,
  previousShotRow: null,
  currentShotRow: null,
  baseDifficulty: null,
  positionModifier: 0,
  playerMoves: 0,
  serveAttempt: 1,
  returningServe: false,
  volley: false
};

function oppositeSide(side) {
  return side === 'left' ? 'right' : 'left';
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function playerCardState(card) {
  return {
    side: card.dataset.player,
    name: card.querySelector('input[type="text"]')?.value || '',
    stats: Array.from(card.querySelectorAll('.stat-input')).map((input) => input.value),
    energy: card.querySelector('.energy-input')?.value || '',
    maxEnergy: card.querySelector('.stat-max')?.value || '',
    recoveryPercent: card.querySelector('.recovery-factor')?.value ?? '50'
  };
}

function getGameState() {
    return {
      score,
      turn,
      ballMemory,
      ballValue,
      lastHitSide,
      hitStateByPlayer,
      playerPositions: {
        left: { left: playerLeftEl.style.left, top: playerLeftEl.style.top },
        right: { left: playerRightEl.style.left, top: playerRightEl.style.top }
      },
      ballPosition: { left: ballEl.style.left, top: ballEl.style.top },
      serveDifficulty: serveDifficultyInput.value,
      playerCards: Array.from(playerCards).map(playerCardState)
    };
}

function saveGame() {
  if (!score.configured || setupDialog.open || window.multiplayer?.active) return;
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(getGameState()));
  } catch {
    // Saving is optional when browser storage is unavailable.
  }
}

function restoreGame(sharedState = null) {
  try {
    const rawState = sharedState ? null : localStorage.getItem(GAME_STORAGE_KEY);
    if (!sharedState && !rawState) return false;
    const state = sharedState || JSON.parse(rawState);
    if (!state.score || !state.turn || !state.playerPositions || !state.ballPosition) return false;

    Object.assign(score.left, state.score.left || {});
    Object.assign(score.right, state.score.right || {});
    Object.assign(score, {
      server: state.score.server || 'left',
      initialServer: state.score.initialServer === 'right' ? 'right' : 'left',
      bestOf: [1, 3, 5].includes(state.score.bestOf) ? state.score.bestOf : 3,
      configured: Boolean(state.score.configured),
      tieBreak: Boolean(state.score.tieBreak),
      tieBreakStartServer: state.score.tieBreakStartServer || null,
      pointsInCurrentGame: state.score.pointsInCurrentGame || 0
    });
    Object.assign(turn, state.turn);
    Object.assign(ballMemory, state.ballMemory || {});
    ballValue = Number.isFinite(state.ballValue) ? state.ballValue : 1;
    lastHitSide = state.lastHitSide || null;
    hitStateByPlayer.left = state.hitStateByPlayer?.left || null;
    hitStateByPlayer.right = state.hitStateByPlayer?.right || null;

    playerLeftEl.style.left = state.playerPositions.left.left;
    playerLeftEl.style.top = state.playerPositions.left.top;
    playerRightEl.style.left = state.playerPositions.right.left;
    playerRightEl.style.top = state.playerPositions.right.top;
    ballEl.style.left = state.ballPosition.left;
    ballEl.style.top = state.ballPosition.top;
    serveDifficultyInput.value = state.serveDifficulty || '1';

    state.playerCards?.forEach((savedCard) => {
      const card = document.querySelector(`.player-card[data-player="${savedCard.side}"]`);
      if (!card) return;
      const nameInput = card.querySelector('input[type="text"]');
      if (nameInput) nameInput.value = savedCard.name || '';
      const savedStats = savedCard.stats?.length === 5
        ? [savedCard.stats[0], savedCard.stats[1], savedCard.stats[2], savedCard.stats[4]]
        : savedCard.stats;
      card.querySelectorAll('.stat-input').forEach((input, index) => {
        input.value = savedStats?.[index] || input.value;
      });
      const energyInput = card.querySelector('.energy-input');
      const maxInput = card.querySelector('.stat-max');
      const recoveryInput = card.querySelector('.recovery-factor');
      if (energyInput) energyInput.value = savedCard.energy || energyInput.value;
      if (maxInput) maxInput.value = savedCard.maxEnergy || maxInput.value;
      if (recoveryInput) recoveryInput.value = savedCard.recoveryPercent ?? '50';
    });

    renderBallValue();
    updatePointButtons();
    updateScoreUI();
    updateHitButtons();
    updateHitPanelForPlayer(lastHitSide || 'left');
    updateTurnUI();
    return true;
  } catch {
    return false;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function boundsFor(element, courtRect) {
  const rect = element.getBoundingClientRect();
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;

  let minX = halfW;
  let maxX = courtRect.width - halfW;
  const minY = halfH;
  const maxY = courtRect.height - halfH;

  if (element.dataset.type === 'player') {
    if (element.dataset.side === 'left') {
      maxX = courtRect.width / 2 - halfW;
    } else {
      minX = courtRect.width / 2 + halfW;
    }
  }

  return { minX, maxX, minY, maxY };
}

function snapToGrid(element, courtRect) {
  const limits = boundsFor(element, courtRect);
  const rect = element.getBoundingClientRect();
  let centerX = rect.left - courtRect.left + rect.width / 2;
  let centerY = rect.top - courtRect.top + rect.height / 2;

  const cols = element.dataset.type === 'ball' ? 6 : 3;
  const rows = 2;

  const width = limits.maxX - limits.minX;
  const height = limits.maxY - limits.minY;
  const cellW = width / cols;
  const cellH = height / rows;

  let colIndex = Math.round((centerX - limits.minX) / cellW - 0.5);
  let rowIndex = Math.round((centerY - limits.minY) / cellH - 0.5);

  colIndex = clamp(colIndex, 0, cols - 1);
  rowIndex = clamp(rowIndex, 0, rows - 1);

  centerX = limits.minX + (colIndex + 0.5) * cellW;
  centerY = limits.minY + (rowIndex + 0.5) * cellH;

  if (element.dataset.type === 'ball') {
    const ballCellKey = `${colIndex},${rowIndex}`;
    const playerCells = [playerLeftEl, playerRightEl]
      .map((player) => {
        const playerRect = player.getBoundingClientRect();
        const px = playerRect.left - courtRect.left + playerRect.width / 2;
        const py = playerRect.top - courtRect.top + playerRect.height / 2;
        const pLimits = boundsFor(player, courtRect);
        const pCols = 3;
        const pRows = 2;
        const pCellW = (pLimits.maxX - pLimits.minX) / pCols;
        const pCellH = (pLimits.maxY - pLimits.minY) / pRows;
        let pCol = Math.round((px - pLimits.minX) / pCellW - 0.5);
        let pRow = Math.round((py - pLimits.minY) / pCellH - 0.5);
        pCol = clamp(pCol, 0, pCols - 1);
        pRow = clamp(pRow, 0, pRows - 1);
        const globalCol = player.dataset.side === 'left' ? pCol : pCol + 3;
        return `${globalCol},${pRow}`;
      })
      .filter(Boolean);

    if (playerCells.includes(ballCellKey)) {
      const nudgeX = Math.min(12, cellW * 0.25);
      const nudgeY = Math.min(10, cellH * 0.25);
      centerX += nudgeX;
      centerY -= nudgeY;
    }
  }

  centerX = clamp(centerX, limits.minX, limits.maxX);
  centerY = clamp(centerY, limits.minY, limits.maxY);

  element.style.left = `${(centerX / courtRect.width) * 100}%`;
  element.style.top = `${(centerY / courtRect.height) * 100}%`;
}

function getPlayerDepthFromBaseline(playerEl, courtRect) {
  const limits = boundsFor(playerEl, courtRect);
  const rect = playerEl.getBoundingClientRect();
  const centerX = rect.left - courtRect.left + rect.width / 2;
  const cols = 3;
  const cellW = (limits.maxX - limits.minX) / cols;
  let colIndex = Math.round((centerX - limits.minX) / cellW - 0.5);
  colIndex = clamp(colIndex, 0, cols - 1);

  return playerEl.dataset.side === 'left' ? colIndex : cols - 1 - colIndex;
}

function getGridCell(element, courtRect = court.getBoundingClientRect()) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left - courtRect.left + rect.width / 2;
  const centerY = rect.top - courtRect.top + rect.height / 2;

  if (element.dataset.type === 'player') {
    const limits = boundsFor(element, courtRect);
    const cellW = (limits.maxX - limits.minX) / 3;
    const cellH = (limits.maxY - limits.minY) / 2;
    const localCol = clamp(Math.round((centerX - limits.minX) / cellW - 0.5), 0, 2);
    const row = clamp(Math.round((centerY - limits.minY) / cellH - 0.5), 0, 1);
    return { col: element.dataset.side === 'left' ? localCol : localCol + 3, row };
  }

  const limits = boundsFor(element, courtRect);
  const cellW = (limits.maxX - limits.minX) / 6;
  const cellH = (limits.maxY - limits.minY) / 2;
  return {
    col: clamp(Math.round((centerX - limits.minX) / cellW - 0.5), 0, 5),
    row: clamp(Math.round((centerY - limits.minY) / cellH - 0.5), 0, 1)
  };
}

function cellsMatch(first, second) {
  return first.col === second.col && first.row === second.row;
}

function depthFromBaseline(side, col) {
  return side === 'left' ? col : 5 - col;
}

function setBallToCell(cell) {
  const courtRect = court.getBoundingClientRect();
  const matchingPlayer = [playerLeftEl, playerRightEl].find((player) =>
    cellsMatch(getGridCell(player, courtRect), cell)
  );
  const xOffset = matchingPlayer
    ? (matchingPlayer.dataset.side === 'left' ? 3 : -3)
    : 0;
  const yOffset = matchingPlayer ? -6 : 0;

  ballEl.style.left = `${((cell.col + 0.5) / 6) * 100 + xOffset}%`;
  ballEl.style.top = `${((cell.row + 0.5) / 2) * 100 + yOffset}%`;
}

function setPlayerToCell(player, cell, courtRect) {
  const limits = boundsFor(player, courtRect);
  const localCol = player.dataset.side === 'left' ? cell.col : cell.col - 3;
  const cellW = (limits.maxX - limits.minX) / 3;
  const cellH = (limits.maxY - limits.minY) / 2;
  const centerX = limits.minX + (localCol + 0.5) * cellW;
  const centerY = limits.minY + (cell.row + 0.5) * cellH;

  player.style.left = `${(centerX / courtRect.width) * 100}%`;
  player.style.top = `${(centerY / courtRect.height) * 100}%`;
}

function activePlayerEl() {
  return turn.activeSide === 'left' ? playerLeftEl : playerRightEl;
}

function playerCanReachBall(side) {
  if (side !== turn.activeSide) return false;
  const courtRect = court.getBoundingClientRect();
  const player = side === 'left' ? playerLeftEl : playerRightEl;
  return cellsMatch(getGridCell(player, courtRect), getGridCell(ballEl, courtRect));
}

function energyForPlayer(side) {
  const playerCard = document.querySelector(`.player-card[data-player="${side}"]`);
  const energyInput = playerCard?.querySelector('.energy-input');
  return Math.max(0, Number.parseInt(energyInput?.value, 10) || 0);
}

function spendPlayerEnergy(side, amount) {
  const playerCard = document.querySelector(`.player-card[data-player="${side}"]`);
  const energyInput = playerCard?.querySelector('.energy-input');
  if (!energyInput) return;
  energyInput.value = Math.max(0, energyForPlayer(side) - amount).toString();
}

function recoverPlayerEnergy(side, amount) {
  const playerCard = document.querySelector(`.player-card[data-player="${side}"]`);
  const energyInput = playerCard?.querySelector('.energy-input');
  const maxInput = playerCard?.querySelector('.stat-max');
  if (!energyInput || !maxInput) return;

  const maximum = Math.max(0, Number.parseInt(maxInput.value, 10) || 0);
  energyInput.value = Math.min(maximum, energyForPlayer(side) + amount).toString();
}

function distanceToBall(side) {
  const courtRect = court.getBoundingClientRect();
  const player = side === 'left' ? playerLeftEl : playerRightEl;
  const playerCell = getGridCell(player, courtRect);
  const ballCell = getGridCell(ballEl, courtRect);
  return Math.abs(playerCell.col - ballCell.col) + Math.abs(playerCell.row - ballCell.row);
}

function awardPointForUnreachableBall() {
  const pointWinner = oppositeSide(turn.activeSide);
  awardPoint(pointWinner);
  updateScoreUI();
  resetCourtAfterPoint();
}

function movementCost() {
  return Math.max(0, distanceToBall(turn.activeSide) - 1);
}

function canAttemptVolley() {
  if (matchWinner() || turn.phase !== 'return' || turn.ballPlaced || turn.hitReady || turn.volley) return false;
  if (energyForPlayer(turn.activeSide) < 1) return false;
  const playerCell = getGridCell(activePlayerEl());
  const ballCell = getGridCell(ballEl);
  const ballSide = ballCell.col < 3 ? 'left' : 'right';
  return ballSide === turn.activeSide &&
    depthFromBaseline(turn.activeSide, ballCell.col) < depthFromBaseline(turn.activeSide, playerCell.col);
}

function volleyDifficultyIncrease() {
  return Math.floor(distanceToBall(turn.activeSide) / 2);
}

function attemptVolley() {
  if (window.multiplayer?.dispatch('volley')) return;
  if (!canAttemptVolley()) return;
  const difficultyIncrease = volleyDifficultyIncrease();
  spendPlayerEnergy(turn.activeSide, 1);
  setBallToCell(getGridCell(activePlayerEl()));
  ballValue += difficultyIncrease;
  turn.volley = true;
  renderBallValue();
  updateHitButtons();
  updateTurnUI();
  saveGame();
}

function openMovementDialog() {
  const steps = distanceToBall(turn.activeSide);
  const energyCost = movementCost();
  const energy = energyForPlayer(turn.activeSide);
  const label = getPlayerLabel(turn.activeSide);
  const canReach = energyCost <= energy;

  movementDialogMessage.textContent = canReach
    ? `${label} farà ${steps} moviment(s): dificultat +${steps} i energia -${energyCost}. Vols continuar?`
    : `${label} necessita ${energyCost} d'energia i només en té ${energy}. No pot arribar a la pilota.`;
  movementConfirmBtn.disabled = !canReach;
  movementDialog.showModal();
}

function acceptMovement() {
  if (window.multiplayer?.dispatch('move')) return;
  const steps = distanceToBall(turn.activeSide);
  const energyCost = movementCost();
  if (energyCost > energyForPlayer(turn.activeSide)) return;

  const courtRect = court.getBoundingClientRect();
  const player = activePlayerEl();
  const ballCell = getGridCell(ballEl, courtRect);
  setPlayerToCell(player, ballCell, courtRect);
  setBallToCell(ballCell);
  turn.playerMoves = steps;
  spendPlayerEnergy(turn.activeSide, energyCost);
  ballValue += steps;
  renderBallValue();
  movementDialog.close();
  updateHitButtons();
  updateTurnUI();
}

function renounceMovement() {
  if (window.multiplayer?.dispatch('renounce')) return;
  if (movementDialog.open) movementDialog.close();
  recoverPlayerEnergy(turn.activeSide, 1);
  const pointWinner = oppositeSide(turn.activeSide);
  awardPoint(pointWinner);
  updateScoreUI();
  resetCourtAfterPoint();
}

function updateTurnUI() {
  const label = getPlayerLabel(turn.activeSide);
  const forcedError = lastHitSide && hitStateByPlayer[lastHitSide]?.forcedError;
  const serveLabel = turn.serveAttempt === 2 ? 'Segon saque' : 'Primer saque';
  const action = turn.phase === 'serve' ? 'ha de fer el saque' : 'ha de tornar la pilota';
  turnStatusEl.textContent = turn.phase === 'serve'
    ? `Actiu: ${label} · ${serveLabel}`
    : `Actiu: ${label}`;
  serveDifficultyControlEl.hidden = turn.phase !== 'serve';
  serveDifficultyInput.disabled = turn.phase !== 'serve' || turn.ballPlaced;

  if (matchWinner()) {
    turnStatusEl.textContent = `Partida acabada · Guanya ${getPlayerLabel(matchWinner())}`;
    turnHintEl.textContent = 'Prem Nova partida per tornar a jugar.';
  } else if (turn.phase === 'reposition') {
    turnHintEl.textContent = `${label}: cop vàlid. Pots moure't una casella ortogonal sense cost o quedar-te al lloc.`;
  } else if (!turn.ballPlaced && !playerCanReachBall(turn.activeSide)) {
    turnHintEl.textContent = canAttemptVolley()
      ? `${label}: la pilota és darrere teu. Pots apropar-t'hi o intentar una volea sense moure't (dificultat +${volleyDifficultyIncrease()}, energia -1).`
      : `${label} ${action}: decideix si vols apropar-lo a la pilota.`;
  } else if (!turn.ballPlaced) {
    turnHintEl.textContent = turn.phase === 'serve'
      ? `${label}: posa el valor a aconseguir i prem Saque. La pilota es mourà automàticament.`
      : turn.volley
        ? `${label}: volea preparada. Envia la pilota al camp contrari i colpeja amb Voleia.`
        : `${label} és a la pilota: envia-la al camp contrari.`;
  } else if (!turn.hitReady) {
    turnHintEl.textContent = `${label}: ara escull el colpeig.`;
  } else if (forcedError) {
    turnHintEl.textContent = 'Tir erroni: només pots resoldre el colpeig.';
  } else if (turn.phase === 'serve') {
    turnHintEl.textContent = `${label}: la pilota és a la posició del rival. Pots millorar el cop o resoldre.`;
  } else {
    turnHintEl.textContent = `${label}: pots ajustar la posició de la pilota o resoldre el colpeig.`;
  }

  playerLeftEl.classList.toggle('active-player', turn.activeSide === 'left');
  playerRightEl.classList.toggle('active-player', turn.activeSide === 'right');
  playerCards.forEach((card) => {
    card.classList.toggle('active-card', card.dataset.player === turn.activeSide);
  });
  moveToBallBtn.hidden = turn.phase === 'reposition' || turn.phase === 'serve' || turn.ballPlaced || playerCanReachBall(turn.activeSide);
  attemptVolleyBtn.hidden = !canAttemptVolley();
  attemptVolleyBtn.textContent = `Intentar volea (+${volleyDifficultyIncrease()} dificultat, -1 energia)`;
  postHitMovementEl.hidden = turn.phase !== 'reposition';
  postHitMovementButtons.forEach((button) => {
    button.disabled = turn.phase !== 'reposition' || !postHitDestination(
      Number(button.dataset.postHitCol), Number(button.dataset.postHitRow)
    );
  });
}

function postHitDestination(colStep, rowStep) {
  if (!Number.isInteger(colStep) || !Number.isInteger(rowStep) ||
      Math.abs(colStep) + Math.abs(rowStep) > 1) return null;
  const cell = getGridCell(activePlayerEl());
  const next = { col: cell.col + colStep, row: cell.row + rowStep };
  const minCol = turn.activeSide === 'left' ? 0 : 3;
  if (next.col < minCol || next.col > minCol + 2 || next.row < 0 || next.row > 1) return null;
  return next;
}

function finishPostHitMovement(colStep, rowStep) {
  if (window.multiplayer?.dispatch('reposition', { colStep, rowStep })) return;
  if (turn.phase !== 'reposition') return;
  const destination = postHitDestination(colStep, rowStep);
  if (!destination) return;
  if (colStep !== 0 || rowStep !== 0) {
    setPlayerToCell(activePlayerEl(), destination, court.getBoundingClientRect());
  }
  const returningServe = hitStateByPlayer[turn.activeSide]?.statName === 'Saque';
  beginTurn(oppositeSide(turn.activeSide), 'return', 1, returningServe);
  saveGame();
}

function beginTurn(side, phase = 'return', serveAttempt = 1, returningServe = false) {
  turn.activeSide = side;
  turn.phase = phase;
  turn.ballPlaced = false;
  turn.hitReady = false;
  turn.previousShotRow = ballMemory.previousShotRow;
  turn.currentShotRow = null;
  turn.baseDifficulty = null;
  turn.positionModifier = 0;
  turn.playerMoves = 0;
  turn.serveAttempt = phase === 'serve' ? serveAttempt : 0;
  turn.returningServe = phase === 'return' && returningServe;
  turn.volley = false;
  updateHitButtons();
  updateTurnUI();

}

function startDrag(event) {
  if (window.multiplayer?.active && !window.multiplayer.canAct()) return;
  if (matchWinner()) return;
  active = event.currentTarget;
  const forcedError = lastHitSide && hitStateByPlayer[lastHitSide]?.forcedError;

  if (
    active.dataset.type === 'player' ||
    (active.dataset.type === 'ball' && (
      forcedError ||
      turn.phase === 'reposition' ||
      turn.phase === 'serve' ||
      (!turn.ballPlaced && !playerCanReachBall(turn.activeSide))
    ))
  ) {
    active = null;
    return;
  }

  active.classList.add('dragging');
  movedWhileDragging = false;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragStartCell = getGridCell(active);

  const itemRect = active.getBoundingClientRect();
  offsetX = event.clientX - itemRect.left;
  offsetY = event.clientY - itemRect.top;

  active.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!active) return;

  const courtRect = court.getBoundingClientRect();
  const limits = boundsFor(active, courtRect);

  let nextX = event.clientX - courtRect.left - offsetX + active.offsetWidth / 2;
  let nextY = event.clientY - courtRect.top - offsetY + active.offsetHeight / 2;

  nextX = clamp(nextX, limits.minX, limits.maxX);
  nextY = clamp(nextY, limits.minY, limits.maxY);

  active.style.left = `${(nextX / courtRect.width) * 100}%`;
  active.style.top = `${(nextY / courtRect.height) * 100}%`;

  const movement = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
  if (movement > 4) {
    movedWhileDragging = true;
  }
}

function endDrag(event) {
  if (!active) return;

  if (movedWhileDragging) {
    const courtRect = court.getBoundingClientRect();
    snapToGrid(active, courtRect);
    if (active.dataset.type === 'player') {
      const desiredCell = getGridCell(active, courtRect);
      const colDistance = desiredCell.col - dragStartCell.col;
      const rowDistance = desiredCell.row - dragStartCell.row;
      const moveHorizontally = Math.abs(colDistance) >= Math.abs(rowDistance);
      const colStep = moveHorizontally ? Math.sign(colDistance) : 0;
      const rowStep = moveHorizontally ? 0 : Math.sign(rowDistance);
      const nextCell = {
        col: dragStartCell.col + colStep,
        row: dragStartCell.row + rowStep
      };

      if (!cellsMatch(nextCell, dragStartCell)) {
        if (turn.playerMoves > 0 && energyForPlayer(turn.activeSide) === 0) {
          awardPointForUnreachableBall();
        } else {
          setPlayerToCell(active, nextCell, courtRect);
          if (cellsMatch(nextCell, getGridCell(ballEl, courtRect))) {
            setBallToCell(nextCell);
          }
          turn.playerMoves += 1;
          if (turn.playerMoves > 1) {
            spendPlayerEnergy(turn.activeSide, 1);
          }

          ballValue += 1;
          renderBallValue();
          updateHitButtons();
          updateTurnUI();

          if (!playerCanReachBall(turn.activeSide) && energyForPlayer(turn.activeSide) === 0) {
            awardPointForUnreachableBall();
          }
        }
      } else {
        setPlayerToCell(active, dragStartCell, courtRect);
      }
    } else if (active.dataset.type === 'ball') {
      const endCell = getGridCell(active, courtRect);
      if (window.multiplayer?.active) {
        setBallToCell(dragStartCell);
        window.multiplayer.dispatch('placeBall', { cell: endCell });
      } else {
        placeShotBall(endCell, dragStartCell);
      }
    }
  }

  active.classList.remove('dragging');
  if (active.hasPointerCapture(event.pointerId)) {
    active.releasePointerCapture(event.pointerId);
  }

  active = null;
  dragStartCell = null;
}

function placeShotBall(endCell, startCell = getGridCell(ballEl)) {
      const courtRect = court.getBoundingClientRect();
      const targetSide = endCell.col < 3 ? 'left' : 'right';
      const opponentCell = getGridCell(
        turn.activeSide === 'left' ? playerRightEl : playerLeftEl,
        courtRect
      );

      if (targetSide === turn.activeSide) {
        setBallToCell(startCell);
        turnHintEl.textContent = "La pilota s'ha d'enviar al camp contrari.";
      } else if (turn.phase === 'serve' && !cellsMatch(endCell, opponentCell)) {
        setBallToCell(startCell);
        turnHintEl.textContent = "En el saque, la pilota ha d'anar a la casella del rival.";
      } else {
        setBallToCell(endCell);
        if (turn.currentShotRow === null) {
          // Preserve the row where this player starts the shot.
          turn.currentShotRow = startCell.row;
          turn.baseDifficulty = ballValue;
        }

        if (turn.phase !== 'serve') {
          const playerDepth = getPlayerDepthFromBaseline(activePlayerEl(), courtRect);
          let increase = endCell.row !== turn.previousShotRow ? 1 : 0;
          const targetDepth = depthFromBaseline(targetSide, endCell.col);
          const opponentDepth = depthFromBaseline(targetSide, opponentCell.col);
          if (targetDepth < opponentDepth) increase += 1;
          if (playerDepth === 0 && targetDepth === 1) increase += 1;
          if (playerDepth === 0 && targetDepth === 2) increase += 2;
          if (playerDepth === 1 && targetDepth === 2) increase += 1;

          turn.positionModifier = increase;
          ballValue = turn.baseDifficulty + increase;
          renderBallValue();
        }

        turn.ballPlaced = true;
        updateHitButtons();
        updateTurnUI();
      }
}

function renderBallValue() {
  ballValueEl.textContent = ballValue.toString();
}

function setServeDifficulty() {
  if (window.multiplayer?.dispatch('serveDifficulty', { value: Number(serveDifficultyInput.value) })) return;
  if (turn.phase !== 'serve' || turn.ballPlaced) return;

  const value = Math.max(1, Number.parseInt(serveDifficultyInput.value, 10) || 1);
  serveDifficultyInput.value = value.toString();
  ballValue = value;
  renderBallValue();
}

function normalizeStatInput(input) {
  const parsed = Number.parseInt(input.value, 10);
  if (Number.isNaN(parsed)) {
    input.value = '1';
    return;
  }

  input.value = clamp(parsed, 1, 4).toString();
}

function getPlayerLabel(side) {
  if (side === 'left') {
    return nameLeftInput?.value.trim() || 'Esquerra';
  }
  return nameRightInput?.value.trim() || 'Dreta';
}

function updatePointButtons() {
  const leftLabel = getPlayerLabel('left');
  const rightLabel = getPlayerLabel('right');

  if (scoreNameLeftEl) scoreNameLeftEl.textContent = leftLabel;
  if (scoreNameRightEl) scoreNameRightEl.textContent = rightLabel;

  updateServeUI();
  updateTurnUI();
}

function updateHitButtons() {
  const canHit = !matchWinner() && turn.phase !== 'reposition' && !turn.hitReady && (
    (turn.phase === 'serve' && playerCanReachBall(turn.activeSide)) ||
    (turn.phase !== 'serve' && turn.ballPlaced)
  );
  hitActionBtn.disabled = !canHit;
  hitActionBtn.textContent = `Colpejar: ${activeHitStatName()}`;
}

function activeHitStatName() {
  if (turn.phase === 'serve') return 'Saque';
  if (turn.volley) return 'Voleia';
  return turn.returningServe ? 'Restada' : 'General';
}

function updateFatePanel(rollData) {
  if (diceText) diceText.textContent = rollData.symbolsText;
  if (totalText) totalText.textContent = `Total: ${rollData.total}`;
}

function rollDataFromRolls(rolls) {
  const symbols = { '-1': '-', '0': ' ', '1': '+' };
  return {
    rolls,
    symbolsText: rolls.map((v) => `[${symbols[v.toString()]}]`).join(' '),
    total: rolls.reduce((sum, val) => sum + val, 0)
  };
}

function serveTargetReached(state) {
  return state?.statName === 'Saque' &&
    rollDataFromRolls(state.rolls).total + state.statValue >= ballValue;
}

function renderHitDice(rolls = null) {
  const key = rolls ? rolls.join(',') : 'pending';
  if (hitPanelDiceEl.dataset.rolls === key) return;
  hitPanelDiceEl.dataset.rolls = key;
  const labels = rolls ? rolls.map((value) => value === 1 ? '+1' : value === -1 ? '−1' : 'blanc (0)') : [];
  hitPanelDiceEl.setAttribute('aria-label', rolls ? `Resultat dels daus: ${labels.join(', ')}` : 'Daus pendents de tirar');
  hitPanelDiceEl.replaceChildren();
  (rolls || [null, null, null, null]).forEach((value) => {
    const die = document.createElement('span');
    die.className = `fate-die ${value === null ? 'pending' : value === 1 ? 'positive' : value === -1 ? 'negative' : 'neutral'}`;
    die.textContent = value === null ? '·' : value === 1 ? '+' : value === -1 ? '−' : '';
    die.setAttribute('aria-hidden', 'true');
    hitPanelDiceEl.append(die);
  });
}

function animateHitDice() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  hitPanelDiceEl.querySelectorAll('.fate-die').forEach((die, index) => {
    die.animate([
      { transform: 'translateY(-12px) rotate(-28deg) scale(0.85)', opacity: 0.3 },
      { transform: 'translateY(3px) rotate(16deg) scale(1.05)', opacity: 1, offset: 0.55 },
      { transform: 'translateY(-4px) rotate(-7deg)', offset: 0.8 },
      { transform: 'translateY(0) rotate(0) scale(1)' }
    ], { duration: 520, delay: index * 65, easing: 'ease-out', fill: 'backwards' });
  });
}

function updateHitPanelForPlayer(side) {
  const state = hitStateByPlayer[side];
  if (!state) {
    hitPanelPlayerEl.textContent = '—';
    hitPanelStatEl.textContent = 'Colpeig: —';
    renderHitDice();
    hitPanelTotalEl.textContent = 'Total: 0';
    hitPanelInfoEl.textContent = '—';
    hitPanelRemoveBtn.disabled = true;
    hitPanelRemoveBtn.hidden = true;
    hitPanelResolveBtn.disabled = true;
    return;
  }

  const rollData = rollDataFromRolls(state.rolls);
  const total = rollData.total + state.statValue;
  const playerLabel = getPlayerLabel(side);
  const minusCount = state.rolls.filter((v) => v === -1).length;
  const playerCard = document.querySelector(`.player-card[data-player="${side}"]`);
  const energyInput = playerCard?.querySelector('.energy-input');
  const energyValue = Math.max(0, Number.parseInt(energyInput?.value, 10) || 0);

  hitPanelPlayerEl.textContent = playerLabel;
  hitPanelStatEl.textContent = `Colpeig: ${state.statName}`;
  renderHitDice(state.rolls);
  hitPanelTotalEl.textContent = `Total: ${rollData.total} + ${state.statValue} = ${total}`;
  hitPanelInfoEl.textContent = state.outcome || `Daus '-' disponibles: ${minusCount}. Energia: ${energyValue}.`;
  const canRemoveMinus = !state.resolved && !state.forcedError && !serveTargetReached(state) && minusCount > 0 && energyValue > 0;
  hitPanelRemoveBtn.hidden = !canRemoveMinus;
  hitPanelRemoveBtn.disabled = !canRemoveMinus;
  hitPanelResolveBtn.disabled = Boolean(state.resolved);
}

function initializePlayerCardValues() {
  playerCards.forEach((card) => {
    card.querySelectorAll('.stat-input').forEach((input) => { input.value = '2'; });
    card.querySelector('.energy-input').value = '5';
    card.querySelector('.stat-max').value = '5';
    card.querySelector('.recovery-factor').value = '50';
  });
}

function matchWinner() {
  const requiredSets = Math.floor(score.bestOf / 2) + 1;
  return ['left', 'right'].find((side) => score[side].sets >= requiredSets) || null;
}

function recoverEnergy() {
  const recoveredByPlayer = { left: 0, right: 0 };

  playerCards.forEach((card) => {
    const playerSide = card.dataset.player;
    const energyInput = card.querySelector('.energy-input');
    const maxInput = card.querySelector('.stat-max');
    const factorInput = card.querySelector('.recovery-factor');
    if (!energyInput || !maxInput || !factorInput) return;

    const currentEnergy = Math.max(0, Number.parseFloat(energyInput.value) || 0);
    const maxEnergy = Math.max(0, Number.parseFloat(maxInput.value) || 0);
    const parsedPercent = Number.parseFloat(factorInput.value);
    const percent = clamp(Number.isFinite(parsedPercent) ? parsedPercent : 50, 0, 100);
    factorInput.value = percent.toString();
    const missingEnergy = Math.max(0, maxEnergy - currentEnergy);
    const recovered = Math.floor(missingEnergy * percent / 100);
    const nextEnergy = Math.min(maxEnergy, currentEnergy + recovered);

    energyInput.value = nextEnergy.toString();
    if (playerSide === 'left' || playerSide === 'right') {
      recoveredByPlayer[playerSide] = recovered;
    }
  });

  return recoveredByPlayer;
}

function showRecovery(context, recovered) {
  recoveryStatusEl.textContent =
    `${context}: Esquerra +${recovered.left} | Dreta +${recovered.right}`;
}

function rollFate() {
  const rollData = rollFourFate();
  updateFatePanel(rollData);
}

function rollFourFate() {
  const faces = [-1, -1, 0, 0, 1, 1];
  const symbols = { '-1': '-', '0': ' ', '1': '+' };
  const rolls = [];

  for (let i = 0; i < 4; i += 1) {
    const value = faces[Math.floor(Math.random() * faces.length)];
    rolls.push(value);
  }

  return {
    rolls,
    symbolsText: rolls.map((v) => `[${symbols[v.toString()]}]`).join(' '),
    total: rolls.reduce((sum, val) => sum + val, 0)
  };
}

function handleHit() {
  if (window.multiplayer?.dispatch('hit')) return;
  const playerSide = turn.activeSide;
  const playerCard = document.querySelector(`.player-card[data-player="${playerSide}"]`);
  if (!playerCard || hitActionBtn.disabled) return;

  const statName = activeHitStatName();
  const row = playerCard.querySelector(`.stat-row[data-stat-name="${statName}"]`);
  const statInput = row?.querySelector('.stat-input');
  if (!statInput) return;
  normalizeStatInput(statInput);
  const statValue = Number.parseInt(statInput.value, 10);

  const rollData = rollFourFate();
  updateFatePanel(rollData);

  const total = rollData.total + statValue;
  const canServe = turn.phase === 'serve' && playerCanReachBall(playerSide);
  const canReturn = turn.phase !== 'serve' && turn.ballPlaced;
  if (playerSide !== turn.activeSide || (!canServe && !canReturn) || turn.hitReady) return;

  if (turn.phase === 'serve') {
    const courtRect = court.getBoundingClientRect();
    const serverCell = getGridCell(activePlayerEl(), courtRect);
    const opponent = playerSide === 'left' ? playerRightEl : playerLeftEl;
    turn.currentShotRow = serverCell.row;
    turn.baseDifficulty = ballValue;
    setBallToCell(getGridCell(opponent, courtRect));
    turn.ballPlaced = true;
  }

  const resultEl = playerCard.querySelector('.hit-result');
  hitStateByPlayer[playerSide] = {
    statName,
    statValue,
    rolls: [...rollData.rolls],
    resolved: false,
    forcedError: false,
    outcome: ''
  };
  const state = hitStateByPlayer[playerSide];
  const isError = turn.phase === 'serve'
    ? total < ballValue
    : total <= ballValue - 2;
  if (isError && turn.phase !== 'serve') {
    state.forcedError = true;
    state.outcome = 'Tir erroni. Prem Resoldre colpeig.';
  }
  const resultText = `${statName}: ${rollData.symbolsText} (${rollData.total}) + ${statValue} = ${total}`;
  resultEl.textContent = resultText;
  lastHitSide = playerSide;
  turn.hitReady = true;
  updateHitPanelForPlayer(playerSide);
  updateHitAdjustUI(playerCard);
  updateHitButtons();
  updateTurnUI();
  animateHitDice();
}

function resetPlayersToInitialPositions() {
  playerLeftEl.style.left = `${initialPositions.left.x}%`;
  playerLeftEl.style.top = `${initialPositions.left.y}%`;
  playerRightEl.style.left = `${initialPositions.right.x}%`;
  playerRightEl.style.top = `${initialPositions.right.y}%`;
}

function clearHitResults() {
  hitResultEls.forEach((el) => {
    el.textContent = 'Tirada: pendent';
  });
  hitStateByPlayer.left = null;
  hitStateByPlayer.right = null;
  lastHitSide = null;
  updateHitPanelForPlayer('left');
  document.querySelectorAll('.hit-adjust').forEach((box) => {
    box.classList.add('hidden');
  });
}

function updateHitAdjustUI(playerCard) {
  const playerSide = playerCard.dataset.player;
  const state = hitStateByPlayer[playerSide];
  const adjustBox = playerCard.querySelector('.hit-adjust');
  const infoEl = playerCard.querySelector('.adjust-info');
  const energyInput = playerCard.querySelector('.energy-input');
  const minusCount = state ? state.rolls.filter((v) => v === -1).length : 0;
  const energyValue = Math.max(0, Number.parseInt(energyInput.value, 10) || 0);
  energyInput.value = energyValue.toString();

  if (!state || minusCount === 0 || serveTargetReached(state)) {
    adjustBox.classList.add('hidden');
    return;
  }

  infoEl.textContent = `Daus '-' disponibles: ${minusCount}. Energia: ${energyValue}.`;
  adjustBox.classList.remove('hidden');

  if (lastHitSide === playerSide) {
    updateHitPanelForPlayer(playerSide);
  }
}

function handleRemoveMinus(event) {
  if (window.multiplayer?.dispatch('removeMinus')) return;
  const playerCard = event.currentTarget.closest('.player-card');
  if (!playerCard) return;
  const playerSide = playerCard.dataset.player;
  const state = hitStateByPlayer[playerSide];
  if (!state || state.resolved || state.forcedError || serveTargetReached(state)) return;

  const energyInput = playerCard.querySelector('.energy-input');
  const currentEnergy = Math.max(0, Number.parseInt(energyInput.value, 10) || 0);
  const minusIndex = state.rolls.indexOf(-1);
  if (minusIndex === -1 || currentEnergy <= 0) return;

  state.rolls[minusIndex] = 0;
  state.outcome = '';
  energyInput.value = (currentEnergy - 1).toString();

  const rollData = rollDataFromRolls(state.rolls);
  updateFatePanel(rollData);

  const total = rollData.total + state.statValue;
  const resultEl = playerCard.querySelector('.hit-result');
  const resultText = `${state.statName}: ${rollData.symbolsText} (${rollData.total}) + ${state.statValue} = ${total}`;
  resultEl.textContent = resultText;

  updateHitAdjustUI(playerCard);
  if (lastHitSide === playerSide) {
    updateHitPanelForPlayer(playerSide);
  }
}

function startSecondServe() {
  const serveValue = ballValue;
  resetPlayersToInitialPositions();
  placeBallWithServer();
  ballValue = serveValue;
  serveDifficultyInput.value = serveValue.toString();
  renderBallValue();
  clearHitResults();
  beginTurn(score.server, 'serve', 2);
}

function resolveHit() {
  if (window.multiplayer?.dispatch('resolve')) return;
  if (!lastHitSide) return;

  const state = hitStateByPlayer[lastHitSide];
  if (!state || state.resolved) return;

  const rollData = rollDataFromRolls(state.rolls);
  const total = rollData.total + state.statValue;
  const playerCard = document.querySelector(`.player-card[data-player="${lastHitSide}"]`);
  const energyInput = playerCard?.querySelector('.energy-input');
  const energy = Math.max(0, Number.parseInt(energyInput?.value, 10) || 0);
  const removableMinuses = state.rolls.filter((value) => value === -1).length;
  const bestPossibleTotal = total + Math.min(removableMinuses, energy);
  const requiredTotal = ballValue - 1;

  if (turn.phase === 'serve' && total < ballValue) {
    state.resolved = true;
    if (turn.serveAttempt === 1) {
      startSecondServe();
      return;
    }

    const pointWinner = oppositeSide(lastHitSide);
    awardPoint(pointWinner);
    updateScoreUI();
    resetCourtAfterPoint();
    return;
  }

  if (total <= ballValue - 2) {
    if (!state.forcedError && bestPossibleTotal >= requiredTotal) {
      const improvementsNeeded = requiredTotal - total;
      state.outcome = `El cop encara es pot salvar: cal treure ${improvementsNeeded} dau(s) '-' gastant energia.`;
      updateHitPanelForPlayer(lastHitSide);
      return;
    }

    state.resolved = true;
    const pointWinner = oppositeSide(lastHitSide);
    awardPoint(pointWinner);
    updateScoreUI();
    resetCourtAfterPoint();
    return;
  }

  state.resolved = true;
  const previousDifficulty = ballValue;
  if (turn.phase !== 'serve') {
    ballValue = total;
    renderBallValue();
  }
  ballMemory.previousShotRow = turn.currentShotRow;
  const difficultyText = turn.phase === 'serve'
    ? `Es manté la dificultat de saque: ${ballValue}.`
    : `Nova dificultat: ${ballValue}.`;
  state.outcome = `Cop vàlid (${total} contra dificultat ${previousDifficulty}). ${difficultyText}`;
  updateHitPanelForPlayer(lastHitSide);
  turn.phase = 'reposition';
  updateHitButtons();
  updateTurnUI();
}

function resetCourtAfterPoint() {
  if (matchWinner()) {
    turn.phase = 'finished';
    turn.hitReady = true;
    turn.ballPlaced = true;
    updateHitButtons();
    updateTurnUI();
    return;
  }
  resetPlayersToInitialPositions();
  placeBallWithServer();
  clearHitResults();
  beginTurn(score.server, 'serve');
}

function tennisPointLabel(playerPoints, opponentPoints) {
  const normal = ['0', '15', '30', '40'];

  if (playerPoints >= 3 && opponentPoints >= 3) {
    if (playerPoints === opponentPoints) return '40';
    if (playerPoints === opponentPoints + 1) return 'AD';
    return '-';
  }

  return normal[playerPoints] ?? '0';
}

function updateServeUI() {
  updateHitButtons();
}

function placeBallWithServer() {
  const serverPlayer = score.server === 'left' ? playerLeftEl : playerRightEl;
  setBallToCell(getGridCell(serverPlayer));
  ballMemory.previousShotRow = getGridCell(serverPlayer).row;
  ballValue = 1;
  serveDifficultyInput.value = '1';
  renderBallValue();
}

function setServer(side, syncBall = false) {
  score.server = side;
  updateServeUI();
  if (syncBall) {
    placeBallWithServer();
    beginTurn(side, 'serve');
  }
}

function resetPointsOnly() {
  score.left.points = 0;
  score.right.points = 0;
  score.pointsInCurrentGame = 0;
}

function resetGamesAndPoints() {
  score.left.games = 0;
  score.right.games = 0;
  resetPointsOnly();
  score.left.tieBreakPoints = 0;
  score.right.tieBreakPoints = 0;
  score.tieBreak = false;
  score.tieBreakStartServer = null;
}

function maybeWinSetByGames(side) {
  const other = oppositeSide(side);
  const games = score[side].games;
  const otherGames = score[other].games;

  if (games >= 6 && games - otherGames >= 2) {
    score[side].sets += 1;
    const recovered = recoverEnergy();
    showRecovery('Fi de set', recovered);
    resetGamesAndPoints();
    return true;
  }

  return false;
}

function maybeStartTieBreak() {
  if (score.left.games === 6 && score.right.games === 6) {
    score.tieBreak = true;
    score.tieBreakStartServer = score.server;
    score.left.tieBreakPoints = 0;
    score.right.tieBreakPoints = 0;
  }
}

function updateScoreUI() {
  setsLeftEl.textContent = score.left.sets.toString();
  setsRightEl.textContent = score.right.sets.toString();
  gamesLeftEl.textContent = score.left.games.toString();
  gamesRightEl.textContent = score.right.games.toString();

  if (score.tieBreak) {
    pointsLeftEl.textContent = score.left.tieBreakPoints.toString();
    pointsRightEl.textContent = score.right.tieBreakPoints.toString();
    matchStatusEl.textContent = 'Mode: Tie-break';
  } else {
    pointsLeftEl.textContent = tennisPointLabel(score.left.points, score.right.points);
    pointsRightEl.textContent = tennisPointLabel(score.right.points, score.left.points);
    matchStatusEl.textContent = 'Mode: Joc normal';
  }
  matchStatusEl.textContent += ` · Al millor de ${score.bestOf} sets`;
  const winner = matchWinner();
  if (winner) matchStatusEl.textContent = `Guanya ${getPlayerLabel(winner)} · ${score.left.sets}–${score.right.sets} sets`;
}

function resetAllScore() {
  score.left.sets = 0;
  score.right.sets = 0;
  resetGamesAndPoints();
  setServer(score.initialServer, true);
  recoveryStatusEl.textContent = 'Recuperació: pendent (cal acabar un joc o un set)';
  updateScoreUI();
}

function openGameSetup() {
  initialServerInput.options[0].textContent = getPlayerLabel('left');
  initialServerInput.options[1].textContent = getPlayerLabel('right');
  initialServerInput.value = score.initialServer;
  matchBestOfInput.value = String(score.bestOf);
  resumeGameBtn.hidden = !score.configured;
  setupDialog.showModal();
}

function startNewGame(event) {
  event.preventDefault();
  score.initialServer = initialServerInput.value === 'right' ? 'right' : 'left';
  score.bestOf = [1, 3, 5].includes(Number(matchBestOfInput.value)) ? Number(matchBestOfInput.value) : 3;
  score.configured = true;
  initializePlayerCardValues();
  resetPlayersToInitialPositions();
  clearHitResults();
  resetAllScore();
  resetCourtAfterPoint();
  setupDialog.close();
  saveGame();
}

function completeRegularGame(winnerSide) {
  const pointsPlayedInGame = score.pointsInCurrentGame;
  score[winnerSide].games += 1;
  resetPointsOnly();
  setServer(oppositeSide(score.server));

  if (maybeWinSetByGames(winnerSide)) {
    updateScoreUI();
    return;
  }

  const recovered =
    pointsPlayedInGame <= 7 ? recoverEnergy() : { left: 0, right: 0 };
  showRecovery('Fi de joc', recovered);

  maybeStartTieBreak();
  updateScoreUI();
}

function updateTieBreakServerAfterPoint() {
  const totalPlayed = score.left.tieBreakPoints + score.right.tieBreakPoints;
  if (totalPlayed % 2 === 1) {
    setServer(oppositeSide(score.server));
  }
}

function completeTieBreakSet(winnerSide) {
  score[winnerSide].sets += 1;
  const recovered = recoverEnergy();
  showRecovery('Fi de set', recovered);
  const nextSetServer = oppositeSide(score.tieBreakStartServer || score.server);
  resetGamesAndPoints();
  setServer(nextSetServer);
  updateScoreUI();
}

function awardPoint(side) {
  if (matchWinner()) return;
  const otherSide = oppositeSide(side);

  if (score.tieBreak) {
    score[side].tieBreakPoints += 1;

    const myTb = score[side].tieBreakPoints;
    const otherTb = score[otherSide].tieBreakPoints;
    if (myTb >= 7 && myTb - otherTb >= 2) {
      completeTieBreakSet(side);
      return;
    }

    updateTieBreakServerAfterPoint();
    updateScoreUI();
    return;
  }

  score[side].points += 1;
  score.pointsInCurrentGame += 1;

  const lead = score[side].points - score[otherSide].points;
  if (score[side].points >= 4 && lead >= 2) {
    completeRegularGame(side);
    return;
  }

  updateScoreUI();
}

draggables.forEach((item) => {
  item.addEventListener('pointerdown', startDrag);
  item.addEventListener('pointermove', moveDrag);
  item.addEventListener('pointerup', endDrag);
  item.addEventListener('pointercancel', endDrag);
});

statInputs.forEach((input) => {
  input.addEventListener('input', () => normalizeStatInput(input));
  input.addEventListener('blur', () => normalizeStatInput(input));
});

serveDifficultyInput.addEventListener('input', setServeDifficulty);
serveDifficultyInput.addEventListener('blur', setServeDifficulty);

if (nameLeftInput) {
  nameLeftInput.addEventListener('input', updatePointButtons);
  nameLeftInput.addEventListener('blur', updatePointButtons);
}

if (nameRightInput) {
  nameRightInput.addEventListener('input', updatePointButtons);
  nameRightInput.addEventListener('blur', updatePointButtons);
}

hitActionBtn.addEventListener('click', handleHit);
postHitMovementButtons.forEach((button) => {
  button.addEventListener('click', () => finishPostHitMovement(
    Number(button.dataset.postHitCol), Number(button.dataset.postHitRow)
  ));
});

removeMinusButtons.forEach((button) => {
  button.addEventListener('click', handleRemoveMinus);
});

hitPanelRemoveBtn.addEventListener('click', () => {
  if (!lastHitSide) return;
  const playerCard = document.querySelector(`.player-card[data-player="${lastHitSide}"]`);
  if (!playerCard) return;
  const btn = playerCard.querySelector('.remove-minus-btn');
  if (!btn) return;
  btn.click();
});

hitPanelResolveBtn.addEventListener('click', resolveHit);
moveToBallBtn.addEventListener('click', openMovementDialog);
attemptVolleyBtn.addEventListener('click', attemptVolley);
movementConfirmBtn.addEventListener('click', acceptMovement);
movementCancelBtn.addEventListener('click', renounceMovement);
movementDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  renounceMovement();
});
newGameBtn.addEventListener('click', openGameSetup);
setupForm.addEventListener('submit', startNewGame);
resumeGameBtn.addEventListener('click', () => setupDialog.close());
setupDialog.addEventListener('cancel', (event) => {
  if (!score.configured) event.preventDefault();
});

document.addEventListener('input', (event) => {
  if (event.target.matches('.energy-input')) updateTurnUI();
  saveGame();
});
document.addEventListener('pointerup', () => setTimeout(saveGame, 0));
document.addEventListener('click', () => setTimeout(saveGame, 0));
window.addEventListener('beforeunload', saveGame);

renderBallValue();
initializePlayerCardValues();
updatePointButtons();
updateHitButtons();
updateHitPanelForPlayer('left');
setServer('left', true);
updateScoreUI();
restoreGame();
if (!new URLSearchParams(window.location?.search || '').has('room')) openGameSetup();
