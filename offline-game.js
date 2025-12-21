/**
 * Orbit Runner - Offline Game
 * A minimalist endless runner for when you're offline
 */

// Game State
const game = {
    canvas: null,
    ctx: null,
    isRunning: false,
    isPaused: false,
    score: 0,
    highScore: 0,
    frameCount: 0,
    speed: 5,
    baseSpeed: 5,
    maxSpeed: 12,
    gravity: 0.6,
    jumpForce: -12,
    groundY: 0,
};

// Player (Orb)
const player = {
    x: 100,
    y: 0,
    radius: 18,
    velocityY: 0,
    isJumping: false,
    color: '#7c7cf8',
    glowColor: 'rgba(124, 124, 248, 0.6)',
    trail: [],
};

// Obstacles
let obstacles = [];
const obstacleTypes = [
    { width: 25, height: 50, color: '#ef4444' },  // Small
    { width: 30, height: 70, color: '#f97316' },  // Medium
    { width: 20, height: 90, color: '#ec4899' },  // Tall
];

// Particles
let particles = [];

// DOM Elements
let startScreen, gameOverScreen, scoreEl, highScoreEl, finalScoreEl, newHighScoreEl;
let onlineToast;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');

    startScreen = document.getElementById('startScreen');
    gameOverScreen = document.getElementById('gameOverScreen');
    scoreEl = document.getElementById('score');
    highScoreEl = document.getElementById('highScore');
    finalScoreEl = document.getElementById('finalScore');
    newHighScoreEl = document.getElementById('newHighScore');
    onlineToast = document.getElementById('onlineToast');

    // Load high score
    game.highScore = parseInt(localStorage.getItem('orbitRunner-highScore') || '0');
    highScoreEl.textContent = game.highScore;

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create starfield
    createStarfield();

    // Event listeners
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('retryBtn').addEventListener('click', startGame);
    document.getElementById('homeBtn').addEventListener('click', goHome);
    document.getElementById('goOnlineBtn').addEventListener('click', goHome);

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Touch controls
    game.canvas.addEventListener('touchstart', handleTouch);
    game.canvas.addEventListener('click', handleClick);

    // Online detection
    window.addEventListener('online', handleOnline);

    // Start idle animation
    idleAnimation();
});

function resizeCanvas() {
    game.canvas.width = window.innerWidth;
    game.canvas.height = window.innerHeight;
    game.groundY = game.canvas.height - 80;
    player.y = game.groundY - player.radius;
}

function createStarfield() {
    const starfield = document.getElementById('starfield');
    starfield.innerHTML = '';

    const starCount = Math.floor((window.innerWidth * window.innerHeight) / 8000);

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 2 + 1}px`;
        star.style.height = star.style.width;
        star.style.setProperty('--opacity', Math.random() * 0.5 + 0.3);
        star.style.setProperty('--duration', `${Math.random() * 3 + 2}s`);
        star.style.animationDelay = `${Math.random() * 3}s`;
        starfield.appendChild(star);
    }
}

function handleKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!game.isRunning && !startScreen.classList.contains('hidden')) {
            startGame();
        } else if (!game.isRunning && !gameOverScreen.classList.contains('hidden')) {
            startGame();
        } else {
            jump();
        }
    }
}

function handleKeyUp(e) {
    // Future: Could add variable jump height
}

function handleTouch(e) {
    e.preventDefault();
    if (game.isRunning) jump();
}

function handleClick() {
    if (game.isRunning) jump();
}

function handleOnline() {
    onlineToast.classList.remove('hidden');
}

function goHome() {
    window.location.href = 'index.html';
}

function startGame() {
    // Reset game state
    game.score = 0;
    game.speed = game.baseSpeed;
    game.frameCount = 0;
    game.isRunning = true;

    // Reset player
    player.y = game.groundY - player.radius;
    player.velocityY = 0;
    player.isJumping = false;
    player.trail = [];

    // Reset obstacles and particles
    obstacles = [];
    particles = [];

    // Update UI
    scoreEl.textContent = '0';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    newHighScoreEl.classList.add('hidden');

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function jump() {
    if (!player.isJumping && game.isRunning) {
        player.velocityY = game.jumpForce;
        player.isJumping = true;

        // Jump particles
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: player.x,
                y: player.y + player.radius,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 2 + 1,
                radius: Math.random() * 4 + 2,
                alpha: 1,
                color: player.color,
            });
        }
    }
}

function gameLoop(timestamp) {
    if (!game.isRunning) return;

    update();
    render();

    requestAnimationFrame(gameLoop);
}

function update() {
    game.frameCount++;

    // Increase speed over time
    if (game.frameCount % 500 === 0 && game.speed < game.maxSpeed) {
        game.speed += 0.3;
    }

    // Update score
    if (game.frameCount % 10 === 0) {
        game.score++;
        scoreEl.textContent = game.score;
    }

    // Player physics
    player.velocityY += game.gravity;
    player.y += player.velocityY;

    // Ground collision
    if (player.y >= game.groundY - player.radius) {
        player.y = game.groundY - player.radius;
        player.velocityY = 0;
        player.isJumping = false;
    }

    // Trail effect
    player.trail.push({ x: player.x, y: player.y, alpha: 0.8 });
    if (player.trail.length > 15) player.trail.shift();
    player.trail.forEach(t => t.alpha -= 0.05);

    // Spawn obstacles
    const spawnRate = Math.max(80, 150 - game.speed * 5);
    if (game.frameCount % Math.floor(spawnRate) === 0) {
        spawnObstacle();
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= game.speed;

        // Remove off-screen obstacles
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            continue;
        }

        // Collision detection
        if (checkCollision(player, obstacles[i])) {
            gameOver();
            return;
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].alpha -= 0.03;

        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

function spawnObstacle() {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push({
        x: game.canvas.width + 50,
        y: game.groundY - type.height,
        width: type.width,
        height: type.height,
        color: type.color,
    });
}

function checkCollision(player, obstacle) {
    // Circle-rectangle collision
    const closestX = Math.max(obstacle.x, Math.min(player.x, obstacle.x + obstacle.width));
    const closestY = Math.max(obstacle.y, Math.min(player.y, obstacle.y + obstacle.height));

    const distanceX = player.x - closestX;
    const distanceY = player.y - closestY;

    return (distanceX * distanceX + distanceY * distanceY) < (player.radius * player.radius);
}

function gameOver() {
    game.isRunning = false;

    // Death particles
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            radius: Math.random() * 6 + 2,
            alpha: 1,
            color: player.color,
        });
    }

    // Update high score
    const isNewHighScore = game.score > game.highScore;
    if (isNewHighScore) {
        game.highScore = game.score;
        localStorage.setItem('orbitRunner-highScore', game.highScore);
        highScoreEl.textContent = game.highScore;
        newHighScoreEl.classList.remove('hidden');
    }

    // Show game over screen
    finalScoreEl.textContent = game.score;

    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
    }, 500);

    // Keep rendering particles
    requestAnimationFrame(deathAnimation);
}

function deathAnimation() {
    if (game.isRunning) return;

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].vy += 0.2; // Gravity
        particles[i].alpha -= 0.02;

        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    render();

    if (particles.length > 0) {
        requestAnimationFrame(deathAnimation);
    }
}

function idleAnimation() {
    if (game.isRunning) return;

    // Bobbing animation for player on start screen
    const time = Date.now() / 1000;
    player.y = game.groundY - player.radius + Math.sin(time * 2) * 5;

    render();
    requestAnimationFrame(idleAnimation);
}

function render() {
    const ctx = game.ctx;

    // Clear canvas
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

    // Draw ground line (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, game.groundY);
    ctx.lineTo(game.canvas.width, game.groundY);
    ctx.stroke();

    // Ground glow
    const groundGradient = ctx.createLinearGradient(0, game.groundY, 0, game.groundY + 50);
    groundGradient.addColorStop(0, 'rgba(124, 124, 248, 0.1)');
    groundGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, game.groundY, game.canvas.width, 50);

    // Draw player trail
    player.trail.forEach((t, i) => {
        if (t.alpha > 0) {
            ctx.beginPath();
            ctx.arc(t.x, t.y, player.radius * (t.alpha * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(124, 124, 248, ${t.alpha * 0.3})`;
            ctx.fill();
        }
    });

    // Draw player glow
    const glowGradient = ctx.createRadialGradient(
        player.x, player.y, player.radius * 0.5,
        player.x, player.y, player.radius * 2.5
    );
    glowGradient.addColorStop(0, 'rgba(124, 124, 248, 0.4)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw player orb
    const orbGradient = ctx.createRadialGradient(
        player.x - player.radius * 0.3, player.y - player.radius * 0.3, 0,
        player.x, player.y, player.radius
    );
    orbGradient.addColorStop(0, '#a5a5ff');
    orbGradient.addColorStop(0.5, player.color);
    orbGradient.addColorStop(1, '#5555cc');

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = orbGradient;
    ctx.fill();

    // Orb highlight
    ctx.beginPath();
    ctx.arc(player.x - player.radius * 0.3, player.y - player.radius * 0.3, player.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    // Draw obstacles
    obstacles.forEach(obs => {
        // Obstacle glow
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 15;

        // Obstacle body
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
        ctx.fill();

        // Obstacle highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(obs.x + 3, obs.y + 3, obs.width - 6, 8, 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    });

    // Draw particles
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${p.alpha})`).replace('rgb', 'rgba');
        // Handle hex colors
        if (p.color.startsWith('#')) {
            ctx.fillStyle = `rgba(124, 124, 248, ${p.alpha})`;
        }
        ctx.fill();
    });
}

// Polyfill for roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
    };
}
