const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Entrega o arquivo index.html exatamente como ele é
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Jogo rodando em http://localhost:${port}`);
});