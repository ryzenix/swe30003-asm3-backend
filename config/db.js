// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hieu',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swe30003',
    port: process.env.DB_PORT || 5432,
});

module.exports = pool;