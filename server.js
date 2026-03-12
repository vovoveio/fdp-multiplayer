const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

const suits = ['♣', '♥', '♠', '♦'];
const values = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const power = {'4♣':100,'7♥':99,'A♠':98,'7♦':97,'3':10,'2':9,'A':8,'K':7,'J':6,'Q':5,'7':4,'6':3,'5':2,'4':1};

let players = [];
let gameStarted = false;
let currentCards = 1;
let table = [];
let turnIdx = 0;
let roundStarter = 0;
let bidsReceived = 0;

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        if (players.length < 4 && !gameStarted) {
            players.push({ id: socket.id, name, lives: 3, hand: [], bid: 0, won: 0, isHost: players.length === 0, bidDone: false });
            io.emit('updatePlayers', players);
        }
    });

    socket.on('startGame', () => {
        if (players.length >= 2 && players.find(p => p.id === socket.id).isHost) {
            startNewRound();
        }
    });

    socket.on('submitBid', (bid) => {
        const p = players.find(p => p.id === socket.id);
        if (p) {
            p.bid = bid;
            p.bidDone = true;
            bidsReceived++;
            io.emit('updatePlayers', players);
            if (bidsReceived === players.length) {
                io.emit('statusUpdate', "Cartas na mesa!");
                nextTurn();
            } else {
                turnIdx = (turnIdx + 1) % players.length;
                requestNextBid();
            }
        }
    });

    socket.on('playCard', (cardData) => {
        const p = players.find(p => p.id === socket.id);
        if (p && players[turnIdx].id === socket.id) {
            table.push({ card: cardData.card, owner: socket.id, ownerName: p.name });
            io.emit('cardPlayed', { card: cardData.card, ownerId: socket.id });
            
            if (table.length === players.length) {
                resolveTrick();
            } else {
                turnIdx = (turnIdx + 1) % players.length;
                io.emit('statusUpdate', `Vez de ${players[turnIdx].name}`);
            }
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (players.length > 0 && !players.find(p => p.isHost)) players[0].isHost = true;
        io.emit('updatePlayers', players);
    });
});

function startNewRound() {
    gameStarted = true;
    bidsReceived = 0;
    table = [];
    let deck = [];
    for(let s of suits) for(let v of values) deck.push({s, v, id: v+s});
    deck.sort(() => Math.random() - 0.5);

    players.forEach(p => {
        p.hand = [];
        p.won = 0;
        p.bidDone = false;
        for(let i=0; i<currentCards; i++) p.hand.push(deck.pop());
        io.to(p.id).emit('receiveHand', p.hand);
    });

    turnIdx = roundStarter;
    io.emit('statusUpdate', `Rodada ${currentCards} - Façam suas apostas!`);
    requestNextBid();
}

function requestNextBid() {
    const p = players[turnIdx];
    io.emit('statusUpdate', `Aguardando aposta de ${p.name}`);
    io.to(p.id).emit('requestBid', { max: currentCards });
}

function nextTurn() {
    io.emit('statusUpdate', `Vez de ${players[turnIdx].name}`);
}

function resolveTrick() {
    // Lógica de quem ganhou a vaza (Manilhas inclusas)
    let winner = table[0];
    table.forEach(t => {
        let p1 = power[t.card.id] || power[t.card.v];
        let p2 = power[winner.card.id] || power[winner.card.v];
        if (p1 > p2) winner = t;
    });

    const pWinner = players.find(p => p.id === winner.owner);
    pWinner.won++;
    io.emit('statusUpdate', `${pWinner.name} venceu a vaza!`);
    
    setTimeout(() => {
        table = [];
        io.emit('clearTable');
        if (pWinner.hand.length === 0 && players[0].hand.length === 0) { // Bug fix: check if round ended
             endRound();
        } else {
            turnIdx = players.indexOf(pWinner);
            nextTurn();
        }
    }, 2000);
}

function endRound() {
    players.forEach(p => { if (p.bid !== p.won) p.lives--; });
    currentCards++;
    roundStarter = (roundStarter + 1) % players.length;
    io.emit('updatePlayers', players);
    setTimeout(startNewRound, 3000);
}

http.listen(process.env.PORT || 3000);