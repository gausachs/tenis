const court = document.getElementById('court');
const draggables = document.querySelectorAll('.draggable');
const ballEl = document.getElementById('ball');
const ballValueEl = document.getElementById('ball-value');
const playerLeftEl = document.querySelector('.player-left');
const playerRightEl = document.querySelector('.player-right');
const statInputs = document.querySelectorAll('.stat-input');
const hitButtons = document.querySelectorAll('.hit-btn');
const hitResultEls = document.querySelectorAll('.hit-result');
const removeMinusButtons = document.querySelectorAll('.remove-minus-btn');
const playerCards = document.querySelectorAll('.player-card');

const hitPanelPlayerEl = document.getElementById('hit-panel-player');
const hitPanelStatEl = document.getElementById('hit-panel-stat');
const hitPanelDiceEl = document.getElementById('hit-panel-dice');
const hitPanelTotalEl = document.getElementById('hit-panel-total');
const hitPanelRemoveBtn = document.getElementById('hit-panel-remove');
const hitPanelInfoEl = document.getElementById('hit-panel-info');

const rollBtn = document.getElementById('roll-fate');
const diceText = document.getElementById('fate-dice');
const totalText = document.getElementById('fate-total');

const nameLeftInput = document.getElementById('name-left');
const nameRightInput = document.getElementById('name-right');
const scoreNameLeftEl = document.getElementById('score-name-left');
const scoreNameRightEl = document.getElementById('score-name-right');

const pointLeftBtn = document.getElementById('point-left');
const pointRightBtn = document.getElementById('point-right');
const resetScoreBtn = document.getElementById('reset-score');

const setsLeftEl = document.getElementById('sets-left');
const setsRightEl = document.getElementById('sets-right');
const gamesLeftEl = document.getElementById('games-left');
const gamesRightEl = document.getElementById('games-right');
const pointsLeftEl = document.getElementById('points-left');
const pointsRightEl = document.getElementById('points-right');
const matchStatusEl = document.getElementById('match-status');
const recoveryStatusEl = document.getElementById('recovery-status');

const serveLeftBtn = document.getElementById('serve-left');
const serveRightBtn = document.getElementById('serve-right');
const serveStatus = document.getElementById('serve-status');

let active = null;
let offsetX = 0;
let offsetY = 0;
let movedWhileDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let suppressBallClickUntil = 0;
let ballValue = 1;
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
  tieBreak: false,
  tieBreakStartServer: null,
  pointsInCurrentGame: 0
};
const hitStateByPlayer = {
  left: null,
  right: null
};
const TOTAL_CARD_POINTS = 20;
let lastHitSide = null;

function oppositeSide(side) {
  return side === 'left' ? 'right' : 'left';
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function startDrag(event) {
  active = event.currentTarget;
  active.classList.add('dragging');
  movedWhileDragging = false;
  dragStartX = event.clientX;
  dragStartY = event.clientY;

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
      updateHitButtons();
    }
  }

  active.classList.remove('dragging');
  if (active.hasPointerCapture(event.pointerId)) {
    active.releasePointerCapture(event.pointerId);
  }

  if (movedWhileDragging && active.dataset.type === 'ball') {
    suppressBallClickUntil = Date.now() + 180;
  }

  active = null;
}

function renderBallValue() {
  ballValueEl.textContent = ballValue.toString();
}

function incrementBall() {
  ballValue += 1;
  renderBallValue();
}

function decrementBall() {
  ballValue = Math.max(1, ballValue - 1);
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

  pointLeftBtn.textContent = `Punt ${leftLabel}`;
  pointRightBtn.textContent = `Punt ${rightLabel}`;

  if (scoreNameLeftEl) scoreNameLeftEl.textContent = leftLabel;
  if (scoreNameRightEl) scoreNameRightEl.textContent = rightLabel;

  updateServeUI();
}

function updateHitButtons() {
  const courtRect = court.getBoundingClientRect();
  const players = [
    { side: 'left', el: playerLeftEl },
    { side: 'right', el: playerRightEl }
  ];

  players.forEach(({ side, el }) => {
    const playerCard = document.querySelector(`.player-card[data-player="${side}"]`);
    if (!playerCard) return;

    const depth = getPlayerDepthFromBaseline(el, courtRect);
    const allowed = new Set();

    if (depth === 0) {
      allowed.add('Fons de pista');
      if (score.server === side) allowed.add('Saque');
    } else if (depth === 1) {
      allowed.add('Mig camp');
    } else {
      allowed.add('Xarxa');
      allowed.add('Voleia');
    }

    playerCard.querySelectorAll('.stat-row').forEach((row) => {
      const statName = row.dataset.statName;
      const btn = row.querySelector('.hit-btn');
      if (!btn) return;
      btn.disabled = !allowed.has(statName);
    });
  });
}

function updateFatePanel(rollData) {
  diceText.textContent = rollData.symbolsText;
  totalText.textContent = `Total: ${rollData.total}`;
}

function rollDataFromRolls(rolls) {
  const symbols = { '-1': '-', '0': ' ', '1': '+' };
  return {
    rolls,
    symbolsText: rolls.map((v) => `[${symbols[v.toString()]}]`).join(' '),
    total: rolls.reduce((sum, val) => sum + val, 0)
  };
}

function updateHitPanelForPlayer(side) {
  const state = hitStateByPlayer[side];
  if (!state) {
    hitPanelPlayerEl.textContent = '—';
    hitPanelStatEl.textContent = 'Colpeig: —';
    hitPanelDiceEl.textContent = 'Daus: [ ] [ ] [ ] [ ]';
    hitPanelTotalEl.textContent = 'Total: 0';
    hitPanelInfoEl.textContent = '—';
    hitPanelRemoveBtn.disabled = true;
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
  hitPanelDiceEl.textContent = `Daus: ${rollData.symbolsText}`;
  hitPanelTotalEl.textContent = `Total: ${rollData.total} + ${state.statValue} = ${total}`;
  hitPanelInfoEl.textContent = `Daus '-' disponibles: ${minusCount}. Energia: ${energyValue}.`;
  hitPanelRemoveBtn.disabled = minusCount === 0 || energyValue <= 0;
}

function initializePlayerCardValues() {
  playerCards.forEach((card) => {
    const statInputsInCard = Array.from(card.querySelectorAll('.stat-row .stat-input'));
    const energyInput = card.querySelector('.energy-input');
    const maxInput = card.querySelector('.stat-max');
    if (!energyInput || !maxInput || statInputsInCard.length === 0) return;

    let remaining = TOTAL_CARD_POINTS;
    const minEnergy = 5;

    statInputsInCard.forEach((input, index) => {
      const statsLeft = statInputsInCard.length - index - 1;
      const minForRest = statsLeft * 1 + minEnergy;
      const maxAllowed = Math.min(4, remaining - minForRest);
      const value = randomInt(1, Math.max(1, maxAllowed));
      input.value = value.toString();
      remaining -= value;
    });

    const energyValue = Math.max(minEnergy, remaining);
    energyInput.value = energyValue.toString();
    maxInput.value = energyValue.toString();
  });
}

function recoverEnergy(multiplier = 1) {
  const recoveredByPlayer = { left: 0, right: 0 };

  playerCards.forEach((card) => {
    const playerSide = card.dataset.player;
    const energyInput = card.querySelector('.energy-input');
    const maxInput = card.querySelector('.stat-max');
    const factorInput = card.querySelector('.recovery-factor');
    if (!energyInput || !maxInput || !factorInput) return;

    const currentEnergy = Math.max(0, Number.parseFloat(energyInput.value) || 0);
    const maxEnergy = Math.max(0, Number.parseFloat(maxInput.value) || 0);
    const factor = clamp(Number.parseFloat(factorInput.value) || 0, 0, 1);
    const missingEnergy = Math.max(0, maxEnergy - currentEnergy);
    const recovered = Math.round(missingEnergy * factor * multiplier);
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

function handleHit(event) {
  const row = event.currentTarget.closest('.stat-row');
  if (!row) return;

  const statInput = row.querySelector('.stat-input');
  normalizeStatInput(statInput);
  const statValue = Number.parseInt(statInput.value, 10);

  const rollData = rollFourFate();
  updateFatePanel(rollData);

  const total = rollData.total + statValue;
  const statName = row.dataset.statName || 'Camp';
  const playerCard = row.closest('.player-card');
  const playerSide = playerCard.dataset.player;
  const resultEl = playerCard.querySelector('.hit-result');
  hitStateByPlayer[playerSide] = {
    statName,
    statValue,
    rolls: [...rollData.rolls]
  };
  const resultText = `${statName}: ${rollData.symbolsText} (${rollData.total}) + ${statValue} = ${total}`;
  resultEl.textContent = resultText;
  lastHitSide = playerSide;
  updateHitPanelForPlayer(playerSide);
  updateHitAdjustUI(playerCard);
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

  if (!state || minusCount === 0) {
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
  const playerCard = event.currentTarget.closest('.player-card');
  if (!playerCard) return;
  const playerSide = playerCard.dataset.player;
  const state = hitStateByPlayer[playerSide];
  if (!state) return;

  const energyInput = playerCard.querySelector('.energy-input');
  const currentEnergy = Math.max(0, Number.parseInt(energyInput.value, 10) || 0);
  const minusIndex = state.rolls.indexOf(-1);
  if (minusIndex === -1 || currentEnergy <= 0) return;

  state.rolls[minusIndex] = 0;
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

function resetCourtAfterPoint() {
  resetPlayersToInitialPositions();
  placeBallWithServer();
  clearHitResults();
  updateHitButtons();
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
  const leftServing = score.server === 'left';
  serveLeftBtn.classList.toggle('active-serve', leftServing);
  serveRightBtn.classList.toggle('active-serve', !leftServing);
  const label = getPlayerLabel(leftServing ? 'left' : 'right');
  serveStatus.textContent = `Servei: ${label}`;
  updateHitButtons();
}

function placeBallWithServer() {
  const serverPlayer = score.server === 'left' ? playerLeftEl : playerRightEl;
  const playerX = Number.parseFloat(serverPlayer.style.left) || 50;
  const playerY = Number.parseFloat(serverPlayer.style.top) || 50;
  const offsetX = score.server === 'left' ? 6 : -6;

  const ballX = clamp(playerX + offsetX, 4, 96);
  const ballY = clamp(playerY, 6, 94);
  ballEl.style.left = `${ballX}%`;
  ballEl.style.top = `${ballY}%`;
}

function setServer(side, syncBall = false) {
  score.server = side;
  updateServeUI();
  if (syncBall) {
    placeBallWithServer();
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
    const recovered = recoverEnergy(1);
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
}

function resetAllScore() {
  score.left.sets = 0;
  score.right.sets = 0;
  resetGamesAndPoints();
  setServer('left', true);
  recoveryStatusEl.textContent = 'Recuperació: pendent (cal acabar un joc o un set)';
  updateScoreUI();
}

function completeRegularGame(winnerSide) {
  const pointsPlayedInGame = score.pointsInCurrentGame;
  score[winnerSide].games += 1;
  resetPointsOnly();
  setServer(oppositeSide(score.server));

  const recovered =
    pointsPlayedInGame <= 7 ? recoverEnergy(0.5) : { left: 0, right: 0 };
  showRecovery('Fi de joc', recovered);

  if (maybeWinSetByGames(winnerSide)) {
    updateScoreUI();
    return;
  }

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
  const recovered = recoverEnergy(1);
  showRecovery('Fi de set', recovered);
  const nextSetServer = oppositeSide(score.tieBreakStartServer || score.server);
  resetGamesAndPoints();
  setServer(nextSetServer);
  updateScoreUI();
}

function awardPoint(side) {
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

ballEl.addEventListener('click', () => {
  if (Date.now() < suppressBallClickUntil) return;
  incrementBall();
});

ballEl.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (Date.now() < suppressBallClickUntil) return;
  decrementBall();
});

statInputs.forEach((input) => {
  input.addEventListener('input', () => normalizeStatInput(input));
  input.addEventListener('blur', () => normalizeStatInput(input));
});

if (nameLeftInput) {
  nameLeftInput.addEventListener('input', updatePointButtons);
  nameLeftInput.addEventListener('blur', updatePointButtons);
}

if (nameRightInput) {
  nameRightInput.addEventListener('input', updatePointButtons);
  nameRightInput.addEventListener('blur', updatePointButtons);
}

hitButtons.forEach((button) => {
  button.addEventListener('click', handleHit);
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

rollBtn.addEventListener('click', rollFate);
pointLeftBtn.addEventListener('click', () => {
  awardPoint('left');
  resetCourtAfterPoint();
});

pointRightBtn.addEventListener('click', () => {
  awardPoint('right');
  resetCourtAfterPoint();
});
resetScoreBtn.addEventListener('click', resetAllScore);

serveLeftBtn.addEventListener('click', () => setServer('left', true));
serveRightBtn.addEventListener('click', () => setServer('right', true));

renderBallValue();
initializePlayerCardValues();
updatePointButtons();
updateHitButtons();
updateHitPanelForPlayer('left');
setServer('left', true);
updateScoreUI();
