const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db');
const router = express.Router();
const { authenticateAdminToken } = require('./middleware');
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Admin login
router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    try {
        const [rows] = await pool.query('SELECT id, username, password_hash, is_admin FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const user = rows[0];
        if (!user.is_admin) {
            return res.status(403).json({ message: 'User is not an admin' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, isAdmin: true }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ message: 'Admin login successful', token });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;

// User management APIs
router.get('/admin/users', authenticateAdminToken, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, full_name, username, email, is_admin FROM users');
        res.json({ users });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

router.put('/admin/users/:id', authenticateAdminToken, async (req, res) => {
    const userId = req.params.id;
    const { fullName, username, email, isAdmin } = req.body;
    try {
        await pool.query(
            'UPDATE users SET full_name = ?, username = ?, email = ?, is_admin = ? WHERE id = ?',
            [fullName, username, email, isAdmin, userId]
        );
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Error updating user' });
    }
});

router.delete('/admin/users/:id', authenticateAdminToken, async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Error deleting user' });
    }
});

// Contest management APIs
router.get('/admin/contests', authenticateAdminToken, async (req, res) => {
    try {
        const [contests] = await pool.query('SELECT * FROM contests');
        res.json({ contests });
    } catch (err) {
        console.error('Error fetching contests:', err);
        res.status(500).json({ message: 'Error fetching contests' });
    }
});

router.post('/admin/contests', authenticateAdminToken, async (req, res) => {
    const { name, entry_fee, contest_type, start_time, end_time, prize_pool } = req.body;
    try {
        await pool.query(
            'INSERT INTO contests (name, entry_fee, contest_type, start_time, end_time, prize_pool) VALUES (?, ?, ?, ?, ?, ?)',
            [name, entry_fee, contest_type, start_time, end_time, prize_pool]
        );
        res.status(201).json({ message: 'Contest created successfully' });
    } catch (err) {
        console.error('Error creating contest:', err);
        res.status(500).json({ message: 'Error creating contest' });
    }
});

router.put('/admin/contests/:id', authenticateAdminToken, async (req, res) => {
    const contestId = req.params.id;
    const { name, entry_fee, contest_type, start_time, end_time, prize_pool } = req.body;
    try {
        await pool.query(
            'UPDATE contests SET name = ?, entry_fee = ?, contest_type = ?, start_time = ?, end_time = ?, prize_pool = ? WHERE id = ?',
            [name, entry_fee, contest_type, start_time, end_time, prize_pool, contestId]
        );
        res.json({ message: 'Contest updated successfully' });
    } catch (err) {
        console.error('Error updating contest:', err);
        res.status(500).json({ message: 'Error updating contest' });
    }
});

router.delete('/admin/contests/:id', authenticateAdminToken, async (req, res) => {
    const contestId = req.params.id;
    try {
        await pool.query('DELETE FROM contests WHERE id = ?', [contestId]);
        res.json({ message: 'Contest deleted successfully' });
    } catch (err) {
        console.error('Error deleting contest:', err);
        res.status(500).json({ message: 'Error deleting contest' });
    }
});

// Transactions overview API
router.get('/admin/transactions', authenticateAdminToken, async (req, res) => {
    try {
        const [transactions] = await pool.query('SELECT * FROM transactions ORDER BY transaction_date DESC');
        res.json({ transactions });
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ message: 'Error fetching transactions' });
    }
});

// API to get all user KYC details for admin panel
router.get('/admin/kyc-details', authenticateAdminToken, async (req, res) => {
    try {
        const [kycDetails] = await pool.query(
            `SELECT k.user_id, k.full_name, k.pancard_number, k.dob, k.phone, k.pan_card_photo, u.username, u.email
             FROM kyc k
             JOIN users u ON k.user_id = u.id`
        );
        res.json({ kycDetails });
    } catch (err) {
        console.error('Error fetching KYC details:', err);
        res.status(500).json({ message: 'Error fetching KYC details' });
    }
});

// Prizes management APIs
router.get('/admin/prizes', authenticateAdminToken, async (req, res) => {
    try {
        const [prizes] = await pool.query('SELECT * FROM contest_prizes');
        res.json({ prizes });
    } catch (err) {
        console.error('Error fetching prizes:', err);
        res.status(500).json({ message: 'Error fetching prizes' });
    }
});

router.post('/admin/prizes', authenticateAdminToken, async (req, res) => {
    let { user_id, contest_id, prize_amount } = req.body;
    if (user_id === undefined) {
        user_id = null;
    }
    try {
        await pool.query(
            'INSERT INTO contest_prizes (user_id, contest_id, prize_amount) VALUES (?, ?, ?)',
            [user_id, contest_id, prize_amount]
        );
        res.status(201).json({ message: 'Prize created successfully' });
    } catch (err) {
        console.error('Error creating prize:', err);
        res.status(500).json({ message: 'Error creating prize' });
    }
});

router.put('/admin/prizes/:id', authenticateAdminToken, async (req, res) => {
    const prizeId = req.params.id;
    let { user_id, contest_id, prize_amount } = req.body;
    if (user_id === undefined) {
        user_id = null;
    }
    try {
        await pool.query(
            'UPDATE contest_prizes SET user_id = ?, contest_id = ?, prize_amount = ? WHERE id = ?',
            [user_id, contest_id, prize_amount, prizeId]
        );
        res.json({ message: 'Prize updated successfully' });
    } catch (err) {
        console.error('Error updating prize:', err);
        res.status(500).json({ message: 'Error updating prize' });
    }
});

router.delete('/admin/prizes/:id', authenticateAdminToken, async (req, res) => {
    const prizeId = req.params.id;
    try {
        await pool.query('DELETE FROM contest_prizes WHERE id = ?', [prizeId]);
        res.json({ message: 'Prize deleted successfully' });
    } catch (err) {
        console.error('Error deleting prize:', err);
        res.status(500).json({ message: 'Error deleting prize' });
    }
});

// Reports API (basic example)
router.get('/admin/reports', authenticateAdminToken, async (req, res) => {
    try {
        // Example: total users and total contests count
        const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
        const [[{ totalContests }]] = await pool.query('SELECT COUNT(*) AS totalContests FROM contests');
        res.json({ totalUsers, totalContests });
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ message: 'Error fetching reports' });
    }
});

router.get('/admin/stocks', authenticateAdminToken, async (req, res) => {
    try {
        const [stocks] = await pool.query('SELECT id, stock_symbol, stock_name, price, volume FROM stocks');
        res.json({ stocks });
    } catch (err) {
        console.error('Error fetching stocks:', err);
        res.status(500).json({ message: 'Error fetching stocks' });
    }
});

router.post('/admin/stocks', authenticateAdminToken, async (req, res) => {
    const { stock_symbol, stock_name, price, volume } = req.body;
    if (!stock_symbol || !stock_name || price === undefined || volume === undefined) {
        return res.status(400).json({ message: 'Stock symbol, name, price, and volume are required' });
    }
    try {
        // Check if stock_symbol already exists
        const [existing] = await pool.query('SELECT id FROM stocks WHERE stock_symbol = ?', [stock_symbol]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Stock symbol already exists' });
        }
        await pool.query(
            'INSERT INTO stocks (stock_symbol, stock_name, price, volume) VALUES (?, ?, ?, ?)',
            [stock_symbol, stock_name, price, volume]
        );
        res.status(201).json({ message: 'Stock added successfully' });
    } catch (err) {
        console.error('Error adding stock:', err);
        res.status(500).json({ message: 'Error adding stock' });
    }
});

router.delete('/admin/stocks/:id', authenticateAdminToken, async (req, res) => {
    const stockId = req.params.id;
    try {
        await pool.query('DELETE FROM stocks WHERE id = ?', [stockId]);
        res.json({ message: 'Stock deleted successfully' });
    } catch (err) {
        console.error('Error deleting stock:', err);
        res.status(500).json({ message: 'Error deleting stock' });
    }
});

const moment = require('moment');

// Helper function to get date ranges for day, week, month
function getDateRanges() {
    const now = moment();
    return {
        dayStart: now.startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        dayEnd: now.endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        weekStart: now.startOf('week').format('YYYY-MM-DD HH:mm:ss'),
        weekEnd: now.endOf('week').format('YYYY-MM-DD HH:mm:ss'),
        monthStart: now.startOf('month').format('YYYY-MM-DD HH:mm:ss'),
        monthEnd: now.endOf('month').format('YYYY-MM-DD HH:mm:ss'),
    };
}

router.get('/admin/finance/summary', authenticateAdminToken, async (req, res) => {
    try {
        const { dayStart, dayEnd, weekStart, weekEnd, monthStart, monthEnd } = getDateRanges();

        // Updated transaction types based on actual data
        const queries = {
            day: `SELECT 
                    SUM(CASE WHEN type = 'GST' THEN amount ELSE 0 END) AS gst_total,
                    SUM(CASE WHEN type = 'TDS' THEN amount ELSE 0 END) AS tds_total,
                    SUM(CASE WHEN type = 'Add Money' THEN amount ELSE 0 END) AS deposit_total,
                    SUM(CASE WHEN type LIKE 'Withdraw to%' THEN amount ELSE 0 END) AS withdrawal_total
                  FROM transactions
                  WHERE transaction_date BETWEEN ? AND ?`,
            week: `SELECT 
                    SUM(CASE WHEN type = 'GST' THEN amount ELSE 0 END) AS gst_total,
                    SUM(CASE WHEN type = 'TDS' THEN amount ELSE 0 END) AS tds_total,
                    SUM(CASE WHEN type = 'Add Money' THEN amount ELSE 0 END) AS deposit_total,
                    SUM(CASE WHEN type LIKE 'Withdraw to%' THEN amount ELSE 0 END) AS withdrawal_total
                  FROM transactions
                  WHERE transaction_date BETWEEN ? AND ?`,
            month: `SELECT 
                    SUM(CASE WHEN type = 'GST' THEN amount ELSE 0 END) AS gst_total,
                    SUM(CASE WHEN type = 'TDS' THEN amount ELSE 0 END) AS tds_total,
                    SUM(CASE WHEN type = 'Add Money' THEN amount ELSE 0 END) AS deposit_total,
                    SUM(CASE WHEN type LIKE 'Withdraw to%' THEN amount ELSE 0 END) AS withdrawal_total
                  FROM transactions
                  WHERE transaction_date BETWEEN ? AND ?`,
        };

        const [[dayTotals]] = await pool.query(queries.day, [dayStart, dayEnd]);
        const [[weekTotals]] = await pool.query(queries.week, [weekStart, weekEnd]);
        const [[monthTotals]] = await pool.query(queries.month, [monthStart, monthEnd]);

        res.json({ dayTotals, weekTotals, monthTotals });
    } catch (err) {
        console.error('Error fetching finance summary:', err);
        res.status(500).json({ message: 'Error fetching finance summary' });
    }
});

// API to get user-wise GST and TDS collection
router.get('/admin/finance/user-collections', authenticateAdminToken, async (req, res) => {
    try {
        const query = `
            SELECT u.id AS user_id, u.full_name, u.username,
                SUM(CASE WHEN t.type = 'gst' THEN t.amount ELSE 0 END) AS total_gst,
                SUM(CASE WHEN t.type = 'tds' THEN t.amount ELSE 0 END) AS total_tds
            FROM users u
            LEFT JOIN transactions t ON u.id = t.user_id
            GROUP BY u.id, u.full_name, u.username
            ORDER BY total_gst DESC, total_tds DESC
        `;
        const [rows] = await pool.query(query);
        res.json({ userCollections: rows });
    } catch (err) {
        console.error('Error fetching user collections:', err);
        res.status(500).json({ message: 'Error fetching user collections' });
    }
});

router.get('/admin/finance/withdrawal-requests', authenticateAdminToken, async (req, res) => {
    try {
        const query = `
            SELECT t.id, t.user_id, u.full_name, u.username, t.amount, t.type AS method, t.transaction_date AS request_date
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.type LIKE 'Withdraw to%'
            ORDER BY t.transaction_date DESC
        `;
        const [rows] = await pool.query(query);

        // Parse payment info from type field for details
        const withdrawalRequests = rows.map(row => {
            let details = '';
            if (row.method) {
                const match = row.method.match(/^Withdraw to (.+)$/);
                if (match) {
                    details = match[1];
                }
            }
            return { ...row, details };
        });

        res.json({ withdrawalRequests });
    } catch (err) {
        console.error('Error fetching withdrawal requests:', err);
        res.status(500).json({ message: 'Error fetching withdrawal requests' });
    }
});

// Debug API to get distinct transaction types
router.get('/admin/finance/transaction-types', authenticateAdminToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT type FROM transactions');
        res.json({ transactionTypes: rows.map(row => row.type) });
    } catch (err) {
        console.error('Error fetching transaction types:', err);
        res.status(500).json({ message: 'Error fetching transaction types' });
    }
});

module.exports = router;
