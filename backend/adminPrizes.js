const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');

// Prizes management APIs
router.get('/prizes', authenticateAdminToken, async (req, res) => {
    try {
        const [prizes] = await pool.query('SELECT * FROM contest_prizes');
        res.json({ prizes });
    } catch (err) {
        console.error('Error fetching prizes:', err);
        res.status(500).json({ message: 'Error fetching prizes' });
    }
});

router.post('/prizes', authenticateAdminToken, async (req, res) => {
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

router.put('/prizes/:id', authenticateAdminToken, async (req, res) => {
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

router.delete('/prizes/:id', authenticateAdminToken, async (req, res) => {
    const prizeId = req.params.id;
    try {
        await pool.query('DELETE FROM contest_prizes WHERE id = ?', [prizeId]);
        res.json({ message: 'Prize deleted successfully' });
    } catch (err) {
        console.error('Error deleting prize:', err);
        res.status(500).json({ message: 'Error deleting prize' });
    }
});

module.exports = router;
