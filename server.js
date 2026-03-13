const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const suits = ['♣', '♥', '♠', '♦'];
const values = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const power = {'4♣':100,'7♥':99,'A♠':98,'7♦':97,'3':10,'2':9,'A':8,'K':7,'J':6,'Q':5,'7':4,'6':3,'5':2,'4':1};

let gameState = {
    currentCards: 1,
    turnStarter: 0,
    roundStarter: 0,
    tableCards: [],
    statusMsg: "Aguardando jogadores...",
    activePlayer: null,
    isGameRunning: false,
    players: [
        { id: 0, name: "Jogador 1", lives: 3, hand: [], bid: 0, won: 0, bot: true, hasBetted: false, socketId: null },
        { id: 1, name: "Sincero", lives: 3, hand: [], bid: 0, won: 0, bot: true, hasBetted: false, socketId: null },
        { id: 2, name: "Debochado", lives: 3, hand: [], bid: 0, won: 0, bot: true, hasBetted: false, socketId: null },
        { id: 3, name: "Calculista", lives: 3, hand: [], bid: 0, won: 0, bot: true, hasBetted: false, socketId: null }
    ]
};

let currentBettor = 0;
let sumBids = 0;

io.on('connection', (socket) => {
    let slot = gameState.players.find(p => p.bot === true && p.socketId === null);
    if (slot && !gameState.isGameRunning) {
        slot.bot = false;
        slot.socketId = socket.id;
        slot.name = `Jogador ${slot.id + 1}`;
        socket.emit('init', slot.id);
    } else {
        socket.emit('init', -1);
    }

    emitState();

    socket.on('start_game', () => {
        if (!gameState.isGameRunning) {
            gameState.isGameRunning = true;
            gameState.currentCards = 1; // Começa sempre na 1
            gameState.roundStarter = Math.floor(Math.random() * 4);
            startRound();
        }
    });

    socket.on('submit_bid', (bid) => {
        let p = gameState.players[currentBettor];
        if (p.socketId === socket.id && gameState.activePlayer === p.id) {
            processBid(bid);
        }
    });

    socket.on('play_card', (cardIndex) => {
        let p = gameState.players[gameState.activePlayer];
        if (p.socketId === socket.id) {
            let card = p.hand.splice(cardIndex, 1)[0];
            processCard(card, p.id);
        }
    });

    socket.on('disconnect', () => {
        let p = gameState.players.find(pl => pl.socketId === socket.id);
        if (p) {
            p.bot = true;
            p.socketId = null;
            p.name = ["Jogador 1", "Sincero", "Debochado", "Calculista"][p.id];
            if (gameState.players.every(pl => pl.bot)) resetGame();
        }
        emitState();
    });
});

function emitState() { io.emit('state_update', gameState); }
function emitSfx(freq, type, dur) { io.emit('play_sfx', {freq, type, dur}); }

function startRound() {
    if (gameState.currentCards > 10) {
        gameState.statusMsg = "FIM DO JOGO!";
        emitState();
        return;
    }
    gameState.players.forEach(p => { p.hand = []; p.bid = 0; p.won = 0; p.hasBetted = false; });
    gameState.tableCards = [];
    sumBids = 0;
    let deck = [];
    for(let s of suits) for(let v of values) deck.push({s, v, id: v+s});
    deck.sort(() => Math.random() - 0.5);
    for(let i=0; i<gameState.currentCards; i++) {
        gameState.players.forEach(p => { if(p.lives > 0) p.hand.push(deck.pop()); });
    }
    gameState.turnStarter = gameState.roundStarter;
    currentBettor = gameState.roundStarter;
    emitState();
    handleNextBid();
}

function handleNextBid() {
    let activePlayers = gameState.players.filter(p => p.lives > 0).length;
    let handledCount = gameState.players.filter(p => p.hasBetted).length;
    if (handledCount >= activePlayers) {
        gameState.activePlayer = null;
        startTricks();
        return;
    }
    while (gameState.players[currentBettor].lives <= 0) currentBettor = (currentBettor + 1) % 4;
    let p = gameState.players[currentBettor];
    gameState.activePlayer = p.id;
    let forbidden = (handledCount === activePlayers - 1) ? (gameState.currentCards - sumBids) : -1;
    if (p.bot) {
        setTimeout(() => {
            let strength = p.hand.filter(c => (power[c.id] || power[c.v]) > 7).length;
            let bid = Math.min(gameState.currentCards, strength);
            if (bid === forbidden) bid = bid === 0 ? 1 : bid - 1;
            processBid(bid);
        }, 1000);
    } else {
        gameState.statusMsg = `Vez de ${p.name}! Quantas você leva?`;
        io.to(p.socketId).emit('request_bid', forbidden);
        emitState();
    }
}

function processBid(bid) {
    let p = gameState.players[currentBettor];
    p.bid = bid; p.hasBetted = true; sumBids += bid;
    emitSfx(400, 'sine', 0.1);
    currentBettor = (currentBettor + 1) % 4;
    handleNextBid();
}

function startTricks() { handleNextCard(); }

function handleNextCard() {
    if (gameState.tableCards.length === gameState.players.filter(p => p.lives > 0).length) {
        resolveTrick();
        return;
    }
    let pIdx = gameState.turnStarter;
    let offset = gameState.tableCards.length;
    for(let i=0; i < offset; i++) {
        pIdx = (pIdx + 1) % 4;
        while(gameState.players[pIdx].lives <= 0) pIdx = (pIdx + 1) % 4;
    }
    let p = gameState.players[pIdx];
    gameState.activePlayer = p.id;
    if (p.bot) {
        setTimeout(() => {
            p.hand.sort((a,b) => (power[a.id]||power[a.v]) - (power[b.id]||power[b.v]));
            let card = p.won < p.bid ? p.hand.pop() : p.hand.shift();
            processCard(card, p.id);
        }, 1000);
    } else {
        gameState.statusMsg = `Vez de ${p.name}! Escolha uma carta.`;
        io.to(p.socketId).emit('request_card');
        emitState();
    }
}

function processCard(card, playerId) {
    gameState.tableCards.push({card, owner: playerId, rot: (Math.random()*20 - 10)});
    emitSfx(600, 'sine', 0.1);
    emitState();
    setTimeout(handleNextCard, 500);
}

function resolveTrick() {
    gameState.activePlayer = null;
    let winIdx = calcWinner(gameState.tableCards);
    gameState.players[winIdx].won++;
    gameState.turnStarter = winIdx;
    gameState.statusMsg = `${gameState.players[winIdx].name} venceu a vaza!`;
    emitSfx(800, 'triangle', 0.2);
    emitState();
    setTimeout(() => {
        gameState.tableCards = [];
        if (gameState.players.every(p => p.hand.length === 0)) endRound();
        else handleNextCard();
    }, 2000);
}

function calcWinner(list) {
    let sc = list.map(x => ({...x, pwr: power[x.card.id] || power[x.card.v]}));
    let counts = {}; sc.forEach(s => counts[s.pwr] = (counts[s.pwr] || 0) + 1);
    let valid = sc.filter(s => counts[s.pwr] === 1);
    if (valid.length === 0) {
        let max = Math.max(...sc.map(s => s.pwr));
        let ties = sc.filter(s => s.pwr === max);
        const suitsP = {'♣':4,'♥':3,'♠':2,'♦':1};
        return ties.sort((a,b) => suitsP[b.card.s] - suitsP[a.card.s])[0].owner;
    }
    return valid.sort((a,b) => b.pwr - a.pwr)[0].owner;
}

function endRound() {
    gameState.players.forEach(p => { if(p.lives > 0 && p.bid !== p.won) p.lives--; });
    gameState.statusMsg = "Fim da rodada! Computando vidas...";
    emitState();
    setTimeout(() => {
        gameState.roundStarter = (gameState.roundStarter + 1) % 4;
        gameState.currentCards++;
        startRound();
    }, 2500);
}

function resetGame() {
    gameState.isGameRunning = false;
    gameState.currentCards = 1;
    gameState.statusMsg = "Aguardando jogadores...";
    gameState.players.forEach(p => { p.lives = 3; p.hand = []; p.bid = 0; p.won = 0; p.hasBetted = false; });
}

server.listen(3000, () => console.log('Servidor em http://localhost:3000'));