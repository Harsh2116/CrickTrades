const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');
const { addNewStock, stocks, broadcast } = require('./websocketServer');

// GET /api/admin/stocks - fetch all stocks from DB
router.get('/stocks', authenticateAdminToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, stock_symbol, stock_name, price, volume FROM stocks');
        res.json({ stocks: rows });
    } catch (err) {
        console.error('Error fetching stocks:', err);
        res.status(500).json({ message: 'Error fetching stocks' });
    }
});

// POST /api/admin/stocks - add new stock to DB and update in-memory stocks
router.post('/stocks', authenticateAdminToken, async (req, res) => {
    const { stock_symbol, stock_name, price, volume } = req.body;
    if (!stock_symbol || !stock_name || price === undefined || volume === undefined) {
        return res.status(400).json({ message: 'Missing required stock fields' });
    }
    try {
        // Insert into DB
        const [result] = await pool.query(
            'INSERT INTO stocks (stock_symbol, stock_name, price, volume) VALUES (?, ?, ?, ?)',
            [stock_symbol, stock_name, price, volume]
        );
        const newStock = {
            id: result.insertId,
            stock_symbol,
            stock_name,
            price,
            volume
        };
        // Update in-memory stocks array
        addNewStock(newStock);
        res.status(201).json({ message: 'Stock added successfully', stock: newStock });
    } catch (err) {
        console.error('Error adding stock:', err);
        res.status(500).json({ message: 'Error adding stock' });
    }
});

// DELETE /api/admin/stocks/:id - delete stock from DB and update in-memory stocks
router.delete('/stocks/:id', authenticateAdminToken, async (req, res) => {
    const stockId = req.params.id;
    try {
        // Delete from DB
        const [result] = await pool.query('DELETE FROM stocks WHERE id = ?', [stockId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Stock not found' });
        }
        // Remove from in-memory stocks array
        const index = stocks.findIndex(s => s.id === parseInt(stockId));
        if (index !== -1) {
            stocks.splice(index, 1);
            // Broadcast updated stocks array
            broadcast({ type: 'stock_update', stocks });
        }
        res.json({ message: 'Stock deleted successfully' });
    } catch (err) {
        console.error('Error deleting stock:', err);
        res.status(500).json({ message: 'Error deleting stock' });
    }
});

module.exports = router;
