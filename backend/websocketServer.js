const WebSocket = require('ws');
const pool = require('./db');

// WebSocket server instance
let wss = null;

// In-memory stocks array, will be initialized from DB
let stocks = [];

// Broadcast function to send data to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    if (!wss) return;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Initialize stocks array from database
async function loadStocksFromDB() {
    try {
        const [rows] = await pool.query('SELECT id, stock_symbol, stock_name, price, volume FROM stocks');
        stocks = rows.map(row => ({
            id: row.id,
            symbol: row.stock_symbol,
            name: row.stock_name,
            price: row.price,
            volume: row.volume
        }));
        console.log('Stocks loaded from DB:', stocks.length);
    } catch (err) {
        console.error('Error loading stocks from DB:', err);
    }
}

function initWebSocketServer(server) {
    wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', (ws) => {
        // Send current stocks array on connection
        ws.send(JSON.stringify({ type: 'stock_data', stocks }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'buy_stock') {
                    const stock = stocks.find(s => s.symbol === data.symbol);
                    if (stock && stock.volume > 0) {
                        stock.volume -= 1;
                        stock.price += 1;
                        // Broadcast updated stocks array
                        broadcast({ type: 'stock_update', stocks });
                    }
                } else if (data.type === 'sell_stock') {
                    const stock = stocks.find(s => s.symbol === data.symbol);
                    if (stock) {
                        stock.volume += 1;
                        stock.price = Math.max(0, stock.price - 1);
                        // Broadcast updated stocks array
                        broadcast({ type: 'stock_update', stocks });
                    }
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });
    });
}

// Function to update stocks array when a new stock is added from admin panel
function addNewStock(newStock) {
    const existing = stocks.find(s => s.symbol === newStock.stock_symbol || s.symbol === newStock.symbol);
    if (!existing) {
        // Normalize newStock object keys
        const stockObj = {
            id: newStock.id,
            symbol: newStock.stock_symbol || newStock.symbol,
            name: newStock.stock_name || newStock.name,
            price: newStock.price,
            volume: newStock.volume
        };
        stocks.push(stockObj);
        // Broadcast updated stocks array to all clients
        broadcast({ type: 'stock_update', stocks });
    }
}

function handleUpgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
}

module.exports = {
    initWebSocketServer,
    handleUpgrade,
    wss,
    stocks,
    addNewStock,
    loadStocksFromDB,
    broadcast
};
