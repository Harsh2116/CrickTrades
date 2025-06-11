require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const pool = require('./db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const { initWebSocketServer, handleUpgrade } = require('./websocketServer');
const { stocks } = require('./websocketServer');
const forgotPasswordRouter = require('./forgotPassword');
const debugQueriesRouter = require('./debugQueries');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads', 'pan_photos');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use('/api', forgotPasswordRouter);
app.use('/api', debugQueriesRouter);

// Serve uploaded PAN card photos as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Also serve uploads directory with absolute path for image access
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// Add GET /api/stocks endpoint to serve stocks array
app.get('/api/stocks', (req, res) => {
    res.json({ stocks });
});

const contestWinningPrizesRouter = require('./api_contest_winning_prizes');
app.use('/api', contestWinningPrizesRouter);

const adminRouter = require('./admin');
const adminReportsRouter = require('./adminReports');
const prizeDistributionRouter = require('./prizeDistribution');

app.use('/api', adminRouter);
app.use('/api/admin/reports', adminReportsRouter);
app.use('/api/prizeDistribution', prizeDistributionRouter);

// Add KYC admin router for admin KYC APIs
const adminKycRouter = require('./admin');
app.use('/api/admin', adminKycRouter);

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, 'admin_panel')));

// Middleware to authenticate JWT token and set req.user
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('Authenticating token:', token); // Log token for debugging
    if (!token) {
        console.log('Access token missing');
        return res.status(401).json({ message: 'Access token missing' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Invalid token:', err);
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// New API to get pending withdrawal requests for admin finance page
app.get('/api/admin/finance/withdrawal-requests', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.user_id, u.full_name, u.username, t.amount, t.type AS method, t.transaction_date AS request_date
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             WHERE t.type = 'Withdraw to' OR t.type LIKE 'Withdraw to %'
             ORDER BY t.transaction_date DESC`
        );
        res.json({ withdrawalRequests: rows });
    } catch (err) {
        console.error('Error fetching withdrawal requests:', err);
        res.status(500).json({ message: 'Error fetching withdrawal requests' });
    }
});

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    const { fullName, username, email, state, securityQuestion, password, referralCode } = req.body;
    if (!fullName || !username || !email || !state || !securityQuestion || !password) {
        return res.status(400).json({ message: 'Full name, username, email, state, security question, and password are required.' });
    }

    // List of blocked states
    const blockedStates = [
        'Telangana',
        'Andhra Pradesh',
        'Odisha',
        'Assam',
        'Nagaland',
        'Sikkim',
        'Tamil Nadu'
    ];

    if (blockedStates.includes(state)) {
        return res.status(403).json({ message: `You are not allowed to signup because of your state policy: ${state}` });
    }

    try {
        // Check if username exists
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (full_name, username, email, state, security_question, password_hash, referral_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [fullName, username, email, state, securityQuestion, hashedPassword, referralCode || null]
        );

        return res.status(201).json({ message: 'Signup successful.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error creating user.' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const [rows] = await pool.query('SELECT id, full_name, username, password_hash FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        return res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                username: user.username
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error logging in.' });
    }
});

// Get portfolio for authenticated user
app.get('/api/portfolio', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const [portfolioRows] = await pool.query('SELECT stock_symbol, stock_name, quantity, purchase_price FROM portfolios WHERE user_id = ?', [userId]);
        return res.json({ portfolio: portfolioRows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching portfolio' });
    }
});

app.post('/api/portfolio/buy', authenticateToken, async (req, res) => {
    const { symbol, quantity, price, name } = req.body;
    if (!symbol || !quantity || !price || !name) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;

        // Check user's stock buying balance
        const [walletRows] = await pool.query('SELECT stock_buying_balance FROM wallets WHERE user_id = ?', [userId]);
        if (walletRows.length === 0) {
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const stockBuyingBalance = walletRows[0].stock_buying_balance;
        const totalPrice = price * quantity;

        if (stockBuyingBalance < totalPrice) {
            return res.status(400).json({ message: 'Insufficient stock buying balance' });
        }

        // Deduct from stock buying balance
        await pool.query('UPDATE wallets SET stock_buying_balance = stock_buying_balance - ? WHERE user_id = ?', [totalPrice, userId]);

        // Check if stock already in portfolio
        const [existingRows] = await pool.query('SELECT quantity FROM portfolios WHERE user_id = ? AND stock_symbol = ?', [userId, symbol]);
        if (existingRows.length > 0) {
            // Update quantity
            const newQuantity = existingRows[0].quantity + quantity;
            await pool.query('UPDATE portfolios SET quantity = ? WHERE user_id = ? AND stock_symbol = ?', [newQuantity, userId, symbol]);
        } else {
            // Insert new stock
            await pool.query('INSERT INTO portfolios (user_id, stock_symbol, stock_name, quantity, purchase_price) VALUES (?, ?, ?, ?, ?)', [userId, symbol, name, quantity, price]);
        }

        // Log transaction
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, 'Buy Stock', totalPrice]);

        return res.json({ message: 'Stock purchased and portfolio updated' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating portfolio' });
    }
});

// Sell stocks and update portfolio
app.post('/api/portfolio/sell', authenticateToken, async (req, res) => {
    const { symbol, quantity, price } = req.body;
    if (!symbol || !quantity || !price) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;

        // Check if stock exists and quantity is sufficient
        const [existingRows] = await pool.query('SELECT quantity FROM portfolios WHERE user_id = ? AND stock_symbol = ?', [userId, symbol]);
        if (existingRows.length === 0 || existingRows[0].quantity < quantity) {
            return res.status(400).json({ message: 'Insufficient stock quantity' });
        }

        const newQuantity = existingRows[0].quantity - quantity;
        if (newQuantity > 0) {
            await pool.query('UPDATE portfolios SET quantity = ? WHERE user_id = ? AND stock_symbol = ?', [newQuantity, userId, symbol]);
        } else {
            await pool.query('DELETE FROM portfolios WHERE user_id = ? AND stock_symbol = ?', [userId, symbol]);
        }

        // Update wallet stock buying balance by adding sale amount
        await pool.query('UPDATE wallets SET stock_buying_balance = stock_buying_balance + ? WHERE user_id = ?', [price * quantity, userId]);

        // Update stocks array volume and price, and broadcast update via WebSocket
        const { stocks, wss } = require('./websocketServer');
        const stock = stocks.find(s => s.symbol === symbol);
        if (stock) {
            stock.volume += quantity;
            stock.price = Math.max(0, stock.price - quantity); // Decrease price proportional to quantity sold
            if (wss) {
                const message = JSON.stringify({ type: 'stock_update', stock });
                wss.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(message);
                    }
                });
            }
        }

        // Log transaction
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, 'Sell Stock', price * quantity]);

        return res.json({ message: 'Stock sold and portfolio updated' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating portfolio' });
    }
});

// Get wallet details for authenticated user
app.get('/api/wallet', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const [walletRows] = await pool.query('SELECT main_balance, withdraw_balance, referral_bonus, stock_buying_balance FROM wallets WHERE user_id = ?', [userId]);
        if (walletRows.length === 0) {
            // Initialize wallet for user if not exists
            await pool.query('INSERT INTO wallets (user_id, main_balance, withdraw_balance, referral_bonus, stock_buying_balance) VALUES (?, 0, 0, 0, 10000)', [userId]);
            const [newWalletRows] = await pool.query('SELECT main_balance, withdraw_balance, referral_bonus, stock_buying_balance FROM wallets WHERE user_id = ?', [userId]);
            return res.json({ wallet: newWalletRows[0] });
        }
        return res.json({ wallet: walletRows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching wallet details' });
    }
});

// Get user transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const [transactionRows] = await pool.query('SELECT type, amount, transaction_date FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC', [userId]);

        // Format transaction_date to ISO string to avoid "Invalid Date" issues on client side
        const formattedTransactions = transactionRows.map(tx => {
            let formattedDate = '';
            if (tx.transaction_date) {
                const dateObj = new Date(tx.transaction_date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toISOString();
                }
            }
            return {
                type: tx.type,
                amount: tx.amount,
                transaction_date: formattedDate
            };
        });

        return res.json({ transactions: formattedTransactions });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching transactions' });
    }
});

// Get KYC details for authenticated user
app.get('/api/kyc', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const [kycRows] = await pool.query('SELECT full_name, pancard_number, dob, phone FROM kyc WHERE user_id = ?', [userId]);
        if (kycRows.length === 0) {
            return res.json({ kyc: null });
        }
        return res.json({ kyc: kycRows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching KYC details' });
    }
});

// Get all contests
app.get('/api/contests', async (req, res) => {
    try {
        const [contests] = await pool.query('SELECT id, name, entry_fee, contest_type, start_time, end_time, prize_pool FROM contests');
        return res.json({ contests });
    } catch (err) {
        console.error(err.stack);
        return res.status(500).json({ message: 'Error fetching contests', error: err.message });
    }
});

// Create a new contest
app.post('/api/contests', async (req, res) => {
    const { name, entry_fee, contest_type, start_time, end_time, prize_pool } = req.body;
    if (!name || !entry_fee || !contest_type || !start_time || !end_time || prize_pool === undefined) {
        return res.status(400).json({ message: 'Missing required contest fields' });
    }
    try {
        await pool.query(
            'INSERT INTO contests (name, entry_fee, contest_type, start_time, end_time, prize_pool) VALUES (?, ?, ?, ?, ?, ?)',
            [name, entry_fee, contest_type, start_time, end_time, prize_pool]
        );
        return res.status(201).json({ message: 'Contest created successfully' });
    } catch (err) {
        console.error('Error creating contest:', err);
        return res.status(500).json({ message: 'Error creating contest' });
    }
});

// Update an existing contest
app.put('/api/contests/:id', async (req, res) => {
    const contestId = req.params.id;
    const { name, entry_fee, contest_type, start_time, end_time, prize_pool } = req.body;
    if (!name || !entry_fee || !contest_type || !start_time || !end_time || prize_pool === undefined) {
        return res.status(400).json({ message: 'Missing required contest fields' });
    }
    try {
        const [result] = await pool.query(
            'UPDATE contests SET name = ?, entry_fee = ?, contest_type = ?, start_time = ?, end_time = ?, prize_pool = ? WHERE id = ?',
            [name, entry_fee, contest_type, start_time, end_time, prize_pool, contestId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Contest not found' });
        }
        return res.json({ message: 'Contest updated successfully' });
    } catch (err) {
        console.error('Error updating contest:', err);
        return res.status(500).json({ message: 'Error updating contest' });
    }
});

// Get joined contests for authenticated user
app.get('/api/joined-contests', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const [joinedContests] = await pool.query(
            `SELECT jc.id, c.id AS contestId, c.name, c.entry_fee, c.contest_type, c.start_time, c.end_time, jc.joined_at
             FROM joined_contests jc
             JOIN contests c ON jc.contest_id = c.id
             WHERE jc.user_id = ?`,
            [userId]
        );

        const now = new Date();
        const activeContests = [];
        const completedContests = [];

        joinedContests.forEach(contest => {
            const endTime = new Date(contest.end_time);
            if (endTime > now) {
                activeContests.push(contest);
            } else {
                completedContests.push(contest);
            }
        });

        return res.json({ activeContests, completedContests });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching joined contests' });
    }
});

// Join a contest with KYC check
app.post('/api/join-contest', authenticateToken, async (req, res) => {
    const { contestId } = req.body;
    if (!contestId) {
        console.log('Join contest failed: Missing contest ID');
        return res.status(400).json({ message: 'Missing contest ID' });
    }
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            console.log('Join contest failed: User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;

        // Check if user has completed KYC
        const [kycRows] = await pool.query('SELECT pan_card_photo FROM kyc WHERE user_id = ?', [userId]);
        if (kycRows.length === 0 || !kycRows[0].pan_card_photo) {
            console.log('Join contest failed: KYC not completed');
            return res.status(403).json({ message: 'You must complete KYC before joining a contest' });
        }

        // Check if already joined
        const [existingRows] = await pool.query('SELECT id FROM joined_contests WHERE user_id = ? AND contest_id = ?', [userId, contestId]);
        if (existingRows.length > 0) {
            console.log('Join contest failed: Already joined this contest');
            return res.status(400).json({ message: 'Already joined this contest' });
        }

        // Get contest entry fee, start_time and end_time
        const [contestRows] = await pool.query('SELECT entry_fee, start_time, end_time FROM contests WHERE id = ?', [contestId]);
        if (contestRows.length === 0) {
            console.log('Join contest failed: Contest not found');
            return res.status(404).json({ message: 'Contest not found' });
        }
        const contest = contestRows[0];
        const entryFee = contest.entry_fee;
        const startTime = new Date(contest.start_time);
        const endTime = new Date(contest.end_time);
        const now = new Date();
        console.log(`Entry fee: ${entryFee}, Start time: ${startTime}, End time: ${endTime}, Now: ${now}`);

        // Check if current time is within contest start and end times
        if (now < startTime) {
            console.log('Join contest failed: Contest has not started yet');
            return res.status(400).json({ message: 'Contest has not started yet' });
        }
        if (now > endTime) {
            console.log('Join contest failed: Contest has already ended');
            return res.status(400).json({ message: 'Contest has already ended' });
        }

        // Check user's main balance
        const [walletRows] = await pool.query('SELECT main_balance FROM wallets WHERE user_id = ?', [userId]);
        if (walletRows.length === 0) {
            console.log('Join contest failed: Wallet not found');
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const mainBalance = walletRows[0].main_balance;
        console.log(`User main balance: ${mainBalance}`);

        // Convert to numbers for comparison
        const entryFeeNum = parseFloat(entryFee);
        const mainBalanceNum = parseFloat(mainBalance);

        if (mainBalanceNum < entryFeeNum) {
            console.log('Join contest failed: Insufficient balance to join contest');
            return res.status(400).json({ message: 'Insufficient balance to join contest' });
        }

        // Deduct entry fee from main balance
        await pool.query('UPDATE wallets SET main_balance = main_balance - ? WHERE user_id = ?', [entryFee, userId]);

        // Insert join record
        await pool.query('INSERT INTO joined_contests (user_id, contest_id) VALUES (?, ?)', [userId, contestId]);

        // Log transaction
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, 'Join Contest', entryFee]);

        return res.json({ message: 'Joined contest successfully' });
    } catch (err) {
        console.error('Join contest error:', err);
        return res.status(500).json({ message: 'Error joining contest' });
    }
});

// Create or update KYC details for authenticated user with file upload
app.post('/api/kyc', authenticateToken, upload.single('panCardPhoto'), async (req, res) => {
    const { fullName, pancardNumber, dob, phone } = req.body;
    if (!fullName || !pancardNumber || !dob || !phone) {
        return res.status(400).json({ message: 'Missing required KYC fields' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'PAN card photo is required' });
    }
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;

        const panCardPhotoPath = path.relative(__dirname, req.file.path).replace(/\\/g, '/');

        const [existingRows] = await pool.query('SELECT id FROM kyc WHERE user_id = ?', [userId]);
        if (existingRows.length > 0) {
            // Update existing KYC
            await pool.query(
                'UPDATE kyc SET full_name = ?, pancard_number = ?, dob = ?, phone = ?, pan_card_photo = ? WHERE user_id = ?',
                [fullName, pancardNumber, dob, phone, panCardPhotoPath, userId]
            );
        } else {
            // Insert new KYC
            await pool.query(
                'INSERT INTO kyc (user_id, full_name, pancard_number, dob, phone, pan_card_photo) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, fullName, pancardNumber, dob, phone, panCardPhotoPath]
            );
        }
        return res.json({ message: 'KYC details saved successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error saving KYC details' });
    }
});

// Create HTTP server and initialize WebSocket server
const server = http.createServer((req, res) => {
  if (req.url === '/admin' || req.url === '/admin/') {
    const filePath = path.join(__dirname, '../admin/index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading admin panel');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    server.emit('request', req, res);
  }
});

initWebSocketServer(server);

// Add upgrade event listener to handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
    handleUpgrade(request, socket, head);
});

// Add money to wallet main balance
app.post('/api/wallet/add', authenticateToken, async (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }
    try {
        const [userRows] = await pool.query('SELECT id, referral_code FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const userReferralCode = userRows[0].referral_code;

        // Calculate GST and net amount
        const gstAmount = amount * 0.18;
        const netAmount = amount * 0.82;

        // Update main_balance in wallets table with net amount
        await pool.query('UPDATE wallets SET main_balance = main_balance + ? WHERE user_id = ?', [netAmount, userId]);

        // Log transaction for user adding money (net amount)
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, 'Add Money', netAmount]);

        // Log transaction for GST amount
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, 'GST', gstAmount]);

        // If amount >= 50 and user has a referral code, add 10rs referral bonus to referring user
        if (amount >= 50 && userReferralCode) {
            // Find referring user by referral code
            const [referrerRows] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [userReferralCode]);
            if (referrerRows.length > 0) {
                const referrerId = referrerRows[0].id;
                // Add 10rs referral bonus to referrer's wallet
                await pool.query('UPDATE wallets SET referral_bonus = referral_bonus + 10 WHERE user_id = ?', [referrerId]);
                // Log referral bonus transaction
                await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [referrerId, 'Referral Bonus', 10]);
            }
        }

        return res.json({ message: 'Money added successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error adding money to wallet' });
    }
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Backend server running on http://localhost:${PORT}`);
    });
}

// Withdraw money from wallet main balance with TDS deduction
app.post('/api/wallet/withdraw', authenticateToken, async (req, res) => {
    const { amount, paymentInfo } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }
    if (!paymentInfo || typeof paymentInfo !== 'string' || paymentInfo.trim() === '') {
        return res.status(400).json({ message: 'Payment information is required' });
    }
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.user.username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;

        // Check user's main balance
        const [walletRows] = await pool.query('SELECT main_balance FROM wallets WHERE user_id = ?', [userId]);
        if (walletRows.length === 0) {
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const mainBalance = walletRows[0].main_balance;

        if (mainBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Calculate TDS and net amount
        const tdsAmount = amount * 0.30;
        const netAmount = amount * 0.70;

        // Deduct full amount from main balance
        await pool.query('UPDATE wallets SET main_balance = main_balance - ? WHERE user_id = ?', [amount, userId]);

        // Log withdrawal transaction with net amount
        const withdrawType = `Withdraw to ${paymentInfo}`;
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, withdrawType, netAmount]);

        // Log TDS transaction
        await pool.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [userId, 'TDS', tdsAmount]);

        return res.json({ message: 'Withdrawal request successful with TDS deduction' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error processing withdrawal' });
    }
});

async function distributePrizes(contestId, leaderboard, prizePool) {
    // Simple equal distribution among top 50% winners
    const totalUsers = leaderboard.length;
    const top50Count = Math.ceil(totalUsers * 0.5);

    // Fetch max prize_amount from contest_prizes table for the contest
    const [prizeRows] = await pool.query(
        'SELECT MAX(prize_amount) AS winning_prize FROM contest_prizes WHERE contest_id = ?',
        [contestId]
    );
    let winningPrize = 0;
    if (prizeRows.length > 0) {
        winningPrize = parseFloat(prizeRows[0].winning_prize) || 0;
    }

    // Clear existing prizes for contest
    await pool.query('DELETE FROM contest_prizes WHERE contest_id = ?', [contestId]);

    // Insert prize records
    for (let i = 0; i < top50Count; i++) {
        const user = leaderboard[i];
        await pool.query(
            'INSERT INTO contest_prizes (user_id, contest_id, prize_amount) VALUES (?, ?, ?)',
            [user.id, contestId, winningPrize]
        );
        user.prize = winningPrize;
    }

    // For others, prize is zero
    for (let i = top50Count; i < totalUsers; i++) {
        leaderboard[i].prize = 0;
    }
}

app.get('/api/leaderboard/:contestId', authenticateToken, async (req, res) => {
    const contestId = req.params.contestId;
    try {
        // Get contest end time and prize pool
        const [contestRows] = await pool.query('SELECT end_time, prize_pool FROM contests WHERE id = ?', [contestId]);
        if (contestRows.length === 0) {
            console.log('Leaderboard fetch failed: Contest not found');
            return res.status(404).json({ message: 'Contest not found' });
        }
        const contest = contestRows[0];
        const endTime = new Date(contest.end_time);
        const prizePool = parseFloat(contest.prize_pool) || 0;
        const now = new Date();
        console.log(`Contest end time: ${endTime}, Now: ${now}, Prize pool: ${prizePool}`);

        // Get users who joined the contest
        const [users] = await pool.query(
            `SELECT u.id, u.username, u.full_name
             FROM joined_contests jc
             JOIN users u ON jc.user_id = u.id
             WHERE jc.contest_id = ?`,
            [contestId]
        );
        console.log(`Users joined contest ${contestId}:`, users);

        // For each user, calculate profit from portfolio stocks using real current prices
        const leaderboard = [];
        for (const user of users) {
            // Get user's portfolio stocks
            const [portfolio] = await pool.query(
                `SELECT stock_symbol, quantity, purchase_price
                 FROM portfolios
                 WHERE user_id = ?`,
                [user.id]
            );
            console.log(`Portfolio for user ${user.username}:`, portfolio);

            let totalPurchase = 0;
            let totalCurrent = 0;
            for (const stock of portfolio) {
                totalPurchase += stock.purchase_price * stock.quantity;
                // Find current price from stocks array
                const stockData = stocks.find(s => s.symbol === stock.stock_symbol);
                const currentPrice = stockData ? stockData.price : stock.purchase_price;
                totalCurrent += currentPrice * stock.quantity;
            }
            let profit = totalCurrent - totalPurchase;

            // If contest not ended, hide profit and prize
            if (now < endTime) {
                profit = 0;
            }

            leaderboard.push({
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                profit: profit,
                prize: 0
            });
        }

        // Sort leaderboard by profit descending
        leaderboard.sort((a, b) => b.profit - a.profit);

        // Distribute prizes if contest ended and prize pool > 0
        if (now >= endTime && prizePool > 0) {
            await distributePrizes(contestId, leaderboard, prizePool);
        }

        // Assign rank and status
        const totalUsers = leaderboard.length;
        const top50Count = Math.ceil(totalUsers * 0.5);
        leaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
            entry.status = index < top50Count ? 'Winner' : '';
            entry.profit = `₹${entry.profit.toFixed(2)}`;
            entry.prize = `₹${entry.prize.toFixed(2)}`;
        });

        res.json({ leaderboard });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching leaderboard' });
    }
});

module.exports = app;
