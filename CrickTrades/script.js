let stocks = []; // Initialize empty, will be populated from backend or WebSocket

// Function to fetch latest stock data from backend API
async function fetchLatestStocks() {
    try {
        const response = await fetch('http://localhost:3001/api/stocks');
        if (!response.ok) {
            console.error('Failed to fetch latest stocks');
            return [];
        }
        const data = await response.json();
        return data.stocks || [];
    } catch (error) {
        console.error('Error fetching latest stocks:', error);
        return [];
    }
}

// Local storage keys
const PORTFOLIO_KEY = "cricktrades_portfolio";
const WALLET_KEY = "cricktrades_wallet";

function saveWallet(wallet) {
    localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
}

// Fetch user transactions from backend API
async function fetchTransactions() {
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            return [];
        }
        const response = await fetch('http://localhost:3001/api/transactions', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch transactions');
            return [];
        }
        const data = await response.json();
        return data.transactions;
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
}

// Render transactions in the UI
async function renderTransactions() {
    const container = document.getElementById("transaction-list");
    if (!container) return;

    const transactions = await fetchTransactions();

    if (transactions.length === 0) {
        container.innerHTML = "<p>No transactions found.</p>";
        return;
    }

    let tableHTML = `
        <table class="transaction-table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Amount (₹)</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    transactions.forEach(tx => {
        const date = new Date(tx.transaction_date);
        tableHTML += `
            <tr>
                <td>${tx.type}</td>
                <td>${tx.amount.toLocaleString('en-IN')}</td>
                <td>${date.toLocaleString()}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
}

// Market page: render stocks with add/remove buttons and quantity input
async function renderMarket() {
    const stockList = document.getElementById("stock-list");
    if (!stockList) return;

    let portfolio = {};
    try {
        portfolio = await loadPortfolio();
    } catch (error) {
        console.error("Error loading portfolio:", error);
        portfolio = {};
    }

    stockList.innerHTML = "";
    stocks.forEach(stock => {
        const inPortfolio = portfolio[stock.symbol] !== undefined;

        const card = document.createElement("div");
        card.className = "stock-card";

        const title = document.createElement("h3");
        title.textContent = stock.name + " (" + stock.symbol + ")";
        card.appendChild(title);

        const price = document.createElement("div");
        price.className = "price";
        price.textContent = "₹ " + stock.price.toLocaleString('en-IN');
        card.appendChild(price);

        // Volume display
        const volume = document.createElement("div");
        volume.className = "volume";
        volume.textContent = "Volume: " + stock.volume.toLocaleString('en-IN');
        card.appendChild(volume);

        // Quantity input
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.min = "1";
        quantityInput.value = "1";
        quantityInput.className = "quantity-input";
        quantityInput.style.width = "60px";
        quantityInput.style.marginRight = "0.5rem";
        card.appendChild(quantityInput);

        // Add button
        const addButton = document.createElement("button");
        addButton.textContent = "Add";
        addButton.className = "add";
        addButton.style.marginRight = "0.5rem";
        addButton.onclick = () => {
            const qty = parseInt(quantityInput.value);
            if (isNaN(qty) || qty < 1) {
                alert("Please enter a valid quantity (1 or more).");
                return;
            }
            buyStock(stock.symbol, qty);
        };
        card.appendChild(addButton);

        // Remove button
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.className = "remove";
        removeButton.onclick = () => {
            const qty = parseInt(quantityInput.value);
            if (isNaN(qty) || qty < 1) {
                alert("Please enter a valid quantity (1 or more).");
                return;
            }
            sellStock(stock.symbol, qty);
        };
        card.appendChild(removeButton);

        stockList.appendChild(card);
    });
}

// Define loadPortfolio function to fetch portfolio from backend or local storage
async function loadPortfolio() {
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            return {};
        }
        const response = await fetch('http://localhost:3001/api/portfolio', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch portfolio');
            return {};
        }
        const data = await response.json();
        const portfolioObj = {};
        data.portfolio.forEach(item => {
            portfolioObj[item.stock_symbol] = {
                name: item.stock_name,
                quantity: item.quantity,
                purchasePrice: item.purchase_price
            };
        });
        return portfolioObj;
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        return {};
    }
}

// Implement fetchPortfolio function to fix ReferenceError in renderPortfolio
async function fetchPortfolio() {
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            return {};
        }
        const response = await fetch('http://localhost:3001/api/portfolio', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch portfolio');
            return {};
        }
        const data = await response.json();
        const portfolioObj = {};
        data.portfolio.forEach(item => {
            portfolioObj[item.stock_symbol] = {
                name: item.stock_name,
                quantity: item.quantity,
                purchasePrice: item.purchase_price
            };
        });
        return portfolioObj;
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        return {};
    }
}

function initializeWallet() {
    let wallet = JSON.parse(localStorage.getItem("cricktrades_wallet"));
    if (!wallet) {
        wallet = { mainBalance: 0, stockBalance: 0 };
        localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
    }
    return wallet;
}

// Buy stock function sends buy event to backend via WebSocket
async function buyStock(symbol, quantity) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("WebSocket connection is not open. Please try again later.");
        return;
    }

    const totalPrice = stocks.find(s => s.symbol === symbol).price * quantity;
    const wallet = initializeWallet();

    if (wallet.stockBuyingBalance < totalPrice) {
        alert("Insufficient stock buying balance to buy this quantity.");
        return;
    }

    // Send buy events for each quantity
    for (let i = 0; i < quantity; i++) {
        ws.send(JSON.stringify({ type: 'buy_stock', symbol }));
    }

    // Call backend API to update portfolio in database
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (token) {
            const stock = stocks.find(s => s.symbol === symbol);
            console.log('Calling API /api/portfolio/buy with:', { symbol, quantity, price: stock.price, name: stock.name });
            const response = await fetch('http://localhost:3001/api/portfolio/buy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    symbol: symbol,
                    quantity: quantity,
                    price: stock.price,
                    name: stock.name
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to update portfolio in DB:', errorData.message);
                alert('Failed to buy stock: ' + errorData.message);
                return;
            } else {
                console.log('Successfully updated portfolio in DB');
                alert(`Bought ${quantity} share(s) of ${symbol} for ₹${totalPrice.toLocaleString('en-IN')}`);
                await renderWallet();
            }
        } else {
            console.error('No auth token found for API call');
            alert('User not authenticated. Please login.');
            return;
        }
    } catch (error) {
        console.error('Error updating portfolio in DB:', error);
        alert('Error buying stock. Please try again.');
        return;
    }

    // Fetch updated portfolio from backend and update localStorage
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (token) {
            const response = await fetch('http://localhost:3001/api/portfolio', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            if (response.ok) {
                const data = await response.json();
                const portfolioObj = {};
                data.portfolio.forEach(item => {
                    portfolioObj[item.stock_symbol] = {
                        name: item.stock_name,
                        quantity: item.quantity,
                        purchasePrice: item.purchase_price
                    };
                });
                savePortfolio(portfolioObj);
                // If on portfolio page, re-render portfolio
                if (window.location.pathname.endsWith("portfolio.html")) {
                    renderPortfolio();
                }
            }
        }
    } catch (error) {
        console.error('Error fetching updated portfolio:', error);
    }
}

// Implement savePortfolio function to fix ReferenceError
function savePortfolio(portfolio) {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

async function sellStock(symbol, quantity) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("WebSocket connection is not open. Please try again later.");
        return;
    }

    const stock = stocks.find(s => s.symbol === symbol);
    const portfolio = await loadPortfolio();

    if (!portfolio[symbol] || portfolio[symbol].quantity < quantity) {
        alert("You do not have enough shares to sell this quantity.");
        return;
    }

    const totalPrice = stock.price * quantity;

    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            alert('User not authenticated. Please login.');
            return;
        }
        const response = await fetch('http://localhost:3001/api/portfolio/sell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                symbol: symbol,
                quantity: quantity,
                price: stock.price
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            alert('Failed to sell stock: ' + errorData.message);
            return;
        }
        alert(`Sold ${quantity} share(s) of ${symbol} for ₹${totalPrice.toLocaleString('en-IN')}`);

        // Fetch updated portfolio and wallet after successful sell
        const updatedPortfolioResponse = await fetch('http://localhost:3001/api/portfolio', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (updatedPortfolioResponse.ok) {
            const data = await updatedPortfolioResponse.json();
            const portfolioObj = {};
            data.portfolio.forEach(item => {
                portfolioObj[item.stock_symbol] = {
                    name: item.stock_name,
                    quantity: item.quantity,
                    purchasePrice: item.purchase_price
                };
            });
            savePortfolio(portfolioObj);
            if (window.location.pathname.endsWith("portfolio.html")) {
                renderPortfolio();
            }
        }

        const updatedWalletResponse = await fetch('http://localhost:3001/api/wallet', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (updatedWalletResponse.ok) {
            const walletData = await updatedWalletResponse.json();
            saveWallet(walletData.wallet);
            renderWallet();
        }
    } catch (error) {
        console.error('Error selling stock:', error);
        alert('Error selling stock. Please try again.');
    }
}

// Portfolio page: render portfolio details
async function renderPortfolio() {
    const container = document.getElementById("portfolio-details");
    if (!container) return;

    const portfolio = await fetchPortfolio();

    if (Object.keys(portfolio).length === 0) {
        container.innerHTML = "<p>Your portfolio is empty.</p>";
        return;
    }

    let totalInvestment = 0;
    let totalCurrentValue = 0;

    let tableHTML = `
        <table class="portfolio-table">
            <thead>
                <tr>
                    <th>Stock Name</th>
                    <th>Quantity</th>
                    <th>Purchase Price (₹)</th>
                    <th>Current Price (₹)</th>
                    <th>Investment (₹)</th>
                    <th>Current Value (₹)</th>
                    <th>Profit / Loss (₹)</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const symbol in portfolio) {
        const stock = stocks.find(s => s.symbol === symbol);
        if (!stock) continue;

        const item = portfolio[symbol];
        const investment = item.purchasePrice * item.quantity;
        const currentValue = stock.price * item.quantity;
        const profitLoss = currentValue - investment;

        totalInvestment += investment;
        totalCurrentValue += currentValue;

        tableHTML += `
            <tr>
                <td>${item.name} (${symbol})</td>
                <td>${item.quantity}</td>
                <td>${item.purchasePrice.toLocaleString('en-IN')}</td>
                <td>${stock.price.toLocaleString('en-IN')}</td>
                <td>${investment.toLocaleString('en-IN')}</td>
                <td>${currentValue.toLocaleString('en-IN')}</td>
                <td style="color:${profitLoss >= 0 ? 'green' : 'red'};">${profitLoss.toLocaleString('en-IN')}</td>
            </tr>
        `;
    }

    const totalProfitLoss = totalCurrentValue - totalInvestment;

    tableHTML += `
            </tbody>
        </table>
        <div class="portfolio-summary">
            Total Investment: ₹${totalInvestment.toLocaleString('en-IN')}<br/>
            Total Current Value: ₹${totalCurrentValue.toLocaleString('en-IN')}<br/>
            Total Profit / Loss: <span style="color:${totalProfitLoss >= 0 ? 'green' : 'red'};">₹${totalProfitLoss.toLocaleString('en-IN')}</span>
        </div>
    `;

    container.innerHTML = tableHTML;
}

async function renderWallet() {
    const wallet = await fetchWallet();

    const mainBalanceEl = document.getElementById("main-balance");
    const withdrawBalanceEl = document.getElementById("withdraw-balance");
    const referralBonusEl = document.getElementById("referral-bonus");
    const stockBuyingBalanceEl = document.getElementById("stock-buying-balance");

    if (mainBalanceEl) mainBalanceEl.textContent = (wallet.mainBalance ?? 0).toLocaleString('en-IN');
    if (withdrawBalanceEl) withdrawBalanceEl.textContent = (wallet.withdrawBalance ?? 0).toLocaleString('en-IN');
    if (referralBonusEl) referralBonusEl.textContent = (wallet.referralBonus ?? 0).toLocaleString('en-IN');
    if (stockBuyingBalanceEl) stockBuyingBalanceEl.textContent = (wallet.stockBuyingBalance ?? 0).toLocaleString('en-IN');
}

// Call render functions on page load based on current page

// Global WebSocket variable
let ws = null;

function connectWebSocket() {
    if (ws !== null && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log("WebSocket is already connected or connecting.");
        return;
    }

    // Replace with your backend WebSocket URL
    const wsUrl = "ws://localhost:3001";

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("WebSocket connection opened.");
        // You can send initial messages here if needed
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("WebSocket message received:", data);

            // Update stock prices if data contains stock updates array
            if (data.type === "stock_update") {
                console.log("Processing stock_update message");
                if (Array.isArray(data.stocks)) {
                    data.stocks.forEach(update => {
                        const stock = stocks.find(s => s.symbol === update.symbol);
                        if (stock) {
                            stock.price = update.price;
                            stock.volume = update.volume;
                        } else {
                            console.log("New stock received via WebSocket:", update);
                            stocks.push(update);
                        }
                    });
                } else if (data.stock) {
                    // Handle single stock update object
                    const update = data.stock;
                    const stock = stocks.find(s => s.symbol === update.symbol);
                    if (stock) {
                        stock.price = update.price;
                        stock.volume = update.volume;
                    } else {
                        console.log("New single stock received via WebSocket:", update);
                        stocks.push(update);
                    }
                }
                // Re-render market to reflect updated stock data
                renderMarket();
            } else if (data.type === "stock_data") {
                console.log("Received initial stock_data message");
                if (Array.isArray(data.stocks)) {
                    stocks = data.stocks;
                    renderMarket();
                }
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
        console.log(`WebSocket connection closed: code=${event.code} reason=${event.reason}`);
        // Optionally attempt to reconnect after a delay
        setTimeout(() => {
            connectWebSocket();
        }, 5000);
    };
}

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    if (path.endsWith("market.html")) {
        connectWebSocket();
        renderMarket();
    } else if (path.endsWith("portfolio.html")) {
        (async () => {
            stocks = await fetchLatestStocks();
            renderPortfolio();
        })();

        // Add event listener for manual refresh button
        const refreshBtn = document.getElementById("refresh-portfolio-btn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                renderPortfolio();
            });
        }

        // Auto-refresh portfolio every 10 seconds
        setInterval(() => {
            renderPortfolio();
        }, 10000);
    } else if (path.endsWith("kyc.html")) {
        renderKYC();
    } else if (path.endsWith("contest.html")) {
        renderContests();
    } else if (path.endsWith("my_contest.html")) {
        renderJoinedContests();
    }
});

// Fetch all contests from backend API
async function fetchContests() {
    try {
        const response = await fetch('http://localhost:3001/api/contests');
        if (!response.ok) {
            console.error('Failed to fetch contests');
            return [];
        }
        const data = await response.json();
        return data.contests;
    } catch (error) {
        console.error('Error fetching contests:', error);
        return [];
    }
}

// Fetch joined contests for authenticated user
async function fetchJoinedContests() {
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            return { activeContests: [], completedContests: [] };
        }
        const response = await fetch('http://localhost:3001/api/joined-contests', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch joined contests');
            return { activeContests: [], completedContests: [] };
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching joined contests:', error);
        return { activeContests: [], completedContests: [] };
    }
}

// Render contests on contest.html
async function renderContests() {
    const container = document.getElementById('contest-list');
    if (!container) return;

    const contests = await fetchContests();
    if (contests.length === 0) {
        container.innerHTML = '<p>No contests available.</p>';
        return;
    }

    // Fetch winning prizes for contests
    let winningPrizes = {};
    try {
        const response = await fetch('http://localhost:3001/api/contest-winning-prizes');
        if (response.ok) {
            const data = await response.json();
            winningPrizes = data.winningPrizes || {};
        }
    } catch (error) {
        console.error('Error fetching contest winning prizes:', error);
    }

    let html = '';
    contests.forEach(contest => {
        const winningPrize = winningPrizes[contest.id] || 0;
        html += `
            <div class="contest-section">
                <h3>${contest.name}</h3>
                <p><strong>Entry Fee:</strong> ₹${contest.entry_fee.toLocaleString('en-IN')}</p>
                <p><strong>Prize Pool:</strong> ₹${(contest.prize_pool || 0).toLocaleString('en-IN')}</p>
                <p><strong>Winning Prize:</strong> ₹${winningPrize.toLocaleString('en-IN')}</p>
                <p><strong>Type:</strong> ${contest.contest_type.charAt(0).toUpperCase() + contest.contest_type.slice(1)}</p>
                <p><strong>Start:</strong> ${new Date(contest.start_time).toLocaleString()}</p>
                <p><strong>End:</strong> ${new Date(contest.end_time).toLocaleString()}</p>
                <button class="join-btn" onclick="joinContest(${contest.id})">Join Contest</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Render joined contests on my_contest.html
async function renderJoinedContests() {
    const container = document.getElementById('joined-contest-list');
    if (!container) return;

    try {
        const { activeContests, completedContests } = await fetchJoinedContests();
        if ((!activeContests || activeContests.length === 0) && (!completedContests || completedContests.length === 0)) {
            container.innerHTML = '<p>You have not joined any contests.</p>';
            return;
        }

        let html = '';

        if (activeContests && activeContests.length > 0) {
            html += '<h3>Active Contests</h3><ul class="joined-contest-list">';
            activeContests.forEach(contest => {
                html += `
                    <li>
                        <h4>${contest.name}</h4>
                        <p>Entry Fee: ₹${contest.entry_fee.toLocaleString('en-IN')}</p>
                        <p>Type: ${contest.contest_type}</p>
                        <p>Start: ${new Date(contest.start_time).toLocaleString()}</p>
                        <p>End: ${new Date(contest.end_time).toLocaleString()}</p>
                        <p>Joined At: ${new Date(contest.joined_at).toLocaleString()}</p>
                    </li>
                `;
            });
            html += '</ul>';
        }

        if (completedContests && completedContests.length > 0) {
            html += '<h3>Completed Contests</h3><ul class="joined-contest-list">';
            completedContests.forEach(contest => {
                html += `
                    <li>
                        <h4>${contest.name}</h4>
                        <p>Entry Fee: ₹${contest.entry_fee.toLocaleString('en-IN')}</p>
                        <p>Type: ${contest.contest_type}</p>
                        <p>Start: ${new Date(contest.start_time).toLocaleString()}</p>
                        <p>End: ${new Date(contest.end_time).toLocaleString()}</p>
                        <p>Joined At: ${new Date(contest.joined_at).toLocaleString()}</p>
                    </li>
                `;
            });
            html += '</ul>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error rendering joined contests:', error);
        container.innerHTML = '<p>Failed to load joined contests.</p>';
    }
}

// Join a contest
async function joinContest(contestId) {
    console.log('joinContest called with contestId:', contestId);
    const token = localStorage.getItem('cricktrades_token');
    console.log('Token:', token);
    if (!token) {
        alert('Please login to join contests.');
        return;
    }
    try {
        const response = await fetch('http://localhost:3001/api/join-contest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ contestId })
        });
        if (!response.ok) {
            const errorData = await response.json();
            alert('Failed to join contest: ' + errorData.message);
            return;
        }
        alert('Successfully joined contest.');
        await renderWallet();
        renderJoinedContests();
    } catch (error) {
        console.error('Error joining contest:', error);
        alert('Error joining contest.');
    }
}

// Fetch KYC details from backend API
async function fetchKYC() {
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            return null;
        }
        const response = await fetch('http://localhost:3001/api/kyc', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch KYC details');
            return null;
        }
        const data = await response.json();
        return data.kyc;
    } catch (error) {
        console.error('Error fetching KYC details:', error);
        return null;
    }
}

// Render KYC details in the form
async function renderKYC() {
    const kyc = await fetchKYC();
    if (!kyc) return;

    const fullNameInput = document.getElementById('full-name');
    const pancardInput = document.getElementById('pancard-number');
    const dobInput = document.getElementById('dob');
    const phoneInput = document.getElementById('phone');

    if (fullNameInput) fullNameInput.value = kyc.full_name || '';
    if (pancardInput) pancardInput.value = kyc.pancard_number || '';
    if (dobInput) dobInput.value = kyc.dob ? new Date(kyc.dob).toISOString().split('T')[0] : '';
    if (phoneInput) phoneInput.value = kyc.phone || '';
}

// Save KYC details to backend API
async function saveKYC() {
    const fullNameInput = document.getElementById('full-name');
    const pancardInput = document.getElementById('pancard-number');
    const dobInput = document.getElementById('dob');
    const phoneInput = document.getElementById('phone');

    const fullName = fullNameInput ? fullNameInput.value.trim() : '';
    const pancardNumber = pancardInput ? pancardInput.value.trim() : '';
    const dob = dobInput ? dobInput.value : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!fullName || !pancardNumber || !dob || !phone) {
        alert('Please fill in all KYC fields.');
        return;
    }

    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            alert('User not authenticated.');
            return;
        }
        const response = await fetch('http://localhost:3001/api/kyc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ fullName, pancardNumber, dob, phone })
        });
        if (!response.ok) {
            const errorData = await response.json();
            alert('Failed to save KYC details: ' + errorData.message);
            return;
        }
        alert('KYC details saved successfully.');
    } catch (error) {
        console.error('Error saving KYC details:', error);
        alert('Error saving KYC details.');
    }
}
