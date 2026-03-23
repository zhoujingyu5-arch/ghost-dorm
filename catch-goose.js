/**
 * 抓大鹅 - 消除类游戏
 * 类似"羊了个羊"的玩法
 */

// 游戏配置
const CONFIG = {
    GRID_ROWS: 6,
    GRID_COLS: 6,
    ITEM_SIZE: 50,
    ITEM_GAP: 5,
    LAYERS: 3,
    SLOT_COUNT: 7,
    ITEM_TYPES: [
        { emoji: '🦢', name: '白鹅', color: '#FFFFFF' },
        { emoji: '🦆', name: '鸭子', color: '#FFE4B5' },
        { emoji: '🥚', name: '鹅蛋', color: '#FFF8DC' },
        { emoji: '🪶', name: '鹅毛', color: '#F0F8FF' },
        { emoji: '🦶', name: '鹅掌', color: '#FFA07A' },
        { emoji: '🌿', name: '水草', color: '#90EE90' },
        { emoji: '🏠', name: '鹅舍', color: '#DEB887' },
        { emoji: '🎀', name: '蝴蝶结', color: '#FFB6C1' },
        { emoji: '👑', name: '皇冠', color: '#FFD700' },
        { emoji: '❤️', name: '爱心', color: '#FF69B4' }
    ]
};

// 游戏状态
class GameState {
    constructor() {
        this.items = [];          // 所有物品
        this.slots = [];          // 槽位中的物品
        this.selectedItem = null; // 当前选中的物品
        this.isGameOver = false;
        this.isWin = false;
        this.animatingItems = new Set();
        this.particles = [];      // 粒子效果
    }
    
    reset() {
        this.items = [];
        this.slots = [];
        this.selectedItem = null;
        this.isGameOver = false;
        this.isWin = false;
        this.animatingItems.clear();
        this.particles = [];
    }
}

// 游戏物品类
class GameItem {
    constructor(id, type, layer, gridX, gridY, x, y) {
        this.id = id;
        this.type = type;           // 物品类型索引
        this.layer = layer;         // 层级 (0-2)
        this.gridX = gridX;         // 网格X坐标
        this.gridY = gridY;         // 网格Y坐标
        this.x = x;                 // 实际X坐标
        this.y = y;                 // 实际Y坐标
        this.width = CONFIG.ITEM_SIZE;
        this.height = CONFIG.ITEM_SIZE;
        this.isRemoved = false;
        this.isClickable = false;
        this.isMoving = false;
        this.targetX = x;
        this.targetY = y;
        this.scale = 1;
        this.opacity = 1;
        this.bounceOffset = 0;
        this.bounceTime = Math.random() * Math.PI * 2;
    }
    
    getBounds() {
        return {
            left: this.x,
            top: this.y,
            right: this.x + this.width,
            bottom: this.y + this.height
        };
    }
    
    contains(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.left && x <= bounds.right &&
               y >= bounds.top && y <= bounds.bottom;
    }
    
    update(deltaTime) {
        // 弹跳动画
        this.bounceTime += deltaTime * 0.003;
        this.bounceOffset = Math.sin(this.bounceTime) * 2;
        
        // 移动动画
        if (this.isMoving) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.x += dx * 0.2;
            this.y += dy * 0.2;
            
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.isMoving = false;
            }
        }
    }
}

// 粒子效果类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 3;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 8 + 4;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // 重力
        this.life -= 0.02;
        this.size *= 0.98;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 游戏主类
class CatchGooseGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = new GameState();
        this.lastTime = 0;
        
        this.initCanvas();
        this.bindEvents();
        this.startGame();
        this.gameLoop();
    }
    
    initCanvas() {
        const container = document.getElementById('gameContainer');
        const containerWidth = container.clientWidth || window.innerWidth;
        const containerHeight = window.innerHeight - 250; // 留出空间给头部、槽位和按钮
        
        // 移动端适配：确保画布不会太大
        const maxCanvasWidth = Math.min(containerWidth - 20, 380);
        const maxCanvasHeight = Math.min(containerHeight, 450);
        
        // 设置画布尺寸
        this.canvas.style.width = maxCanvasWidth + 'px';
        this.canvas.style.height = maxCanvasHeight + 'px';
        
        // 设置实际像素尺寸（考虑设备像素比）
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = maxCanvasWidth * dpr;
        this.canvas.height = maxCanvasHeight * dpr;
        this.ctx.scale(dpr, dpr);
        
        // 计算物品大小以适应画布
        const availableWidth = maxCanvasWidth - 30;
        const availableHeight = maxCanvasHeight - 30;
        
        const cellWidth = Math.floor(availableWidth / CONFIG.GRID_COLS);
        const cellHeight = Math.floor(availableHeight / CONFIG.GRID_ROWS);
        
        CONFIG.ITEM_SIZE = Math.min(cellWidth, cellHeight) - CONFIG.ITEM_GAP;
        CONFIG.ITEM_SIZE = Math.max(CONFIG.ITEM_SIZE, 40); // 最小40px，确保可点击
        CONFIG.ITEM_SIZE = Math.min(CONFIG.ITEM_SIZE, 55); // 最大55px
        
        // 更新网格间距
        CONFIG.ITEM_GAP = Math.max(3, Math.floor(CONFIG.ITEM_SIZE * 0.1));
    }
    
    bindEvents() {
        // 点击/触摸事件
        const handleInput = (e) => {
            if (this.state.isGameOver) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            
            this.handleClick(x, y);
        };
        
        this.canvas.addEventListener('click', handleInput);
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleInput(e);
        });
        
        // 按钮事件
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('shuffleBtn').addEventListener('click', () => this.shuffleItems());
        document.getElementById('modalBtn').addEventListener('click', () => {
            document.getElementById('modal').classList.remove('show');
            this.startGame();
        });
        
        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.initCanvas();
            this.recalculatePositions();
        });
    }
    
    startGame() {
        this.state.reset();
        this.generateItems();
        this.updateSlotDisplay();
        this.updateRemainingCount();
        document.getElementById('modal').classList.remove('show');
    }
    
    generateItems() {
        const items = [];
        const totalCells = CONFIG.GRID_ROWS * CONFIG.GRID_COLS;
        const itemsPerLayer = Math.floor(totalCells * 0.7); // 每层填充70%
        
        let id = 0;
        
        // 为每层生成物品
        for (let layer = 0; layer < CONFIG.LAYERS; layer++) {
            const layerItems = [];
            const usedPositions = new Set();
            
            // 生成该层的物品位置
            const itemCount = itemsPerLayer - layer * 3; // 上层物品少一些
            
            for (let i = 0; i < itemCount; i++) {
                let gridX, gridY, posKey;
                do {
                    gridX = Math.floor(Math.random() * CONFIG.GRID_COLS);
                    gridY = Math.floor(Math.random() * CONFIG.GRID_ROWS);
                    posKey = `${gridX},${gridY}`;
                } while (usedPositions.has(posKey));
                
                usedPositions.add(posKey);
                
                // 计算实际位置（带偏移）
                const offsetX = layer * 8; // 每层偏移
                const offsetY = layer * 6;
                const x = 20 + gridX * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP) + offsetX;
                const y = 20 + gridY * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP) + offsetY;
                
                // 随机选择物品类型
                const typeIndex = Math.floor(Math.random() * CONFIG.ITEM_TYPES.length);
                
                const item = new GameItem(id++, typeIndex, layer, gridX, gridY, x, y);
                layerItems.push(item);
            }
            
            items.push(...layerItems);
        }
        
        // 确保每种物品数量是3的倍数
        this.ensureValidCounts(items);
        
        // 按层级排序（上层在前）
        items.sort((a, b) => b.layer - a.layer);
        
        this.state.items = items;
        this.updateClickableState();
    }
    
    ensureValidCounts(items) {
        // 统计每种类型数量
        const typeCounts = {};
        items.forEach(item => {
            typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        });
        
        // 调整数量使其成为3的倍数
        Object.keys(typeCounts).forEach(type => {
            const count = typeCounts[type];
            const remainder = count % 3;
            if (remainder !== 0) {
                // 需要移除的物品数
                const toRemove = remainder;
                const typeItems = items.filter(i => i.type === parseInt(type) && !i.isRemoved);
                for (let i = 0; i < toRemove && i < typeItems.length; i++) {
                    typeItems[i].isRemoved = true;
                }
            }
        });
        
        // 过滤掉被标记移除的物品
        this.state.items = items.filter(i => !i.isRemoved);
    }
    
    updateClickableState() {
        // 检查每个物品是否可点击（没有被上层物品遮挡）
        this.state.items.forEach(item => {
            if (item.isRemoved) return;
            
            item.isClickable = true;
            
            // 检查是否有上层的物品覆盖它
            for (const other of this.state.items) {
                if (other.isRemoved || other.layer <= item.layer) continue;
                
                // 检查是否重叠
                const overlap = !(other.x + other.width < item.x ||
                                other.x > item.x + item.width ||
                                other.y + other.height < item.y ||
                                other.y > item.y + item.height);
                
                if (overlap) {
                    item.isClickable = false;
                    break;
                }
            }
        });
    }
    
    handleClick(x, y) {
        // 找到点击的物品（从上到下）
        for (const item of this.state.items) {
            if (item.isRemoved || !item.isClickable) continue;
            
            if (item.contains(x, y)) {
                this.moveToSlot(item);
                break;
            }
        }
    }
    
    moveToSlot(item) {
        if (this.state.slots.length >= CONFIG.SLOT_COUNT) {
            return; // 槽位已满
        }
        
        // 标记物品为已移除
        item.isRemoved = true;
        this.state.slots.push(item);
        
        // 计算槽位位置
        const slotIndex = this.state.slots.length - 1;
        const slotContainer = document.getElementById('slotContainer');
        const slotRect = slotContainer.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // 动画移动到槽位
        item.isMoving = true;
        item.targetX = slotRect.left - canvasRect.left + 10 + slotIndex * 55;
        item.targetY = slotRect.top - canvasRect.top + 10;
        
        this.state.animatingItems.add(item);
        
        // 播放音效（可选）
        this.playSound('pop');
        
        // 延迟更新状态
        setTimeout(() => {
            this.updateSlotDisplay();
            this.checkMatch();
            this.updateClickableState();
            this.checkGameState();
            this.updateRemainingCount();
        }, 300);
    }
    
    updateSlotDisplay() {
        const slots = document.querySelectorAll('.slot');
        slots.forEach((slot, index) => {
            slot.innerHTML = '';
            slot.classList.remove('filled');
            
            if (index < this.state.slots.length) {
                const item = this.state.slots[index];
                const type = CONFIG.ITEM_TYPES[item.type];
                slot.textContent = type.emoji;
                slot.classList.add('filled');
                slot.style.background = type.color;
            }
        });
    }
    
    checkMatch() {
        // 统计槽位中每种类型数量
        const typeCounts = {};
        this.state.slots.forEach((item, index) => {
            if (!typeCounts[item.type]) {
                typeCounts[item.type] = [];
            }
            typeCounts[item.type].push(index);
        });
        
        // 检查是否有3个相同的
        let matched = false;
        Object.keys(typeCounts).forEach(type => {
            if (typeCounts[type].length >= 3) {
                // 消除这3个
                const indicesToRemove = typeCounts[type].slice(0, 3);
                this.removeMatchedItems(indicesToRemove);
                matched = true;
            }
        });
        
        if (matched) {
            this.playSound('match');
        }
    }
    
    removeMatchedItems(indices) {
        // 从后往前删除，避免索引变化
        indices.sort((a, b) => b - a);
        
        indices.forEach(index => {
            const item = this.state.slots[index];
            // 创建消除粒子效果
            this.createParticles(item.targetX + CONFIG.ITEM_SIZE/2, item.targetY + CONFIG.ITEM_SIZE/2, 
                CONFIG.ITEM_TYPES[item.type].color);
            this.state.slots.splice(index, 1);
        });
        
        // 更新槽位显示
        setTimeout(() => this.updateSlotDisplay(), 100);
    }
    
    createParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.state.particles.push(new Particle(x, y, color));
        }
    }
    
    checkGameState() {
        const remainingItems = this.state.items.filter(i => !i.isRemoved).length;
        
        // 检查胜利
        if (remainingItems === 0 && this.state.slots.length === 0) {
            this.state.isWin = true;
            this.state.isGameOver = true;
            this.showModal('胜利！', '🎉 恭喜你抓到了所有大鹅！', 'win');
            this.playSound('win');
            return;
        }
        
        // 检查失败
        if (this.state.slots.length >= CONFIG.SLOT_COUNT) {
            this.state.isGameOver = true;
            this.showModal('游戏结束', '😢 槽位已满，再试一次吧！', 'lose');
            this.playSound('lose');
        }
    }
    
    showModal(title, message, className) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalTitle').className = className;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('modal').classList.add('show');
    }
    
    shuffleItems() {
        if (this.state.isGameOver) return;
        
        // 将槽位中的物品放回游戏区
        const slotItems = [...this.state.slots];
        this.state.slots = [];
        
        // 获取所有未消除的物品
        const activeItems = this.state.items.filter(i => !i.isRemoved);
        
        // 合并物品
        const allItems = [...activeItems, ...slotItems];
        
        // 随机打乱
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
        
        // 重新分配位置
        const positions = [];
        for (let layer = 0; layer < CONFIG.LAYERS; layer++) {
            for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
                for (let col = 0; col < CONFIG.GRID_COLS; col++) {
                    if (Math.random() > 0.3) { // 70%概率有物品
                        const offsetX = layer * 8;
                        const offsetY = layer * 6;
                        positions.push({
                            x: 20 + col * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP) + offsetX,
                            y: 20 + row * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP) + offsetY,
                            layer: layer,
                            gridX: col,
                            gridY: row
                        });
                    }
                }
            }
        }
        
        // 分配新位置
        allItems.forEach((item, index) => {
            if (index < positions.length) {
                const pos = positions[index];
                item.x = pos.x;
                item.y = pos.y;
                item.layer = pos.layer;
                item.gridX = pos.gridX;
                item.gridY = pos.gridY;
                item.targetX = pos.x;
                item.targetY = pos.y;
                item.isRemoved = false;
                item.isMoving = false;
            } else {
                item.isRemoved = true;
            }
        });
        
        this.state.items = allItems.filter(i => !i.isRemoved);
        this.updateClickableState();
        this.updateSlotDisplay();
        this.updateRemainingCount();
        
        // 洗牌动画
        this.playSound('shuffle');
    }
    
    updateRemainingCount() {
        const count = this.state.items.filter(i => !i.isRemoved).length;
        document.getElementById('remaining').textContent = count;
    }
    
    recalculatePositions() {
        // 重新计算物品位置
        this.state.items.forEach(item => {
            if (!item.isRemoved) {
                item.x = 20 + item.gridX * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP) + item.layer * 8;
                item.y = 20 + item.gridY * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP) + item.layer * 6;
                item.targetX = item.x;
                item.targetY = item.y;
            }
        });
    }
    
    playSound(type) {
        // 简单的音效模拟（使用Web Audio API）
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'pop':
                oscillator.frequency.value = 600;
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'match':
                oscillator.frequency.value = 800;
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            case 'win':
                oscillator.frequency.value = 523.25; // C5
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                oscillator.start(audioContext.currentTime);
                oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'lose':
                oscillator.frequency.value = 300;
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.3);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'shuffle':
                oscillator.frequency.value = 400;
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                for (let i = 0; i < 5; i++) {
                    oscillator.frequency.setValueAtTime(400 + i * 100, audioContext.currentTime + i * 0.05);
                }
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
        }
    }
    
    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景网格
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= CONFIG.GRID_COLS; i++) {
            const x = 20 + i * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP);
            this.ctx.beginPath();
            this.ctx.moveTo(x, 20);
            this.ctx.lineTo(x, 20 + CONFIG.GRID_ROWS * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP));
            this.ctx.stroke();
        }
        for (let i = 0; i <= CONFIG.GRID_ROWS; i++) {
            const y = 20 + i * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP);
            this.ctx.beginPath();
            this.ctx.moveTo(20, y);
            this.ctx.lineTo(20 + CONFIG.GRID_COLS * (CONFIG.ITEM_SIZE + CONFIG.ITEM_GAP), y);
            this.ctx.stroke();
        }
        
        // 按层级绘制物品（从底层到上层）
        const sortedItems = [...this.state.items].sort((a, b) => a.layer - b.layer);
        
        sortedItems.forEach(item => {
            if (item.isRemoved && !item.isMoving) return;
            this.drawItem(item);
        });
        
        // 绘制粒子效果
        this.state.particles = this.state.particles.filter(p => {
            p.update();
            p.draw(this.ctx);
            return p.life > 0;
        });
    }
    
    drawItem(item) {
        const type = CONFIG.ITEM_TYPES[item.type];
        const y = item.y + item.bounceOffset;
        
        this.ctx.save();
        
        // 阴影效果
        if (item.isClickable) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowOffsetY = 4;
        } else {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 4;
            this.ctx.shadowOffsetY = 2;
        }
        
        // 绘制物品背景
        this.ctx.fillStyle = type.color;
        this.ctx.globalAlpha = item.isClickable ? 1 : 0.6;
        
        // 圆角矩形
        this.roundRect(item.x, y, item.width, item.height, 10);
        this.ctx.fill();
        
        // 绘制边框
        this.ctx.strokeStyle = item.isClickable ? '#fff' : 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 绘制emoji
        this.ctx.shadowColor = 'transparent';
        this.ctx.font = `${CONFIG.ITEM_SIZE * 0.6}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#333';
        this.ctx.globalAlpha = item.isClickable ? 1 : 0.5;
        this.ctx.fillText(type.emoji, item.x + item.width/2, y + item.height/2);
        
        // 可点击指示器
        if (item.isClickable && !this.state.isGameOver) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.globalAlpha = 0.5 + Math.sin(item.bounceTime * 2) * 0.3;
            this.roundRect(item.x - 3, y - 3, item.width + 6, item.height + 6, 12);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }
    
    update(deltaTime) {
        // 更新所有物品
        this.state.items.forEach(item => {
            item.update(deltaTime);
        });
    }
    
    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
    new CatchGooseGame();
});
