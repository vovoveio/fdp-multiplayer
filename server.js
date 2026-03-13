const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let gameState = {
    players: [],
    currentCards: 1,
    roundStarter: 0,
    tableCards: [],
    gameStarted: false
};

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    socket.on('joinGame', (name) => {
        if (gameState.players.length < 4) {
            const player = {
                id: socket.id,
                name: name || `Jogador ${gameState.players.length + 1}`,
                lives: 3,
                hand: [],
                bid: 0,
                won: 0,
                hasBetted: false
            };
            gameState.players.push(player);
            io.emit('updatePlayers', gameState.players);
        }
    });

    socket.on('startGame', () => {
        gameState.gameStarted = true;
        io.emit('gameStarted', gameState);
    });

    socket.on('playCard', (cardData) => {
        io.emit('cardPlayed', cardData);
    });

    socket.on('disconnect', () => {
        gameState.players = gameState.players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', gameState.players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));