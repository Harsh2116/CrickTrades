const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');
const moment = require('moment');

// Helper function to get date ranges based on query params or defaults
function getDateRange(query) {
    let startDate, endDate;
    if (query.startDate && query.endDate) {
        startDate = query.startDate + ' 00:00:00';
        endDate = query.endDate + ' 23:59:59';
    } else {
        // Default to last 7 days
        endDate = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        startDate = moment().subtract(6, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    }
    return { startDate, endDate };
}

// 1. Dashboard Overview
router.get('/dashboard-overview', authenticateAdminToken, async (req, res) => {
    try {
        const { startDate, endDate } = getDateRange(req.query);

        const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
        const [[{ activeUsersToday }]] = await pool.query(
            'SELECT COUNT(DISTINCT user_id) AS activeUsersToday FROM joined_contests WHERE joined_at BETWEEN ? AND ?',
            [startDate, endDate]
        );
        const [[{ ongoingContests }]] = await pool.query(
            'SELECT COUNT(*) AS ongoingContests FROM contests WHERE start_time <= NOW() AND end_time >= NOW()'
        );
        const [[{ totalContests }]] = await pool.query('SELECT COUNT(*) AS totalContests FROM contests');
        const [[{ totalCreditsIssued }]] = await pool.query(
            "SELECT COALESCE(SUM(amount),0) AS totalCreditsIssued FROM transactions WHERE type = 'credit_issued'"
        );
        const [[{ totalEntryFees }]] = await pool.query(
            "SELECT COALESCE(SUM(amount),0) AS totalEntryFees FROM transactions WHERE type = 'entry_fee'"
        );
        const [[{ totalPayouts }]] = await pool.query(
            "SELECT COALESCE(SUM(amount),0) AS totalPayouts FROM transactions WHERE type = 'prize_payout'"
        );
        const platformProfit = totalEntryFees - totalPayouts;
        const [[{ last24hTrades }]] = await pool.query(
            'SELECT COUNT(*) AS last24hTrades FROM trades WHERE trade_time >= NOW() - INTERVAL 1 DAY'
        );
        const [[mostTradedPlayerRow]] = await pool.query(
            `SELECT player_name FROM trades WHERE trade_time >= NOW() - INTERVAL 1 DAY GROUP BY player_name ORDER BY COUNT(*) DESC LIMIT 1`
        );
        const mostTradedPlayer = mostTradedPlayerRow ? mostTradedPlayerRow.player_name : null;

        res.json({
            totalUsers,
            activeUsersToday,
            ongoingContests,
            totalContests,
            totalCreditsIssued,
            totalEntryFees,
            totalPayouts,
            platformProfit,
            last24hTrades,
            mostTradedPlayer,
        });
    } catch (err) {
        console.error('Error fetching dashboard overview:', err);
        res.status(500).json({ message: 'Error fetching dashboard overview' });
    }
});

// 3. Contest Reports
router.get('/contest-reports', authenticateAdminToken, async (req, res) => {
    try {
        const { startDate, endDate } = getDateRange(req.query);

        // Contest-wise statistics
        const [contestStats] = await pool.query(
            `SELECT c.id, c.name, c.entry_fee, 
                COUNT(DISTINCT jc.user_id) AS total_participants,
                (c.entry_fee * COUNT(DISTINCT jc.user_id)) AS total_entry_credits,
                COALESCE(SUM(cp.prize_amount), 0) AS total_payouts,
                ((c.entry_fee * COUNT(DISTINCT jc.user_id)) - COALESCE(SUM(cp.prize_amount), 0)) AS profit_loss
             FROM contests c
             LEFT JOIN joined_contests jc ON c.id = jc.contest_id
             LEFT JOIN contest_prizes cp ON c.id = cp.contest_id
             WHERE c.start_time BETWEEN ? AND ?
             GROUP BY c.id, c.name, c.entry_fee`,
            [startDate, endDate]
        );

        // Completed contests with filters
        const [completedContests] = await pool.query(
            `SELECT id, name, start_time, end_time, entry_fee
             FROM contests
             WHERE end_time < NOW()
             ORDER BY end_time DESC
             LIMIT 50`
        );

        res.json({
            contestStats,
            completedContests,
        });
    } catch (err) {
        console.error('Error fetching contest reports:', err);
        res.status(500).json({ message: 'Error fetching contest reports' });
    }
});

module.exports = router;
