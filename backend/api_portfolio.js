const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming db.js exports a MySQL pool or similar

// GET /api/portfolio
// Returns the portfolio of the authenticated user
router.get('/portfolio', async (req, res) => {
    try {
        const userId = req.user?.id; // Assuming authentication middleware sets req.user
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const [rows] = await db.query(
            `SELECT stock_symbol, stock_name, quantity, purchase_price
             FROM portfolio
             WHERE user_id = ?`,
            [userId]
        );

        return res.json({ portfolio: rows });
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
