// 猛鬼宿舍 - Ghost Dorm Defense
// 多人防守游戏

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏配置
const CONFIG = {
    ROOM_COUNT: 4,
    ROOM_WIDTH: 120,
    ROOM_HEIGHT: 100,
    DOOR_WIDTH: 40,
    DOOR_HEIGHT: 60,
    BED_SIZE: 30,
    TURRET_SIZE: 25,
    GHOST_SIZE: 35,
    
    // 小人角色配置
    PLAYER_SIZE: 20,
    PLAYER_SPEED: 2.5,
    PLAYER_ANIMATION_SPEED: 150,  // 毫秒每帧
    
    // 经济系统
    START_GOLD: 200,
    BED_INCOME_BASE: 10,      // 床基础产金
    BED_INCOME_LEVEL_MULTIPLIER: 5,  // 每级增加
    INCOME_INTERVAL: 1000,    // 每秒产金
    
    // 建造花费
    COST_TURRET: 100,
    COST_UPGRADE_TURRET: 150,
    COST_REPAIR: 50,
    COST_UPGRADE_BED: 200,
    
    // 战斗数值
    DOOR_MAX_HP: 200,
    TURRET_DAMAGE: 15,
    TURRET_RANGE: 150,
    TURRET_FIRE_RATE: 800,    // 毫秒
    GHOST_DAMAGE: 10,
    GHOST_SPEED: 0.8,
    GHOST_HP: 500,
    GHOST_HP_GROWTH: 100,     // 每波增加
};

// 游戏状态
let gameState = {
    isRunning: false,
    isPaused: false,
    wave: 1,
    selectedRoom: null,
    selectedBuildType: null,
    rooms: [],
    ghost: null,
    projectiles: [],
    particles: [],
    playerCharacters: [],  // 小人角色数组
    lastTime: 0,
    gameOver: false,
    clickTarget: null,     // 点击目标位置
    clickIndicatorTimer: 0 // 点击指示器计时器
};

// 小人角色类
class PlayerCharacter {
    constructor(id, x, y, room, isHuman = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLAYER_SIZE;
        this.height = CONFIG.PLAYER_SIZE;
        this.room = room;  // 所属房间
        this.isHuman = isHuman;  // 是否是人类玩家控制
        
        // 移动相关
        this.targetX = x;
        this.targetY = y;
        this.isMoving = false;
        this.moveSpeed = CONFIG.PLAYER_SPEED;
        
        // 动画相关
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.facingRight = true;
        
        // AI相关
        this.aiMoveTimer = 0;
        this.aiMoveInterval = 2000 + Math.random() * 3000;  // 2-5秒随机移动
        this.aiTargetRoom = null;
    }
    
    update(deltaTime) {
        // 更新动画
        if (this.isMoving) {
            this.animationTimer += deltaTime;
            if (this.animationTimer >= CONFIG.PLAYER_ANIMATION_SPEED) {
                this.animationFrame = (this.animationFrame + 1) % 4;
                this.animationTimer = 0;
            }
        } else {
            this.animationFrame = 0;
        }
        
        // 人类玩家：点击移动
        if (this.isHuman) {
            if (this.isMoving) {
                this.moveToTarget(deltaTime);
            }
        } else {
            // AI移动逻辑
            this.aiUpdate(deltaTime);
        }
        
        // 检查是否走到房间门口
        this.checkRoomEntry();
    }
    
    moveToTarget(deltaTime) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
            // 到达目标
            this.x = this.targetX;
            this.y = this.targetY;
            this.isMoving = false;
        } else {
            // 继续移动
            const moveDistance = this.moveSpeed * (deltaTime / 16);
            const ratio = Math.min(moveDistance / distance, 1);
            
            this.x += dx * ratio;
            this.y += dy * ratio;
            
            // 更新朝向
            this.facingRight = dx > 0;
        }
    }
    
    setTarget(targetX, targetY) {
        this.targetX = targetX;
        this.targetY = targetY;
        this.isMoving = true;
    }
    
    aiUpdate(deltaTime) {
        this.aiMoveTimer += deltaTime;
        
        if (this.isMoving) {
            this.moveToTarget(deltaTime);
        } else if (this.aiMoveTimer >= this.aiMoveInterval) {
            // 随机选择一个目标位置或房间
            this.aiChooseTarget();
            this.aiMoveTimer = 0;
            this.aiMoveInterval = 2000 + Math.random() * 3000;
        }
    }
    
    aiChooseTarget() {
        // AI有30%概率走向某个房间门口，70%概率随机走动
        if (Math.random() < 0.3) {
            // 选择一个随机房间
            const aliveRooms = gameState.rooms.filter(r => r.player.isAlive);
            if (aliveRooms.length > 0) {
                const targetRoom = aliveRooms[Math.floor(Math.random() * aliveRooms.length)];
                // 走到房间门口
                this.targetX = targetRoom.door.x + CONFIG.DOOR_WIDTH / 2 - this.width / 2;
                this.targetY = targetRoom.door.y - this.height - 10;
                this.isMoving = true;
                this.aiTargetRoom = targetRoom;
            }
        } else {
            // 随机走动
            const margin = 50;
            this.targetX = margin + Math.random() * (canvas.width - margin * 2);
            this.targetY = 100 + Math.random() * (canvas.height - 350);
            this.isMoving = true;
            this.aiTargetRoom = null;
        }
    }
    
    checkRoomEntry() {
        // 检查是否走到某个房间门口附近
        for (const room of gameState.rooms) {
            const doorCenterX = room.door.x + CONFIG.DOOR_WIDTH / 2;
            const doorCenterY = room.door.y + CONFIG.DOOR_HEIGHT / 2;
            
            const dx = (this.x + this.width / 2) - doorCenterX;
            const dy = (this.y + this.height / 2) - doorCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 如果在门口附近且停止移动，自动选择该房间
            if (distance < 40 && !this.isMoving) {
                if (this.isHuman) {
                    // 人类玩家：自动选择房间
                    if (gameState.selectedRoom !== room) {
                        gameState.selectedRoom = room;
                        addLog(`走到 ${room.player.isHuman ? '你的' : 'AI' + room.id} 房间门口，自动选择该房间`, 'build');
                        updateUI();
                    }
                } else {
                    // AI：有概率进入房间（只是视觉效果，实际游戏逻辑不变）
                    if (Math.random() < 0.3) {
                        // AI小人"进入"房间，暂时消失一会儿
                        this.x = room.x + room.width / 2 - this.width / 2;
                        this.y = room.y + room.height / 2 - this.height / 2;
                    }
                }
                break;
            }
        }
    }
    
    draw() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        ctx.save();
        
        // 如果是人类玩家，绘制选中光环
        if (this.isHuman) {
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(centerX, centerY + 5, 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 绘制阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(centerX, this.y + this.height - 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 身体摆动动画
        const bobOffset = this.isMoving ? Math.sin(this.animationFrame * Math.PI / 2) * 2 : 0;
        const bodyY = this.y + bobOffset;
        
        // 绘制身体
        ctx.fillStyle = this.isHuman ? '#4ecdc4' : '#ff9f43';
        ctx.fillRect(this.x + 4, bodyY + 8, 12, 10);
        
        // 绘制头
        ctx.fillStyle = this.isHuman ? '#ffeaa7' : '#dfe6e9';
        ctx.beginPath();
        ctx.arc(centerX, bodyY + 6, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制眼睛
        ctx.fillStyle = '#2d3436';
        const eyeOffsetX = this.facingRight ? 2 : -2;
        ctx.beginPath();
        ctx.arc(centerX + eyeOffsetX - 2, bodyY + 5, 1.5, 0, Math.PI * 2);
        ctx.arc(centerX + eyeOffsetX + 2, bodyY + 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制腿部（行走动画）
        ctx.fillStyle = '#2d3436';
        if (this.isMoving) {
            const legOffset = Math.sin(this.animationFrame * Math.PI / 2) * 4;
            // 左腿
            ctx.fillRect(this.x + 5 + legOffset, bodyY + 16, 3, 5);
            // 右腿
            ctx.fillRect(this.x + 12 - legOffset, bodyY + 16, 3, 5);
        } else {
            // 站立姿势
            ctx.fillRect(this.x + 5, bodyY + 16, 3, 5);
            ctx.fillRect(this.x + 12, bodyY + 16, 3, 5);
        }
        
        // 绘制手臂
        ctx.fillStyle = this.isHuman ? '#ffeaa7' : '#dfe6e9';
        if (this.isMoving) {
            const armOffset = Math.cos(this.animationFrame * Math.PI / 2) * 3;
            ctx.fillRect(this.x + 2, bodyY + 10 + armOffset, 3, 6);
            ctx.fillRect(this.x + 15, bodyY + 10 - armOffset, 3, 6);
        } else {
            ctx.fillRect(this.x + 2, bodyY + 10, 3, 6);
            ctx.fillRect(this.x + 15, bodyY + 10, 3, 6);
        }
        
        // 玩家标识
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.isHuman ? '你' : `AI${this.id}`, centerX, this.y - 5);
        
        ctx.restore();
    }
    
    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }
}

// 房间类
class Room {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = CONFIG.ROOM_WIDTH;
        this.height = CONFIG.ROOM_HEIGHT;
        
        // 玩家数据
        this.player = {
            isHuman: id === 0,  // 第一个房间是人类玩家
            gold: CONFIG.START_GOLD,
            isAlive: true
        };
        
        // 床
        this.bed = {
            level: 1,
            x: x + 10,
            y: y + this.height - CONFIG.BED_SIZE - 10
        };
        
        // 门
        this.door = {
            hp: CONFIG.DOOR_MAX_HP,
            maxHp: CONFIG.DOOR_MAX_HP,
            x: x + this.width / 2 - CONFIG.DOOR_WIDTH / 2,
            y: y + this.height - CONFIG.DOOR_HEIGHT
        };
        
        // 炮台
        this.turrets = [];
        
        // 收入计时器
        this.incomeTimer = 0;
    }
    
    update(deltaTime) {
        if (!this.player.isAlive) return;
        
        // 床产金
        this.incomeTimer += deltaTime;
        if (this.incomeTimer >= CONFIG.INCOME_INTERVAL) {
            const income = CONFIG.BED_INCOME_BASE + (this.bed.level - 1) * CONFIG.BED_INCOME_LEVEL_MULTIPLIER;
            this.player.gold += income;
            this.incomeTimer = 0;
            
            if (this.player.isHuman) {
                addLog(`获得 ${income} 金币`, 'gold');
            }
        }
        
        // 更新炮台
        this.turrets.forEach(turret => {
            turret.update(deltaTime);
        });
        
        // AI玩家逻辑
        if (!this.player.isHuman) {
            this.aiUpdate();
        }
    }
    
    aiUpdate() {
        // AI简单策略
        // 1. 优先修理门
        if (this.door.hp < this.door.maxHp * 0.5 && this.player.gold >= CONFIG.COST_REPAIR) {
            this.repairDoor();
        }
        // 2. 升级床
        else if (this.bed.level < 5 && this.player.gold >= CONFIG.COST_UPGRADE_BED) {
            this.upgradeBed();
        }
        // 3. 建造炮台
        else if (this.turrets.length < 3 && this.player.gold >= CONFIG.COST_TURRET) {
            this.buildTurret();
        }
        // 4. 升级炮台
        else if (this.turrets.length > 0 && this.player.gold >= CONFIG.COST_UPGRADE_TURRET) {
            this.upgradeTurret();
        }
    }
    
    buildTurret() {
        if (this.player.gold < CONFIG.COST_TURRET || this.turrets.length >= 3) return false;
        
        this.player.gold -= CONFIG.COST_TURRET;
        
        // 在房间内随机位置放置炮台
        const positions = [
            { x: this.x + 20, y: this.y + 20 },
            { x: this.x + this.width - 45, y: this.y + 20 },
            { x: this.x + this.width / 2 - 12, y: this.y + 30 }
        ];
        
        const pos = positions[this.turrets.length];
        this.turrets.push(new Turret(pos.x, pos.y, this));
        
        if (this.player.isHuman) {
            addLog('建造了炮台！', 'build');
        }
        return true;
    }
    
    upgradeTurret() {
        if (this.player.gold < CONFIG.COST_UPGRADE_TURRET || this.turrets.length === 0) return false;
        
        // 找到等级最低的炮台升级
        const turret = this.turrets.reduce((min, t) => t.level < min.level ? t : min);
        if (turret.level >= 5) return false;
        
        this.player.gold -= CONFIG.COST_UPGRADE_TURRET;
        turret.upgrade();
        
        if (this.player.isHuman) {
            addLog('炮台升级！', 'build');
        }
        return true;
    }
    
    repairDoor() {
        if (this.player.gold < CONFIG.COST_REPAIR || this.door.hp >= this.door.maxHp) return false;
        
        this.player.gold -= CONFIG.COST_REPAIR;
        this.door.hp = Math.min(this.door.hp + 50, this.door.maxHp);
        
        if (this.player.isHuman) {
            addLog('修理了门', 'build');
        }
        return true;
    }
    
    upgradeBed() {
        if (this.player.gold < CONFIG.COST_UPGRADE_BED || this.bed.level >= 10) return false;
        
        this.player.gold -= CONFIG.COST_UPGRADE_BED;
        this.bed.level++;
        
        if (this.player.isHuman) {
            addLog(`床升级到 ${this.bed.level} 级！`, 'build');
        }
        return true;
    }
    
    takeDamage(damage) {
        this.door.hp -= damage;
        
        // 创建粒子效果
        for (let i = 0; i < 5; i++) {
            gameState.particles.push(new Particle(
                this.door.x + CONFIG.DOOR_WIDTH / 2,
                this.door.y + CONFIG.DOOR_HEIGHT / 2,
                '#ff6b6b'
            ));
        }
        
        if (this.door.hp <= 0) {
            this.door.hp = 0;
            this.player.isAlive = false;
            
            if (this.player.isHuman) {
                addLog('你的门被破坏了！游戏结束', 'attack');
                endGame(false);
            } else {
                addLog(`玩家${this.id + 1} 被消灭了！`, 'attack');
            }
        }
    }
    
    draw() {
        // 绘制房间背景
        ctx.fillStyle = this.player.isHuman ? 'rgba(78, 205, 196, 0.2)' : 'rgba(100, 100, 100, 0.2)';
        if (!this.player.isAlive) {
            ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
        }
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 房间边框
        ctx.strokeStyle = this.player.isHuman ? '#4ecdc4' : '#666';
        if (gameState.selectedRoom === this) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
        } else {
            ctx.lineWidth = 2;
        }
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.lineWidth = 1;
        
        // 绘制床
        this.drawBed();
        
        // 绘制门
        this.drawDoor();
        
        // 绘制炮台
        this.turrets.forEach(turret => turret.draw());
        
        // 绘制玩家信息
        ctx.fillStyle = '#fff';
        ctx.font = '12px Microsoft YaHei';
        ctx.textAlign = 'center';
        const label = this.player.isHuman ? '你' : `AI${this.id}`;
        ctx.fillText(label, this.x + this.width / 2, this.y - 5);
        
        // 金币显示
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`💰${this.player.gold}`, this.x + this.width / 2, this.y + 15);
    }
    
    drawBed() {
        const { x, y } = this.bed;
        const size = CONFIG.BED_SIZE;
        
        // 床架
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(x, y, size, size);
        
        // 床垫
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
        
        // 枕头
        ctx.fillStyle = '#ddd';
        ctx.fillRect(x + 5, y + 5, size - 10, 8);
        
        // 等级标记
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv${this.bed.level}`, x + size / 2, y + size + 12);
    }
    
    drawDoor() {
        const { x, y, hp, maxHp } = this.door;
        
        // 门框
        ctx.fillStyle = '#654321';
        ctx.fillRect(x, y, CONFIG.DOOR_WIDTH, CONFIG.DOOR_HEIGHT);
        
        // 门板（根据血量变色）
        const hpPercent = hp / maxHp;
        if (hpPercent > 0.6) {
            ctx.fillStyle = '#8b4513';
        } else if (hpPercent > 0.3) {
            ctx.fillStyle = '#a0522d';
        } else {
            ctx.fillStyle = '#cd5c5c';
        }
        
        if (!this.player.isAlive) {
            ctx.fillStyle = '#333';
        }
        
        ctx.fillRect(x + 3, y + 3, CONFIG.DOOR_WIDTH - 6, CONFIG.DOOR_HEIGHT - 6);
        
        // 门把手
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(x + CONFIG.DOOR_WIDTH - 10, y + CONFIG.DOOR_HEIGHT / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 血量条
        const barWidth = CONFIG.DOOR_WIDTH;
        const barHeight = 6;
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y - barHeight - 2, barWidth, barHeight);
        
        ctx.fillStyle = hpPercent > 0.5 ? '#4ecdc4' : hpPercent > 0.25 ? '#ffd700' : '#e94560';
        ctx.fillRect(x, y - barHeight - 2, barWidth * hpPercent, barHeight);
        
        // 血量数字
        ctx.fillStyle = '#fff';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(hp)}/${maxHp}`, x + barWidth / 2, y - 5);
    }
    
    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }
}

// 炮台类
class Turret {
    constructor(x, y, room) {
        this.x = x;
        this.y = y;
        this.room = room;
        this.level = 1;
        this.lastFire = 0;
        this.angle = 0;
    }
    
    update(deltaTime) {
        this.lastFire += deltaTime;
        
        // 寻找目标
        const ghost = gameState.ghost;
        if (!ghost || ghost.hp <= 0) return;
        
        const dx = ghost.x - (this.x + CONFIG.TURRET_SIZE / 2);
        const dy = ghost.y - (this.y + CONFIG.TURRET_SIZE / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 更新角度
        this.angle = Math.atan2(dy, dx);
        
        // 在射程内且冷却完毕
        if (distance <= CONFIG.TURRET_RANGE && this.lastFire >= CONFIG.TURRET_FIRE_RATE) {
            this.fire(ghost);
            this.lastFire = 0;
        }
    }
    
    fire(target) {
        const damage = CONFIG.TURRET_DAMAGE * this.level;
        gameState.projectiles.push(new Projectile(
            this.x + CONFIG.TURRET_SIZE / 2,
            this.y + CONFIG.TURRET_SIZE / 2,
            target,
            damage
        ));
    }
    
    upgrade() {
        this.level++;
    }
    
    draw() {
        const size = CONFIG.TURRET_SIZE;
        const centerX = this.x + size / 2;
        const centerY = this.y + size / 2;
        
        // 炮台底座
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 炮台炮管
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(0, -4, size / 2 + 5, 8);
        
        ctx.restore();
        
        // 炮台中心
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 等级标记
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.level, centerX, centerY + 3);
    }
}

// 猛鬼类
class Ghost {
    constructor() {
        this.x = 400;
        this.y = 50;
        this.hp = CONFIG.GHOST_HP;
        this.maxHp = CONFIG.GHOST_HP;
        this.targetRoom = null;
        this.attackCooldown = 0;
        this.findNewTarget();
    }
    
    findNewTarget() {
        // 寻找存活的玩家
        const aliveRooms = gameState.rooms.filter(r => r.player.isAlive);
        if (aliveRooms.length === 0) return;
        
        // 随机选择目标
        this.targetRoom = aliveRooms[Math.floor(Math.random() * aliveRooms.length)];
    }
    
    update(deltaTime) {
        if (this.hp <= 0) return;
        
        // 检查目标是否死亡
        if (!this.targetRoom || !this.targetRoom.player.isAlive) {
            this.findNewTarget();
            if (!this.targetRoom) return;
        }
        
        // 移动到目标门前
        const targetX = this.targetRoom.door.x + CONFIG.DOOR_WIDTH / 2;
        const targetY = this.targetRoom.door.y - 20;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            // 移动
            this.x += (dx / distance) * CONFIG.GHOST_SPEED * (deltaTime / 16);
            this.y += (dy / distance) * CONFIG.GHOST_SPEED * (deltaTime / 16);
        } else {
            // 攻击门
            this.attackCooldown += deltaTime;
            if (this.attackCooldown >= 1000) {
                this.attack();
                this.attackCooldown = 0;
            }
        }
    }
    
    attack() {
        if (!this.targetRoom) return;
        
        this.targetRoom.takeDamage(CONFIG.GHOST_DAMAGE);
        
        if (this.targetRoom.player.isHuman) {
            addLog(`猛鬼攻击了你的门！门血量: ${Math.ceil(this.targetRoom.door.hp)}`, 'attack');
        }
    }
    
    takeDamage(damage) {
        this.hp -= damage;
        
        // 创建粒子效果
        for (let i = 0; i < 3; i++) {
            gameState.particles.push(new Particle(
                this.x + CONFIG.GHOST_SIZE / 2,
                this.y + CONFIG.GHOST_SIZE / 2,
                '#9b59b6'
            ));
        }
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    die() {
        addLog(`猛鬼被消灭了！第 ${gameState.wave} 波结束`, 'build');
        
        // 检查是否还有存活的玩家
        const alivePlayers = gameState.rooms.filter(r => r.player.isAlive);
        const humanAlive = alivePlayers.some(r => r.player.isHuman);
        
        if (!humanAlive) {
            endGame(false);
        } else if (alivePlayers.length === 1 && humanAlive) {
            endGame(true);
        } else {
            // 下一波
            setTimeout(() => {
                gameState.wave++;
                gameState.ghost = new Ghost();
                gameState.ghost.hp = CONFIG.GHOST_HP + (gameState.wave - 1) * CONFIG.GHOST_HP_GROWTH;
                gameState.ghost.maxHp = gameState.ghost.hp;
                addLog(`第 ${gameState.wave} 波开始！猛鬼变强了！`, 'attack');
            }, 2000);
        }
    }
    
    draw() {
        if (this.hp <= 0) return;
        
        const size = CONFIG.GHOST_SIZE;
        
        // 猛鬼身体（幽灵效果）
        ctx.fillStyle = 'rgba(155, 89, 182, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x + size / 2, this.y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 幽灵尾巴
        ctx.fillStyle = 'rgba(155, 89, 182, 0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x + size / 2, this.y + size + 5, size / 3, size / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(this.x + size / 2 - 6, this.y + size / 2 - 3, 4, 0, Math.PI * 2);
        ctx.arc(this.x + size / 2 + 6, this.y + size / 2 - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // 血量条
        const barWidth = size;
        const barHeight = 6;
        const hpPercent = this.hp / this.maxHp;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y - barHeight - 4, barWidth, barHeight);
        
        ctx.fillStyle = hpPercent > 0.5 ? '#e94560' : '#ff0000';
        ctx.fillRect(this.x, this.y - barHeight - 4, barWidth * hpPercent, barHeight);
        
        // 波数标记
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`👻`, this.x + size / 2, this.y - 15);
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
        this.active = true;
    }
    
    update() {
        if (!this.active) return;
        
        const dx = this.target.x + CONFIG.GHOST_SIZE / 2 - this.x;
        const dy = this.target.y + CONFIG.GHOST_SIZE / 2 - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) {
            // 命中
            this.target.takeDamage(this.damage);
            this.active = false;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }
    
    draw() {
        if (!this.active) return;
        
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // 光晕效果
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 粒子效果类
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
    }
    
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1;
    }
}

// 初始化游戏
function initGame() {
    // 创建房间
    gameState.rooms = [];
    const roomSpacing = 160;
    const startX = 80;
    const roomY = 350;

    for (let i = 0; i < CONFIG.ROOM_COUNT; i++) {
        gameState.rooms.push(new Room(i, startX + i * roomSpacing, roomY));
    }

    // 创建猛鬼
    gameState.ghost = new Ghost();

    // 创建小人角色
    gameState.playerCharacters = [];
    for (let i = 0; i < CONFIG.ROOM_COUNT; i++) {
        // 每个房间一个小人，初始位置在房间门口附近
        const room = gameState.rooms[i];
        const charX = room.door.x + CONFIG.DOOR_WIDTH / 2 - CONFIG.PLAYER_SIZE / 2;
        const charY = room.door.y - CONFIG.PLAYER_SIZE - 20;
        const isHuman = (i === 0);  // 第一个小人由人类玩家控制
        gameState.playerCharacters.push(new PlayerCharacter(i, charX, charY, room, isHuman));
    }

    // 重置状态
    gameState.projectiles = [];
    gameState.particles = [];
    gameState.wave = 1;
    gameState.gameOver = false;
    gameState.selectedRoom = gameState.rooms[0];  // 默认选择第一个房间
    gameState.clickTarget = null;
    gameState.clickIndicatorTimer = 0;

    updateUI();
    addLog('游戏开始！点击地面移动你的小人，走到房间门口自动选择该房间！', 'build');
}

// 游戏循环
function gameLoop(currentTime) {
    if (!gameState.isRunning || gameState.isPaused || gameState.gameOver) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    
    // 更新
    gameState.rooms.forEach(room => room.update(deltaTime));

    if (gameState.ghost) {
        gameState.ghost.update(deltaTime);
    }

    // 更新小人角色
    gameState.playerCharacters.forEach(char => char.update(deltaTime));

    // 更新点击指示器
    if (gameState.clickIndicatorTimer > 0) {
        gameState.clickIndicatorTimer -= deltaTime;
    }

    gameState.projectiles.forEach(p => p.update());
    gameState.projectiles = gameState.projectiles.filter(p => p.active);

    gameState.particles.forEach(p => p.update());
    gameState.particles = gameState.particles.filter(p => p.life > 0);
    
    // 绘制
    draw();
    
    // 更新UI
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// 绘制函数
function draw() {
    // 清空画布
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
    
    // 绘制房间
    gameState.rooms.forEach(room => room.draw());

    // 绘制小人角色（在房间下面，但在其他元素上面）
    gameState.playerCharacters.forEach(char => char.draw());

    // 绘制点击目标指示器
    if (gameState.clickTarget && gameState.clickIndicatorTimer > 0) {
        const alpha = gameState.clickIndicatorTimer / 500;
        ctx.strokeStyle = `rgba(78, 205, 196, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gameState.clickTarget.x, gameState.clickTarget.y, 10 + (500 - gameState.clickIndicatorTimer) / 20, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = `rgba(78, 205, 196, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(gameState.clickTarget.x, gameState.clickTarget.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 绘制猛鬼
    if (gameState.ghost) {
        gameState.ghost.draw();
    }
    
    // 绘制子弹
    gameState.projectiles.forEach(p => p.draw());
    
    // 绘制粒子
    gameState.particles.forEach(p => p.draw());
    
    // 绘制波数信息
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 20px Microsoft YaHei';
    ctx.textAlign = 'left';
    ctx.fillText(`第 ${gameState.wave} 波`, 20, 40);
    
    // 绘制存活玩家数
    const aliveCount = gameState.rooms.filter(r => r.player.isAlive).length;
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText(`存活: ${aliveCount}/${CONFIG.ROOM_COUNT}`, 20, 70);
}

// 更新UI
function updateUI() {
    const room = gameState.selectedRoom;
    if (!room) return;
    
    document.getElementById('goldDisplay').textContent = room.player.gold;
    document.getElementById('roomDisplay').textContent = room.player.isHuman ? '你的房间' : `AI房间 ${room.id}`;
    document.getElementById('doorDisplay').textContent = room.player.isAlive ? `${Math.ceil(room.door.hp)}/${room.door.maxHp}` : '已破坏';
    document.getElementById('bedDisplay').textContent = `Lv${room.bed.level}`;
    
    // 更新按钮状态
    document.querySelectorAll('.build-btn').forEach(btn => {
        const type = btn.dataset.type;
        let canAfford = false;
        
        switch(type) {
            case 'turret':
                canAfford = room.player.gold >= CONFIG.COST_TURRET && room.turrets.length < 3;
                break;
            case 'upgradeTurret':
                canAfford = room.player.gold >= CONFIG.COST_UPGRADE_TURRET && room.turrets.length > 0;
                break;
            case 'repair':
                canAfford = room.player.gold >= CONFIG.COST_REPAIR && room.door.hp < room.door.maxHp;
                break;
            case 'upgradeBed':
                canAfford = room.player.gold >= CONFIG.COST_UPGRADE_BED && room.bed.level < 10;
                break;
        }
        
        btn.disabled = !canAfford || !room.player.isAlive || !room.player.isHuman;
        btn.style.opacity = btn.disabled ? '0.5' : '1';
    });
}

// 添加日志
function addLog(message, type = '') {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString('zh-CN', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})}] ${message}`;
    log.insertBefore(entry, log.firstChild);
    
    // 限制日志数量
    while (log.children.length > 20) {
        log.removeChild(log.lastChild);
    }
}

// 游戏结束
function endGame(win) {
    gameState.gameOver = true;
    gameState.isRunning = false;
    
    const screen = document.getElementById('gameOverScreen');
    const text = document.getElementById('gameOverText');
    const reason = document.getElementById('gameOverReason');
    
    screen.style.display = 'flex';
    screen.className = win ? 'win' : 'lose';
    text.textContent = win ? '🎉 胜利！' : '💀 失败！';
    reason.textContent = win ? '你是最后的幸存者！' : '你的门被猛鬼破坏了！';
}

// 事件监听
// 开始游戏
document.getElementById('startBtn').addEventListener('click', () => {
    if (!gameState.isRunning) {
        gameState.isRunning = true;
        gameState.lastTime = performance.now();
        initGame();
        requestAnimationFrame(gameLoop);
        
        document.getElementById('startBtn').textContent = '重新开始';
        document.getElementById('pauseBtn').disabled = false;
    } else {
        location.reload();
    }
});

// 暂停
document.getElementById('pauseBtn').addEventListener('click', () => {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('pauseBtn').textContent = gameState.isPaused ? '继续' : '暂停';
});

// 建造按钮
document.querySelectorAll('.build-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const room = gameState.selectedRoom;
        if (!room || !room.player.isHuman || !room.player.isAlive) return;
        
        const type = btn.dataset.type;
        
        switch(type) {
            case 'turret':
                room.buildTurret();
                break;
            case 'upgradeTurret':
                room.upgradeTurret();
                break;
            case 'repair':
                room.repairDoor();
                break;
            case 'upgradeBed':
                room.upgradeBed();
                break;
        }
        
        updateUI();
    });
});

// 点击选择房间或移动小人
canvas.addEventListener('click', (e) => {
    if (!gameState.isRunning) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 首先检查是否点击了房间
    let clickedRoom = null;
    for (const room of gameState.rooms) {
        if (room.containsPoint(x, y)) {
            clickedRoom = room;
            break;
        }
    }

    if (clickedRoom) {
        // 点击了房间，选择该房间
        gameState.selectedRoom = clickedRoom;
        addLog(clickedRoom.player.isHuman ? '切换到你的房间' : `查看 AI${clickedRoom.id} 的房间`);
        updateUI();
    } else {
        // 点击了地面，移动人类玩家的小人
        const humanChar = gameState.playerCharacters.find(char => char.isHuman);
        if (humanChar) {
            humanChar.setTarget(x - CONFIG.PLAYER_SIZE / 2, y - CONFIG.PLAYER_SIZE / 2);
            
            // 设置点击指示器
            gameState.clickTarget = { x, y };
            gameState.clickIndicatorTimer = 500;  // 显示500毫秒
            
            addLog('移动中...', 'build');
        }
    }
});

// 初始绘制
ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#e94560';
ctx.font = '24px Microsoft YaHei';
ctx.textAlign = 'center';
ctx.fillText('点击"开始游戏"开始', canvas.width / 2, canvas.height / 2);

console.log('猛鬼宿舍游戏已加载！');
