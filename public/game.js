// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const SEGMENT_SIZE = 20;
const BEAD_SIZE = 15;
const PROJECTILE_SIZE = 10;
const INITIAL_SEGMENTS = 8;
const BEAD_COUNT = 5;
const BASE_MOVEMENT_SPEED = 5;
const PROJECTILE_SPEED = 8;
const SPAWN_INTERVAL = 5000; // Spawn a new bead every 5 seconds

// Game state
let gameRunning = false;
let gameBoard = document.getElementById('game-board');
let player1Score = document.querySelector('#player1-score span');
let player2Score = document.querySelector('#player2-score span');
let gameOverScreen = document.getElementById('game-over');
let winnerText = document.getElementById('winner-text');
let restartButton = document.getElementById('restart-button');
let speedSlider = document.getElementById('speed-slider');
let speedValue = document.getElementById('speed-value');
let gameSpeedMultiplier = 1;
let lastSegmentWarningActive = false;

// Game objects
let player1 = null;
let player2 = null;
let beads = [];
let projectiles = [];
let lastFrameTime = 0;
let beadSpawnTimer = 0;

// Key states
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    arrowUp: false,
    arrowDown: false,
    arrowLeft: false,
    arrowRight: false,
    enter: false
};

// Caterpillar class
class Caterpillar {
    constructor(playerId, x, y, color, direction) {
        this.playerId = playerId;
        this.segments = [];
        this.direction = direction;
        this.nextDirection = direction;
        this.baseSpeed = BASE_MOVEMENT_SPEED;
        this.color = color;
        this.shootCooldown = 0;
        this.element = document.createElement('div');
        this.element.className = `caterpillar player${playerId}`;
        gameBoard.appendChild(this.element);

        // Create initial segments
        for (let i = 0; i < INITIAL_SEGMENTS; i++) {
            this.addSegment(x - (direction.x * SEGMENT_SIZE * i), y - (direction.y * SEGMENT_SIZE * i));
        }
    }

    get speed() {
        return this.baseSpeed * gameSpeedMultiplier;
    }

    addSegment(x, y) {
        const segment = {
            x: x,
            y: y,
            element: document.createElement('div')
        };

        segment.element.className = 'caterpillar-segment';
        if (this.segments.length === 0) {
            segment.element.classList.add('caterpillar-head');
        }
        this.element.appendChild(segment.element);
        this.segments.push(segment);

        // Update score display
        if (this.playerId === 1) {
            player1Score.textContent = this.segments.length;
        } else {
            player2Score.textContent = this.segments.length;
        }

        // Check if we need to remove the last-segment class from any segment
        this.updateLastSegmentStatus();
    }

    removeSegment() {
        if (this.segments.length <= 1) {
            // Game over if only the head remains
            endGame(this.playerId === 1 ? 2 : 1);
            return;
        }

        const lastSegment = this.segments.pop();
        this.element.removeChild(lastSegment.element);

        // Update score display
        if (this.playerId === 1) {
            player1Score.textContent = this.segments.length;
        } else {
            player2Score.textContent = this.segments.length;
        }

        // Create a bead at the position of the removed segment
        createBead(lastSegment.x, lastSegment.y);

        // Check if we're down to the last segment (head + 1 body segment)
        this.updateLastSegmentStatus();
    }

    updateLastSegmentStatus() {
        // Remove last-segment class from all segments
        this.segments.forEach(segment => {
            segment.element.classList.remove('last-segment');
        });

        // If we're down to 2 segments (head + 1 body), add the last-segment class
        if (this.segments.length === 2) {
            this.segments[1].element.classList.add('last-segment');
            
            // Add a dramatic animation using anime.js
            anime({
                targets: this.segments[1].element,
                scale: [1, 1.2, 1],
                boxShadow: [
                    '0 0 0 0 rgba(255, 0, 0, 0)',
                    '0 0 20px 10px rgba(255, 0, 0, 0.7)',
                    '0 0 0 0 rgba(255, 0, 0, 0)'
                ],
                duration: 1000,
                easing: 'easeInOutQuad',
                loop: true
            });

            // Set the warning flag
            lastSegmentWarningActive = true;
            
            // Create a warning message
            const warningMessage = document.createElement('div');
            warningMessage.className = 'warning-message';
            warningMessage.textContent = `Player ${this.playerId} is down to the last segment!`;
            warningMessage.style.color = this.playerId === 1 ? '#4CAF50' : '#2196F3';
            
            // Position the warning at the top of the game board
            warningMessage.style.position = 'absolute';
            warningMessage.style.top = '10px';
            warningMessage.style.left = '50%';
            warningMessage.style.transform = 'translateX(-50%)';
            warningMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            warningMessage.style.padding = '10px 20px';
            warningMessage.style.borderRadius = '5px';
            warningMessage.style.zIndex = '5';
            warningMessage.style.fontWeight = 'bold';
            
            // Add to game board
            gameBoard.appendChild(warningMessage);
            
            // Animate the warning
            anime({
                targets: warningMessage,
                opacity: [0, 1, 1, 0],
                translateY: ['-20px', '0px', '0px', '-20px'],
                duration: 3000,
                easing: 'easeOutQuad',
                complete: function() {
                    gameBoard.removeChild(warningMessage);
                }
            });
        } else {
            lastSegmentWarningActive = false;
        }
    }

    update(deltaTime) {
        // Update direction based on input
        this.direction = this.nextDirection;

        // Move head
        const head = this.segments[0];
        const newX = head.x + this.direction.x * this.speed;
        const newY = head.y + this.direction.y * this.speed;

        // Check boundaries
        const boundedX = Math.max(SEGMENT_SIZE / 2, Math.min(GAME_WIDTH - SEGMENT_SIZE / 2, newX));
        const boundedY = Math.max(SEGMENT_SIZE / 2, Math.min(GAME_HEIGHT - SEGMENT_SIZE / 2, newY));

        // Move segments (follow the leader)
        for (let i = this.segments.length - 1; i > 0; i--) {
            this.segments[i].x = this.segments[i - 1].x;
            this.segments[i].y = this.segments[i - 1].y;
        }

        // Update head position
        head.x = boundedX;
        head.y = boundedY;

        // Update cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }

        // Render segments
        this.segments.forEach((segment, index) => {
            segment.element.style.left = `${segment.x - SEGMENT_SIZE / 2}px`;
            segment.element.style.top = `${segment.y - SEGMENT_SIZE / 2}px`;
        });
    }

    shoot() {
        if (this.shootCooldown <= 0) {
            const head = this.segments[0];
            const projectile = {
                x: head.x + this.direction.x * SEGMENT_SIZE,
                y: head.y + this.direction.y * SEGMENT_SIZE,
                direction: { ...this.direction },
                playerId: this.playerId,
                element: document.createElement('div')
            };

            projectile.element.className = `projectile player${this.playerId}-projectile`;
            projectile.element.style.left = `${projectile.x - PROJECTILE_SIZE / 2}px`;
            projectile.element.style.top = `${projectile.y - PROJECTILE_SIZE / 2}px`;
            gameBoard.appendChild(projectile.element);
            projectiles.push(projectile);

            // Add cooldown
            this.shootCooldown = 500; // 500ms cooldown

            // Add animation effect using anime.js
            anime({
                targets: projectile.element,
                scale: [1.5, 1],
                duration: 300,
                easing: 'easeOutQuad'
            });
        }
    }

    checkCollision(x, y, size) {
        // Check collision with all segments except the head
        for (let i = 1; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const distance = Math.sqrt(
                Math.pow(segment.x - x, 2) + Math.pow(segment.y - y, 2)
            );
            if (distance < (SEGMENT_SIZE + size) / 2) {
                return true;
            }
        }
        return false;
    }
}

// Bead functions
function createBead(x, y) {
    // If x and y are provided, use them; otherwise, generate random position
    const beadX = x !== undefined ? x : Math.random() * (GAME_WIDTH - BEAD_SIZE) + BEAD_SIZE / 2;
    const beadY = y !== undefined ? y : Math.random() * (GAME_HEIGHT - BEAD_SIZE) + BEAD_SIZE / 2;

    const bead = {
        x: beadX,
        y: beadY,
        element: document.createElement('div')
    };

    bead.element.className = 'bead';
    bead.element.style.left = `${bead.x - BEAD_SIZE / 2}px`;
    bead.element.style.top = `${bead.y - BEAD_SIZE / 2}px`;
    gameBoard.appendChild(bead.element);
    beads.push(bead);

    // Add animation effect using anime.js
    anime({
        targets: bead.element,
        scale: [0, 1],
        opacity: [0, 1],
        duration: 800,
        easing: 'easeOutElastic(1, .5)'
    });
}

// Game initialization
function initGame() {
    // Clear game board
    gameBoard.innerHTML = '';
    beads = [];
    projectiles = [];
    lastSegmentWarningActive = false;

    // Create players
    player1 = new Caterpillar(
        1,
        GAME_WIDTH * 0.25,
        GAME_HEIGHT / 2,
        '#4CAF50',
        { x: 1, y: 0 }
    );

    player2 = new Caterpillar(
        2,
        GAME_WIDTH * 0.75,
        GAME_HEIGHT / 2,
        '#2196F3',
        { x: -1, y: 0 }
    );

    // Create initial beads
    for (let i = 0; i < BEAD_COUNT; i++) {
        createBead();
    }

    // Reset timers
    beadSpawnTimer = SPAWN_INTERVAL;
    lastFrameTime = performance.now();

    // Start game
    gameRunning = true;
    gameOverScreen.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

// Game loop
function gameLoop(timestamp) {
    if (!gameRunning) return;

    // Calculate delta time
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // Update bead spawn timer
    beadSpawnTimer -= deltaTime;
    if (beadSpawnTimer <= 0) {
        createBead();
        beadSpawnTimer = SPAWN_INTERVAL;
    }

    // Update players
    updatePlayerInput();
    player1.update(deltaTime);
    player2.update(deltaTime);

    // Update projectiles
    updateProjectiles(deltaTime);

    // Check collisions
    checkCollisions();

    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Update player input
function updatePlayerInput() {
    // Player 1 movement (WASD)
    if (keys.w && !keys.s) player1.nextDirection = { x: 0, y: -1 };
    else if (keys.s && !keys.w) player1.nextDirection = { x: 0, y: 1 };
    else if (keys.a && !keys.d) player1.nextDirection = { x: -1, y: 0 };
    else if (keys.d && !keys.a) player1.nextDirection = { x: 1, y: 0 };

    // Player 2 movement (Arrow keys)
    if (keys.arrowUp && !keys.arrowDown) player2.nextDirection = { x: 0, y: -1 };
    else if (keys.arrowDown && !keys.arrowUp) player2.nextDirection = { x: 0, y: 1 };
    else if (keys.arrowLeft && !keys.arrowRight) player2.nextDirection = { x: -1, y: 0 };
    else if (keys.arrowRight && !keys.arrowLeft) player2.nextDirection = { x: 1, y: 0 };

    // Shooting
    if (keys.space) player1.shoot();
    if (keys.enter) player2.shoot();
}

// Update projectiles
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Move projectile
        projectile.x += projectile.direction.x * PROJECTILE_SPEED * gameSpeedMultiplier;
        projectile.y += projectile.direction.y * PROJECTILE_SPEED * gameSpeedMultiplier;
        
        // Update position
        projectile.element.style.left = `${projectile.x - PROJECTILE_SIZE / 2}px`;
        projectile.element.style.top = `${projectile.y - PROJECTILE_SIZE / 2}px`;
        
        // Check if out of bounds
        if (
            projectile.x < 0 ||
            projectile.x > GAME_WIDTH ||
            projectile.y < 0 ||
            projectile.y > GAME_HEIGHT
        ) {
            gameBoard.removeChild(projectile.element);
            projectiles.splice(i, 1);
        }
    }
}

// Check collisions
function checkCollisions() {
    // Check bead collisions
    for (let i = beads.length - 1; i >= 0; i--) {
        const bead = beads[i];
        
        // Check collision with player 1 head
        const p1Head = player1.segments[0];
        const p1Distance = Math.sqrt(
            Math.pow(p1Head.x - bead.x, 2) + Math.pow(p1Head.y - bead.y, 2)
        );
        
        if (p1Distance < (SEGMENT_SIZE + BEAD_SIZE) / 2) {
            // Player 1 collects bead
            gameBoard.removeChild(bead.element);
            beads.splice(i, 1);
            player1.addSegment(
                player1.segments[player1.segments.length - 1].x,
                player1.segments[player1.segments.length - 1].y
            );
            continue;
        }
        
        // Check collision with player 2 head
        const p2Head = player2.segments[0];
        const p2Distance = Math.sqrt(
            Math.pow(p2Head.x - bead.x, 2) + Math.pow(p2Head.y - bead.y, 2)
        );
        
        if (p2Distance < (SEGMENT_SIZE + BEAD_SIZE) / 2) {
            // Player 2 collects bead
            gameBoard.removeChild(bead.element);
            beads.splice(i, 1);
            player2.addSegment(
                player2.segments[player2.segments.length - 1].x,
                player2.segments[player2.segments.length - 1].y
            );
        }
    }
    
    // Check projectile collisions
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Check collision with player 1 (if projectile is from player 2)
        if (projectile.playerId === 2 && player1.checkCollision(projectile.x, projectile.y, PROJECTILE_SIZE)) {
            gameBoard.removeChild(projectile.element);
            projectiles.splice(i, 1);
            
            // Check if player 1 is down to last segment
            const isLastSegment = player1.segments.length === 2;
            
            player1.removeSegment();
            
            // If it was the last segment, show special game over
            if (isLastSegment) {
                endGameWithSpecialAnimation(2);
                return;
            }
            
            // Add hit animation using anime.js
            anime({
                targets: player1.element,
                translateX: [
                    { value: -10, duration: 100 },
                    { value: 10, duration: 100 },
                    { value: -5, duration: 100 },
                    { value: 5, duration: 100 },
                    { value: 0, duration: 100 }
                ],
                easing: 'easeInOutSine'
            });
            
            continue;
        }
        
        // Check collision with player 2 (if projectile is from player 1)
        if (projectile.playerId === 1 && player2.checkCollision(projectile.x, projectile.y, PROJECTILE_SIZE)) {
            gameBoard.removeChild(projectile.element);
            projectiles.splice(i, 1);
            
            // Check if player 2 is down to last segment
            const isLastSegment = player2.segments.length === 2;
            
            player2.removeSegment();
            
            // If it was the last segment, show special game over
            if (isLastSegment) {
                endGameWithSpecialAnimation(1);
                return;
            }
            
            // Add hit animation using anime.js
            anime({
                targets: player2.element,
                translateX: [
                    { value: -10, duration: 100 },
                    { value: 10, duration: 100 },
                    { value: -5, duration: 100 },
                    { value: 5, duration: 100 },
                    { value: 0, duration: 100 }
                ],
                easing: 'easeInOutSine'
            });
        }
    }
}

// Special game over animation when a player with last segment is hit
function endGameWithSpecialAnimation(winnerId) {
    gameRunning = false;
    
    // Create a dramatic overlay
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '5';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    
    // Create the victory message
    const victoryMessage = document.createElement('div');
    victoryMessage.className = 'victory-message';
    victoryMessage.textContent = 'GAME OVER';
    victoryMessage.style.color = 'white';
    victoryMessage.style.fontSize = '4rem';
    victoryMessage.style.fontWeight = 'bold';
    victoryMessage.style.textShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
    victoryMessage.style.marginBottom = '20px';
    
    // Create the winner message
    const winnerMessage = document.createElement('div');
    winnerMessage.className = 'winner-message';
    winnerMessage.textContent = `Player ${winnerId} Wins!`;
    winnerMessage.style.color = winnerId === 1 ? '#4CAF50' : '#2196F3';
    winnerMessage.style.fontSize = '3rem';
    winnerMessage.style.fontWeight = 'bold';
    winnerMessage.style.textShadow = '0 0 15px rgba(255, 255, 255, 0.8)';
    winnerMessage.style.marginBottom = '30px';
    
    // Create the restart button
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Play Again';
    restartBtn.style.padding = '15px 30px';
    restartBtn.style.fontSize = '1.5rem';
    restartBtn.style.backgroundColor = winnerId === 1 ? '#4CAF50' : '#2196F3';
    restartBtn.style.color = 'white';
    restartBtn.style.border = 'none';
    restartBtn.style.borderRadius = '5px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.5)';
    
    // Add event listener to restart button
    restartBtn.addEventListener('click', function() {
        gameBoard.removeChild(overlay);
        initGame();
    });
    
    // Add elements to overlay
    overlay.appendChild(victoryMessage);
    overlay.appendChild(winnerMessage);
    overlay.appendChild(restartBtn);
    
    // Add overlay to game board
    gameBoard.appendChild(overlay);
    
    // Animate the game board
    anime({
        targets: gameBoard,
        backgroundColor: [
            { value: '#222', duration: 100 },
            { value: '#500', duration: 200 },
            { value: '#222', duration: 300 }
        ],
        boxShadow: [
            { value: '0 10px 20px rgba(0, 0, 0, 0.2)', duration: 100 },
            { value: '0 10px 30px rgba(255, 0, 0, 0.5)', duration: 200 },
            { value: '0 10px 20px rgba(0, 0, 0, 0.2)', duration: 300 }
        ],
        loop: 3,
        easing: 'easeInOutQuad'
    });
    
    // Animate the overlay
    anime({
        targets: overlay,
        opacity: [0, 1],
        duration: 1000,
        easing: 'easeOutQuad'
    });
    
    // Animate the victory message
    anime({
        targets: victoryMessage,
        scale: [3, 1],
        opacity: [0, 1],
        duration: 1500,
        delay: 500,
        easing: 'easeOutElastic(1, .5)'
    });
    
    // Animate the winner message
    anime({
        targets: winnerMessage,
        scale: [0.5, 1],
        opacity: [0, 1],
        duration: 1000,
        delay: 1000,
        easing: 'easeOutQuad'
    });
    
    // Animate the restart button
    anime({
        targets: restartBtn,
        translateY: [50, 0],
        opacity: [0, 1],
        duration: 800,
        delay: 1500,
        easing: 'easeOutQuad'
    });
}

// Regular end game
function endGame(winnerId) {
    gameRunning = false;
    winnerText.textContent = `Player ${winnerId} wins!`;
    gameOverScreen.classList.remove('hidden');
    
    // Add game over animation using anime.js
    anime({
        targets: gameOverScreen,
        scale: [0.8, 1],
        opacity: [0, 1],
        duration: 800,
        easing: 'easeOutElastic(1, .5)'
    });

    // Add a special animation for the game board
    anime({
        targets: gameBoard,
        backgroundColor: [
            { value: '#222', duration: 100 },
            { value: '#500', duration: 200 },
            { value: '#222', duration: 300 }
        ],
        boxShadow: [
            { value: '0 10px 20px rgba(0, 0, 0, 0.2)', duration: 100 },
            { value: '0 10px 30px rgba(255, 0, 0, 0.5)', duration: 200 },
            { value: '0 10px 20px rgba(0, 0, 0, 0.2)', duration: 300 }
        ],
        loop: 3,
        easing: 'easeInOutQuad'
    });
}

// Event listeners
document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case ' ': keys.space = true; break;
        case 'arrowup': keys.arrowUp = true; e.preventDefault(); break;
        case 'arrowdown': keys.arrowDown = true; e.preventDefault(); break;
        case 'arrowleft': keys.arrowLeft = true; e.preventDefault(); break;
        case 'arrowright': keys.arrowRight = true; e.preventDefault(); break;
        case 'enter': keys.enter = true; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case ' ': keys.space = false; break;
        case 'arrowup': keys.arrowUp = false; break;
        case 'arrowdown': keys.arrowDown = false; break;
        case 'arrowleft': keys.arrowLeft = false; break;
        case 'arrowright': keys.arrowRight = false; break;
        case 'enter': keys.enter = false; break;
    }
});

// Speed slider event listener
speedSlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    speedValue.textContent = value;
    gameSpeedMultiplier = value / 5; // 5 is the default/middle value
});

restartButton.addEventListener('click', initGame);

// Start the game when the page loads
window.addEventListener('load', initGame); 