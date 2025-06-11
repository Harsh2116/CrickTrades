const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');

const router = express.Router();

// POST /api/forgot-password/request
// Accepts email, returns security question if email exists
router.post('/forgot-password/request', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }
    try {
        const [rows] = await pool.query('SELECT security_question FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Email not found.' });
        }
        return res.json({ securityQuestion: rows[0].security_question });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching security question.' });
    }
});

// POST /api/forgot-password/verify
// Accepts email and security question answer, verifies correctness
router.post('/forgot-password/verify', async (req, res) => {
    const { email, securityAnswer } = req.body;
    if (!email || !securityAnswer) {
        return res.status(400).json({ message: 'Email and security answer are required.' });
    }
    try {
        const [rows] = await pool.query('SELECT security_question FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Email not found.' });
        }
        const storedAnswer = rows[0].security_question;
        if (storedAnswer !== securityAnswer) {
            return res.status(401).json({ message: 'Security answer does not match.' });
        }
        return res.json({ message: 'Security answer verified.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error verifying security answer.' });
    }
});

// POST /api/forgot-password/reset
// Accepts email and new password, updates password in database
router.post('/forgot-password/reset', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email and new password are required.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Email not found.' });
        }
        return res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating password.' });
    }
});

module.exports = router;
