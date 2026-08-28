// Pong with: rounds, high scores (localStorage), improved AI (prediction for Hard), particles, music, SFX, touch, and controls.
// Save as script.js alongside index.html and styles.css.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// DOM
const leftScoreEl = document.getElementById('leftScore');
const rightScoreEl = document.getElementById('rightScore');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const difficultySel = document.getElementById('difficulty');
const controlModeSel = document.getElementById('controlMode');
const soundToggle = document.getElementById('soundToggle');
const musicToggle = document.getElementById('musicToggle');
const roundsSel = document.getElementById('roundsToWin');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const playAgainBtn = document.getElementById('playAgainBtn');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');
const highScoreList = document.getElementById('highScoreList');
const clearScoresBtn = document.getElementById('clearScoresBtn');

// Game constants
const PADDLE_W = 12;
const PADDLE_H = 100;
const PADDLE_MARGIN = 12;
const LEFT_X = PADDLE_MARGIN;
const RIGHT_X = W - PADDLE_W - PADDLE_MARGIN;
const BALL_R = 8;
const MAX_PARTICLES = 80;

// Game state
const left = { x: LEFT_X, y: (H - PADDLE_H) / 2, speed: 6, wins: 0 };
const right = { x: RIGHT_X, y: (H - PADDLE_H) / 2, speed: 5, reaction: 0.5, wins: 0 };
const ball = { x: W / 2, y: H / 2, vx: 5, vy: 3, speed: 5 };
const score = { left: 0, right: 0 };

let keys = { ArrowUp: false, ArrowDown: false, KeyW: false, KeyS: false };
let mouseActive = false;
let gameState = 'stopped'; // 'running' | 'paused' | 'stopped' | 'gameover'
let lastTime = performance.now();
let audioCtx = null;
let soundEnabled = true;
let musicEnabled = false;
let musicInterval = null;
let particles = [];

// High scores stored as array in localStorage under 'pongHighScores'
function loadHighScores() {
  try {
    const raw = localStorage.getItem('pongHighScores');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
function saveHighScores(list) {
  try {
    localStorage.setItem('pongHighScores', JSON.stringify(list.slice(0, 20)));
  } catch (e) {}
}
function addHighScore(entry) {
  const list = loadHighScores();
  list.unshift(entry);
  saveHighScores(list);
  renderHighScores();
}
function clearHighScores() {
  saveHighScores([]);
  renderHighScores();
}
function renderHighScores() {
  const list = loadHighScores();
  highScoreList.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No high scores yet';
    highScoreList.appendChild(li);
    return;
  }
  list.slice(0, 10).forEach((e) => {
    const li = document.createElement('li');
    const when = new Date(e.date).toLocaleString();
    li.textContent = `${e.winner} won ${e.roundsToWin}–${e.loserScore} (${e.difficulty}) — ${when}`;
    highScoreList.appendChild(li);
  });
}

// Utility
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Audio (WebAudio)
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function playTone(freq, duration = 0.08, type = 'sine', gain = 0.12) {
  if (!soundEnabled) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(audioCtx.destination);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.start(now);
  o.stop(now + duration + 0.02);
}
function playSound(name) {
  if (!soundEnabled) return;
  if (name === 'paddle') playTone(900, 0.06, 'square', 0.12);
  if (name === 'wall') playTone(420, 0.04, 'sine', 0.08);
  if (name === 'score') playTone(220, 0.18, 'sawtooth', 0.16);
  if (name === 'start') playTone(1200, 0.12, 'sine', 0.14);
}

// Simple ambient music: soft note sequence
const MUSIC_NOTES = [220, 277, 330, 392]; // A, C#, E, G
let musicStep = 0;
function startMusic() {
  if (!musicEnabled) return;
  ensureAudio();
  stopMusic();
  musicInterval = setInterval(() => {
    if (!musicEnabled) return;
    const freq = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    // play a soft chord-ish tone
    const now = audioCtx.currentTime;
    const o1 = audioCtx.createOscillator();
    const o2 = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = freq;
    o2.frequency.value = freq * 1.5;
    g.gain.value = 0.04;
    o1.connect(g); o2.connect(g);
    g.connect(audioCtx.destination);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    o1.start(now); o2.start(now);
    o1.stop(now + 1.2); o2.stop(now + 1.2);
    musicStep++;
  }, 700);
}
function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

// Ball reset
function resetBall(towardsRight = Math.random() > 0.5) {
  ball.x = W / 2;
  ball.y = H / 2;
  const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8);
  const dir = towardsRight ? 1 : -1;
  ball.speed = 5;
  ball.vx = dir * ball.speed * Math.cos(angle);
  ball.vy = ball.speed * Math.sin(angle);
}

// Difficulty
function applyDifficulty(mode) {
  if (mode === 'easy') {
    right.speed = 3.2;
    right.reaction = 0.12;
  } else if (mode === 'normal') {
    right.speed = 5.0;
    right.reaction = 0.5;
  } else if (mode === 'hard') {
    right.speed = 9.0;
    right.reaction = 1.0;
  }
}

// Input handlers
canvas.addEventListener('mousemove', (e) => {
  if (controlModeSel.value === 'keyboard') return;
  const rect = canvas.getBoundingClientRect();
  const my = e.clientY - rect.top;
  left.y = clamp(my - PADDLE_H / 2, 0, H - PADDLE_H);
  mouseActive = true;
});
canvas.addEventListener('mouseleave', () => { mouseActive = false; });

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (controlModeSel.value === 'keyboard') return;
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  left.y = clamp(t.clientY - rect.top - PADDLE_H / 2, 0, H - PADDLE_H);
  mouseActive = true;
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (controlModeSel.value === 'keyboard') return;
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  left.y = clamp(t.clientY - rect.top - PADDLE_H / 2, 0, H - PADDLE_H);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code)) {
    if (controlModeSel.value === 'mouse') return;
    keys[e.code] = true;
    e.preventDefault();
  }
  if (e.code === 'Space') {
    toggleStartPause();
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code)) {
    keys[e.code] = false;
  }
});

// Particle system
function spawnParticles(x, y, count = 10, color = '#00d1ff') {
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.6,
      age: 0,
      color,
      size: 1 + Math.random() * 3
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.vy += 0.04; // slight gravity
    p.age += dt;
    if (p.age >= p.life) particles.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    const t = 1 - (p.age / p.life);
    ctx.globalAlpha = t;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

// Predict ball Y for AI hard mode (simulate future trajectory)
function predictBallY(ballState) {
  // simulate until it reaches x >= RIGHT_X - (PADDLE_W + BALL_R) or x <= LEFT_X + (PADDLE_W + BALL_R)
  let simX = ballState.x;
  let simY = ballState.y;
  let vx = ballState.vx;
  let vy = ballState.vy;
  const dt = 1/120; // fine-grained simulation
  for (let step = 0; step < 6000; step++) {
    simX += vx * dt * 60;
    simY += vy * dt * 60;
    if (simY - BALL_R <= 0) {
      simY = BALL_R;
      vy *= -1;
    } else if (simY + BALL_R >= H) {
      simY = H - BALL_R;
      vy *= -1;
    }
    // if it's heading toward right and has reached right-side plane
    if (vx > 0 && simX >= RIGHT_X - BALL_R - PADDLE_W) {
      return clamp(simY, 0, H);
    }
    // early exit if it goes past left (not needed for AI)
    if (vx < 0 && simX <= LEFT_X + BALL_R + PADDLE_W) {
      // will bounce off left paddle or score; return center fallback
      return clamp(simY, 0, H);
    }
  }
  return H / 2;
}

// Collision detection
function paddleCollision(p, side) {
  const nextX = ball.x + ball.vx;
  if (side === 'left') {
    if (nextX - BALL_R <= p.x + PADDLE_W && ball.x - BALL_R >= p.x) {
      if (ball.y >= p.y - 2 && ball.y <= p.y + PADDLE_H + 2) return true;
    }
  } else {
    if (nextX + BALL_R >= p.x && ball.x + BALL_R <= p.x + PADDLE_W) {
      if (ball.y >= p.y - 2 && ball.y <= p.y + PADDLE_H + 2) return true;
    }
  }
  return false;
}

// Update loop
function update(dt) {
  if (gameState !== 'running') return;

  // Keyboard paddle control
  if (controlModeSel.value !== 'mouse') {
    if (keys.ArrowUp || keys.KeyW) left.y -= left.speed;
    if (keys.ArrowDown || keys.KeyS) left.y += left.speed;
    left.y = clamp(left.y, 0, H - PADDLE_H);
  }

  // Right AI
  const diff = difficultySel.value;
  if (diff === 'hard') {
    // Predictive AI: simulate the ball to find intercept y
    const predictedY = predictBallY({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    // move toward predicted target center with speed limit
    const target = predictedY - PADDLE_H / 2;
    const dir = target - right.y;
    const step = clamp(dir, -right.speed, right.speed);
    right.y += step;
  } else {
    // simpler proportional-following AI with reaction
    const centerOffset = ball.y - (right.y + PADDLE_H / 2);
    let step = centerOffset * right.reaction;
    step = clamp(step, -right.speed, right.speed);
    right.y += step;
  }
  right.y = clamp(right.y, 0, H - PADDLE_H);

  // Move ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall collisions
  if (ball.y - BALL_R <= 0) {
    ball.y = BALL_R;
    ball.vy *= -1;
    spawnParticles(ball.x, BALL_R + 4, 8, '#ffffff');
    playSound('wall');
  } else if (ball.y + BALL_R >= H) {
    ball.y = H - BALL_R;
    ball.vy *= -1;
    spawnParticles(ball.x, H - BALL_R - 4, 8, '#ffffff');
    playSound('wall');
  }

  // Paddle collisions
  if (ball.vx < 0 && paddleCollision(left, 'left')) {
    const rel = (ball.y - (left.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    const bounceAngle = rel * (Math.PI / 4);
    const speed = Math.min(16, Math.hypot(ball.vx, ball.vy) * 1.06 + 0.4);
    ball.vx = Math.abs(speed * Math.cos(bounceAngle));
    ball.vy = speed * Math.sin(bounceAngle);
    ball.x = left.x + PADDLE_W + BALL_R + 0.5;
    spawnParticles(ball.x, ball.y, 14, '#00d1ff');
    playSound('paddle');
  } else if (ball.vx > 0 && paddleCollision(right, 'right')) {
    const rel = (ball.y - (right.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    const bounceAngle = rel * (Math.PI / 4);
    const speed = Math.min(16, Math.hypot(ball.vx, ball.vy) * 1.06 + 0.4);
    ball.vx = -Math.abs(speed * Math.cos(bounceAngle));
    ball.vy = speed * Math.sin(bounceAngle);
    ball.x = right.x - BALL_R - 0.5;
    spawnParticles(ball.x, ball.y, 14, '#ffb86b');
    playSound('paddle');
  }

  // Scoring (round end)
  if (ball.x < -BALL_R) {
    score.right += 1;
    rightScoreEl.textContent = score.right;
    playSound('score');
    spawnParticles(10, ball.y, 24, '#ff6b6b');
    nextRound('right');
  } else if (ball.x > W + BALL_R) {
    score.left += 1;
    leftScoreEl.textContent = score.left;
    playSound('score');
    spawnParticles(W - 10, ball.y, 24, '#6bffb8');
    nextRound('left');
  }

  updateParticles(dt);
}

// Round handling & game over
function getRoundsToWin() {
  return parseInt(roundsSel.value, 10) || 3;
}
function nextRound(winner) {
  // increment wins and check for game over
  if (winner === 'left') left.wins += 1;
  else right.wins += 1;
  const roundsToWin = getRoundsToWin();
  // small pause between rounds
  stopGame(); // pause so player sees the score change
  setTimeout(() => {
    if (left.wins >= roundsToWin || right.wins >= roundsToWin) {
      // Game over
      gameOver(left.wins >= roundsToWin ? 'left' : 'right');
    } else {
      resetBall(Math.random() > 0.5);
      startGame();
    }
  }, 700);
}

function gameOver(winner) {
  gameState = 'gameover';
  stopMusic();
  overlay.classList.remove('hidden');
  if (winner === 'left') {
    overlayTitle.textContent = 'You win!';
    overlayText.textContent = `Final score: ${left.wins} — ${right.wins}`;
    addHighScore({ winner: 'You', loserScore: right.wins, roundsToWin: left.wins, difficulty: difficultySel.value, date: Date.now() });
  } else {
    overlayTitle.textContent = 'Computer wins';
    overlayText.textContent = `Final score: ${left.wins} — ${right.wins}`;
    addHighScore({ winner: 'Computer', loserScore: left.wins, roundsToWin: right.wins, difficulty: difficultySel.value, date: Date.now() });
  }
}

// Draw helpers
function drawNet() {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
}
function roundRectFill(ctx, x, y, w, h, r) {
  const radius = r;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}
function drawHUD() {
  // small text: rounds to win and current wins
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(14, 12, 250, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Rounds to win: ${getRoundsToWin()}`, 24, 32);
  ctx.fillText(`Wins — You: ${left.wins}  Computer: ${right.wins}`, 24, 50);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // subtle background
  ctx.fillStyle = 'rgba(10,16,26,0.06)';
  ctx.fillRect(0, 0, W, H);
  drawNet();

  // Paddles
  ctx.fillStyle = '#00d1ff';
  roundRectFill(ctx, left.x, left.y, PADDLE_W, PADDLE_H, 6);
  roundRectFill(ctx, right.x, right.y, PADDLE_W, PADDLE_H, 6);

  // Ball
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00d1ff';
  ctx.shadowBlur = 12;
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Particles
  drawParticles();

  // HUD
  drawHUD();

  // paused overlay
  if (gameState === 'paused') {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(W/2 - 160, H/2 - 38, 320, 76);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', W/2, H/2 + 6);
  }
}

// Main loop
function loop(ts) {
  const dt = Math.min(1000 / 30, ts - lastTime);
  lastTime = ts;
  update(dt / 1000);
  draw();
  requestAnimationFrame(loop);
}

// Controls
function startGame() {
  if (gameState === 'running') return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  gameState = 'running';
  startBtn.textContent = 'Pause';
  playSound('start');
  if (musicEnabled) startMusic();
}
function pauseGame() {
  if (gameState !== 'running') return;
  gameState = 'paused';
  startBtn.textContent = 'Resume';
}
function stopGame() {
  if (gameState === 'stopped') return;
  gameState = 'stopped';
  startBtn.textContent = 'Start';
}
function toggleStartPause() {
  if (gameState === 'running') pauseGame();
  else startGame();
}
startBtn.addEventListener('click', () => { toggleStartPause(); });

resetBtn.addEventListener('click', () => {
  // Reset everything
  score.left = score.right = 0;
  leftScoreEl.textContent = '0';
  rightScoreEl.textContent = '0';
  left.wins = right.wins = 0;
  resetBall(Math.random() > 0.5);
  stopMusic();
  stopGame();
  overlay.classList.add('hidden');
  particles = [];
});

// settings
difficultySel.addEventListener('change', (e) => {
  applyDifficulty(e.target.value);
});
controlModeSel.addEventListener('change', (e) => {
  if (e.target.value === 'mouse') {
    keys = { ArrowUp: false, ArrowDown: false, KeyW: false, KeyS: false };
  }
});
soundToggle.addEventListener('change', (e) => {
  soundEnabled = e.target.checked;
});
musicToggle.addEventListener('change', (e) => {
  musicEnabled = e.target.checked;
  if (musicEnabled) {
    // ensure audio started on user gesture
    ensureAudio();
    if (gameState === 'running') startMusic();
  } else {
    stopMusic();
  }
});
roundsSel.addEventListener('change', () => {
  // resetting wins if user changes rounds mid-game
  left.wins = 0; right.wins = 0;
});

// overlay actions
playAgainBtn.addEventListener('click', () => {
  left.wins = 0; right.wins = 0;
  leftScoreEl.textContent = '0'; rightScoreEl.textContent = '0';
  overlay.classList.add('hidden');
  resetBall(Math.random() > 0.5);
  if (musicEnabled) startMusic();
  startGame();
});
closeOverlayBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  stopGame();
});

// highscore UI
clearScoresBtn.addEventListener('click', () => {
  clearHighScores();
});

// Prevent arrow/space scrolling
window.addEventListener("keydown", function(e) {
  if(["ArrowUp","ArrowDown","Space"].indexOf(e.code) > -1) {
    e.preventDefault();
  }
}, false);

// Initialization
applyDifficulty(difficultySel.value);
resetBall(Math.random() > 0.5);
renderHighScores();
requestAnimationFrame(loop);

// Make canvas focusable and resume audio on user gesture
canvas.addEventListener('click', () => {
  canvas.focus();
  if (!audioCtx) ensureAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});

/* Notes:
 - High scores are stored in localStorage as an array of objects {winner, loserScore, roundsToWin, difficulty, date}.
 - Hard AI predicts the ball's Y position by simulating its trajectory until it reaches the right paddle plane.
 - Particles are simple squares drawn on canvas; they spawn on paddle/wall/score events.
 - Music is an ambient repeating soft chord; toggle with Music checkbox.
 - This file is intended for local usage — no external assets required.
*/
