const express = require('express');
const router = express.Router();
const pool = require('./db');

router.post('/request-add-money', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }
        // Get userId from authenticated user if not provided
        let uid = userId;
        if (!uid && req.user && req.user.id) {
            uid = req.user.id;
        }
        if (!uid) {
            return res.status(400).json({ message: 'User ID is required' });
        }
        // Insert new add money request with status 'pending'
        await pool.query(
            'INSERT INTO add_money_requests (user_id, amount, status, request_date) VALUES (?, ?, "pending", NOW())',
            [uid, amount]
        );
        res.json({ message: 'Add money request submitted successfully' });
    } catch (err) {
        console.error('Error handling add money request:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
