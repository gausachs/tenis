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
    renderReserve();
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

  function chooseReserveShot(risky) {
    const opponent = getGridCell(playerLeftEl);
    const options = [];
    for (const target of reserveTargets({ anyDie: true })) {
      reserve.pools.right.forEach((value, index) => {
        if (value === null || dieMaximum(value, 'right') < target.difficulty) return;
        const energy = reserveStat('right') + value < target.difficulty ? 1 : 0;
        const quality = risky
          ? distance(target.cell, opponent) * 3 + value - energy
          : -energy * 6 - value * 2 - target.difficulty + distance(target.cell, opponent) * .25;
        options.push({ cell: target.cell, index, quality });
      });
    }
    options.sort((a,b) => b.quality - a.quality);
    return options.length ? pick(options.filter(option => option.quality === options[0].quality)) : null;
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
    const noticeBefore = reserve.lossId;
    const lines = [risky ? 'Decisió arriscada: busca pressionar i avançar cap a la xarxa.'
      : 'Decisió prudent: prioritza un cop assequible i una posició central.'];
    lines.push(`Reserva inicial: ${reserve.pools.right.map(v => v === null ? 'gastat' : v > 0 ? '+1' : String(v)).join(', ')}.`);
    lines.push(`Fatiga d’aquest punt: +${reserve.fatigue.right} a la dificultat dels seus cops.`);
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
        if (reserve.lossId !== noticeBefore) {
          lines.push(reserve.notice);
          finishReport(lines, energyBefore, recoveryBefore);
          return;
        }
        if (!turn.hitReady) {
          if (turn.phase === 'serve') {
            const dice = reserve.pools.right.map((value,index) => ({ value,index })).filter(die => die.value !== null);
            dice.sort((a,b) => risky ? b.value - a.value : a.value - b.value);
            const chosen = dice.find(die => die.value >= 0 && stat('Saque') + die.value >= 1 + reserve.fatigue.right) || dice[0];
            selectReserveDie(chosen.index);
            const value = risky ? Math.max(1, stat('Saque') + chosen.value - reserve.fatigue.right) : 1;
            serveDifficultyInput.value = String(value);
            setServeDifficulty();
            lines.push(`${turn.serveAttempt === 2 ? 'Segon' : 'Primer'} saque: tria dificultat ${value}; envia la pilota a la casella del rival.`);
          } else if (!turn.ballPlaced) {
            const choice = chooseReserveShot(risky);
            if (!choice) {
              settleReserveTurn();
              lines.push('No hi ha cap destí assolible amb la reserva i l’energia disponibles. Perd el punt.');
              finishReport(lines, energyBefore, recoveryBefore);
              return;
            }
            selectReserveDie(choice.index);
            placeShotBall(choice.cell);
            lines.push(`Envia la pilota a ${cellLabel(choice.cell)} del teu camp. Modificador de posició: +${turn.positionModifier}.`);
          }
          lines.push(`Tria el dau ${reserve.selected.right + 1}: ${chosenDie() > 0 ? '+' : ''}${chosenDie()}. Aquest dau queda gastat.`);
          updateHitButtons();
          handleHit();
        }
        const hit = hitStateByPlayer.right;
        if (hit && !hit.resolved) {
          lines.push(`${hit.statName}: habilitat ${hit.statValue}. Dau utilitzat: ${hit.rolls.map(v => v > 0 ? '+1' : String(v)).join(', ')}. Total inicial: ${rollDataFromRolls(hit.rolls).total + hit.statValue}. Dificultat a igualar: ${requiredHitTotal(hit, 'right')}.`);
          if (negativeServe(hit)) lines.push('El −1 és falta de servei obligatòria i no es pot corregir amb energia.');
          let spent = 0;
          while (canRescueHit(hit, 'right') && spent < 4) {
            handleRemoveMinus({ currentTarget: { closest: () => document.querySelector('.player-card[data-player="right"]') } });
            spent++;
          }
          lines.push(spent ? `Gasta ${spent} d’energia per anul·lar ${spent} dau(s) negatiu(s). Total final: ${rollDataFromRolls(hit.rolls).total + hit.statValue}.` : 'No gasta energia per millorar la tirada.');
          const wasFirstServe = turn.phase === 'serve' && turn.serveAttempt === 1;
          resolveHit();
          if (turn.phase === 'reposition' && turn.activeSide === 'right') {
            lines.push(`Cop vàlid. Reps una pilota de dificultat ${ballValue}.`);
            reposition(risky, lines);
          } else if (wasFirstServe && turn.phase === 'serve' && turn.activeSide === 'right' && turn.serveAttempt === 2) {
            lines.push('Falta de primer saque. Després de Continuar farà el segon saque.');
          } else {
            lines.push('Cop fallat: el punt és teu.');
          }
        }
      }
      if (reserve.lossId !== noticeBefore && !lines.includes(reserve.notice)) lines.push(reserve.notice);
      finishReport(lines, energyBefore, recoveryBefore);
    } finally {
      running = false;
      updateHitButtons();
      updateTurnUI();
    }
  }

  function finishReport(lines, energyBefore, recoveryBefore) {
    lines.push(`Reserva restant: ${reserve.pools.right.map(v => v === null ? 'gastat' : v > 0 ? '+1' : String(v)).join(', ')}. Si el punt ha acabat, és la nova reserva.`);
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
