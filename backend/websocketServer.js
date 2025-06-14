const WebSocket = require('ws');
// Initial stock data with price and volume
let stocks = [
  { symbol: "KOHLI", name: "Virat Kohli", price: 1050, volume: 1000000 },
  { symbol: "ROHIT", name: "Rohit Sharma", price: 1045, volume: 1000000 },
  { symbol: "GILL", name: "Shubman Gill", price: 1040, volume: 1000000 },
  { symbol: "JAISWAL", name: "Yashasvi Jaiswal", price: 1035, volume: 1000000 },
  { symbol: "PANT", name: "Rishabh Pant", price: 1030, volume: 1000000 },
  { symbol: "HARDIK", name: "Hardik Pandya", price: 1030, volume: 1000000 },
  { symbol: "SKY", name: "Suryakumar Yadav", price: 1030, volume: 1000000 },
  { symbol: "BUMRAH", name: "Jasprit Bumrah", price: 1025, volume: 1000000 },
  { symbol: "RAHUL", name: "KL Rahul", price: 1025, volume: 1000000 },
  { symbol: "SAMSON", name: "Sanju Samson", price: 1020, volume: 1000000 },
  { symbol: "DUBE", name: "Shivam Dube", price: 1015, volume: 1000000 },
  { symbol: "TILAK", name: "Tilak Varma", price: 1015, volume: 1000000 },
  { symbol: "RINKU", name: "Rinku Singh", price: 1010, volume: 1000000 },
  { symbol: "KISHAN", name: "Ishan Kishan", price: 1010, volume: 1000000 },
  { symbol: "GAIKWAD", name: "Ruturaj Gaikwad", price: 1005, volume: 1000000 },
  { symbol: "TRIPATHI", name: "Rahul Tripathi", price: 1005, volume: 1000000 },
  { symbol: "VENKY", name: "Venkatesh Iyer", price: 1000, volume: 1000000 },
  { symbol: "AXAR", name: "Axar Patel", price: 1000, volume: 1000000 },
  { symbol: "JADEJA", name: "Ravindra Jadeja", price: 1000, volume: 1000000 },
  { symbol: "JITESH", name: "Jitesh Sharma", price: 1000, volume: 1000000 },
  { symbol: "ABHISHEK", name: "Abhishek Sharma", price: 995, volume: 1000000 },
  { symbol: "RANA", name: "Nitish Rana", price: 995, volume: 1000000 },
  { symbol: "HOODA", name: "Deepak Hooda", price: 995, volume: 1000000 },
  { symbol: "KARTHIK", name: "Dinesh Karthik", price: 990, volume: 1000000 },
  { symbol: "SIRAJ", name: "Mohammed Siraj", price: 990, volume: 1000000 },
  { symbol: "UMRAN", name: "Umran Malik", price: 990, volume: 1000000 },
  { symbol: "ARSHDEEP", name: "Arshdeep Singh", price: 990, volume: 1000000 },
  { symbol: "AVESH", name: "Avesh Khan", price: 985, volume: 1000000 },
  { symbol: "SHARDUL", name: "Shardul Thakur", price: 985, volume: 1000000 },
  { symbol: "DCHAHAR", name: "Deepak Chahar", price: 985, volume: 1000000 },
  { symbol: "NATARAJAN", name: "T Natarajan", price: 985, volume: 1000000 },
  { symbol: "CHAHAL", name: "Yuzvendra Chahal", price: 880, volume: 1000000 },
  { symbol: "KULDEEP", name: "Kuldeep Yadav", price: 980, volume: 1000000 },
  { symbol: "BISHNOI", name: "Ravi Bishnoi", price: 980, volume: 1000000 },
  { symbol: "MARKANDE", name: "Mayank Markande", price: 975, volume: 1000000 },
  { symbol: "VARUN", name: "Varun Chakravarthy", price: 975, volume: 1000000 },
  { symbol: "RCHAHAR", name: "Rahul Chahar", price: 975, volume: 1000000 },
  { symbol: "RAWAT", name: "Anuj Rawat", price: 970, volume: 1000000 },
  { symbol: "JUREL", name: "Dhruv Jurel", price: 970, volume: 1000000 },
  { symbol: "SARFARAZ", name: "Sarfaraz Khan", price: 970, volume: 1000000 },
  { symbol: "POREL", name: "Abhishek Porel", price: 965, volume: 1000000 },
  { symbol: "SHAHBAZ", name: "Shahbaz Ahmed", price: 965, volume: 1000000 },
  { symbol: "KISHORE", name: "R Sai Kishore", price: 960, volume: 1000000 },
  { symbol: "SAKARIYA", name: "Chetan Sakariya", price: 960, volume: 1000000 },
  { symbol: "MOHSIN", name: "Mohsin Khan", price: 960, volume: 1000000 },
  { symbol: "KARTIK", name: "Kartik Tyagi", price: 955, volume: 1000000 },
  { symbol: "PADIKKAL", name: "Devdutt Padikkal", price: 955, volume: 1000000 },
  { symbol: "PARAG", name: "Riyan Parag", price: 955, volume: 1000000 },
  { symbol: "PANDY", name: "Manish Pandey", price: 950, volume: 1000000 },
  { symbol: "RAHANE", name: "Ajinkya Rahane", price: 950, volume: 1000000 },
  { symbol: "MAYANK", name: "Mayank Agarwal", price: 950, volume: 1000000 },
  { symbol: "SUYASH", name: "Suyash Sharma", price: 950, volume: 1000000 },
  { symbol: "AKASH", name: "Akash Madhwal", price: 950, volume: 1000000 },
  { symbol: "ARJUN", name: "Arjun Tendulkar", price: 950, volume: 1000000 },
  { symbol: "KRUNAL", name: "Krunal Pandya", price: 980, volume: 1000000 },
  { symbol: "MUKESH", name: "Mukesh Kumar", price: 960, volume: 1000000 },
  { symbol: "SUNDAR", name: "Washington Sundar", price: 970, volume: 1000000 },
  { symbol: "DHONI", name: "MS Dhoni", price: 500, volume: 1000000 }
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
