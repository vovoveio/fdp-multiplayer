const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let players = [];

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        players.push({ id: socket.id, name, lives: 3, hand: [], bid: 0, won: 0 });
        io.emit('updatePlayers', players);
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

http.listen(process.env.PORT || 3000);