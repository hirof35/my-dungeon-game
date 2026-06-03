const express = require('express');
const ROT = require('rot-js');
const path = require('path');

const app = express();
const PORT = 3000;

// publicフォルダの中身をそのままブラウザに公開する
app.use(express.static(path.join(__dirname, 'public')));

const WIDTH = 30;
const HEIGHT = 15;

// マップ生成API
app.get('/api/map', (req, res) => {
    let map = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(1));
    let emptyCells = [];

    let digger = new ROT.Map.Digger(WIDTH, HEIGHT, {
        roomWidth: [3, 7],
        roomHeight: [3, 6],
        corridorLength: [1, 5]
    });

    digger.create((x, y, value) => {
        map[y][x] = value;
        if (value === 0) emptyCells.push({ x, y });
    });

    // クライアント（ブラウザ）に必要なデータをまとめて返す
    res.json({ map, emptyCells, width: WIDTH, height: HEIGHT });
});

app.listen(PORT, () => {
    console.log(`サーバー起動！ http://localhost:${PORT} にアクセスしてください`);
});