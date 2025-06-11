const express = require('express');
const pool = require('./db');
const router = express.Router();

// Get winning prize for all contests
router.get('/contest-winning-prizes', async (req, res) => {
    try {
        // Query to get max prize_amount per contest from contest_prizes table
        const [rows] = await pool.query(
            `SELECT contest_id, MAX(prize_amount) AS winning_prize
             FROM contest_prizes
             GROUP BY contest_id`
        );

        // Convert to object keyed by contest_id for easy lookup
        const prizesMap = {};
        rows.forEach(row => {
            prizesMap[row.contest_id] = row.winning_prize;
        });

        res.json({ winningPrizes: prizesMap });
    } catch (err) {
        console.error('Error fetching contest winning prizes:', err);
        res.status(500).json({ message: 'Error fetching contest winning prizes' });
    }
});

module.exports = router;
