// Local opponent: every action goes through the existing game rules.
(() => {
  const dialog = document.getElementById('computer-dialog');
  const report = document.getElementById('computer-report');
  const banner = document.getElementById('computer-status');
  const lastTurn = document.getElementById('computer-last-turn');
  let timer = null;
  let running = false;
  const enabled = () => score.mode === 'computer' && !window.multiplayer?.active;
  const ownsTurn = () => enabled() && !matchWinner() && turn.activeSide === 'right';
  const pick = items => items[Math.floor(Math.random() * items.length)];
  const distance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  const cellLabel = cell => {
    const side = cell.col < 3 ? 'left' : 'right';
    const zone = ['fons', 'centre', 'xarxa'][depthFromBaseline(side, cell.col)];
    const lane = court.dataset.orientation === 'vertical' ? (cell.row ? 'esquerra' : 'dreta') : (cell.row ? 'inferior' : 'superior');
    return `${zone}, franja ${lane}`;
  };
  const stat = name => Number(document.querySelector('.player-card[data-player="right"]')
    .querySelector(`[data-stat-name="${name}"]`).querySelector('.stat-input').value);

  function showReport() {
    if (!score.computerReport || dialog.open) return;
    report.textContent = score.computerReport;
    dialog.showModal();
  }

  function schedule() {
    banner.hidden = !enabled();
    lastTurn.disabled = !score.computerReport;
    if (running) return;
    // Card editing would let either side bypass the opponent's energy rules.
    if (!window.multiplayer?.active) {
      document.querySelectorAll('.player-card input').forEach(input => { input.disabled = enabled(); });
    }
    if (!enabled()) return;
    if (ownsTurn() || score.computerReportPending) {
      document.querySelectorAll('.action-panels button, #serve-difficulty').forEach(button => { button.disabled = true; });
    }
    if (setupDialog.open || recoveryDialog.open || dialog.open) return;
    if (score.computerReportPending) { showReport(); return; }
    if (!ownsTurn() || timer !== null) return;
    turnHintEl.textContent = 'L’ordinador està preparant el seu torn…';
    timer = setTimeout(() => {
      timer = null;
      if (ownsTurn() && !setupDialog.open && !dialog.open && !recoveryDialog.open) playTurn();
    }, 450);
  }

  function targetChoices(risky) {
    const opponent = getGridCell(playerLeftEl);
    const depth = depthFromBaseline('right', getGridCell(playerRightEl).col);
    const choices = [];
    for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) {
      // Same positional penalties used by placeShotBall, before rolling any dice.
      let extra = row !== turn.previousShotRow ? 1 : 0;
      if (col < opponent.col) extra++;
      if (depth === 0 && col === 1) extra++;
      if (depth === 0 && col === 2) extra += 2;
      if (depth === 1 && col === 2) extra++;
      const cell = { col, row };
      const value = risky ? distance(cell, opponent) * 2 - extra : -extra * 4 + distance(cell, opponent);
      choices.push({ cell, value });
    }
    choices.sort((a,b) => b.value - a.value);
    return choices.filter(choice => choice.value >= choices[0].value - (risky ? 1 : 0));
  }

  function reposition(risky, lines) {
    const choices = [[0,0],[-1,0],[1,0],[0,-1],[0,1]].map(([colStep,rowStep]) => ({
      colStep, rowStep, cell: postHitDestination(colStep,rowStep)
    })).filter(choice => choice.cell);
    // Prudence favours the middle depth; risk favours approaching the net.
    const idealCol = risky ? 3 : 4;
    choices.sort((a,b) => Math.abs(a.cell.col - idealCol) - Math.abs(b.cell.col - idealCol));
    const best = choices.filter(choice => Math.abs(choice.cell.col - idealCol) === Math.abs(choices[0].cell.col - idealCol));
    const choice = pick(best);
    lines.push(choice.colStep || choice.rowStep
      ? `Després del cop es mou a ${cellLabel(choice.cell)}, sense cost d’energia.`
      : 'Després del cop es queda al lloc, sense cost d’energia.');
    finishPostHitMovement(choice.colStep, choice.rowStep);
  }

  function playTurn() {
    if (!ownsTurn() || running) return;
    running = true;
    const risky = Math.random() < 0.35;
    const energyBefore = energyForPlayer('right');
    const recoveryBefore = recoveryEvent?.id;
    const lines = [risky ? 'Decisió arriscada: busca pressionar i avançar cap a la xarxa.'
      : 'Decisió prudent: prioritza un cop assequible i una posició central.'];
    try {
      if (turn.phase === 'reposition') {
        reposition(risky, lines);
      } else {
        if (!turn.ballPlaced && turn.phase === 'return' && !playerCanReachBall('right')) {
          const steps = distanceToBall('right');
          const cost = movementCost();
          if (canAttemptVolley() && (cost > energyForPlayer('right') || (risky && Math.random() < 0.6))) {
            const increase = volleyDifficultyIncrease();
            attemptVolley();
            lines.push(`Intenta una volea: −1 energia i +${increase} dificultat.`);
          } else if (cost <= energyForPlayer('right')) {
            acceptMovement();
            lines.push(`S’apropa a la pilota: ${steps} casella(es), −${cost} energia i +${steps} dificultat.`);
          } else {
            lines.push(`No pot arribar a la pilota: necessita ${cost} d’energia i en té ${energyForPlayer('right')}. Perd el punt.`);
            awardPointForUnreachableBall();
            finishReport(lines, energyBefore, recoveryBefore);
            return;
          }
        }
        if (!turn.hitReady) {
          if (turn.phase === 'serve') {
            const value = clamp(stat('Saque') + (risky ? 1 : -1), 1, 99);
            serveDifficultyInput.value = String(value);
            setServeDifficulty();
            lines.push(`${turn.serveAttempt === 2 ? 'Segon' : 'Primer'} saque: tria dificultat ${value}; envia la pilota a la casella del rival.`);
          } else if (!turn.ballPlaced) {
            const choice = pick(targetChoices(risky));
            placeShotBall(choice.cell);
            lines.push(`Envia la pilota a ${cellLabel(choice.cell)} del teu camp. Modificador de posició: +${turn.positionModifier}.`);
          }
          updateHitButtons();
          handleHit();
        }
        const hit = hitStateByPlayer.right;
        if (hit && !hit.resolved) {
          lines.push(`${hit.statName}: habilitat ${hit.statValue}. Daus: ${hit.rolls.map(v => v > 0 ? '+1' : String(v)).join(', ')}. Total inicial: ${rollDataFromRolls(hit.rolls).total + hit.statValue}. Dificultat: ${ballValue}.`);
          let spent = 0;
          while (canRescueHit(hit, 'right') && spent < 4) {
            handleRemoveMinus({ currentTarget: { closest: () => document.querySelector('.player-card[data-player="right"]') } });
            spent++;
          }
          lines.push(spent ? `Gasta ${spent} d’energia per anul·lar ${spent} dau(s) negatiu(s). Total final: ${rollDataFromRolls(hit.rolls).total + hit.statValue}.` : 'No gasta energia per millorar la tirada.');
          const wasFirstServe = turn.phase === 'serve' && turn.serveAttempt === 1;
          const special = specialRoll(hit);
          if (special === -1) lines.push('−−−−: falta automàtica; no es pot salvar amb energia.');
          resolveHit();
          if (special === 1) {
            lines.push('++++: punt directe per a l’ordinador.');
          } else if (turn.phase === 'reposition' && turn.activeSide === 'right') {
            lines.push(`Cop vàlid. Reps una pilota de dificultat ${ballValue}.`);
            reposition(risky, lines);
          } else if (wasFirstServe && turn.phase === 'serve' && turn.activeSide === 'right' && turn.serveAttempt === 2) {
            lines.push('Falta de primer saque. Després de Continuar farà el segon saque.');
          } else {
            lines.push('Cop fallat: el punt és teu.');
          }
        }
      }
      finishReport(lines, energyBefore, recoveryBefore);
    } finally {
      running = false;
      updateHitButtons();
      updateTurnUI();
    }
  }

  function finishReport(lines, energyBefore, recoveryBefore) {
    lines.push(`Energia de l’ordinador: ${energyBefore} → ${energyForPlayer('right')}.`);
    if (recoveryEvent?.id !== recoveryBefore && recoveryEvent) {
      lines.push(`Recuperació d’energia: tu +${recoveryEvent.recovered.left}; ordinador +${recoveryEvent.recovered.right}.`);
    }
    lines.push(`Marcador (tu / ordinador): sets ${score.left.sets}/${score.right.sets}; jocs ${score.left.games}/${score.right.games}; punts ${pointsLeftEl.textContent}/${pointsRightEl.textContent}.`);
    score.computerReport = lines.join('\n\n');
    score.computerReportPending = true;
    saveGame();
    if (!recoveryDialog.open) showReport();
  }

  dialog.addEventListener('close', () => {
    score.computerReportPending = false;
    saveGame();
    updateHitButtons(); updateTurnUI();
  });
  lastTurn.addEventListener('click', showReport);
  setupDialog.addEventListener('close', schedule);
  recoveryDialog.addEventListener('close', schedule);
  // Prevent user input in the short interval before the automatic turn starts.
  document.addEventListener('click', event => {
    if (!ownsTurn() || running) return;
    if (event.target.closest('.action-panels')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.computer = { schedule, ownsTurn, playTurn };
  schedule();
})();
