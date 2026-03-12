const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        const isHost = players.length === 0;
        players.push({ id: socket.id, name, isHost, hand: [] });
        io.emit('updatePlayers', players);
    });

    socket.on('hostStartGame', () => {
        if (players.length >= 2) {
            gameStarted = true;
            const suits = ['♣', '♥', '♠', '♦'];
            const values = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
            let deck = [];
            for(let s of suits) for(let v of values) deck.push({v, s});
            deck.sort(() => Math.random() - 0.5);

            players.forEach(p => {
                p.hand = [deck.pop(), deck.pop()]; // Dá 2 cartas
                io.to(p.id).emit('receiveHand', p.hand);
            });
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (players.length > 0) players[0].isHost = true;
        io.emit('updatePlayers', players);
    });
});

http.listen(process.env.PORT || 3000);