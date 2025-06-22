const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');
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

router.get('/finance/summary', authenticateAdminToken, async (req, res) => {
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
router.get('/finance/user-collections', authenticateAdminToken, async (req, res) => {
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

router.get('/finance/withdrawal-requests', authenticateAdminToken, async (req, res) => {
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
router.get('/finance/transaction-types', authenticateAdminToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT type FROM transactions');
        res.json({ transactionTypes: rows.map(row => row.type) });
    } catch (err) {
        console.error('Error fetching transaction types:', err);
        res.status(500).json({ message: 'Error fetching transaction types' });
    }
});

// API endpoint to get all transactions for admin panel
router.get('/transactions', authenticateAdminToken, async (req, res) => {
    try {
        const query = `
            SELECT id, user_id, type, amount, transaction_date
            FROM transactions
            ORDER BY transaction_date DESC
            LIMIT 100
        `;
        const [rows] = await pool.query(query);
        res.json({ transactions: rows });
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ message: 'Error fetching transactions' });
    }
});

// Add Money Requests - List pending requests
router.get('/finance/add-money-requests', authenticateAdminToken, async (req, res) => {
    try {
        const query = `
            SELECT r.id, r.user_id, u.full_name, u.username, r.amount, r.status, r.request_date
            FROM add_money_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.status = 'pending'
            ORDER BY r.request_date DESC
        `;
        const [rows] = await pool.query(query);
        res.json({ addMoneyRequests: rows });
    } catch (err) {
        console.error('Error fetching add money requests:', err);
        res.status(500).json({ message: 'Error fetching add money requests' });
    }
});

// Approve Add Money Request
router.post('/finance/approve-add-money', authenticateAdminToken, async (req, res) => {
    const { requestId } = req.body;
    const adminId = req.admin.id;
    if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
    }
    try {
        // Get the request details
        const [requests] = await pool.query('SELECT * FROM add_money_requests WHERE id = ? AND status = "pending"', [requestId]);
        if (requests.length === 0) {
            return res.status(404).json({ message: 'Add money request not found or already processed' });
        }
        const request = requests[0];

        // Update user's wallet balance
        await pool.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [request.amount, request.user_id]);

        // Mark request as approved
        await pool.query('UPDATE add_money_requests SET status = "approved", processed_date = NOW(), processed_by = ? WHERE id = ?', [adminId, requestId]);

        // Insert transaction record
        await pool.query('INSERT INTO transactions (user_id, type, amount, transaction_date) VALUES (?, "Add Money", ?, NOW())', [request.user_id, request.amount]);

        res.json({ message: 'Add money request approved and wallet updated' });
    } catch (err) {
        console.error('Error approving add money request:', err);
        res.status(500).json({ message: 'Error approving add money request' });
    }
});

// Reject Add Money Request
router.post('/finance/reject-add-money', authenticateAdminToken, async (req, res) => {
    const { requestId } = req.body;
    const adminId = req.admin.id;
    if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
    }
    try {
        // Check if request exists and is pending
        const [requests] = await pool.query('SELECT * FROM add_money_requests WHERE id = ? AND status = "pending"', [requestId]);
        if (requests.length === 0) {
            return res.status(404).json({ message: 'Add money request not found or already processed' });
        }

        // Mark request as rejected
        await pool.query('UPDATE add_money_requests SET status = "rejected", processed_date = NOW(), processed_by = ? WHERE id = ?', [adminId, requestId]);

        res.json({ message: 'Add money request rejected' });
    } catch (err) {
        console.error('Error rejecting add money request:', err);
        res.status(500).json({ message: 'Error rejecting add money request' });
    }
});

module.exports = router;

