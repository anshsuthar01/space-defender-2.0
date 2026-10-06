const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("score");
const livesText = document.getElementById("lives");
const levelText = document.getElementById("level");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScore = document.getElementById("finalScore");

const W = canvas.width;
const H = canvas.height;

// ===============================
// SETTINGS (easy to tweak)
// ===============================

const START_LIVES = 5;
const MAX_LIVES = 7;          // lives can't go above this
const PLAYER_SPEED = 11;      // was 7
const BULLET_SPEED = 14;
const POINTS_PER_LEVEL = 100; // score needed for each new level

// ===============================
// GAME VARIABLES
// ===============================

let gameRunning = false;
let playerAlive = true;
let score = 0;
let lives = START_LIVES;
let level = 1;

let bullets = [];
let enemies = [];
let particles = [];
let hearts = [];
let floaters = [];

let keys = {};
let firing = false;

let enemyTimer = 0;
let heartTimer = 0;
let shake = 0;
let now = 0;

// ===============================
// PLAYER
// ===============================

const player = {
    x: W / 2 - 25,
    y: H - 75,
    width: 50,
    height: 45,
    speed: PLAYER_SPEED
};

// ===============================
// DIFFICULTY (smooth, keeps growing with score)
// ===============================

function difficulty() {
    return score / POINTS_PER_LEVEL;
}

function spawnInterval() {
    // starts slow (~1.8s between enemies), gets faster little by little
    return Math.max(22, 110 - difficulty() * 8);
}

function baseEnemySpeed() {
    // starts slow, increases gradually
    return Math.min(4.5, 1 + difficulty() * 0.17);
}

// ===============================
// BACKGROUND: MILKY WAY, STARS, PLANETS
// ===============================

let milkyWayTile = null;
let milkyY = 0;

function createMilkyWayTile() {

    const tile = document.createElement("canvas");
    tile.width = W;
    tile.height = H;

    const c = tile.getContext("2d");

    const colors = [
        [120, 80, 255],
        [60, 140, 255],
        [255, 90, 200],
        [80, 220, 255]
    ];

    // The band follows a wavy path that repeats exactly every H pixels,
    // so the tile loops seamlessly.
    const pathX = y =>
        W * 0.5 +
        Math.sin((y / H) * Math.PI * 2) * W * 0.22 +
        Math.sin((y / H) * Math.PI * 4 + 1) * W * 0.06;

    // Soft colored glow
    for (let i = 0; i < 70; i++) {

        const y = Math.random() * H;
        const x = pathX(y) + (Math.random() - 0.5) * W * 0.18;
        const r = 60 + Math.random() * 120;
        const col = colors[Math.floor(Math.random() * colors.length)];

        for (const oy of [-H, 0, H]) {

            const g = c.createRadialGradient(x, y + oy, 0, x, y + oy, r);
            g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.10)`);
            g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);

            c.fillStyle = g;
            c.fillRect(x - r, y + oy - r, r * 2, r * 2);
        }
    }

    // Bright core
    for (let i = 0; i < 45; i++) {

        const y = Math.random() * H;
        const x = pathX(y) + (Math.random() - 0.5) * W * 0.08;
        const r = 30 + Math.random() * 70;

        for (const oy of [-H, 0, H]) {

            const g = c.createRadialGradient(x, y + oy, 0, x, y + oy, r);
            g.addColorStop(0, "rgba(255,240,255,0.08)");
            g.addColorStop(1, "rgba(255,240,255,0)");

            c.fillStyle = g;
            c.fillRect(x - r, y + oy - r, r * 2, r * 2);
        }
    }

    // Dark dust lanes
    for (let i = 0; i < 14; i++) {

        const y = Math.random() * H;
        const x = pathX(y) + (Math.random() - 0.5) * W * 0.1;
        const r = 20 + Math.random() * 40;

        for (const oy of [-H, 0, H]) {

            const g = c.createRadialGradient(x, y + oy, 0, x, y + oy, r);
            g.addColorStop(0, "rgba(2,3,20,0.30)");
            g.addColorStop(1, "rgba(2,3,20,0)");

            c.fillStyle = g;
            c.fillRect(x - r, y + oy - r, r * 2, r * 2);
        }
    }

    // Dense tiny stars inside the band
    for (let i = 0; i < 900; i++) {

        const y = Math.random() * H;
        const spread = (Math.random() + Math.random() + Math.random() - 1.5) * W * 0.16;
        const x = pathX(y) + spread;
        const size = 0.4 + Math.random() * 1.1;

        c.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`;
        c.fillRect(x, y, size, size);
    }

    return tile;
}

// Parallax star layers

const starLayers = [
    { count: 60, size: 1,   speed: 0.3 },
    { count: 40, size: 1.5, speed: 0.7 },
    { count: 25, size: 2.2, speed: 1.4 }
];

const stars = [];

starLayers.forEach(layer => {
    for (let i = 0; i < layer.count; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size: layer.size,
            speed: layer.speed,
            phase: Math.random() * Math.PI * 2
        });
    }
});

// Planets

const planetStyles = [
    // Gas giant (orange)
    { base: "#e0763a", atmos: "255,170,100", ring: false,
      bands: ["#c85a2a", "#f2a35e", "#a8441f", "#f7c58a"] },
    // Ocean world (blue)
    { base: "#2f7fd6", atmos: "110,190,255", ring: false,
      bands: ["#3fae7a", "#6cc0ff", "#2563b0"] },
    // Ringed planet (gold)
    { base: "#e8c27a", atmos: "255,225,160", ring: true,
      ringColor: "230,200,150",
      bands: ["#d6a85c", "#f3dca3", "#c4934a"] },
    // Purple world
    { base: "#8a5cf0", atmos: "190,150,255", ring: false,
      bands: ["#6a3fd0", "#b08cff", "#52309e"] },
    // Ice / teal world with ring
    { base: "#4fd1c5", atmos: "150,255,240", ring: true,
      ringColor: "170,255,240",
      bands: ["#2fa89e", "#9af2e8", "#23847c"] }
];

const planets = [];

function makePlanet(initial) {

    const style = planetStyles[Math.floor(Math.random() * planetStyles.length)];
    const r = 30 + Math.random() * 60;

    const bands = [];
    const bandCount = 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < bandCount; i++) {
        bands.push({
            off: Math.random(),
            h: 0.06 + Math.random() * 0.14,
            color: style.bands[Math.floor(Math.random() * style.bands.length)]
        });
    }

    return {
        style: style,
        r: r,
        x: 80 + Math.random() * (W - 160),
        y: initial ? Math.random() * H : -r * 2 - Math.random() * 300,
        speed: 0.2 + (r / 90) * 0.35,   // bigger planets feel closer, so move faster
        tilt: (Math.random() - 0.5) * 0.7,
        bands: bands
    };
}

for (let i = 0; i < 3; i++) {
    planets.push(makePlanet(true));
}

milkyWayTile = createMilkyWayTile();

function updateBackground(dt) {

    milkyY = (milkyY + 0.25 * dt) % H;

    stars.forEach(star => {
        star.y += star.speed * dt;

        if (star.y > H) {
            star.y = 0;
            star.x = Math.random() * W;
        }
    });

    for (let i = 0; i < planets.length; i++) {

        const p = planets[i];
        p.y += p.speed * dt;

        // Left the screen -> a new planet drifts in from the top (endless loop)
        if (p.y - p.r * 2 > H) {
            planets[i] = makePlanet(false);
        }
    }
}

function drawPlanet(p) {

    const s = p.style;
    const r = p.r;

    ctx.save();
    ctx.globalAlpha = 0.92;

    // Atmosphere glow
    const glow = ctx.createRadialGradient(p.x, p.y, r * 0.9, p.x, p.y, r * 1.45);
    glow.addColorStop(0, `rgba(${s.atmos},0.35)`);
    glow.addColorStop(1, `rgba(${s.atmos},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Ring (back half)
    if (s.ring) {
        drawRing(p, Math.PI, Math.PI * 2);
    }

    // Body
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = s.base;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

    // Surface bands
    p.bands.forEach(b => {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = b.color;
        ctx.fillRect(p.x - r, p.y - r + b.off * r * 2, r * 2, b.h * r * 2);
    });

    ctx.globalAlpha = 1;

    // Light from top-left, shadow bottom-right
    const shade = ctx.createRadialGradient(
        p.x - r * 0.4, p.y - r * 0.4, r * 0.1,
        p.x - r * 0.2, p.y - r * 0.2, r * 1.5
    );
    shade.addColorStop(0, "rgba(255,255,255,0.28)");
    shade.addColorStop(0.5, "rgba(0,0,0,0.15)");
    shade.addColorStop(1, "rgba(0,0,10,0.85)");

    ctx.fillStyle = shade;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

    ctx.restore();

    // Ring (front half)
    if (s.ring) {
        drawRing(p, 0, Math.PI);
    }

    ctx.restore();
}

function drawRing(p, from, to) {

    const r = p.r;
    const col = p.style.ringColor;

    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = `rgba(${col},0.55)`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 1.8, r * 0.5, p.tilt, from, to);
    ctx.stroke();

    ctx.lineWidth = r * 0.07;
    ctx.strokeStyle = `rgba(${col},0.35)`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 2.1, r * 0.6, p.tilt, from, to);
    ctx.stroke();
}

function drawBackground() {

    // Deep space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#03051a");
    gradient.addColorStop(1, "#0b0030");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Milky Way (two copies so it loops without a gap)
    ctx.drawImage(milkyWayTile, 0, milkyY - H);
    ctx.drawImage(milkyWayTile, 0, milkyY);

    // Stars (twinkling)
    stars.forEach(star => {
        const twinkle = 0.6 + 0.4 * Math.sin(now / 400 + star.phase);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    // Planets
    planets.forEach(drawPlanet);
}

// ===============================
// KEYBOARD CONTROLS
// ===============================

document.addEventListener("keydown", function (e) {

    if (e.code === "Space" ||
        e.code === "ArrowLeft" || e.code === "ArrowRight" ||
        e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault();
    }

    if (e.code === "Space") {
        firing = true;
    }

    keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", function (e) {

    if (e.code === "Space") {
        firing = false;
    }

    keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", function () {
    keys = {};
    firing = false;
});

// ===============================
// START GAME
// ===============================

function startGame() {

    score = 0;
    lives = START_LIVES;
    level = 1;

    bullets = [];
    enemies = [];
    particles = [];
    hearts = [];
    floaters = [];

    enemyTimer = 0;
    heartTimer = randomHeartDelay();
    shake = 0;

    player.x = W / 2 - 25;
    player.y = H - 75;
    playerAlive = true;

    updateHUD();

    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");

    // Stop the focused button from reacting to the Space key
    if (document.activeElement) {
        document.activeElement.blur();
    }

    gameRunning = true;
}

// ===============================
// GAME OVER
// ===============================

function gameOver() {

    gameRunning = false;
    playerAlive = false;

    createExplosion(
        player.x + player.width / 2,
        player.y + player.height / 2,
        "#00eaff",
        45
    );

    shake = 18;

    finalScore.textContent = score;

    gameOverScreen.classList.remove("hidden");
}

// ===============================
// UPDATE HUD
// ===============================

function updateHUD() {

    scoreText.textContent = score;
    levelText.textContent = level;
    livesText.textContent = "❤️".repeat(Math.max(0, lives));
}

function loseLife() {

    lives--;
    shake = 10;

    updateHUD();

    if (lives <= 0) {
        gameOver();
    }
}

// ===============================
// PLAYER MOVEMENT + CONTINUOUS FIRE
// ===============================

function updatePlayer(dt) {

    if (keys["arrowleft"] || keys["a"]) {
        player.x -= player.speed * dt;
    }

    if (keys["arrowright"] || keys["d"]) {
        player.x += player.speed * dt;
    }

    // Keep player inside screen

    if (player.x < 0) {
        player.x = 0;
    }

    if (player.x + player.width > W) {
        player.x = W - player.width;
    }

    // No cooldown: hold SPACE and it fires non-stop
    if (firing) {
        shoot();
    }
}

function shoot() {

    bullets.push({
        x: player.x + player.width / 2 - 3,
        y: player.y,
        width: 6,
        height: 16,
        speed: BULLET_SPEED
    });
}

function updateBullets(dt) {

    for (let i = bullets.length - 1; i >= 0; i--) {

        bullets[i].y -= bullets[i].speed * dt;

        if (bullets[i].y < -30) {
            bullets.splice(i, 1);
        }
    }
}

// ===============================
// ENEMIES
// ===============================

const ENEMY_TYPES = {
    scout: {
        w: 40, h: 40, hp: 1, points: 10, speedMul: 1.05,
        colors: ["#ff3366", "#ff9900", "#00ff99"]
    },
    saucer: {
        w: 48, h: 34, hp: 2, points: 20, speedMul: 0.85,
        colors: ["#b44dff", "#4d9bff"]
    },
    heavy: {
        w: 66, h: 58, hp: 24, points: 50, speedMul: 0.5,
        colors: ["#ff4d4d", "#ff7a1a"]
    }
};

function pickEnemyType() {

    const d = difficulty();
    const r = Math.random();

    // New enemy types appear as the game gets harder
    if (d >= 4 && r < 0.15) return "heavy";
    if (d >= 1.5 && r < 0.45) return "saucer";

    return "scout";
}

function createEnemy() {

    const type = pickEnemyType();
    const def = ENEMY_TYPES[type];
    const base = baseEnemySpeed();

    const amp = 50 + Math.random() * 50;

    const enemy = {
        type: type,
        width: def.w,
        height: def.h,
        hp: def.hp,
        maxHp: def.hp,
        points: def.points,
        y: -def.h,
        x: Math.random() * (W - def.w),
        speed: base * def.speedMul * (type === "scout" ? 0.9 + Math.random() * 0.3 : 1),
        color: def.colors[Math.floor(Math.random() * def.colors.length)],
        age: 0,
        flash: 0,
        phase: Math.random() * Math.PI * 2,
        amp: amp,
        baseX: amp + Math.random() * (W - def.w - amp * 2)
    };

    enemies.push(enemy);
}

function updateEnemies(dt) {

    enemyTimer += dt;

    if (enemyTimer >= spawnInterval()) {

        createEnemy();

        // Later in the game, sometimes two enemies arrive together
        if (difficulty() >= 6 && Math.random() < 0.25) {
            createEnemy();
        }

        enemyTimer = 0;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {

        const enemy = enemies[i];

        enemy.age += dt;
        enemy.y += enemy.speed * dt;

        if (enemy.flash > 0) {
            enemy.flash -= dt;
        }

        if (enemy.type === "saucer") {
            enemy.x = enemy.baseX + Math.sin(enemy.age * 0.04 + enemy.phase) * enemy.amp;
        }

        // Enemy reached bottom

        if (enemy.y > H) {

            enemies.splice(i, 1);

            loseLife();

            if (!gameRunning) {
                return;
            }
        }
    }
}

// ===============================
// LIFE PICKUPS (HEARTS)
// ===============================

function randomHeartDelay() {
    // roughly every 12 - 22 seconds
    return 720 + Math.random() * 600;
}

function updateHearts(dt) {

    heartTimer -= dt;

    if (heartTimer <= 0) {

        if (lives < MAX_LIVES) {
            hearts.push({
                x: 30 + Math.random() * (W - 60),
                y: -30,
                width: 30,
                height: 30,
                speed: 1.8,
                age: 0,
                phase: Math.random() * Math.PI * 2
            });
        }

        heartTimer = randomHeartDelay();
    }

    for (let i = hearts.length - 1; i >= 0; i--) {

        const h = hearts[i];

        h.age += dt;
        h.y += h.speed * dt;
        h.x += Math.sin(h.age * 0.05 + h.phase) * 0.8 * dt;

        h.x = Math.max(0, Math.min(W - h.width, h.x));

        if (h.y > H + 30) {
            hearts.splice(i, 1);
        }
    }
}

// ===============================
// COLLISION DETECTION
// ===============================

function collision(a, b) {

    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function playerBox() {
    // slightly smaller than the sprite so near misses feel fair
    return {
        x: player.x + 8,
        y: player.y + 6,
        width: player.width - 16,
        height: player.height - 10
    };
}

function addFloater(text, x, y, color, size, life) {
    floaters.push({
        text: text, x: x, y: y, color: color,
        size: size, life: life, max: life
    });
}

function checkCollisions() {

    // Bullet vs Enemy

    for (let i = bullets.length - 1; i >= 0; i--) {

        for (let j = enemies.length - 1; j >= 0; j--) {

            const enemy = enemies[j];

            if (collision(bullets[i], enemy)) {

                const hitX = bullets[i].x + bullets[i].width / 2;
                const hitY = bullets[i].y;

                bullets.splice(i, 1);

                enemy.hp--;
                enemy.flash = 4;

                if (enemy.hp <= 0) {

                    createExplosion(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2,
                        enemy.color,
                        enemy.type === "heavy" ? 40 : 18
                    );

                    enemies.splice(j, 1);

                    addScore(enemy.points);

                } else {
                    createSparks(hitX, hitY, enemy.color);
                }

                break;
            }
        }
    }

    // Player vs Enemy

    const box = playerBox();

    for (let i = enemies.length - 1; i >= 0; i--) {

        if (collision(box, enemies[i])) {

            createExplosion(
                enemies[i].x + enemies[i].width / 2,
                enemies[i].y + enemies[i].height / 2,
                enemies[i].color,
                22
            );

            enemies.splice(i, 1);

            loseLife();

            if (!gameRunning) {
                return;
            }
        }
    }

    // Player vs Heart pickup

    for (let i = hearts.length - 1; i >= 0; i--) {

        if (collision(box, hearts[i])) {

            const h = hearts[i];
            hearts.splice(i, 1);

            if (lives < MAX_LIVES) {
                lives++;
                addFloater("+1 LIFE", h.x + 15, h.y, "255,120,160", 22, 60);
            } else {
                addFloater("MAX LIVES", h.x + 15, h.y, "255,120,160", 18, 50);
            }

            createExplosion(h.x + 15, h.y + 15, "#ff4d88", 16);

            updateHUD();
        }
    }
}

function addScore(points) {

    score += points;

    const newLevel = Math.floor(score / POINTS_PER_LEVEL) + 1;

    if (newLevel > level) {

        level = newLevel;

        addFloater("LEVEL " + level, W / 2, H / 2 - 40, "0,234,255", 44, 100);
    }

    updateHUD();
}

// ===============================
// DRAW PLAYER (new fighter design)
// ===============================

function drawPlayer() {

    if (!playerAlive) {
        return;
    }

    ctx.save();
    ctx.translate(player.x, player.y);

    // Engine flames
    const flick = 10 + Math.random() * 10;

    ctx.globalCompositeOperation = "lighter";

    [21, 29].forEach(ex => {

        const fg = ctx.createLinearGradient(0, 42, 0, 42 + flick);
        fg.addColorStop(0, "rgba(255,255,255,0.95)");
        fg.addColorStop(0.35, "rgba(0,234,255,0.8)");
        fg.addColorStop(1, "rgba(0,120,255,0)");

        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(ex - 3.5, 40);
        ctx.lineTo(ex + 3.5, 40);
        ctx.lineTo(ex, 42 + flick);
        ctx.closePath();
        ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";

    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 18;

    // Wings
    const wg = ctx.createLinearGradient(0, 0, 50, 0);
    wg.addColorStop(0, "#0066ff");
    wg.addColorStop(0.5, "#00eaff");
    wg.addColorStop(1, "#0066ff");

    ctx.fillStyle = wg;

    ctx.beginPath();
    ctx.moveTo(19, 18);
    ctx.lineTo(3, 34);
    ctx.lineTo(0, 45);
    ctx.lineTo(11, 41);
    ctx.lineTo(19, 37);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(31, 18);
    ctx.lineTo(47, 34);
    ctx.lineTo(50, 45);
    ctx.lineTo(39, 41);
    ctx.lineTo(31, 37);
    ctx.closePath();
    ctx.fill();

    // Fuselage
    ctx.shadowBlur = 0;

    const bg = ctx.createLinearGradient(0, 0, 0, 42);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.45, "#bfefff");
    bg.addColorStop(1, "#3a7bff");

    ctx.fillStyle = bg;

    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.lineTo(31, 12);
    ctx.lineTo(33, 32);
    ctx.lineTo(29, 42);
    ctx.lineTo(21, 42);
    ctx.lineTo(17, 32);
    ctx.lineTo(19, 12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Wing accent stripes
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(17, 30);
    ctx.lineTo(6, 41);
    ctx.moveTo(33, 30);
    ctx.lineTo(44, 41);
    ctx.stroke();

    // Cockpit
    const cg = ctx.createLinearGradient(0, 9, 0, 25);
    cg.addColorStop(0, "#d8f6ff");
    cg.addColorStop(1, "#4a4aff");

    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(25, 17, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing tip lights (blinking)
    const blink = Math.floor(now / 250) % 2 === 0;

    ctx.fillStyle = blink ? "#ff3b6b" : "#ffffff";
    ctx.shadowColor = "#ff3b6b";
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.arc(1.5, 43, 1.8, 0, Math.PI * 2);
    ctx.arc(48.5, 43, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ===============================
// DRAW BULLETS
// ===============================

function drawBullets() {

    ctx.save();

    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 12;

    bullets.forEach(bullet => {

        const g = ctx.createLinearGradient(0, bullet.y, 0, bullet.y + bullet.height);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(1, "#00c8ff");

        ctx.fillStyle = g;

        ctx.fillRect(
            bullet.x,
            bullet.y,
            bullet.width,
            bullet.height
        );
    });

    ctx.restore();
}

// ===============================
// DRAW ENEMIES (3 designs)
// ===============================

function enemyBodyPath(e) {

    ctx.beginPath();

    if (e.type === "scout") {

        // Sharp dart pointing down
        ctx.moveTo(20, 40);
        ctx.lineTo(25, 26);
        ctx.lineTo(40, 12);
        ctx.lineTo(38, 0);
        ctx.lineTo(28, 6);
        ctx.lineTo(20, 2);
        ctx.lineTo(12, 6);
        ctx.lineTo(2, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(15, 26);
        ctx.closePath();

    } else if (e.type === "saucer") {

        // Flying disc
        ctx.ellipse(e.width / 2, e.height * 0.62, e.width / 2, e.height * 0.3, 0, 0, Math.PI * 2);

    } else {

        // Armored gunship
        ctx.moveTo(33, 58);
        ctx.lineTo(46, 46);
        ctx.lineTo(66, 32);
        ctx.lineTo(62, 8);
        ctx.lineTo(50, 14);
        ctx.lineTo(42, 0);
        ctx.lineTo(24, 0);
        ctx.lineTo(16, 14);
        ctx.lineTo(4, 8);
        ctx.lineTo(0, 32);
        ctx.lineTo(20, 46);
        ctx.closePath();
    }
}

function drawEnemies() {

    enemies.forEach(e => {

        ctx.save();
        ctx.translate(e.x, e.y);

        // Colored body with glow
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = e.color;

        enemyBodyPath(e);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Metallic shading
        const sg = ctx.createLinearGradient(0, 0, 0, e.height);
        sg.addColorStop(0, "rgba(255,255,255,0.4)");
        sg.addColorStop(0.5, "rgba(255,255,255,0)");
        sg.addColorStop(1, "rgba(0,0,0,0.45)");

        ctx.fillStyle = sg;
        enemyBodyPath(e);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Type details
        if (e.type === "scout") {

            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(20, 2);
            ctx.lineTo(20, 30);
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(20, 14, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(6, 4, 2, 0, Math.PI * 2);
            ctx.arc(34, 4, 2, 0, Math.PI * 2);
            ctx.fill();

        } else if (e.type === "saucer") {

            // Glass dome
            ctx.fillStyle = "rgba(150,255,255,0.55)";
            ctx.strokeStyle = "rgba(255,255,255,0.8)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(e.width / 2, e.height * 0.4, e.width * 0.22, e.height * 0.3, 0, Math.PI, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Blinking rim lights
            for (let i = 0; i < 5; i++) {

                const on = (Math.floor(now / 200) + i) % 2 === 0;

                ctx.fillStyle = on ? "#ffffff" : "#ffee55";
                ctx.shadowColor = "#ffee55";
                ctx.shadowBlur = on ? 8 : 2;
                ctx.beginPath();
                ctx.arc(e.width * (0.2 + 0.15 * i), e.height * 0.68, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }

        } else {

            // Dark armor plates
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.moveTo(33, 50);
            ctx.lineTo(43, 40);
            ctx.lineTo(55, 30);
            ctx.lineTo(53, 16);
            ctx.lineTo(44, 20);
            ctx.lineTo(38, 8);
            ctx.lineTo(28, 8);
            ctx.lineTo(22, 20);
            ctx.lineTo(13, 16);
            ctx.lineTo(11, 30);
            ctx.lineTo(23, 40);
            ctx.closePath();
            ctx.fill();

            // Pulsing core
            const cr = 7 + Math.sin(now / 150) * 1.5;
            const cg = ctx.createRadialGradient(33, 26, 0, 33, 26, cr);
            cg.addColorStop(0, "#ffffff");
            cg.addColorStop(0.4, "#ffd000");
            cg.addColorStop(1, "#ff2200");

            ctx.fillStyle = cg;
            ctx.shadowColor = "#ffaa00";
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(33, 26, cr, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Side cannons
            ctx.fillStyle = "#222";
            ctx.fillRect(6, 14, 6, 12);
            ctx.fillRect(54, 14, 6, 12);

            // Health bar
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(8, -8, e.width - 16, 4);
            ctx.fillStyle = "#ff4d4d";
            ctx.fillRect(8, -8, (e.width - 16) * (e.hp / e.maxHp), 4);
        }

        // Hit flash
        if (e.flash > 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            enemyBodyPath(e);
            ctx.fill();
        }

        ctx.restore();
    });
}

// ===============================
// DRAW HEARTS
// ===============================

function drawHearts() {

    hearts.forEach(h => {

        const cx = h.x + h.width / 2;
        const cy = h.y + h.height / 2;
        const pulse = 1 + Math.sin(h.age * 0.12) * 0.1;
        const s = 28 * pulse;

        ctx.save();
        ctx.translate(cx, cy);

        // Pulsing ring
        ctx.strokeStyle = `rgba(255,80,130,${0.25 + 0.2 * Math.sin(h.age * 0.12)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + Math.sin(h.age * 0.12) * 3, 0, Math.PI * 2);
        ctx.stroke();

        // Heart
        ctx.shadowColor = "#ff3377";
        ctx.shadowBlur = 20;

        const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.4);
        g.addColorStop(0, "#ff8fb3");
        g.addColorStop(1, "#ff1e56");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.35);
        ctx.bezierCurveTo(-s * 0.65, -s * 0.05, -s * 0.45, -s * 0.6, 0, -s * 0.2);
        ctx.bezierCurveTo(s * 0.45, -s * 0.6, s * 0.65, -s * 0.05, 0, s * 0.35);
        ctx.fill();

        // Shine
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.ellipse(-s * 0.22, -s * 0.22, s * 0.08, s * 0.05, -0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

// ===============================
// PARTICLES & FLOATING TEXT
// ===============================

function createExplosion(x, y, color, count) {

    count = count || 18;

    for (let i = 0; i < count; i++) {

        const speed = 1 + Math.random() * 4;
        const angle = Math.random() * Math.PI * 2;

        particles.push({
            x: x,
            y: y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            size: Math.random() * 4 + 2,
            life: 30 + Math.random() * 15,
            max: 45,
            color: Math.random() < 0.55 ? color : (Math.random() < 0.5 ? "#ffaa00" : "#ffee88")
        });
    }
}

function createSparks(x, y, color) {

    for (let i = 0; i < 4; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 4,
            dy: -Math.random() * 3,
            size: Math.random() * 2 + 1,
            life: 14,
            max: 14,
            color: color
        });
    }
}

function updateParticles(dt) {

    for (let i = particles.length - 1; i >= 0; i--) {

        const p = particles[i];

        p.x += p.dx * dt;
        p.y += p.dy * dt;

        p.life -= dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    for (let i = floaters.length - 1; i >= 0; i--) {

        const f = floaters[i];

        f.y -= 0.5 * dt;
        f.life -= dt;

        if (f.life <= 0) {
            floaters.splice(i, 1);
        }
    }
}

function drawParticles() {

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    particles.forEach(p => {

        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();

    floaters.forEach(f => {

        const alpha = Math.min(1, f.life / (f.max * 0.5));

        ctx.save();
        ctx.font = `bold ${f.size}px Arial`;
        ctx.textAlign = "center";
        ctx.shadowColor = `rgba(${f.color},0.9)`;
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(${f.color},${alpha})`;
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
    });
}

// ===============================
// MAIN LOOP (always running so the background never stops)
// ===============================

let lastTime = performance.now();

function update(dt) {

    updateBackground(dt);

    if (gameRunning) {
        updatePlayer(dt);
        updateBullets(dt);
        updateEnemies(dt);
        updateHearts(dt);
        checkCollisions();
    }

    updateParticles(dt);

    if (shake > 0) {
        shake = Math.max(0, shake - dt * 0.8);
    }
}

function render() {

    ctx.save();

    if (shake > 0) {
        ctx.translate(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake
        );
    }

    drawBackground();
    drawBullets();
    drawHearts();
    drawEnemies();
    drawPlayer();
    drawParticles();

    ctx.restore();
}

function gameLoop(timestamp) {

    now = timestamp;

    // dt = 1 at 60 FPS, so speed is the same on 120/144 Hz screens
    const dt = Math.min((timestamp - lastTime) / 16.667, 3);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

updateHUD();
requestAnimationFrame(gameLoop);
