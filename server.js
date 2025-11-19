const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server: http });

app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

const FIXED_SUPPLY = 1000000;
let ledger = [];
const LEDGER_FILE = './ledger.json';

// Load ledger or create genesis
if(fs.existsSync(LEDGER_FILE)){
    ledger = JSON.parse(fs.readFileSync(LEDGER_FILE));
}else{
    const genesisBlock = {
        index:0,
        timestamp: Date.now(),
        from:'GENESIS',
        to:'GENESIS_POOL',
        amount:FIXED_SUPPLY,
        prevHash:'NONE',
        hash: Buffer.from('GENESIS'+Date.now()).toString('base64').slice(0,32)
    };
    ledger.push(genesisBlock);
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger,null,2));
}

// Helper functions
function saveLedger(){ fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger,null,2)); }
function getBalance(walletID){
    let bal=0;
    ledger.forEach(b=>{
        if(b.to===walletID) bal+=b.amount;
        if(b.from===walletID) bal-=b.amount;
    });
    return bal;
}

// API Endpoints
app.get('/ledger',(req,res)=>res.json(ledger));

app.post('/transaction',(req,res)=>{
    const { from, to, amount } = req.body;
    if(!from||!to||!amount) return res.status(400).json({error:'Invalid data'});
    if(getBalance(from)<amount) return res.status(400).json({error:'Insufficient balance'});

    const prevHash = ledger.length?ledger[ledger.length-1].hash:'GENESIS';
    const block = {
        index:ledger.length,
        timestamp:Date.now(),
        from,
        to,
        amount,
        prevHash,
        hash: Buffer.from(JSON.stringify({from,to,amount,prevHash,timestamp:Date.now()})).toString('base64').slice(0,32)
    };
    ledger.push(block);
    saveLedger();

    // WebSocket notify
    wss.clients.forEach(client=>{
        if(client.readyState===WebSocket.OPEN){
            client.send(JSON.stringify({type:'new_block', block}));
        }
    });

    res.json({success:true, block});
});

// WebSocket
wss.on('connection', ws=>{
    console.log('New WS connection');
});

http.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
