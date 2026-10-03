import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createGameDOM } from '../server/game-dom.mjs';
import { runGame } from '../.generated/game-engine.mjs';

function client(saved = new Map()) {
  const document = createGameDOM();
  const buttons = [[0,-1],[0,1],[-1,0],[1,0],[0,0]].map(([x,y]) => ({
    dataset: { postHitCol: String(x), postHitRow: String(y) },
    addEventListener(type, callback) { this[type] = callback; }
  }));
  document.getElementById('post-hit-movement').querySelectorAll = () => buttons;
  for (const element of document.querySelectorAll('.draggable')) {
    element.style.setProperty = function(key, value) { this[key] = value; };
    element.setPointerCapture = () => {};
    element.hasPointerCapture = () => false;
  }
  const context = vm.createContext({ document, URLSearchParams,
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key,value) => saved.set(key,value) },
    window: { location: { search: '' }, addEventListener() {}, matchMedia: () => ({ matches: true }) }
  });
  vm.runInContext(readFileSync('versio-nova/script.js', 'utf8'), context);
  return { context, document, buttons, saved };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('orientation preserves every logical cell and shared snapshot; preference is local', () => {
  const { context: c, document: d, saved } = client();
  const ball = d.getElementById('ball');
  for (let col = 0; col < 6; col++) for (let row = 0; row < 2; row++) {
    const player = d.querySelector(col < 3 ? '.player-left' : '.player-right');
    c.setPlayerToCell(player, { col, row });
    c.setBallToCell({ col, row });
    const state = plain(c.getGameState());
    for (const view of ['vertical', 'horizontal']) {
      c.setCourtOrientation(view);
      assert.deepEqual(plain(c.getGridCell(player)), { col, row });
      assert.deepEqual(plain(c.getGridCell(ball)), { col, row });
      assert.deepEqual(plain(c.getGameState()), state);
      c.restoreGame(state);
      assert.equal(d.getElementById('court').dataset.orientation, view);
      assert.equal(player.style['--vertical-x'], `${100 - parseFloat(player.style.top)}%`);
      assert.equal(player.style['--vertical-y'], player.style.left);
    }
  }
  c.setCourtOrientation('vertical');
  assert.equal(client(saved).document.getElementById('court').dataset.orientation, 'vertical');
  assert.equal(client().document.getElementById('court').dataset.orientation, 'horizontal');
});

test('screen arrows move both players correctly and never cross a boundary in either view', () => {
  const { context: c, document: d, buttons } = client();
  const deltas = { horizontal: [[0,-1],[0,1],[-1,0],[1,0],[0,0]],
    vertical: [[-1,0],[1,0],[0,1],[0,-1],[0,0]] };
  for (const view of ['horizontal', 'vertical']) {
    c.setCourtOrientation(view);
    for (let col = 0; col < 6; col++) for (let row = 0; row < 2; row++) {
      const side = col < 3 ? 'left' : 'right';
      const player = d.querySelector(`.player-${side}`);
      for (let i = 0; i < buttons.length; i++) {
        const state = runGame(null, null);
        state.turn.phase = 'reposition'; state.turn.activeSide = side;
        state.playerPositions[side] = { left: `${(col+.5)/6*100}%`, top: `${(row+.5)/2*100}%` };
        c.restoreGame(state);
        const [dx,dy] = deltas[view][i];
        const dest = { col: col+dx, row: row+dy };
        const valid = dest.col >= (side === 'left' ? 0 : 3) && dest.col <= (side === 'left' ? 2 : 5) && dest.row >= 0 && dest.row <= 1;
        assert.equal(buttons[i].disabled, !valid, `${view} ${col},${row} direction ${i}`);
        if (valid) {
          buttons[i].click();
          assert.deepEqual(plain(c.getGridCell(player)), dest);
          const server = runGame(state, { type: 'reposition', colStep: dx, rowStep: dy });
          assert.deepEqual(plain(c.getGameState()), server);
        }
      }
    }
  }
});

test('dragging maps visible cells to canonical multiplayer actions, including frame and grab offset', () => {
  const { context: c, document: d } = client();
  const ball = d.getElementById('ball'), court = d.getElementById('court');
  const sent = [];
  c.window.multiplayer = { active: true, canAct: () => true, dispatch: (...args) => sent.push(args) };
  for (const view of ['horizontal', 'vertical']) {
    c.setCourtOrientation(view);
    court.clientLeft = court.clientTop = 8;
    court.clientWidth = view === 'vertical' ? 304 : 464;
    court.clientHeight = view === 'vertical' ? 464 : 304;
    court.getBoundingClientRect = () => ({ left: 37, top: 81, width: court.clientWidth+16, height: court.clientHeight+16 });
    for (let col = 3; col < 6; col++) for (let row = 0; row < 2; row++) {
      const state = runGame(null, null);
      state.turn.phase = 'return'; state.turn.ballPlaced = true;
      c.restoreGame(state);
      const rect = ball.getBoundingClientRect();
      c.startDrag({ currentTarget: ball, pointerId: 1, clientX: rect.left+rect.width/2+3, clientY: rect.top+rect.height/2-2 });
      const x = (col+.5)/6, y = (row+.5)/2;
      c.moveDrag({ clientX: 37+8+(view === 'vertical' ? 1-y : x)*court.clientWidth+3,
        clientY: 81+8+(view === 'vertical' ? x : y)*court.clientHeight-2 });
      c.endDrag({ pointerId: 1 });
      assert.deepEqual(plain(sent.at(-1)), ['placeBall', { cell: { col, row } }]);
    }
  }
});
