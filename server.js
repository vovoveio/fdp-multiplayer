const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // Apenas repassa a ação do jogador para os outros
    socket.on('playerAction', (data) => {
        io.emit('remoteAction', { from: socket.id, action: data.action, payload: data.payload });
    });
});

http.listen(process.env.PORT || 3000);