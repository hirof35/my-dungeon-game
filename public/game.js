const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE_SIZE = 32;

// マップの規格サイズ
canvas.width = 30 * TILE_SIZE;
canvas.height = 15 * TILE_SIZE;

// 💡 1. ゲームのシーン状態管理
// 'TITLE' (タイトル), 'PLAY' (プレイ中), 'GAMEOVER' (死亡), 'GAMECLEAR' (クリア)
let gameState = 'TITLE'; 

let map = [], emptyCells = [], width = 30, height = 15;
let currentFloor = 1, score = 0;
let player = { x: 0, y: 0, hp: 100, maxHp: 100, dir: 'down' };
let enemies = [];
let items = [];
let stairs = { x: 0, y: 0 };
let logMessage = "";
let laserBeams = []; 
let attackEffect = null; 
let difficulty = 'normal';

const DIFFICULTY_SETTINGS = {
    easy:   { playerHp: 150, enemyCountBase: 2, speedMultiplier: 1.3 },
    normal: { playerHp: 100, enemyCountBase: 3, speedMultiplier: 1.0 },
    hard:   { playerHp: 70,  enemyCountBase: 5, speedMultiplier: 0.7 }
};

const ENEMY_TYPES = {
    SLIME:  { type: 'slime',  name: 'スライム', emoji: '🟢', hp: 1, damage: 10, speedInterval: 400 },
    TURRET: { type: 'turret', name: '固定砲台', emoji: '🤖', hp: 3, damage: 25, speedInterval: 1200 },
    GOBLIN: { type: 'goblin', name: 'ゴブリン', emoji: '👺', hp: 2, damage: 15, speedInterval: 800 }
};

// 💡 2. ゲームの初期化・難易度選択後のスタート
function startGame(selectedDifficulty) {
    difficulty = selectedDifficulty;
    currentFloor = 1;
    score = 0;
    
    const settings = DIFFICULTY_SETTINGS[difficulty];
    player.maxHp = settings.playerHp;
    player.hp = settings.playerHp;

    gameState = 'PLAY'; // シーンをプレイ中に変更
    startNewFloor();
}

async function startNewFloor() {
    const response = await fetch('/api/map');
    const data = await response.json();
    
    map = data.map;
    emptyCells = data.emptyCells;
    width = data.width;
    height = data.height;

    function getRandomEmptyCell() {
        const index = Math.floor(Math.random() * emptyCells.length);
        return emptyCells.splice(index, 1)[0];
    }

    player = { ...player, ...getRandomEmptyCell() };
    stairs = getRandomEmptyCell();

    // アイテム配置
    items = [];
    const itemCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < itemCount; i++) {
        items.push({ ...getRandomEmptyCell(), type: 'potion', emoji: '🧪', healAmount: 30 });
    }

    // 敵配置
    enemies = [];
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const enemyCount = settings.enemyCountBase + Math.floor(currentFloor / 2);
    
    for (let i = 0; i < enemyCount; i++) {
        const rand = Math.random();
        let template = ENEMY_TYPES.GOBLIN;
        if (rand < 0.3) template = ENEMY_TYPES.SLIME;
        else if (rand < 0.6) template = ENEMY_TYPES.TURRET;

        enemies.push({
            ...template,
            ...getRandomEmptyCell(),
            speedInterval: Math.floor(template.speedInterval * settings.speedMultiplier),
            isAlive: true,
            lastMoved: Date.now()
        });
    }
    laserBeams = [];
    attackEffect = null;
    logMessage = `地下 ${currentFloor} 階に突入！`;
    draw();
}

// 🎨 3. メイン描画システム（シーンごとに見た目を切り替える）
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- タイトル画面の描画 ---
    if (gameState === 'TITLE') {
        document.getElementById('status').innerText = "";
        document.getElementById('log').innerText = "";

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        
        ctx.font = 'bold 36px Arial';
        ctx.fillText('⚔️ DUNGEON ACTION 🤠', canvas.width / 2, canvas.height / 3);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText('難易度キーを押してスタートして下さい', canvas.width / 2, canvas.height / 2);
        
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#28a745'; ctx.fillText('[1] EASY 🟢', canvas.width / 2 - 150, canvas.height * 2 / 3);
        ctx.fillStyle = '#007bff'; ctx.fillText('[2] NORMAL 🔵', canvas.width / 2, canvas.height * 2 / 3);
        ctx.fillStyle = '#dc3545'; ctx.fillText('[3] HARD 🔴', canvas.width / 2 + 150, canvas.height * 2 / 3);
        return;
    }

    // --- ゲームオーバー画面の描画 ---
    if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#dc3545';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('☠️ GAME OVER ☠️', canvas.width / 2, canvas.height / 2 - 30);
        
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText(`到達階層: 地下 ${currentFloor} 階  /  討伐数: ${score} 匹`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillStyle = '#aaa';
        ctx.fillText('【スペースキー】を押してタイトルに戻る', canvas.width / 2, canvas.height / 2 + 70);
        return;
    }

    // --- ゲームクリア画面の描画 ---
    if (gameState === 'GAMECLEAR') {
        ctx.fillStyle = 'rgba(20, 40, 20, 0.9)'; // 薄い緑の背景
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffd700'; // ゴールド
        ctx.font = 'bold 45px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 GAME CLEAR!! 🏆', canvas.width / 2, canvas.height / 2 - 30);
        
        ctx.fillStyle = '#fff';
        ctx.font = '22px Arial';
        ctx.fillText(`無事に地上へ脱出した！最終討伐数: ${score} 匹 [難易度: ${difficulty.toUpperCase()}]`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillStyle = '#aaa';
        ctx.fillText('【スペースキー】を押してタイトルに戻る', canvas.width / 2, canvas.height / 2 + 80);
        return;
    }

    // --- 通常プレイ画面の描画 (PLAY) ---
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (map[y][x] === 1) {
                ctx.fillStyle = '#444444'; ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
            } else {
                ctx.fillStyle = '#222222'; ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    ctx.font = '24px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🪜', stairs.x * TILE_SIZE + TILE_SIZE/2, stairs.y * TILE_SIZE + TILE_SIZE/2);
    items.forEach(item => ctx.fillText(item.emoji, item.x * TILE_SIZE + TILE_SIZE/2, item.y * TILE_SIZE + TILE_SIZE/2));
    enemies.forEach(enemy => { if (enemy.isAlive) ctx.fillText(enemy.emoji, enemy.x * TILE_SIZE + TILE_SIZE/2, enemy.y * TILE_SIZE + TILE_SIZE/2); });

    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; 
    laserBeams.forEach(beam => ctx.fillRect(beam.x * TILE_SIZE, beam.y * TILE_SIZE, TILE_SIZE, TILE_SIZE));

    if (attackEffect) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.6)'; ctx.fillRect(attackEffect.x * TILE_SIZE, attackEffect.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px Arial'; ctx.fillText('⚔️', attackEffect.x * TILE_SIZE + TILE_SIZE/2, attackEffect.y * TILE_SIZE + TILE_SIZE/2);
    }

    ctx.font = '24px Arial'; ctx.fillText('🤠', player.x * TILE_SIZE + TILE_SIZE/2, player.y * TILE_SIZE + TILE_SIZE/2);

    document.getElementById('status').innerText = `【${difficulty.toUpperCase()} - 地下 ${currentFloor} 階】 HP: ${player.hp}/${player.maxHp} | 討伐数: ${score}匹 | 向き: ${player.dir.toUpperCase()}`;
    document.getElementById('log').innerText = `ログ: ${logMessage}  (操作: WASD もしくは 矢印キー / Spaceで攻撃)`;
}

// 👾 4. 敵のリアルタイムループ処理
setInterval(() => {
    if (gameState !== 'PLAY' || map.length === 0) return; // プレイ中以外は動かさない
    let now = Date.now();
    let updated = false;

    enemies.forEach((enemy) => {
        if (!enemy.isAlive) return;
        if (now - enemy.lastMoved >= enemy.speedInterval) {
            enemy.lastMoved = now;

            if (enemy.type === 'turret') {
                let inSight = false; let tempBeams = [];
                if (enemy.x === player.x) {
                    let minY = Math.min(enemy.y, player.y), maxY = Math.max(enemy.y, player.y); inSight = true;
                    for (let y = minY + 1; y < maxY; y++) { if (map[y][enemy.x] === 1) inSight = false; tempBeams.push({ x: enemy.x, y: y }); }
                } else if (enemy.y === player.y) {
                    let minX = Math.min(enemy.x, player.x), maxX = Math.max(enemy.x, player.x); inSight = true;
                    for (let x = minX + 1; x < maxX; x++) { if (map[enemy.y][x] === 1) inSight = false; tempBeams.push({ x: x, y: enemy.y }); }
                }
                if (inSight) {
                    player.hp -= enemy.damage; logMessage = `⚡ ${enemy.name}の遠隔レーザー！ ${enemy.damage}ダメ！`;
                    laserBeams = laserBeams.concat(tempBeams); updated = true;
                    setTimeout(() => { laserBeams = laserBeams.filter(b => !tempBeams.includes(b)); if (gameState === 'PLAY') draw(); }, 100);
                }
            } else {
                let nextX = enemy.x, nextY = enemy.y;
                if (enemy.x < player.x) nextX++; else if (enemy.x > player.x) nextX--;
                else if (enemy.y < player.y) nextY++; else if (enemy.y > player.y) nextY--;

                if (map[nextY] && map[nextY][nextX] === 0) { enemy.x = nextX; enemy.y = nextY; updated = true; }
                if (enemy.x === player.x && enemy.y === player.y) { player.hp -= enemy.damage; logMessage = `💥 ${enemy.name}から ${enemy.damage}ダメージ！`; updated = true; }
            }
        }
    });

    // 💡 プレイヤー死亡 ➡️ GAMEOVERシーンへ
    if (player.hp <= 0) {
        gameState = 'GAMEOVER';
        draw();
    } else if (updated) {
        draw();
    }
}, 50);

// ⌨️ 5. キーボード入力（シーンによって動作を分岐）
window.addEventListener('keydown', (e) => {
    // 【タイトル画面での入力判定】
    if (gameState === 'TITLE') {
        if (e.key === '1') startGame('easy');
        if (e.key === '2') startGame('normal');
        if (e.key === '3') startGame('hard');
        return;
    }

    // 【ゲームオーバー / クリア画面での入力判定】
    if (gameState === 'GAMEOVER' || gameState === 'GAMECLEAR') {
        if (e.key === ' ') {
            gameState = 'TITLE'; // スペースキーでタイトルに戻る
            draw();
        }
        return;
    }

    // 【通常のゲームプレイ中の入力判定 (PLAY)】
    let nextX = player.x; let nextY = player.y;
    if (e.key === 'w' || e.key === 'ArrowUp')    { nextY--; player.dir = 'up'; }
    if (e.key === 's' || e.key === 'ArrowDown')  { nextY++; player.dir = 'down'; }
    if (e.key === 'a' || e.key === 'ArrowLeft')  { nextX--; player.dir = 'left'; }
    if (e.key === 'd' || e.key === 'ArrowRight') { nextX++; player.dir = 'right'; }

    if (e.key === ' ') {
        let attackX = player.x, attackY = player.y;
        if (player.dir === 'up') attackY--; if (player.dir === 'down') attackY++;
        if (player.dir === 'left') attackX--; if (player.dir === 'right') attackX++;
        attackEffect = { x: attackX, y: attackY };

        let hitIdx = enemies.findIndex(e => e.isAlive && e.x === attackX && e.y === attackY);
        if (hitIdx !== -1) {
            enemies[hitIdx].hp--;
            if (enemies[hitIdx].hp <= 0) { enemies[hitIdx].isAlive = false; score++; logMessage = `⚔️ ${enemies[hitIdx].name}を撃破！`; }
            else { logMessage = `⚔️ ${enemies[hitIdx].name}に攻撃！残HP:${enemies[hitIdx].hp}`; }
        } else { logMessage = "💨 空振り！"; }

        setTimeout(() => { attackEffect = null; if (gameState === 'PLAY') draw(); }, 100);
    }

    if (map[nextY] && map[nextY][nextX] === 0) {
        player.x = nextX; player.y = nextY;
        let itemIdx = items.findIndex(i => i.x === player.x && i.y === player.y);
        if (itemIdx !== -1) { player.hp = Math.min(player.maxHp, player.hp + items[itemIdx].healAmount); logMessage = `🧪 ポーションで回復！`; items.splice(itemIdx, 1); }
    }

    // 階段判定
    if (player.x === stairs.x && player.y === stairs.y) {
        // 💡 地下5階の階段を降りたら「ゲームクリア」！
        if (currentFloor === 5) {
            gameState = 'GAMECLEAR';
        } else {
            currentFloor++;
            startNewFloor();
        }
    }
    draw();
});

// 最初にタイトル画面を描画
draw();