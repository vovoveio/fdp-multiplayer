const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = [];
let gameStarted = false;
const suits = ['♣', '♥', '♠', '♦'];
const values = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

io.on('connection', (socket) => {
    // Primeiro jogador a entrar vira o HOST
    socket.on('joinGame', (name) => {
        if (gameStarted) return socket.emit('error', 'Jogo já em andamento');
        
        const isHost = players.length === 0;
        const newPlayer = { 
            id: socket.id, 
            name: name, 
            lives: 3, 
            hand: [], 
            isHost: isHost 
        };
        
        players.push(newPlayer);
        io.emit('updatePlayers', players);
    });

    // Função exclusiva do HOST para iniciar
    socket.on('hostStartGame', () => {
        const player = players.find(p => p.id === socket.id);
        if (player && player.isHost) {
            gameStarted = true;
            startRound(1); // Começa rodada com 1 carta
        }
    });

    function startRound(numCards) {
        let deck = [];
        for(let s of suits) for(let v of values) deck.push({v, s, id: v+s});
        deck.sort(() => Math.random() - 0.5);

        players.forEach(p => {
            p.hand = [];
            for(let i=0; i < numCards; i++) p.hand.push(deck.pop());
            // Envia a mão APENAS para o dono dela (Anti-trapaça)
            io.to(p.id).emit('receiveHand', p.hand);
        });

        io.emit('roundStarted', { numCards });
    }

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (players.length > 0 && !players.some(p => p.isHost)) {
            players[0].isHost = true; // Passa o host se o original sair
        }
        io.emit('updatePlayers', players);
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Servidor Online!');
});