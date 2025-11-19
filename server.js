// ==============================
// Alif Payment Version 3 - Server
// ==============================

const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==============================
// Config
// ==============================
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const FIXED_SUPPLY = Number(process.env.FIXED_SUPPLY) || 1000000;
const GENESIS_POOL = process.env.GENESIS_POOL || "GENESIS_POOL";
const LEDGER_FILE = './ledger.json';

let ledger = [];

// ==============================
// Serve frontend
// ==============================
app.use(express.static(path.join(__dirname,'public')));

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname,'public','index.html'));
});

// ==============================
// Ledger: load or create genesis
// ==============================
if(fs.existsSync(LEDGER_FILE)){
    ledger = JSON.parse(fs.readFileSync(LEDGER_FILE));
}else{
    const genesisBlock = {
        index:0,
        timestamp: Date.now(),
        from:'GENESIS',
        to: GENESIS_POOL,
        amount: FIXED_SUPPLY,
        prevHash:'NONE',
        hash: Buffer.from('GENESIS'+Date.now()).toString('base64').slice(0,32)
    };
    ledger.push(genesisBlock);
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger,null,2));
}

// ==============================
// Helper Functions
// ==============================
function saveLedger(){ fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger,null,2)); }
function getBalance(walletID){
    let bal=0;
    ledger.forEach(b=>{
        if(b.to===walletID) bal+=b.amount;
        if(b.from===walletID) bal-=b.amount;
    });
    return bal;
}

// ==============================
// API Endpoints
// ==============================
app.get('/ledger', (req,res)=>res.json(ledger));

app.post('/transaction', (req,res)=>{
    const { from, to, amount } = req.body;
    if(!from || !to || !amount) return res.status(400).json({error:'Invalid data'});
    if(getBalance(from)<amount) return res.status(400).json({error:'Insufficient balance'});

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

    // Notify WebSocket clients
    wss.clients.forEach(client=>{
        if(client.readyState===WebSocket.OPEN){
            client.send(JSON.stringify({type:'new_block', block}));
        }
    });

    res.json({success:true, block});
});

// ==============================
// WebSocket
// ==============================
wss.on('connection', ws=>{
    console.log('New WS connection');
    ws.send(JSON.stringify({type:'ledger', ledger}));
});

// ==============================
// Start Server
// ==============================
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
