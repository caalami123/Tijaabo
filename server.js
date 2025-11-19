// server.js
const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server: http });

app.use(express.json());

let ledger = [];
const LEDGER_FILE = './ledger.json';

// Load ledger if exists
if (fs.existsSync(LEDGER_FILE)) {
    ledger = JSON.parse(fs.readFileSync(LEDGER_FILE));
}

// Helper: Save ledger
function saveLedger() {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

// API: Get ledger
app.get('/ledger', (req,res)=>{
    res.json(ledger);
});

// API: Send tokens
app.post('/transaction', (req,res)=>{
    const { from, to, amount } = req.body;
    if(!from || !to || !amount) return res.status(400).json({ error:'Invalid data' });

    // Calculate balances
    const balances = {};
    ledger.forEach(b=>{
        balances[b.to] = (balances[b.to]||0) + b.amount;
        balances[b.from] = (balances[b.from]||0) - b.amount;
    });

    if((balances[from]||0) < amount) return res.status(400).json({ error:'Insufficient balance' });

    // Add block
    const prevHash = ledger.length ? ledger[ledger.length-1].hash : 'GENESIS';
    const block = {
        index: ledger.length,
        timestamp: Date.now(),
        from,
        to,
        amount,
        prevHash,
        hash: Buffer.from(JSON.stringify({from,to,amount,prevHash,timestamp:Date.now()})).toString('base64').slice(0,32)
    };
    ledger.push(block);
    saveLedger();

    // Notify all websocket clients
    wss.clients.forEach(client=>{
        if(client.readyState === WebSocket.OPEN){
            client.send(JSON.stringify({ type:'new_block', block }));
        }
    });

    res.json({ success:true, block });
});

// Serve frontend
app.use(express.static('public'));

// Start server
http.listen(3000, ()=>console.log('Server running on http://localhost:3000'));
