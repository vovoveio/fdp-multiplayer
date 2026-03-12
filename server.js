const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// Lista de conexões para garantir que todos vejam o mesmo estado
let connectedPlayers = [];

io.on('connection', (socket) => {
    connectedPlayers.push(socket.id);
    
    // Repassa qualquer ação de um jogador para todos os outros
    socket.on('gameAction', (data) => {
        io.emit('remoteAction', data);
    });

    socket.on('disconnect', () => {
        connectedPlayers = connectedPlayers.filter(id => id !== socket.id);
    });
});

http.listen(process.env.PORT || 3000);