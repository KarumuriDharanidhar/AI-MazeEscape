(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const COLS = 27, ROWS = 19, CELL = 28;
  const W = COLS * CELL, H = ROWS * CELL;
  canvas.width = W; canvas.height = H;

  const C = {
    bg: "#080d1e", floor: "#0d1730", wall: "#202d50", edge: "#354d7b",
    cyan: "#31ebff", pink: "#ff41be", yellow: "#ffdc57", green: "#55ff96",
    white: "#e6f1ff", muted: "#8297be"
  };

  let grid, player, enemy, key, exit, hasKey, hintPath = [], hintUntil = 0;
  let level = 1, score = 0, lives = 3, best = Number(localStorage.getItem("aiMazeBest") || 0);
  let mode = "menu", moveLock = 0, enemyClock = 0, startedAt = 0, elapsed = 0;
  let message = "System ready. Press START GAME.", messageUntil = 0;
  let audioContext = null, soundOn = false, lastFrame = 0;
  let lastEnemyMove = 0;

  function say(text, seconds = 2.2) {
    message = text;
    messageUntil = performance.now() + seconds * 1000;
    $("message").textContent = text;
  }

  function beep(frequency = 600, duration = 0.07, type = "sine") {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start(); osc.stop(audioContext.currentTime + duration);
    } catch (_) { /* Audio is optional; game remains playable without it. */ }
  }

  function generateMaze() {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
    const start = [1, 1];
    g[1][1] = 0;
    const stack = [start];
    const dirs = [[0,-2],[0,2],[-2,0],[2,0]];
    while (stack.length) {
      const [x,y] = stack[stack.length - 1];
      const choices = dirs.map(([dx,dy]) => [x+dx,y+dy,dx,dy])
        .filter(([nx,ny]) => nx > 0 && nx < COLS-1 && ny > 0 && ny < ROWS-1 && g[ny][nx] === 1);
      if (!choices.length) { stack.pop(); continue; }
      const [nx,ny,dx,dy] = choices[Math.floor(Math.random()*choices.length)];
      g[y+dy/2][x+dx/2] = 0;
      g[ny][nx] = 0;
      stack.push([nx,ny]);
    }
    // A few extra passages create route choices.
    for (let i=0; i<Math.floor(COLS*ROWS/22); i++) {
      const x = 1 + Math.floor(Math.random()*(COLS-2));
      const y = 1 + Math.floor(Math.random()*(ROWS-2));
      if (g[y][x] !== 1) continue;
      const horizontal = x > 1 && x < COLS-2 && g[y][x-1]===0 && g[y][x+1]===0;
      const vertical = y > 1 && y < ROWS-2 && g[y-1][x]===0 && g[y+1][x]===0;
      if (horizontal || vertical) g[y][x] = 0;
    }
    return g;
  }

  const same = (a,b) => a && b && a[0]===b[0] && a[1]===b[1];
  function walkable([x,y]) {
    return y >= 0 && y < ROWS && x >= 0 && x < COLS && grid[y][x] === 0;
  }
  function neighbors(pos) {
    const [x,y] = pos;
    return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(walkable);
  }

  // BFS returns a shortest path through the unweighted maze.
  function bfs(start, goal) {
    const queue = [start], parent = new Map([[start.join(","), null]]);
    for (let head=0; head<queue.length; head++) {
      const current = queue[head];
      if (same(current, goal)) break;
      for (const next of neighbors(current)) {
        const keyId = next.join(",");
        if (!parent.has(keyId)) {
          parent.set(keyId, current);
          queue.push(next);
        }
      }
    }
    const goalId = goal.join(",");
    if (!parent.has(goalId)) return [];
    const path = [];
    let node = goal;
    while (node) {
      path.push(node);
      node = parent.get(node.join(","));
    }
    return path.reverse();
  }

  function startLevel() {
    grid = generateMaze();
    player = [1,1];
    exit = [COLS-2, ROWS-2];
    grid[exit[1]][exit[0]] = 0;
    const route = bfs(player, exit);
    const candidates = route.slice(3, -3);
    key = candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : route[Math.max(1, route.length-2)];
    hasKey = false;
    hintPath = [];
    enemy = chooseEnemy();
    enemyClock = 0;
    moveLock = 0;
    startedAt = performance.now();
    elapsed = 0;
    updateHUD();
    $("keyStatus").textContent = "Collect it to unlock the exit";
    $("exitStatus").textContent = "Locked until key collected";
  }

  function chooseEnemy() {
    const floors = [];
    for (let y=1; y<ROWS-1; y++) for (let x=1; x<COLS-1; x++) {
      if (grid[y][x]===0 && Math.abs(x-1)+Math.abs(y-1)>10 && !same([x,y],exit) && !same([x,y],key)) floors.push([x,y]);
    }
    return floors[Math.floor(Math.random()*floors.length)] || [COLS-2,1];
  }

  function newGame() {
    level = 1; score = 0; lives = 3;
    startLevel();
    mode = "playing";
    $("overlay").classList.add("hidden");
    say("Find the key, avoid the hunter, then reach the exit.", 4);
    beep(520, .12);
  }

  function newMaze() {
    if (mode === "menu") { newGame(); return; }
    startLevel();
    say("New maze generated. Good luck!");
    if (mode === "paused") mode = "playing";
    $("overlay").classList.add("hidden");
  }

  function updateHUD() {
    $("level").textContent = level;
    $("score").textContent = score;
    $("lives").textContent = "♥ ".repeat(lives).trim() || "—";
    best = Math.max(best, score);
    $("best").textContent = best;
    $("time").textContent = formatTime(elapsed);
  }
  function formatTime(seconds) {
    const n = Math.max(0, Math.floor(seconds));
    return String(Math.floor(n/60)).padStart(2,"0") + ":" + String(n%60).padStart(2,"0");
  }
  function persistBest() {
    best = Math.max(best, score);
    localStorage.setItem("aiMazeBest", String(best));
    $("best").textContent = best;
  }

  function catchPlayer() {
    lives--;
    score = Math.max(0, score-50);
    beep(150, .2, "sawtooth");
    if (lives <= 0) {
      mode = "gameover";
      persistBest();
      showOverlay("GAME OVER", `Final score: ${score}. Best score: ${best}.`, "PLAY AGAIN");
    } else {
      player = [1,1];
      enemy = chooseEnemy();
      say("CAUGHT! -50 points. You lost a life.", 2.5);
    }
    updateHUD();
  }

  function movePlayer(dx,dy) {
    if (mode !== "playing") return;
    const next = [player[0]+dx, player[1]+dy];
    if (!walkable(next)) return;
    player = next;
    beep(280, .025);
    if (!hasKey && same(player,key)) {
      hasKey = true;
      score += 100*level;
      $("keyStatus").textContent = "Collected!";
      $("exitStatus").textContent = "Unlocked — reach the green exit";
      say("KEY ACQUIRED! The exit is unlocked.", 2.5);
      beep(900,.14);
    }
    if (same(player,enemy)) { catchPlayer(); return; }
    if (same(player,exit)) {
      if (!hasKey) {
        say("Exit locked. Find the glowing yellow key!", 2);
      } else {
        const bonus = Math.max(0, 250-Math.floor(elapsed*4)) + level*100;
        score += bonus;
        persistBest();
        say(`LEVEL CLEARED! +${bonus} points`, 2);
        level++;
        startLevel();
        beep(1000,.2);
        updateHUD();
      }
    }
    updateHUD();
  }

  function useHint() {
    if (mode !== "playing") return;
    if (score < 25) { say("Hints cost 25 points. Collect the key to earn points.", 2.5); return; }
    hintPath = bfs(player, hasKey ? exit : key);
    score -= 25;
    hintUntil = performance.now()+3000;
    say("AI ROUTE SHOWN (-25 POINTS)", 1.7);
    updateHUD();
    beep(740,.08);
  }

  function showOverlay(title, text, button) {
    $("overlayTitle").textContent = title;
    $("overlayText").textContent = text;
    $("mainBtn").textContent = button;
    $("overlay").classList.remove("hidden");
  }
  function pauseGame() {
    if (mode === "playing") {
      mode = "paused";
      showOverlay("PAUSED", "Take a breath. Press resume when you're ready.", "RESUME");
    } else if (mode === "paused") {
      mode = "playing";
      $("overlay").classList.add("hidden");
    }
  }

  function roundedRect(x,y,w,h,r) {
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,r);
  }
  function glowCircle(x,y,r,color) {
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
    // Fine background lines.
    ctx.strokeStyle = "rgba(45,80,130,.12)"; ctx.lineWidth = 1;
    for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    if (!grid) { requestAnimationFrame(draw); return; }
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) {
      const px=x*CELL, py=y*CELL;
      if(grid[y][x]) {
        ctx.fillStyle=C.wall; ctx.fillRect(px,py,CELL,CELL);
        ctx.strokeStyle=C.edge; ctx.strokeRect(px+.5,py+.5,CELL-1,CELL-1);
      } else {
        ctx.fillStyle=C.floor; ctx.fillRect(px,py,CELL,CELL);
      }
    }
    if (hintPath.length && performance.now()<hintUntil) {
      ctx.fillStyle="rgba(49,235,255,.26)";
      for(const [x,y] of hintPath) { ctx.beginPath();ctx.arc(x*CELL+CELL/2,y*CELL+CELL/2,5,0,Math.PI*2);ctx.fill(); }
    } else if (performance.now()>=hintUntil) hintPath=[];

    const center=(p)=>[p[0]*CELL+CELL/2,p[1]*CELL+CELL/2];
    let [ex,ey]=center(exit);
    ctx.save(); ctx.shadowBlur=hasKey?18:4; ctx.shadowColor=hasKey?C.green:"#626b87";
    ctx.fillStyle=hasKey?C.green:"#59627b"; roundedRect(ex-9,ey-10,18,20,4);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle=C.bg;ctx.beginPath();ctx.arc(ex,ey-2,3,0,Math.PI*2);ctx.fill();ctx.restore();

    if(!hasKey) {
      const [kx,ky]=center(key);
      ctx.save();ctx.strokeStyle=C.yellow;ctx.lineWidth=3;ctx.shadowBlur=15;ctx.shadowColor=C.yellow;
      ctx.beginPath();ctx.arc(kx-3,ky-3,5,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(kx+1,ky+1);ctx.lineTo(kx+9,ky+9);ctx.lineTo(kx+9,ky+5);ctx.moveTo(kx+6,ky+6);ctx.lineTo(kx+6,ky+10);ctx.stroke();ctx.restore();
    }
    let [ax,ay]=center(enemy);
    glowCircle(ax,ay,10,C.pink);
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(ax-3,ay-2,2,0,Math.PI*2);ctx.arc(ax+3,ay-2,2,0,Math.PI*2);ctx.fill();
    let [px,py]=center(player);
    glowCircle(px,py,9,C.cyan);
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(px-3,py-2,2,0,Math.PI*2);ctx.arc(px+3,py-2,2,0,Math.PI*2);ctx.fill();

    // Gentle frame.
    ctx.strokeStyle="rgba(49,235,255,.35)";ctx.lineWidth=2;ctx.strokeRect(1,1,W-2,H-2);
    requestAnimationFrame(draw);
  }

  function update(now) {
    const dt = Math.min((now-lastFrame)/1000 || 0, .05);
    lastFrame = now;
    if(mode==="playing") {
      elapsed=(now-startedAt)/1000;
      moveLock=Math.max(0,moveLock-dt);
      enemyClock += dt;
      const interval=Math.max(.24,.72-level*.035);
      if(enemyClock>=interval) {
        enemyClock=0;
        const route=bfs(enemy,player);
        if(route.length>1) enemy=route[1];
        if(same(enemy,player)) catchPlayer();
      }
      updateHUD();
    }
    requestAnimationFrame(update);
  }

  function handleKey(e) {
    const keyName=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(keyName)) e.preventDefault();
    if(keyName==="escape") { pauseGame(); return; }
    if(keyName===" " || keyName==="spacebar") { useHint(); return; }
    if(mode!=="playing" || moveLock>0) return;
    const directions={
      arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],
      arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]
    };
    if(directions[keyName]) {
      movePlayer(...directions[keyName]);
      moveLock=.105;
    }
  }

  $("mainBtn").addEventListener("click", () => {
    if(mode==="paused") { mode="playing";$("overlay").classList.add("hidden"); }
    else newGame();
  });
  $("pauseBtn").addEventListener("click", pauseGame);
  $("hintBtn").addEventListener("click", useHint);
  $("newBtn").addEventListener("click", newMaze);
  $("soundBtn").addEventListener("click", () => {
    soundOn=!soundOn;
    $("soundBtn").textContent=`SOUND: ${soundOn?"ON":"OFF"}`;
    $("soundBtn").setAttribute("aria-pressed",String(soundOn));
    if(soundOn) beep(700,.08);
  });
  window.addEventListener("keydown", handleKey);

  // Touch-friendly directional buttons. Holding a button moves repeatedly.
  let touchMoveTimer = null;
  function stopTouchMove() {
    if (touchMoveTimer !== null) { clearInterval(touchMoveTimer); touchMoveTimer = null; }
  }
  document.querySelectorAll(".direction[data-dx]").forEach(button => {
    if (button.disabled) return;
    const startMove = event => {
      event.preventDefault();
      stopTouchMove();
      const dx = Number(button.dataset.dx);
      const dy = Number(button.dataset.dy);
      if (mode !== "playing") {
        say("Press START GAME first.", 1.5);
        return;
      }
      movePlayer(dx, dy);
      touchMoveTimer = setInterval(() => movePlayer(dx, dy), 145);
      if (button.setPointerCapture && event.pointerId !== undefined) {
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      }
    };
    button.addEventListener("pointerdown", startMove);
    button.addEventListener("pointerup", stopTouchMove);
    button.addEventListener("pointercancel", stopTouchMove);
    button.addEventListener("lostpointercapture", stopTouchMove);
    button.addEventListener("contextmenu", event => event.preventDefault());
  });
  $("mobileHintBtn").addEventListener("click", useHint);
  $("mobilePauseBtn").addEventListener("click", pauseGame);
  window.addEventListener("pointerup", stopTouchMove);
  window.addEventListener("blur", () => { stopTouchMove(); if(mode==="playing") pauseGame(); });

  grid=generateMaze();
  player=[1,1]; exit=[COLS-2,ROWS-2]; key=[3,1]; enemy=[COLS-2,1];
  // Prepare a valid display maze before the player starts.
  startLevel();
  $("best").textContent=best;
  showOverlay("Escape the maze.", "Find the glowing key, avoid the AI hunter, and reach the exit.", "START GAME");
  requestAnimationFrame(draw);
  requestAnimationFrame(update);
})();
