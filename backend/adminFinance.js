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

module.exports = router;

