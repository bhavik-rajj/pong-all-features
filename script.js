const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const gameWrap = document.getElementById("gameWrap");
const result = document.getElementById("result");

const playerScoreEl = document.getElementById("playerScore");
const aiScoreEl = document.getElementById("aiScore");
const bestEl = document.getElementById("bestScore");

const statusEl = document.getElementById("statusText");
const roundEl = document.getElementById("roundText");
const countdownEl = document.getElementById("countdown");

const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultIcon = document.getElementById("resultIcon");

let W = 960;
let H = 540;
let dpr = 1;

let level = "normal";
let running = false;
let paused = false;
let sound = true;
let raf = 0;

let player = {
  x: 28,
  y: 220,
  w: 14,
  h: 100,
  score: 0
};

let ai = {
  x: 918,
  y: 220,
  w: 14,
  h: 100,
  score: 0
};

let ball = {
  x: 480,
  y: 270,
  r: 9,
  vx: 6,
  vy: 2.5
};

let particles = [];
let keys = {};
let touchY = null;

const settings = {
  easy: {
    speed: 4.1,
    error: 55
  },

  normal: {
    speed: 5.4,
    error: 28
  },

  hard: {
    speed: 7,
    error: 9
  }
};


/* =========================
   RESIZE
========================= */

function resize() {
  const rect = canvas.getBoundingClientRect();

  dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  W = canvas.width / dpr;
  H = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  player.x = 28;
  ai.x = W - 42;

  player.w = 14;
  ai.w = 14;

  player.h = H * 0.19;
  ai.h = H * 0.19;

  if (!running) {
    resetPositions();
  }
}


/* =========================
   RESET
========================= */

function resetPositions() {
  player.y = H / 2 - player.h / 2;
  ai.y = H / 2 - ai.h / 2;

  ball.x = W / 2;
  ball.y = H / 2;
}


/* =========================
   HIGH SCORE
========================= */

function saveBest() {
  let best = Number(localStorage.getItem("neonPongBest")) || 0;

  if (player.score > best) {
    localStorage.setItem("neonPongBest", player.score);
    best = player.score;
  }

  bestEl.textContent = best;
}


/* =========================
   SOUND
========================= */

function beep(freq = 440, duration = 0.05) {
  if (!sound) return;

  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!window._audio) {
      window._audio = new AudioContext();
    }

    const oscillator = window._audio.createOscillator();
    const gain = window._audio.createGain();

    oscillator.frequency.value = freq;
    oscillator.type = "sine";

    gain.gain.value = 0.035;

    oscillator.connect(gain);
    gain.connect(window._audio.destination);

    oscillator.start();

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      window._audio.currentTime + duration
    );

    oscillator.stop(
      window._audio.currentTime + duration
    );

  } catch (error) {
    // Audio may be blocked until the user interacts with the page.
  }
}


/* =========================
   DIFFICULTY
========================= */

function setLevel(newLevel) {
  level = newLevel;

  document
    .querySelectorAll(".difficulty button")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.level === newLevel
      );
    });
}


/* =========================
   LAUNCH BALL
========================= */

function launch() {
  ball.x = W / 2;
  ball.y = H / 2;

  const direction = Math.random() < 0.5 ? -1 : 1;
  const angle = Math.random() * 0.8 - 0.4;

  ball.vx =
    direction *
    (5.2 + Math.random() * 1.4);

  ball.vy = angle * 4;

  statusEl.textContent = "PLAYING";
}


/* =========================
   PARTICLES
========================= */

function particlesAt(x, y, amount = 9) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 1
    });
  }
}


/* =========================
   START GAME
========================= */

function start() {
  menu.classList.add("hidden");
  result.classList.add("hidden");
  gameWrap.classList.remove("hidden");

  player.score = 0;
  ai.score = 0;

  playerScoreEl.textContent = "0";
  aiScoreEl.textContent = "0";

  roundEl.textContent = "ROUND 1";

  running = true;
  paused = false;

  resetPositions();

  countdown();

  cancelAnimationFrame(raf);

  raf = requestAnimationFrame(loop);
}


/* =========================
   COUNTDOWN
========================= */

function countdown() {
  countdownEl.classList.remove("hidden");

  let number = 3;

  countdownEl.textContent = number;
  statusEl.textContent = "READY";

  const timer = setInterval(() => {
    number--;

    if (number > 0) {
      countdownEl.textContent = number;
    } else {
      clearInterval(timer);

      countdownEl.classList.add("hidden");

      launch();
    }

  }, 650);
}


/* =========================
   SCORE
========================= */

function score(who) {

  if (who === "player") {

    player.score++;

    beep(740, 0.1);

    particlesAt(
      W - 28,
      ball.y,
      18
    );

  } else {

    ai.score++;

    beep(180, 0.1);

    particlesAt(
      28,
      ball.y,
      18
    );
  }

  playerScoreEl.textContent = player.score;
  aiScoreEl.textContent = ai.score;

  if (
    player.score >= 7 ||
    ai.score >= 7
  ) {

    finish(player.score > ai.score);

  } else {

    roundEl.textContent =
      `ROUND ${player.score + ai.score + 1}`;

    setTimeout(launch, 450);
  }
}


/* =========================
   FINISH
========================= */

function finish(playerWon) {

  running = false;

  saveBest();

  result.classList.remove("hidden");
  gameWrap.classList.add("hidden");

  if (playerWon) {

    resultTitle.textContent = "YOU WIN!";

    resultText.textContent =
      `Final score ${player.score}–${ai.score}. Keep pushing your high score!`;

    resultIcon.textContent = "🏆";

    beep(880, 0.18);

  } else {

    resultTitle.textContent = "AI WINS";

    resultText.textContent =
      `Final score ${player.score}–${ai.score}. Try a lower difficulty!`;

    resultIcon.textContent = "⚡";

    beep(120, 0.18);
  }
}


/* =========================
   UPDATE GAME
========================= */

function update() {

  if (paused) return;

  let move = 0;

  if (keys.ArrowUp || keys.w) {
    move -= 1;
  }

  if (keys.ArrowDown || keys.s) {
    move += 1;
  }

  player.y += move * 7;


  /* Mobile control */

  if (touchY !== null) {
    player.y =
      touchY - player.h / 2;
  }


  /* Keep player inside */

  player.y = Math.max(
    8,
    Math.min(
      H - player.h - 8,
      player.y
    )
  );


  /* AI */

  const aiSettings = settings[level];

  const target =
    ball.y +
    (Math.random() - 0.5) *
    aiSettings.error;

  const aiCenter =
    ai.y + ai.h / 2;

  if (aiCenter < target) {
    ai.y += aiSettings.speed;
  } else {
    ai.y -= aiSettings.speed;
  }

  ai.y = Math.max(
    8,
    Math.min(
      H - ai.h - 8,
      ai.y
    )
  );


  /* Ball */

  ball.x += ball.vx;
  ball.y += ball.vy;


  /* Top / bottom */

  if (
    ball.y - ball.r < 5 ||
    ball.y + ball.r > H - 5
  ) {

    ball.vy *= -1;

    ball.y = Math.max(
      ball.r + 5,
      Math.min(
        H - ball.r - 5,
        ball.y
      )
    );

    beep(300, 0.035);

    particlesAt(
      ball.x,
      ball.y,
      5
    );
  }


  /* Player collision */

  if (
    ball.vx < 0 &&
    ball.x - ball.r <
      player.x + player.w &&
    ball.x + ball.r >
      player.x &&
    ball.y > player.y &&
    ball.y < player.y + player.h
  ) {

    const relative =
      (ball.y -
        (player.y + player.h / 2)) /
      (player.h / 2);

    ball.vx =
      Math.abs(ball.vx) * 1.045;

    ball.vy =
      relative * 6;

    ball.x =
      player.x +
      player.w +
      ball.r;

    beep(560, 0.04);

    particlesAt(
      ball.x,
      ball.y,
      8
    );
  }


  /* AI collision */

  if (
    ball.vx > 0 &&
    ball.x + ball.r > ai.x &&
    ball.x - ball.r <
      ai.x + ai.w &&
    ball.y > ai.y &&
    ball.y < ai.y + ai.h
  ) {

    const relative =
      (ball.y -
        (ai.y + ai.h / 2)) /
      (ai.h / 2);

    ball.vx =
      -Math.abs(ball.vx) * 1.045;

    ball.vy =
      relative * 6;

    ball.x =
      ai.x - ball.r;

    beep(620, 0.04);

    particlesAt(
      ball.x,
      ball.y,
      8
    );
  }


  /* Scoring */

  if (ball.x < -30) {
    score("ai");
  }

  if (ball.x > W + 30) {
    score("player");
  }


  /* Particles */

  particles.forEach(particle => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 0.035;
  });

  particles =
    particles.filter(
      particle => particle.life > 0
    );
}


/* =========================
   DRAW
========================= */

function draw() {

  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  /* Background */

  ctx.fillStyle = "#050812";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );


  /* Center line */

  ctx.strokeStyle =
    "rgba(100,246,255,0.13)";

  ctx.lineWidth = 2;

  ctx.setLineDash([
    9,
    14
  ]);

  ctx.beginPath();

  ctx.moveTo(
    W / 2,
    0
  );

  ctx.lineTo(
    W / 2,
    H
  );

  ctx.stroke();

  ctx.setLineDash([]);


  /* Subtle scan lines */

  for (
    let y = 40;
    y < H;
    y += 55
  ) {

    ctx.fillStyle =
      "rgba(255,255,255,0.025)";

    ctx.fillRect(
      0,
      y,
      W,
      1
    );
  }


  /* Paddles */

  drawPaddle(player);
  drawPaddle(ai);


  /* Ball */

  ctx.shadowBlur = 24;
  ctx.shadowColor = "#64f6ff";

  ctx.fillStyle = "#dffeff";

  ctx.beginPath();

  ctx.arc(
    ball.x,
    ball.y,
    ball.r,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.shadowBlur = 0;


  /* Particles */

  particles.forEach(particle => {

    ctx.globalAlpha =
      particle.life;

    ctx.fillStyle =
      "#64f6ff";

    ctx.fillRect(
      particle.x,
      particle.y,
      3,
      3
    );
  });

  ctx.globalAlpha = 1;
}


/* =========================
   DRAW PADDLE
========================= */

function drawPaddle(paddle) {

  ctx.shadowBlur = 20;
  ctx.shadowColor = "#64f6ff";

  ctx.fillStyle = "#bdfcff";

  ctx.beginPath();

  ctx.roundRect(
    paddle.x,
    paddle.y,
    paddle.w,
    paddle.h,
    7
  );

  ctx.fill();

  ctx.shadowBlur = 0;
}


/* =========================
   GAME LOOP
========================= */

function loop() {

  if (running) {

    update();
    draw();

    raf =
      requestAnimationFrame(loop);
  }
}


/* =========================
   BUTTONS
========================= */

document
  .querySelectorAll(".difficulty button")
  .forEach(button => {

    button.onclick = () => {
      setLevel(button.dataset.level);
    };
  });


document.getElementById(
  "startBtn"
).onclick = start;


document.getElementById(
  "playAgainBtn"
).onclick = start;


document.getElementById(
  "pauseBtn"
).onclick = togglePause;


document.getElementById(
  "restartBtn"
).onclick = start;


document.getElementById(
  "menuBtn"
).onclick = () => {

  running = false;

  gameWrap.classList.add("hidden");
  result.classList.add("hidden");

  menu.classList.remove("hidden");
};


document.getElementById(
  "resultMenuBtn"
).onclick = () => {

  result.classList.add("hidden");

  menu.classList.remove("hidden");
};


/* =========================
   PAUSE
========================= */

function togglePause() {

  if (!running) return;

  paused = !paused;

  statusEl.textContent =
    paused ? "PAUSED" : "PLAYING";

  document.getElementById(
    "pauseBtn"
  ).textContent =
    paused
      ? "▶ RESUME"
      : "Ⅱ PAUSE";
}


/* =========================
   KEYBOARD
========================= */

window.onkeydown = event => {

  keys[event.key] = true;

  if (
    ["ArrowUp", "ArrowDown", " "]
      .includes(event.key)
  ) {
    event.preventDefault();
  }

  if (
    event.key === " " &&
    running
  ) {
    togglePause();
  }
};


window.onkeyup = event => {
  keys[event.key] = false;
};


/* =========================
   MOBILE / MOUSE
========================= */

canvas.addEventListener(
  "pointerdown",
  event => {

    canvas.setPointerCapture(
      event.pointerId
    );

    const rect =
      canvas.getBoundingClientRect();

    touchY =
      ((event.clientY - rect.top) /
        rect.height) *
      H;
  }
);


canvas.addEventListener(
  "pointermove",
  event => {

    if (event.buttons) {

      const rect =
        canvas.getBoundingClientRect();

      touchY =
        ((event.clientY - rect.top) /
          rect.height) *
        H;
    }
  }
);


canvas.addEventListener(
  "pointerup",
  () => {
    touchY = null;
  }
);


/* =========================
   SOUND BUTTON
========================= */

document.getElementById(
  "soundBtn"
).onclick = () => {

  sound = !sound;

  document.getElementById(
    "soundBtn"
  ).textContent =
    sound ? "🔊" : "🔇";
};


/* =========================
   INITIALIZE
========================= */

window.addEventListener(
  "resize",
  resize
);

bestEl.textContent =
  localStorage.getItem(
    "neonPongBest"
  ) || "0";

resize();
