(() => {
  'use strict';

  const SIZE = 4;
  const BEST_KEY = '2048-snakes-best-v1';
  const GAME_KEY = '2048-snakes-state-v1';
  const SPECIES = [
    { code: 'C', name: 'Cobra' }, { code: 'T', name: 'Typan' },
    { code: 'M', name: 'Mumba' }, { code: 'V', name: 'Viper' },
    { code: 'R', name: 'Rattle' }, { code: 'K', name: 'Krait' }
  ];
  const boardEl = document.getElementById('board');
  const boardWrap = document.getElementById('board-wrap');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const undoButton = document.getElementById('undo');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayCopy = document.getElementById('overlay-copy');
  const overlayEyebrow = document.getElementById('overlay-eyebrow');
  const overlayActions = document.getElementById('overlay-actions');
  const soundButton = document.getElementById('sound-toggle');
  let board, score, best, won, keepPlaying, undoState, touchStart = null;
  let soundEnabled = true;
  let audioContext = null;
  let newCells = new Set();
  let mergedCells = new Set();

  const freshBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const cloneBoard = value => value.map(row => row.slice());

  function loadGame() {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    try {
      const saved = JSON.parse(localStorage.getItem(GAME_KEY));
      if (saved && Array.isArray(saved.board) && saved.board.length === SIZE && saved.board.every(row => Array.isArray(row) && row.length === SIZE) && saved.snakesVersion === 1) {
        board = saved.board.map(row => row.map(tile => tile && Number.isFinite(tile.value) && tile.value > 0 && SPECIES.some(s => s.code === tile.species) ? { value: tile.value, species: tile.species } : null));
        score = Number.isFinite(saved.score) ? saved.score : 0;
        won = Boolean(saved.won);
        keepPlaying = Boolean(saved.keepPlaying);
        return;
      }
    } catch (_) { /* Start a clean game if saved data is damaged. */ }
    startFresh(false);
  }

  function persist() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
      localStorage.setItem(GAME_KEY, JSON.stringify({ board, score, won, keepPlaying, snakesVersion: 1 }));
    } catch (_) { /* The game remains playable when storage is unavailable. */ }
  }

  function spawnTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) empty.push([r, c]);
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .map(([row, column]) => board[row]?.[column]).filter(Boolean);
    const nearbySpecies = neighbors.map(tile => tile.species);
    const species = nearbySpecies.length && Math.random() < 0.8
      ? nearbySpecies[Math.floor(Math.random() * nearbySpecies.length)]
      : SPECIES[Math.floor(Math.random() * SPECIES.length)].code;
    board[r][c] = { value: Math.random() < 0.95 ? 2 : 4, species };
    newCells.add(`${r},${c}`);
    return [r, c];
  }

  function startFresh(confirmFirst = true) {
    if (confirmFirst && board && board.some(row => row.some(Boolean)) && !window.confirm('Start a new game? Your current board will be cleared.')) return;
    board = freshBoard(); score = 0; won = false; keepPlaying = false; undoState = null;
    newCells = new Set(); mergedCells = new Set();
    board[1][1] = { value: 2, species: 'C' };
    board[1][2] = { value: 2, species: 'C' };
    spawnTile();
    overlay.hidden = true;
    persist(); render();
  }

  function render() {
    boardEl.replaceChildren();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const tile = board[r][c];
      const value = tile ? tile.value : 0;
      const cell = document.createElement('div');
      cell.className = `cell${tile ? ` tile-${value <= 2048 ? value : 'super'} species-${tile.species}` : ''}`;
      if (newCells.has(`${r},${c}`)) cell.classList.add('tile-new');
      if (mergedCells.has(`${r},${c}`)) cell.classList.add('tile-merged');
      cell.setAttribute('role', 'gridcell');
      const species = tile && SPECIES.find(s => s.code === tile.species);
      cell.setAttribute('aria-label', tile ? `${value}, ${species.name}` : 'empty');
      if (tile) {
        const number = document.createElement('span'); number.className = 'tile-value'; number.textContent = value;
        const buddy = document.createElement('span'); buddy.className = `tile-buddy buddy-${tile.species}`; buddy.setAttribute('aria-hidden', 'true');
        const tag = document.createElement('span'); tag.className = 'tile-species'; tag.textContent = tile.species;
        const snake = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        snake.setAttribute('viewBox', '0 0 32 24'); snake.setAttribute('class', 'snake-glyph');
        snake.innerHTML = '<path d="M3 18c4-8 8 7 13-2s8-8 12-4"/><path d="M23 7c1-3 5-3 6-1l-1 5-5-1"/><circle cx="27" cy="8" r=".8" class="snake-eye"/><path d="M4 16l-2 1 2 2" class="snake-tail"/>';
        buddy.append(tag, snake);
        cell.append(number, buddy);
      }
      boardEl.append(cell);
    }
    scoreEl.textContent = score.toLocaleString();
    bestEl.textContent = best.toLocaleString();
    undoButton.disabled = !undoState;
    newCells = new Set(); mergedCells = new Set();
    updateOverlay();
  }

  function updateOverlay() {
    if (won && !keepPlaying) {
      overlayEyebrow.textContent = 'That’s a big one';
      overlayTitle.textContent = 'You made it!';
      overlayCopy.textContent = 'You reached 2048. Want to keep playing?';
      overlayActions.replaceChildren(makeButton('Keep playing', 'button button-primary', () => { keepPlaying = true; overlay.hidden = true; persist(); render(); }), makeButton('New game', 'button button-secondary', () => startFresh(true)));
      overlay.hidden = false;
    } else if (isGameOver()) {
      overlayEyebrow.textContent = 'Every move counts';
      overlayTitle.textContent = 'No more moves';
      overlayCopy.textContent = `Final score: ${score.toLocaleString()}. Fancy another round?`;
      overlayActions.replaceChildren(makeButton('Play again', 'button button-primary', () => startFresh(false)));
      overlay.hidden = false;
    }
  }

  function makeButton(label, className, onClick) {
    const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label; button.addEventListener('click', onClick); return button;
  }

  function isGameOver() {
    if (board.some(row => row.includes(null))) return false;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (r < SIZE - 1 && canMerge(board[r][c], board[r + 1][c])) return false;
      if (c < SIZE - 1 && canMerge(board[r][c], board[r][c + 1])) return false;
    }
    return true;
  }

  function canMerge(a, b) { return Boolean(a && b && a.value === b.value && a.species === b.species); }

  function playHiss() {
    if (!soundEnabled) return;
    try {
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextType) return;
      audioContext ||= new AudioContextType();
      if (audioContext.state === 'suspended') audioContext.resume();
      const duration = 0.22;
      const noise = audioContext.createBufferSource();
      const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const filter = audioContext.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 2100; filter.Q.value = 0.7;
      const volume = audioContext.createGain();
      const now = audioContext.currentTime;
      volume.gain.setValueAtTime(0.0001, now); volume.gain.exponentialRampToValueAtTime(0.07, now + 0.025); volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(filter); filter.connect(volume); volume.connect(audioContext.destination);
      noise.start(now); noise.stop(now + duration);
    } catch (_) { /* Audio is optional; keep the game playable when unavailable. */ }
  }

  function updateSoundButton() {
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.setAttribute('aria-label', soundEnabled ? 'Turn sound off' : 'Turn sound on');
    soundButton.title = soundEnabled ? 'Sound on' : 'Sound off';
    soundButton.querySelector('.sound-label').textContent = soundEnabled ? 'Sound on' : 'Sound off';
  }

  function move(direction) {
    if (overlay && !overlay.hidden) return;
    const before = { board: cloneBoard(board), score, won, keepPlaying };
    const next = freshBoard(); let gained = 0; let changed = false;
    const mergePositions = new Set();
    for (let line = 0; line < SIZE; line++) {
      const coords = [];
      for (let i = 0; i < SIZE; i++) {
        let r, c;
        if (direction === 'left') { r = line; c = i; }
        else if (direction === 'right') { r = line; c = SIZE - 1 - i; }
        else if (direction === 'up') { r = i; c = line; }
        else { r = SIZE - 1 - i; c = line; }
        coords.push([r, c]);
      }
      const values = coords.map(([r, c]) => board[r][c]).filter(Boolean);
      const result = [];
      for (let i = 0; i < values.length; i++) {
        if (canMerge(values[i], values[i + 1])) { result.push({ value: values[i].value * 2, species: values[i].species }); gained += values[i].value * 2; i++; }
        else result.push(values[i]);
      }
      coords.forEach(([r, c], i) => { next[r][c] = result[i] || null; if (result[i] && (!board[r][c] || result[i].value !== board[r][c].value || result[i].species !== board[r][c].species)) changed = true; });
    }
    if (!changed) return;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if ((!next[r][c]) !== (!board[r][c]) || (next[r][c] && board[r][c] && (next[r][c].value !== board[r][c].value || next[r][c].species !== board[r][c].species))) changed = true;
      if (next[r][c] && board[r][c] && next[r][c].value > board[r][c].value) mergePositions.add(`${r},${c}`);
    }
    if (!changed) return;
    board = next; score += gained; best = Math.max(best, score); undoState = before;
    mergedCells = mergePositions;
    if (!won && board.some(row => row.some(tile => tile && tile.value >= 2048))) won = true;
    spawnTile(); persist(); render();
    if (gained) {
      playHiss();
      const pop = document.getElementById('score-pop'); pop.textContent = `+${gained}`; pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
    }
  }

  function undo() {
    if (!undoState) return;
    board = cloneBoard(undoState.board); score = undoState.score; won = undoState.won; keepPlaying = undoState.keepPlaying; undoState = null;
    overlay.hidden = true; persist(); render();
  }

  function onKey(event) {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[event.key]) { event.preventDefault(); move(map[event.key]); }
    else if (event.key.toLowerCase() === 'z' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); undo(); }
  }

  boardWrap.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  boardWrap.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
  boardWrap.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  window.addEventListener('keydown', onKey);
  undoButton.addEventListener('click', undo);
  document.getElementById('new-game').addEventListener('click', () => startFresh(true));
  document.getElementById('new-game-top').addEventListener('click', () => startFresh(true));
  soundButton.addEventListener('click', () => { soundEnabled = !soundEnabled; updateSoundButton(); });

  updateSoundButton(); loadGame(); render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
