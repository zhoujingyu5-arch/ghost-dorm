/**
 * 猛鬼宿舍 - Ghost Dorm
 * 塔防游戏核心逻辑
 */

// 游戏配置
const CONFIG = {
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 500,
    GRID_SIZE: 40,
    DOOR_X: 180,
    DOOR_Y: 420,
    DOOR_WIDTH: 40,
    DOOR_HEIGHT: 60,
    MAX_WAVE: 10
};

// 建筑类型配置
const BUILDINGS = {
    turret: {
        name: '炮台',
        cost: 50,
        damage: 10,
        range: 100,
        fireRate: 1000,
        color: '#e94560',
        icon: '🔫'
    },
    bed: {
        name: '床铺',
        cost: 30,
        goldPerSecond: 2,
        color: '#4ecdc4',
        icon: '🛏️'
    },
    generator: {
        name: '发电机',
        cost: 80,
        goldMultiplier: 1.5,
        color: '#ffd700',
        icon: '⚡'
    },
    trap: {
        name: '陷阱',
        cost: 40,
        damage: 30,
        slow: 0.5,
        color: '#95a5a6',
        icon: '🕸️'
    }
};

// 游戏状态
let gameState = {
    gold: 100,
    wave: 1,
    doorHp: 100,
    doorMaxHp: 100,
    doorLevel: 1,
    buildings: [],
    ghosts: [],
    projectiles: [],
    particles: [],
    isWaveActive: false,
    isGameOver: false,
    selectedBuildType: null,
    buildMenuOpen: false,
    lastGoldTime: 0,
    waveStartTime: 0
};

// 获取画布
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 网格系统
class Grid {
    constructor() {
        this.cols = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
        this.rows = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);
        this.cells = [];
        
        for (let r = 0; r < this.rows; r++) {
            this.cells[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.cells[r][c] = null;
            }
        }
    }
    
    getCell(x, y) {
        const c = Math.floor(x / CONFIG.GRID_SIZE);
        const r = Math.floor(y / CONFIG.GRID_SIZE);
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
            return { r, c, building: this.cells[r][c] };
        }
        return null;
    }
    
    placeBuilding(r, c, building) {
        if (this.cells[r] && this.cells[r][c] === null) {
            this.cells[r][c] = building;
            return true;
        }
        return false;
    }
    
    removeBuilding(r, c) {
        if (this.cells[r] && this.cells[r][c]) {
            this.cells[r][c] = null;
        }
    }
}

const grid = new Grid();

// 建筑类
class Building {
    constructor(r, c, type) {
        this.r = r;
        this.c = c;
        this.x = c * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
        this.y = r * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
        this.type = type;
        this.config = BUILDINGS[type];
        this.level = 1;
        this.lastFire = 0;
        this.target = null;
    }
    
    update(deltaTime) {
        if (this.type === 'turret') {
            // 寻找目标
            this.findTarget();
            
            // 射击
            if (this.target && Date.now() - this.lastFire > this.config.fireRate) {
                this.fire();
                this.lastFire = Date.now();
            }
        }
    }
    
    findTarget() {
        let closest = null;
        let minDist = this.config.range;
        
        for (const ghost of gameState.ghosts) {
            const dist = Math.hypot(ghost.x - this.x, ghost.y - this.y);
            if (dist < minDist) {
                minDist = dist;
                closest = ghost;
            }
        }
        
        this.target = closest;
    }
    
    fire() {
        if (this.target) {
            gameState.projectiles.push(new Projectile(this.x, this.y, this.target, this.config.damage));
        }
    }
    
    draw(ctx) {
        const size = CONFIG.GRID_SIZE - 4;
        const x = this.c * CONFIG.GRID_SIZE + 2;
        const y = this.r * CONFIG.GRID_SIZE + 2;
        
        // 绘制建筑背景
        ctx.fillStyle = this.config.color;
        ctx.fillRect(x, y, size, size);
        
        // 绘制图标
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.config.icon, this.x, this.y);
        
        // 绘制等级
        if (this.level > 1) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '12px Arial';
            ctx.fillText('Lv' + this.level, this.x, this.y + 12);
        }
        
        // 绘制射程（选中时）
        if (this.type === 'turret' && this.target) {
            ctx.strokeStyle = 'rgba(233, 69, 96, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.config.range, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// 猛鬼类
class Ghost {
    constructor(wave) {
        this.wave = wave;
        this.hp = 50 + wave * 20;
        this.maxHp = this.hp;
        this.damage = 5 + wave * 2;
        this.speed = 0.5 + wave * 0.1;
        this.goldReward = 10 + wave * 5;
        
        // 从上方随机位置生成
        this.x = Math.random() * (CONFIG.CANVAS_WIDTH - 40) + 20;
        this.y = -30;
        
        this.radius = 15;
        this.color = `hsl(${280 + Math.random() * 40}, 70%, 50%)`;
        this.attacking = false;
        this.attackCooldown = 0;
        this.slowed = false;
        this.slowTimer = 0;
    }
    
    update(deltaTime) {
        // 检查陷阱
        const cell = grid.getCell(this.x, this.y);
        if (cell && cell.building && cell.building.type === 'trap') {
            this.hp -= BUILDINGS.trap.damage * deltaTime / 1000;
            this.speed = (0.5 + this.wave * 0.1) * BUILDINGS.trap.slow;
            this.slowed = true;
            this.slowTimer = Date.now();
        } else if (this.slowed && Date.now() - this.slowTimer > 1000) {
            this.speed = 0.5 + this.wave * 0.1;
            this.slowed = false;
        }
        
        // 向门移动
        const doorCenterX = CONFIG.DOOR_X + CONFIG.DOOR_WIDTH / 2;
        const doorCenterY = CONFIG.DOOR_Y + CONFIG.DOOR_HEIGHT / 2;
        const dx = doorCenterX - this.x;
        const dy = doorCenterY - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 30) {
            this.x += (dx / dist) * this.speed * (deltaTime / 16);
            this.y += (dy / dist) * this.speed * (deltaTime / 16);
            this.attacking = false;
        } else {
            // 攻击门
            this.attacking = true;
            if (Date.now() - this.attackCooldown > 1000) {
                gameState.doorHp -= this.damage;
                this.attackCooldown = Date.now();
                
                // 创建攻击特效
                createParticles(CONFIG.DOOR_X + CONFIG.DOOR_WIDTH/2, CONFIG.DOOR_Y + CONFIG.DOOR_HEIGHT/2, '#ff0000', 5);
                
                if (gameState.doorHp <= 0) {
                    gameOver();
                }
            }
        }
    }
    
    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            gameState.gold += this.goldReward;
            createParticles(this.x, this.y, this.color, 10);
            return true; // 死亡
        }
        return false;
    }
    
    draw(ctx) {
        // 绘制猛鬼
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制眼睛
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y - 3, 3, 0, Math.PI * 2);
        ctx.arc(this.x + 5, this.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制血条
        const barWidth = 30;
        const barHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 10, barWidth, barHeight);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 10, barWidth * (this.hp / this.maxHp), barHeight);
    }
}

// 子弹类
class Projectile {
    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 8;
        this.radius = 4;
    }
    
    update() {
        if (!this.target || gameState.ghosts.indexOf(this.target) === -1) {
            return true; // 目标消失，删除子弹
        }
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < this.speed) {
            // 命中
            if (this.target.takeDamage(this.damage)) {
                gameState.ghosts = gameState.ghosts.filter(g => g !== this.target);
            }
            return true; // 删除子弹
        }
        
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
        return false;
    }
    
    draw(ctx) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 粒子特效
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.02;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        return this.life <= 0;
    }
    
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}

// 初始化游戏
function init() {
    setupCanvas();
    setupInputEvents();
    updateUI();
    gameLoop();
}

function setupCanvas() {
    const maxWidth = Math.min(window.innerWidth - 20, 400);
    if (maxWidth < 400) {
        const scale = maxWidth / 400;
        canvas.style.width = maxWidth + 'px';
        canvas.style.height = (500 * scale) + 'px';
    }
}

function setupInputEvents() {
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
}

function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 500 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    handleInput(x, y);
}

function handleTouchStart(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 500 / rect.height;
    const x = (e.touches[0].clientX - rect.left) * scaleX;
    const y = (e.touches[0].clientY - rect.top) * scaleY;
    
    handleInput(x, y);
}

function handleInput(x, y) {
    if (!gameState.selectedBuildType || gameState.isGameOver) return;
    
    const cell = grid.getCell(x, y);
    if (!cell) return;
    
    // 检查是否在门的位置
    if (x >= CONFIG.DOOR_X && x <= CONFIG.DOOR_X + CONFIG.DOOR_WIDTH &&
        y >= CONFIG.DOOR_Y && y <= CONFIG.DOOR_Y + CONFIG.DOOR_HEIGHT) {
        return;
    }
    
    // 检查金币
    const cost = BUILDINGS[gameState.selectedBuildType].cost;
    if (gameState.gold < cost) {
        alert('金币不足！');
        return;
    }
    
    // 建造
    if (grid.placeBuilding(cell.r, cell.c, null)) {
        const building = new Building(cell.r, cell.c, gameState.selectedBuildType);
        grid.cells[cell.r][cell.c] = building;
        gameState.buildings.push(building);
        gameState.gold -= cost;
        createParticles(x, y, '#00ff00', 8);
        updateUI();
        
        // 关闭建造菜单
        toggleBuildMenu();
    }
}

// 建造菜单
function toggleBuildMenu() {
    gameState.buildMenuOpen = !gameState.buildMenuOpen;
    document.getElementById('buildMenu').classList.toggle('active', gameState.buildMenuOpen);
    if (!gameState.buildMenuOpen) {
        gameState.selectedBuildType = null;
    }
}

function selectBuild(type) {
    gameState.selectedBuildType = type;
    toggleBuildMenu();
}

// 升级门
function upgradeDoor() {
    if (gameState.isGameOver) return;
    
    const cost = gameState.doorLevel * 50;
    if (gameState.gold < cost) {
        alert('金币不足！需要 ' + cost + ' 金币');
        return;
    }
    
    gameState.gold -= cost;
    gameState.doorLevel++;
    gameState.doorMaxHp += 50;
    gameState.doorHp = gameState.doorMaxHp;
    createParticles(CONFIG.DOOR_X + CONFIG.DOOR_WIDTH/2, CONFIG.DOOR_Y + CONFIG.DOOR_HEIGHT/2, '#ffd700', 10);
    updateUI();
}

// 修门
function repairDoor() {
    if (gameState.isGameOver) return;
    if (gameState.doorHp >= gameState.doorMaxHp) return;
    
    const cost = 20;
    if (gameState.gold < cost) {
        alert('金币不足！');
        return;
    }
    
    gameState.gold -= cost;
    gameState.doorHp = Math.min(gameState.doorHp + 30, gameState.doorMaxHp);
    createParticles(CONFIG.DOOR_X + CONFIG.DOOR_WIDTH/2, CONFIG.DOOR_Y + CONFIG.DOOR_HEIGHT/2, '#00ff00', 5);
    updateUI();
}

// 开始波次
function startWave() {
    if (gameState.isWaveActive || gameState.isGameOver) return;
    
    gameState.isWaveActive = true;
    gameState.waveStartTime = Date.now();
    
    // 生成猛鬼
    const ghostCount = 3 + gameState.wave * 2;
    let spawned = 0;
    
    const spawnInterval = setInterval(() => {
        if (spawned >= ghostCount || gameState.isGameOver) {
            clearInterval(spawnInterval);
            return;
        }
        
        gameState.ghosts.push(new Ghost(gameState.wave));
        spawned++;
    }, 1500);
}

// 游戏主循环
let lastTime = Date.now();
function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // 清空画布
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // 绘制网格
    drawGrid();
    
    // 绘制门
    drawDoor();
    
    // 更新和绘制建筑
    for (const building of gameState.buildings) {
        building.update(deltaTime);
        building.draw(ctx);
    }
    
    // 更新和绘制猛鬼
    for (let i = gameState.ghosts.length - 1; i >= 0; i--) {
        const ghost = gameState.ghosts[i];
        ghost.update(deltaTime);
        ghost.draw(ctx);
    }
    
    // 更新和绘制子弹
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        const proj = gameState.projectiles[i];
        if (proj.update()) {
            gameState.projectiles.splice(i, 1);
        } else {
            proj.draw(ctx);
        }
    }
    
    // 更新和绘制粒子
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        if (p.update()) {
            gameState.particles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
    
    // 生产金币
    if (currentTime - gameState.lastGoldTime > 1000) {
        produceGold();
        gameState.lastGoldTime = currentTime;
    }
    
    // 检查波次结束
    if (gameState.isWaveActive && gameState.ghosts.length === 0) {
        const timeSinceWaveStart = currentTime - gameState.waveStartTime;
        if (timeSinceWaveStart > 3000) { // 等待3秒确保所有猛鬼生成完毕
            waveComplete();
        }
    }
    
    // 绘制选中建筑的预览
    if (gameState.selectedBuildType) {
        drawBuildPreview();
    }
    
    updateUI();
    requestAnimationFrame(gameLoop);
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= CONFIG.CANVAS_WIDTH; x += CONFIG.GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
    }
    
    for (let y = 0; y <= CONFIG.CANVAS_HEIGHT; y += CONFIG.GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

function drawDoor() {
    // 门背景
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(CONFIG.DOOR_X, CONFIG.DOOR_Y, CONFIG.DOOR_WIDTH, CONFIG.DOOR_HEIGHT);
    
    // 门框
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 4;
    ctx.strokeRect(CONFIG.DOOR_X, CONFIG.DOOR_Y, CONFIG.DOOR_WIDTH, CONFIG.DOOR_HEIGHT);
    
    // 门把手
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(CONFIG.DOOR_X + 30, CONFIG.DOOR_Y + 30, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 血量条
    const barWidth = CONFIG.DOOR_WIDTH;
    const barHeight = 6;
    ctx.fillStyle = '#333';
    ctx.fillRect(CONFIG.DOOR_X, CONFIG.DOOR_Y - 12, barWidth, barHeight);
    
    const hpPercent = gameState.doorHp / gameState.doorMaxHp;
    ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillRect(CONFIG.DOOR_X, CONFIG.DOOR_Y - 12, barWidth * hpPercent, barHeight);
    
    // 血量文字
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(gameState.doorHp)}/${gameState.doorMaxHp}`, CONFIG.DOOR_X + barWidth/2, CONFIG.DOOR_Y - 15);
}

function drawBuildPreview() {
    // 这里可以添加建造预览效果
}

function produceGold() {
    let baseGold = 0;
    let multiplier = 1;
    
    for (const building of gameState.buildings) {
        if (building.type === 'bed') {
            baseGold += building.config.goldPerSecond;
        } else if (building.type === 'generator') {
            multiplier += 0.5;
        }
    }
    
    gameState.gold += Math.floor(baseGold * multiplier);
}

function waveComplete() {
    gameState.isWaveActive = false;
    gameState.wave++;
    
    // 波次奖励
    gameState.gold += 50 + gameState.wave * 10;
    
    if (gameState.wave > CONFIG.MAX_WAVE) {
        gameWin();
    }
}

function updateUI() {
    document.getElementById('gold').textContent = Math.floor(gameState.gold);
    document.getElementById('doorHp').textContent = Math.floor(gameState.doorHp);
    document.getElementById('doorMaxHp').textContent = gameState.doorMaxHp;
    document.getElementById('wave').textContent = gameState.wave;
}

function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('finalWave').textContent = gameState.wave;
    document.getElementById('gameOver').style.display = 'flex';
}

function gameWin() {
    gameState.isGameOver = true;
    document.getElementById('gameWin').style.display = 'flex';
}

function resetGame() {
    gameState = {
        gold: 100,
        wave: 1,
        doorHp: 100,
        doorMaxHp: 100,
        doorLevel: 1,
        buildings: [],
        ghosts: [],
        projectiles: [],
        particles: [],
        isWaveActive: false,
        isGameOver: false,
        selectedBuildType: null,
        buildMenuOpen: false,
        lastGoldTime: 0,
        waveStartTime: 0
    };
    
    // 重置网格
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            grid.cells[r][c] = null;
        }
    }
    
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('gameWin').style.display = 'none';
    document.getElementById('buildMenu').classList.remove('active');
    updateUI();
}

// 启动游戏
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
