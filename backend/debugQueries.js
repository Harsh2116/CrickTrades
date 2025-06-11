const express = require('express');
const pool = require('./db');

const router = express.Router();

// Debug endpoint to get joined contests for a user by username
router.get('/debug/joined-contests/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userRows[0].id;
        const [joinedContests] = await pool.query(
            `SELECT jc.id, c.name, c.entry_fee, c.contest_type, c.start_time, c.end_time, jc.joined_at
             FROM joined_contests jc
             JOIN contests c ON jc.contest_id = c.id
             WHERE jc.user_id = ?`,
            [userId]
        );
        return res.json({ joinedContests });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching joined contests' });
    }
});

// Debug endpoint to get portfolio for a user by username
router.get('/debug/portfolio/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
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

module.exports = router;
