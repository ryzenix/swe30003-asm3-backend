const { Pool } = require('pg');
require('dotenv').config();

console.log(process.env.NODE_ENV);

class Database {
    constructor() {
        this.pool = new Pool({
            connectionString: "postgresql://hieu@localhost:5432/swe30003",
            // If in development mode, do not use SSL
            ...(process.env.NODE_ENV === 'development'
                ? { connectionString: "postgresql://hieu@localhost:5432/swe30003", ssl: false }
                : { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    async query(text, params) {
        return await this.pool.query(text, params);
    }

    async getClient() {
        return await this.pool.connect();
    }

    async close() {
        await this.pool.end();
    }

    getPool() {
        return this.pool;
    }
}

module.exports = Database; 