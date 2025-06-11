const express = require('express');
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');
const router = express.Router();

// Helper function to update user's main balance
async function addPrizeToUser(userId, amount) {
    await pool.query(
        'UPDATE wallets SET main_balance = main_balance + ? WHERE user_id = ?',
        [amount, userId]
    );
}

// API to distribute prizes to top 50% users in a contest
router.post('/admin/contests/:contestId/distribute-prizes', authenticateAdminToken, async (req, res) => {
    const contestId = req.params.contestId;
    const userRanks = req.body.userRanks; // Expecting array of { user_id, rank }

    if (!Array.isArray(userRanks)) {
        return res.status(400).json({ message: 'userRanks must be an array' });
    }

    try {
        // Get total participants count
        const [[{ totalParticipants }]] = await pool.query(
            'SELECT COUNT(*) AS totalParticipants FROM joined_contests WHERE contest_id = ?',
            [contestId]
        );

        if (totalParticipants === 0) {
            return res.status(400).json({ message: 'No participants found for this contest' });
        }

        // Calculate top 50% threshold
        const topThreshold = Math.ceil(totalParticipants / 2);

        // Get winning prize amount for the contest
        const [[prizeRow]] = await pool.query(
            'SELECT MAX(prize_amount) AS winningPrize FROM contest_prizes WHERE contest_id = ?',
            [contestId]
        );

        if (!prizeRow || !prizeRow.winningPrize) {
            return res.status(400).json({ message: 'Winning prize not found for this contest' });
        }

        const winningPrize = prizeRow.winningPrize;

        // Filter users in top 50%
        const winners = userRanks.filter(ur => ur.rank <= topThreshold);

        // Update main balance for each winner
        for (const winner of winners) {
            await addPrizeToUser(winner.user_id, winningPrize);
        }

        res.json({ message: `Prizes distributed to top ${topThreshold} participants.` });
    } catch (err) {
        console.error('Error distributing prizes:', err);
        res.status(500).json({ message: 'Error distributing prizes' });
    }
});

// New API to get contest-winning users with details
router.get('/admin/contest-winners', authenticateAdminToken, async (req, res) => {
    try {
        // Query to get users who won contests with their winning amounts and paid status
        const [rows] = await pool.query(
            `SELECT u.id AS user_id, u.full_name, u.username, cp.contest_id, cp.prize_amount AS winning_amount, cp.paid
             FROM contest_prizes cp
             JOIN users u ON cp.user_id = u.id
             ORDER BY cp.contest_id DESC`
        );
        res.json({ winners: rows });
    } catch (err) {
        console.error('Error fetching contest winners:', err);
        res.status(500).json({ message: 'Error fetching contest winners' });
    }
});

// New API to add money to user's main balance manually
router.post('/admin/users/:userId/add-money', authenticateAdminToken, async (req, res) => {
    const userId = req.params.userId;
    const { amount, contestId } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }
    if (!contestId) {
        return res.status(400).json({ message: 'Missing contestId' });
    }

    try {
        await addPrizeToUser(userId, amount);

        // Mark the prize as paid for the user and contest
        await pool.query(
            'UPDATE contest_prizes SET paid = TRUE WHERE user_id = ? AND contest_id = ?',
            [userId, contestId]
        );

        // Insert a transaction record with type 'contest winner'
        await pool.query(
            'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
            [userId, 'contest winner', amount]
        );

        res.json({ message: `Added ${amount} to user ${userId}'s main balance.` });
    } catch (err) {
        console.error('Error adding money to user:', err);
        res.status(500).json({ message: 'Error adding money to user' });
    }
});

module.exports = router;
