const WebSocket = require('ws');
// Initial stock data with price and volume
let stocks = [
    { symbol: "RELIANCE", name: "Reliance Industries", price: 2500, volume: 1000000 },
    { symbol: "TCS", name: "Tata Consultancy Services", price: 3200, volume: 1000000 },
    { symbol: "INFY", name: "Infosys", price: 1500, volume: 1000000 },
    { symbol: "HDFCBANK", name: "HDFC Bank", price: 1400, volume: 1000000 },
    { symbol: "ICICIBANK", name: "ICICI Bank", price: 700, volume: 1000000 },
    { symbol: "SBIBANK", name: "SBI Bank", price: 800, volume: 1000000 },
];

// WebSocket server instance
let wss = null;

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
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
    const existing = stocks.find(s => s.symbol === newStock.symbol);
    if (!existing) {
        stocks.push(newStock);
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
};
