const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'skcc6858_sk',
    password: process.env.DB_PASSWORD || 'Satria123',
    database: process.env.DB_NAME || 'skcc6858_sk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();