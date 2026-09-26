// A small, isolated board adapter lets the browser and server run the same rules.
// No browser code is evaluated dynamically and no match state is kept globally.
export function createGameDOM() {
  class Element {
    constructor() {
      this.value = '2'; this.textContent = ''; this.dataset = {}; this.style = {};
      this.disabled = false; this.hidden = false; this.open = false; this.children = [];
      this.options = [{}, {}];
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    addEventListener() {}
    setAttribute() {}
    replaceChildren() { this.children = []; }
    append(child) { this.children.push(child); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    querySelectorAll() { return []; }
    getBoundingClientRect() {
      if (this.isCourt) return { left: 0, top: 0, width: 600, height: 400 };
      const width = this.dataset.type === 'ball' ? 32 : 30;
      return { left: parseFloat(this.style.left) * 6 - width / 2,
        top: parseFloat(this.style.top) * 4 - 15, width, height: 30 };
    }
  }
  const ids = new Map();
  const get = (id) => { if (!ids.has(id)) ids.set(id, new Element()); return ids.get(id); };
  const stats = ['Saque', 'Restada', 'General', 'Voleia'];
  const cards = ['left', 'right'].map((side) => {
    const card = new Element(); card.dataset.player = side;
    const name = get(`name-${side}`); name.value = side === 'left' ? 'Ferran' : 'Joan Albert';
    const energy = new Element(); energy.value = '5';
    const maximum = new Element(); maximum.value = '5';
    const recovery = new Element(); recovery.value = '50';
    const result = new Element(), adjust = new Element(), info = new Element(), remove = new Element();
    remove.closest = () => card;
    const rows = stats.map((stat) => {
      const row = new Element(); row.dataset.statName = stat;
      row.input = new Element(); row.querySelector = () => row.input;
      row.closest = () => card; return row;
    });
    card.querySelector = (selector) => {
      const match = selector.match(/data-stat-name="([^"]+)"/);
      if (match) return rows.find(row => row.dataset.statName === match[1]);
      return { 'input[type="text"]': name, '.energy-input': energy, '.stat-max': maximum,
        '.recovery-factor': recovery, '.hit-result': result, '.hit-adjust': adjust,
        '.adjust-info': info, '.remove-minus-btn': remove }[selector];
    };
    card.querySelectorAll = (selector) => selector === '.stat-row' ? rows : rows.map(row => row.input);
    return card;
  });
  const players = ['left', 'right'].map((side, index) => {
    const player = new Element(); player.dataset = { type: 'player', side };
    player.style = { left: index ? '90%' : '10%', top: index ? '76%' : '24%' }; return player;
  });
  get('court').isCourt = true;
  get('ball').dataset.type = 'ball'; get('ball').style = { left: '16%', top: '24%' };
  get('serve-difficulty').value = '1'; get('initial-server').value = 'left'; get('match-best-of').value = '3';
  return {
    getElementById: get, createElement: () => new Element(), addEventListener() {},
    querySelector(selector) {
      if (selector === '.player-left') return players[0];
      if (selector === '.player-right') return players[1];
      const match = selector.match(/data-player="(left|right)"/);
      return match ? cards[match[1] === 'left' ? 0 : 1] : null;
    },
    querySelectorAll(selector) {
      if (selector === '.player-card') return cards;
      if (selector === '.stat-input') return cards.flatMap(card => card.querySelectorAll(selector));
      if (selector === '.draggable') return [...players, get('ball')];
      if (selector === '.hit-result' || selector === '.remove-minus-btn' || selector === '.hit-adjust') {
        return cards.map(card => card.querySelector(selector));
      }
      return [];
    }
  };
}
