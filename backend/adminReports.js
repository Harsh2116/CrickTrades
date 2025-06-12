const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');

// Reports API (basic example)
router.get('/reports', authenticateAdminToken, async (req, res) => {
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

router.get('/stocks', authenticateAdminToken, async (req, res) => {
    try {
        const [stocks] = await pool.query('SELECT id, stock_symbol, stock_name, price, volume FROM stocks');
        res.json({ stocks });
    } catch (err) {
        console.error('Error fetching stocks:', err);
        res.status(500).json({ message: 'Error fetching stocks' });
    }
});

router.post('/stocks', authenticateAdminToken, async (req, res) => {
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

router.delete('/stocks/:id', authenticateAdminToken, async (req, res) => {
    const stockId = req.params.id;
    try {
        await pool.query('DELETE FROM stocks WHERE id = ?', [stockId]);
        res.json({ message: 'Stock deleted successfully' });
    } catch (err) {
        console.error('Error deleting stock:', err);
        res.status(500).json({ message: 'Error deleting stock' });
    }
});

module.exports = router;
