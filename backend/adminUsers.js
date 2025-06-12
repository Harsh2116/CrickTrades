const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateAdminToken } = require('./middleware');

// User management APIs
router.get('/users', authenticateAdminToken, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, full_name, username, email, is_admin FROM users');
        res.json({ users });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

router.put('/users/:id', authenticateAdminToken, async (req, res) => {
    const userId = req.params.id;
    const { fullName, username, email, isAdmin } = req.body;
    try {
        await pool.query(
            'UPDATE users SET full_name = ?, username = ?, email = ?, is_admin = ? WHERE id = ?',
            [fullName, username, email, isAdmin, userId]
        );
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Error updating user' });
    }
});

router.delete('/users/:id', authenticateAdminToken, async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Error deleting user' });
    }
});

module.exports = router;
