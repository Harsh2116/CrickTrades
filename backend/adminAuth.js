const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db');
const router = express.Router();
const { authenticateAdminToken } = require('./middleware');
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Admin login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    try {
        const [rows] = await pool.query('SELECT id, username, password_hash, is_admin FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const user = rows[0];
        if (!user.is_admin) {
            return res.status(403).json({ message: 'User is not an admin' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, isAdmin: true }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ message: 'Admin login successful', token });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
