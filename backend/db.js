const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || '34.131.110.114',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Harsh@1981',
    database: process.env.DB_NAME || 'cricktrades1', // ⬅ lowercase that name matches my database
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
