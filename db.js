const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'guntur.iixcp.rumahweb.net',  // ← PAKE INI!
    user: 'skcc6858_sk',
    password: 'Satria123',
    database: 'skcc6858_sk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();
