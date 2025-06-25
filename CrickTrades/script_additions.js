const BASE_URL = window.location.origin;

async function renderWallet() {
    const wallet = await fetchWallet();

    // Save fresh wallet data to localStorage
    localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));

    const mainBalanceEl = document.getElementById("main-balance");
    const withdrawBalanceEl = document.getElementById("withdraw-balance");
    const referralBonusEl = document.getElementById("referral-bonus");
    const stockBuyingBalanceEl = document.getElementById("stock-buying-balance");

    if (mainBalanceEl) mainBalanceEl.textContent = (wallet.mainBalance ?? 0).toLocaleString('en-IN');
    if (withdrawBalanceEl) withdrawBalanceEl.textContent = (wallet.withdrawBalance ?? 0).toLocaleString('en-IN');
    if (referralBonusEl) referralBonusEl.textContent = (wallet.referralBonus ?? 0).toLocaleString('en-IN');
    if (stockBuyingBalanceEl) stockBuyingBalanceEl.textContent = (wallet.stockBuyingBalance ?? 0).toLocaleString('en-IN');
}



async function fetchWallet() {
    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            return {
                mainBalance: 0,
                withdrawBalance: 0,
                referralBonus: 0,
                stockBuyingBalance: 10000,
            };
        }
        const response = await fetch(`${BASE_URL}/api/wallet`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch wallet');
            return {
                mainBalance: 0,
                withdrawBalance: 0,
                referralBonus: 0,
                stockBuyingBalance: 10000,
            };
        }
        const data = await response.json();
        // Convert snake_case keys to camelCase
        const wallet = data.wallet;
        return {
            mainBalance: wallet.main_balance,
            withdrawBalance: wallet.withdraw_balance,
            referralBonus: wallet.referral_bonus,
            stockBuyingBalance: wallet.stock_buying_balance,
        };
    } catch (error) {
        console.error('Error fetching wallet:', error);
        return {
            mainBalance: 0,
            withdrawBalance: 0,
            referralBonus: 0,
            stockBuyingBalance: 10000,
        };
    }
}

// New functions to add and withdraw money from mainBalance
function saveWallet(wallet) {
    localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
}

async function addMoney() {
    const amountInput = document.getElementById("add-amount");
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount greater than 0.");
        return;
    }
    const token = localStorage.getItem('cricktrades_token');
    if (!token) {
        alert("You must be logged in to add money.");
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}/api/request-add-money`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ amount })
        });
        if (!response.ok) {
            const data = await response.json();
            alert(data.message || "Failed to request add money.");
            return;
        }
        alert("Add money request submitted successfully. Please wait for admin approval.");
        await renderWallet();
        amountInput.value = "";
    } catch (error) {
        console.error('Error requesting add money:', error);
        alert("Error requesting add money. Please try again.");
    }
}

async function withdrawMoney() {
    const amountInput = document.getElementById("withdraw-amount");
    const paymentInfoInput = document.getElementById("payment-info");
    const amount = parseFloat(amountInput.value);
    const paymentInfo = paymentInfoInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount greater than 0.");
        return;
    }
    if (!paymentInfo) {
        alert("Please enter your Paytm/PhonePe mobile number or UPI ID.");
        return;
    }
    const token = localStorage.getItem('cricktrades_token');
    if (!token) {
        alert("You must be logged in to withdraw money.");
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ amount, paymentInfo })
        });
        if (!response.ok) {
            const data = await response.json();
            alert(data.message || "Failed to withdraw money.");
            return;
        }
        alert(`₹${amount.toLocaleString('en-IN')} withdrawn from your main balance. Within an hour, money will be credited to your account.`);
        await renderWallet();
        amountInput.value = "";
        paymentInfoInput.value = "";
    } catch (error) {
        console.error('Error withdrawing money:', error);
        alert("An error occurred while withdrawing money. Please try again.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const addMoneyBtn = document.getElementById("add-money-btn");
    if (addMoneyBtn) {
        addMoneyBtn.addEventListener("click", (e) => {
            e.preventDefault();
            addMoney();
        });
    }
    const withdrawMoneyBtn = document.getElementById("withdraw-money-btn");
    if (withdrawMoneyBtn) {
        withdrawMoneyBtn.addEventListener("click", (e) => {
            e.preventDefault();
            withdrawMoney();
        });
    }
});

// Render transaction table on page load
renderTransactionTable();

// Fetch and render stocks on market page
// Removed fetchAndRenderStocks function and call because stocks are served via WebSocket

// WebSocket connection to receive stock data updates on market page
// Removed duplicate ws declaration to avoid conflict with script.js



// Initialize WebSocket connection and render market on DOMContentLoaded if on market page
document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.endsWith("market.html")) {
        connectWebSocket();
    }
});

// Function to log transactions
function logTransaction(type, amount) {
    const transactions = JSON.parse(localStorage.getItem("cricktrades_transactions")) || [];
    const date = new Date().toLocaleString('en-IN', { hour12: false });
    transactions.push({ date, type, amount });
    localStorage.setItem("cricktrades_transactions", JSON.stringify(transactions));
}

// Function to render transaction table
async function renderTransactionTable() {
    const tbody = document.getElementById("transaction-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    try {
        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            console.error('User not authenticated');
            return;
        }
        const response = await fetch(`${BASE_URL}/api/transactions`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch transactions');
            return;
        }
        const data = await response.json();
        const transactions = data.transactions || [];

        transactions.forEach(tx => {
            const tr = document.createElement("tr");

            const tdDate = document.createElement("td");
            tdDate.textContent = new Date(tx.created_at).toLocaleString('en-IN', { hour12: false });
            tr.appendChild(tdDate);

            const tdType = document.createElement("td");
            tdType.textContent = tx.type;
            tr.appendChild(tdType);

            const tdAmount = document.createElement("td");
            tdAmount.textContent = tx.amount.toLocaleString('en-IN');
            tr.appendChild(tdAmount);

            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}

// Function to render wallet balances from localStorage, including withdraw balance update after prize distribution
function renderWalletFromLocalStorage() {
    const wallet = JSON.parse(localStorage.getItem("cricktrades_wallet")) || {
        mainBalance: 0,
        withdrawBalance: 0,
        referralBonus: 0,
        stockBuyingBalance: 10000,
    };

    const mainBalanceEl = document.getElementById("main-balance");
    const withdrawBalanceEl = document.getElementById("withdraw-balance");
    const referralBonusEl = document.getElementById("referral-bonus");
    const stockBuyingBalanceEl = document.getElementById("stock-buying-balance");

    if (mainBalanceEl) mainBalanceEl.textContent = wallet.mainBalance.toLocaleString('en-IN');
    if (withdrawBalanceEl) withdrawBalanceEl.textContent = wallet.withdrawBalance.toLocaleString('en-IN');
    if (referralBonusEl) referralBonusEl.textContent = wallet.referralBonus.toLocaleString('en-IN');
    if (stockBuyingBalanceEl) stockBuyingBalanceEl.textContent = wallet.stockBuyingBalance.toLocaleString('en-IN');
}

// Call async renderWallet on DOMContentLoaded to update wallet display with fresh data
document.addEventListener("DOMContentLoaded", () => {
    renderWallet();
});
document.addEventListener("DOMContentLoaded", () => {
    const kycForm = document.getElementById("kyc-form");
    const kycMessage = document.getElementById("kyc-message");

    if (!kycForm) return;

    kycForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = kycForm.fullName.value.trim();
        const pancardNumber = kycForm.pancardNumber.value.trim().toUpperCase();
        const dob = kycForm.dob.value;
        const phone = kycForm.phone.value.trim();

        if (!fullName || !pancardNumber || !dob || !phone) {
            kycMessage.textContent = "Please fill in all fields.";
            kycMessage.style.color = "red";
            return;
        }

        const token = localStorage.getItem('cricktrades_token');
        if (!token) {
            kycMessage.textContent = "User not authenticated. Please login.";
            kycMessage.style.color = "red";
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/kyc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ fullName, pancardNumber, dob, phone })
            });

            if (!response.ok) {
                const data = await response.json();
                kycMessage.textContent = data.message || "Failed to save KYC details.";
                kycMessage.style.color = "red";
                return;
            }

            kycMessage.textContent = "Your KYC is done.";
            kycMessage.style.color = "green";

            kycForm.reset();
        } catch (error) {
            console.error('Error saving KYC details:', error);
            kycMessage.textContent = "Error saving KYC details. Please try again.";
            kycMessage.style.color = "red";
        }
    });
});
// Contest join handling
document.addEventListener("DOMContentLoaded", () => {
    const joinWeeklyBtn = document.getElementById("join-weekly");
    const joinDailyBtn = document.getElementById("join-daily");
    const contestMessage = document.getElementById("contest-message");

    function initializeWallet() {
        let wallet = JSON.parse(localStorage.getItem("cricktrades_wallet"));
        if (!wallet) {
            wallet = { mainBalance: 0, stockBalance: 0 };
            localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
        }
        return wallet;
    }

    function saveWallet(wallet) {
        localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
    }

    function updateMessage(message, isError = false) {
        contestMessage.textContent = message;
        contestMessage.style.color = isError ? "red" : "green";
    }

    if (joinWeeklyBtn) {
        joinWeeklyBtn.addEventListener("click", () => {
            const wallet = initializeWallet();
            const entryFee = 500;
            if ((wallet.mainBalance ?? 0) >= entryFee) {
                wallet.mainBalance -= entryFee;
                saveWallet(wallet);
                updateMessage("You have successfully joined the Weekly Contest!");
            } else {
                updateMessage("Insufficient main balance to join the Weekly Contest.", true);
            }
        });
    }

    if (joinDailyBtn) {
        joinDailyBtn.addEventListener("click", () => {
            const wallet = initializeWallet();
            const entryFee = 100;
            if ((wallet.mainBalance ?? 0) >= entryFee) {
                wallet.mainBalance -= entryFee;
                saveWallet(wallet);
                updateMessage("You have successfully joined the Daily Contest!");
            } else {
                updateMessage("Insufficient main balance to join the Daily Contest.", true);
            }
        });
    }
});
// Save joined contest data to localStorage
function saveJoinedContest(contest) {
    let joinedContests = JSON.parse(localStorage.getItem("cricktrades_joined_contests")) || [];
    // Avoid duplicate entries
    if (!joinedContests.find(c => c.id === contest.id)) {
        joinedContests.push(contest);
        localStorage.setItem("cricktrades_joined_contests", JSON.stringify(joinedContests));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const contestButtons = [
        { id: "join-weekly-1", name: "Weekly Contest 1", entryFee: 500 },
        { id: "join-weekly-2", name: "Weekly Contest 2", entryFee: 750 },
        { id: "join-daily-1", name: "Daily Contest 1", entryFee: 100 },
        { id: "join-daily-2", name: "Daily Contest 2", entryFee: 150 },
    ];

    const contestMessage = document.getElementById("contest-message");

    // Function to check if current time is before 10:00 PM
    function canJoinContest() {
        const now = new Date();
        const cutoff = new Date();
        cutoff.setHours(22, 0, 0, 0); // 10:00 PM
        return now < cutoff;
    }

    // Disable join buttons and show message if after cutoff time
    function updateJoinAvailability() {
        const canJoin = canJoinContest();
        contestButtons.forEach(contest => {
            const btn = document.getElementById(contest.id);
            if (btn) {
                btn.disabled = !canJoin;
            }
        });
        if (!canJoin && contestMessage) {
            contestMessage.textContent = "Joining contests is closed after 10:00 PM.";
            contestMessage.style.color = "red";
        } else if (contestMessage) {
            contestMessage.textContent = "";
        }
    }

    updateJoinAvailability();

    contestButtons.forEach(contest => {
        const btn = document.getElementById(contest.id);
        if (btn) {
            btn.addEventListener("click", () => {
                if (!canJoinContest()) {
                    if (contestMessage) {
                        contestMessage.textContent = "Joining contests is closed after 10:00 PM.";
                        contestMessage.style.color = "red";
                    }
                    return;
                }
                let wallet = JSON.parse(localStorage.getItem("cricktrades_wallet")) || { mainBalance: 0, stockBalance: 0 };
                if ((wallet.mainBalance ?? 0) >= contest.entryFee) {
                    wallet.mainBalance -= contest.entryFee;
                    localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
                    saveJoinedContest({ id: contest.id, name: contest.name, entryFee: contest.entryFee });
                    if (contestMessage) {
                        contestMessage.textContent = `You have successfully joined the ${contest.name}!`;
                        contestMessage.style.color = "green";
                    }
                } else {
                    if (contestMessage) {
                        contestMessage.textContent = `Insufficient main balance to join the ${contest.name}.`;
                        contestMessage.style.color = "red";
                    }
                }
            });
        }
    });

    // New function to distribute prizes after contest end at 10:30 PM
    function distributePrizes() {
        const now = new Date();
        const contestEnd = new Date();
        contestEnd.setHours(22, 30, 0, 0); // 10:30 PM

        if (now < contestEnd) {
            return; // Contest not ended yet
        }

        const joinedContests = JSON.parse(localStorage.getItem("cricktrades_joined_contests")) || [];
        const prizeDistributed = JSON.parse(localStorage.getItem("cricktrades_prize_distributed")) || {};

        joinedContests.forEach(contest => {
            if (prizeDistributed[contest.id]) {
                return; // Prize already distributed for this contest
            }

            // Simulated leaderboard data for demonstration
            const leaderboardData = {
                "join-weekly-1": [
                    { rank: 1, username: "user1", profit: 5000 },
                    { rank: 2, username: "user2", profit: 3000 },
                    { rank: 3, username: "user3", profit: 1500 },
                    { rank: 4, username: "user13", profit: 1000 },
                    { rank: 5, username: "user14", profit: 800 },
                ],
                "join-weekly-2": [
                    { rank: 1, username: "user4", profit: 7000 },
                    { rank: 2, username: "user5", profit: 4000 },
                    { rank: 3, username: "user6", profit: 2000 },
                    { rank: 4, username: "user15", profit: 1500 },
                    { rank: 5, username: "user16", profit: 1200 },
                ],
                "join-daily-1": [
                    { rank: 1, username: "user7", profit: 1000 },
                    { rank: 2, username: "user8", profit: 800 },
                    { rank: 3, username: "user9", profit: 600 },
                    { rank: 4, username: "user17", profit: 500 },
                    { rank: 5, username: "user18", profit: 400 },
                ],
                "join-daily-2": [
                    { rank: 1, username: "user10", profit: 1200 },
                    { rank: 2, username: "user11", profit: 900 },
                    { rank: 3, username: "user12", profit: 700 },
                    { rank: 4, username: "user19", profit: 600 },
                    { rank: 5, username: "user20", profit: 500 },
                ],
            };

            const leaderboard = leaderboardData[contest.id] || [];
            const totalUsers = leaderboard.length;
            const top70Count = Math.ceil(totalUsers * 0.7);

            // Prize amounts per contest
            const prizeAmounts = {
                "join-daily-1": 123,
                "join-daily-2": 200,
                "join-weekly-1": 300,
                "join-weekly-2": 400,
            };

            // Distribute prize to top 70% users
            leaderboard.slice(0, top70Count).forEach(user => {
                // For demonstration, assume current user is "user3"
                if (user.username === "user3") {
                    let wallet = JSON.parse(localStorage.getItem("cricktrades_wallet")) || { withdrawBalance: 0 };
                    const prize = prizeAmounts[contest.id] || 0;
                    wallet.withdrawBalance = (wallet.withdrawBalance || 0) + prize;
                    localStorage.setItem("cricktrades_wallet", JSON.stringify(wallet));
                }
            });

            prizeDistributed[contest.id] = true;
            localStorage.setItem("cricktrades_prize_distributed", JSON.stringify(prizeDistributed));
        });
    }

    distributePrizes();
});
