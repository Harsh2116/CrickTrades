const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');

// Contest management APIs
router.get('/contests', authenticateAdminToken, async (req, res) => {
    try {
        const [contests] = await pool.query('SELECT * FROM contests');
        res.json({ contests });
    } catch (err) {
        console.error('Error fetching contests:', err);
        res.status(500).json({ message: 'Error fetching contests' });
    }
});

router.post('/contests', authenticateAdminToken, async (req, res) => {
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

router.put('/contests/:id', authenticateAdminToken, async (req, res) => {
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

router.delete('/contests/:id', authenticateAdminToken, async (req, res) => {
    const contestId = req.params.id;
    try {
        await pool.query('DELETE FROM contests WHERE id = ?', [contestId]);
        res.json({ message: 'Contest deleted successfully' });
    } catch (err) {
        console.error('Error deleting contest:', err);
        res.status(500).json({ message: 'Error deleting contest' });
    }
});

module.exports = router;
