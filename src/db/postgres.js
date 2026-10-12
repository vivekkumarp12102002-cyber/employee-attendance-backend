const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// ========================================
// POSTGRESQL CONNECT
// ========================================

pool.on("connect", () => {
    console.log("PostgreSQL connected");
});

// ========================================
// POSTGRESQL ERROR
// ========================================

pool.on("error", (error) => {
    console.error("PostgreSQL error:", error);
});

module.exports = pool;