const path = require("path");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({
    path: path.resolve(__dirname, "../../.env")
});

const requiredEnv = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD"
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

if (typeof process.env.DB_PASSWORD !== "string") {
    throw new Error("DB_PASSWORD must be a string");
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("connect", () => {
    console.log("PostgreSQL connected successfully");
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err.message);
});

module.exports = pool;
