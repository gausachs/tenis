(() => {
  const apiOrigin = window.TENIS_API_ORIGIN || (location.hostname === 'gausachs.github.io'
    ? 'https://tenis-fate.vercel.app'
    : '');
  const status = document.getElementById('online-status');
  const message = document.getElementById('online-message');
  const lobby = document.getElementById('online-lobby');
  const roomControls = document.getElementById('online-room');
  const roomLink = document.getElementById('room-link');
  const joinCode = document.getElementById('join-room-code');
  const createButton = document.getElementById('create-room');
  const joinButton = document.getElementById('join-room');
  const online = { active: false, room: null, token: null, revision: -1, busy: false, connected: false, state: null, participants: 0 };
  let polling = false;
  let notice = '';
  function makeToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
  }
  function tokenForRoom(id) {
    const key = `tenis-room-token:${id}`;
    let token = sessionStorage.getItem(key);
    if (!token) { token = makeToken(); sessionStorage.setItem(key, token); }
    return token;
  }
  function refreshControls() {
    lobby.hidden = online.active;
    roomControls.hidden = !online.active;
    if (!online.active) return;
    const canAct = online.connected && !online.busy && Boolean(online.state);
    if (online.state) {
      updateHitButtons();
      updateTurnUI();
      updateHitPanelForPlayer(lastHitSide || 'left');
    }
    if (!canAct) document.querySelectorAll('.action-panels button, #serve-difficulty').forEach(el => { el.disabled = true; });
    document.querySelectorAll('.player-card input').forEach(el => { el.disabled = true; });
    newGameBtn.disabled = true;
    status.textContent = online.busy ? 'Desant…' : online.connected ? `${online.participants} connectat(s) · Partida compartida` : 'Reconnectant…';
    message.textContent = notice || 'Tothom controla els dos tenistes. Els moviments, els daus i el marcador es comparteixen automàticament.';
  }
  function applySnapshot(data) {
    if (data.room !== online.room || data.revision < online.revision) return;
    const changed = data.revision > online.revision || !online.state;
    const hadState = Boolean(online.state);
    const newRoll = online.state && !online.state.turn.hitReady && data.state.turn.hitReady && data.state.lastHitSide;
    online.participants = data.participants;
    online.connected = true;
    if (changed) {
      online.revision = data.revision;
      online.state = data.state;
      if (active) {
        active.classList.remove('dragging'); active = null; dragStartCell = null;
      }
      if (movementDialog.open) movementDialog.close();
      restoreGame(data.state, { notifyRecovery: hadState });
      if (newRoll) animateHitDice();
    }
    refreshControls();
  }
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${apiOrigin}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(online.token ? { Authorization: `Bearer ${online.token}` } : {}), ...options.headers },
      cache: 'no-store', signal: AbortSignal.timeout(12000),
      ...(apiOrigin ? { credentials: 'omit' } : {}),
      });
    } catch {
      throw new Error('No es pot connectar amb el servei multijugador. Comprova la connexió; el servei ha d’estar publicat i permetre l’accés des d’aquest web.');
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      const error = new Error('El servei multijugador no està disponible o demana iniciar sessió. GitHub Pages només allotja el tauler; cal que el servei de partides sigui accessible.');
      error.status = response.status;
      throw error;
    }
    let data;
    try { data = await response.json(); }
    catch { throw new Error('El servei multijugador ha retornat una resposta no vàlida. Torna-ho a provar més tard.'); }
    if (!response.ok) {
      if (data.state) applySnapshot(data);
      const error = new Error(data.error || 'No s’ha pogut connectar.'); error.status = response.status; throw error;
    }
    return data;
  }
  function enterRoom(id, token) {
    online.active = true; online.room = id; online.token = token; online.revision = -1; online.state = null;
    if (setupDialog.open) setupDialog.close();
    const url = new URL(location.href); url.search = ''; url.searchParams.set('room', id); url.hash = '';
    history.replaceState(null, '', url);
    roomLink.value = url.href;
    refreshControls();
  }
  async function poll() {
    if (!online.active || online.busy || polling) return;
    polling = true;
    try {
      const wasDisconnected = !online.connected;
      let data;
      try { data = await request(`/api/rooms/${online.room}`); }
      catch (error) {
        if (error.status !== 403) throw error;
        data = await request(`/api/rooms/${online.room}/join`, { method: 'POST', body: '{}' });
      }
      if (wasDisconnected) notice = '';
      applySnapshot(data);
    } catch (error) {
      online.connected = false;
      notice = error.status === 404 ? error.message : 'Connexió interrompuda. Es reprendrà automàticament; les accions estan pausades.';
      refreshControls();
    } finally { polling = false; }
  }
  async function sendAction(type, payload) {
    online.busy = true; notice = ''; refreshControls();
    try {
      const data = await request(`/api/rooms/${online.room}/actions`, {
        method: 'POST', body: JSON.stringify({ revision: online.revision, action: { type, ...payload } }),
      });
      applySnapshot(data);
    } catch (error) {
      notice = error.status ? error.message : 'No s’ha rebut la confirmació. Reconnectant per comprovar si l’acció s’ha desat.';
      if (!error.status) online.connected = false;
      if (online.state) restoreGame(online.state);
    } finally {
      online.busy = false; refreshControls();
      if (!online.connected) await poll();
    }
  }
  window.multiplayer = {
    refreshControls,
    get active() { return online.active; },
    canAct: () => online.connected && !online.busy && Boolean(online.state),
    dispatch(type, payload = {}) {
      if (!online.active) return false;
      if (this.canAct()) void sendAction(type, payload);
      return true;
    },
  };
  async function join(id) {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Enganxa un enllaç o un codi de partida vàlid.');
    const token = tokenForRoom(id);
    enterRoom(id, token); online.busy = true; refreshControls();
    try {
      const data = await request(`/api/rooms/${id}/join`, { method: 'POST', body: '{}' });
      notice = ''; applySnapshot(data);
    } finally { online.busy = false; refreshControls(); }
  }
  createButton.addEventListener('click', async () => {
    createButton.disabled = true; joinButton.disabled = true;
    try {
      const token = makeToken();
      const data = await request('/api/rooms', { method: 'POST', body: JSON.stringify({ token, config: {
        initialServer: score.initialServer, bestOf: score.bestOf,
        leftName: getPlayerLabel('left'), rightName: getPlayerLabel('right'),
      } }) });
      sessionStorage.setItem(`tenis-room-token:${data.room}`, token);
      enterRoom(data.room, token); notice = ''; applySnapshot(data);
    } catch (error) { message.textContent = error.message || 'No s’ha pogut crear la partida.'; }
    finally { createButton.disabled = false; joinButton.disabled = false; }
  });
  joinButton.addEventListener('click', async () => {
    let id = joinCode.value.trim();
    try {
      if (id.includes('://')) id = new URL(id).searchParams.get('room') || '';
      await join(id);
    } catch (error) { notice = error.message; message.textContent = notice; }
  });
  document.getElementById('copy-room-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomLink.value); notice = 'Enllaç copiat. Envia’l a les persones amb qui vols jugar.'; }
    catch { notice = 'Selecciona i copia l’enllaç del camp.'; roomLink.select(); }
    refreshControls();
  });
  document.getElementById('leave-room').addEventListener('click', () => {
    const url = new URL(location.href); url.search = ''; url.hash = ''; location.assign(url.href);
  });
  const initialRoom = new URLSearchParams(location.search).get('room');
  if (initialRoom) join(initialRoom).catch(error => { notice = error.message; refreshControls(); });
  setInterval(() => { if (!document.hidden) void poll(); }, 1000);
  window.addEventListener('online', () => void poll());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });
})();
