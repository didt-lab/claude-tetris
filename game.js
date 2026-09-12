'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const leaderboardListEl = document.getElementById('leaderboard-list');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameEntrySection = document.getElementById('name-entry-section');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');
const overlayLeaderboardSection = document.getElementById('overlay-leaderboard-section');
const overlayLeaderboardListEl = document.getElementById('overlay-leaderboard-list');

const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const BEST_LINES_KEY = 'tetris-best-lines';
const MAX_HIGHSCORES = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let comboCount = 0;
let pendingScoreEntry = null;
let highScores = loadHighScores();
let bestCombo = loadNumber(BEST_COMBO_KEY);
let bestLines = loadNumber(BEST_LINES_KEY);

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e.score === 'number')
      .map(e => ({ name: String(e.name || 'Jugador').slice(0, 12), score: e.score }));
  } catch (e) {
    return [];
  }
}

function saveHighScores() {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(highScores));
}

function loadNumber(key) {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveBestCombo() {
  localStorage.setItem(BEST_COMBO_KEY, String(bestCombo));
}

function saveBestLines() {
  localStorage.setItem(BEST_LINES_KEY, String(bestLines));
}

function updateStatsDisplay() {
  bestComboEl.textContent = bestCombo;
  bestLinesEl.textContent = bestLines;
}

function renderLeaderboard(listEl, highlightEntry) {
  listEl.innerHTML = '';
  if (!highScores.length) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = 'Sin récords';
    listEl.appendChild(li);
    return;
  }
  highScores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-row';
    if (highlightEntry && entry === highlightEntry) li.classList.add('highlight');

    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = (i + 1) + '.';

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.name;

    const sc = document.createElement('span');
    sc.className = 'lb-score';
    sc.textContent = entry.score.toLocaleString();

    li.append(rank, name, sc);
    listEl.appendChild(li);
  });
}

function renderAllLeaderboards(highlightEntry) {
  renderLeaderboard(leaderboardListEl, highlightEntry || null);
  renderLeaderboard(overlayLeaderboardListEl, highlightEntry || null);
}

function submitScore() {
  if (!pendingScoreEntry || pendingScoreEntry.saved) return;
  const rawName = playerNameInput.value.trim();
  const name = (rawName || 'Jugador').slice(0, 12);
  const entry = { name, score: pendingScoreEntry.score };

  const qualifies = highScores.length < MAX_HIGHSCORES ||
    entry.score > highScores[highScores.length - 1].score;

  let highlightEntry = null;
  if (qualifies) {
    highScores.push(entry);
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, MAX_HIGHSCORES);
    saveHighScores();
    highlightEntry = entry;
  }

  pendingScoreEntry.saved = true;
  submitScoreBtn.disabled = true;
  playerNameInput.disabled = true;
  renderAllLeaderboards(highlightEntry);
}

function resetRecords() {
  highScores = [];
  bestCombo = 0;
  bestLines = 0;
  saveHighScores();
  saveBestCombo();
  saveBestLines();
  updateStatsDisplay();
  renderAllLeaderboards(null);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    comboCount++;
    if (comboCount > bestCombo) {
      bestCombo = comboCount;
      saveBestCombo();
    }
    if (cleared > bestLines) {
      bestLines = cleared;
      saveBestLines();
    }
    updateStatsDisplay();
    updateHUD();
  } else {
    comboCount = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  pendingScoreEntry = { score, saved: false };
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  submitScoreBtn.disabled = false;
  nameEntrySection.classList.remove('hidden');
  overlayLeaderboardSection.classList.remove('hidden');
  renderAllLeaderboards(null);
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    nameEntrySection.classList.add('hidden');
    overlayLeaderboardSection.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  comboCount = 0;
  pendingScoreEntry = null;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntrySection.classList.add('hidden');
  overlayLeaderboardSection.classList.add('hidden');
  playerNameInput.value = '';
  playerNameInput.disabled = false;
  submitScoreBtn.disabled = false;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

submitScoreBtn.addEventListener('click', submitScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.key === 'Enter') {
    e.preventDefault();
    submitScore();
  }
});
resetRecordsBtn.addEventListener('click', resetRecords);

updateStatsDisplay();
renderAllLeaderboards(null);

init();
