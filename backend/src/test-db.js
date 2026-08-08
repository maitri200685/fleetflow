const pool = require("./config/database");

async function testDatabaseConnection() {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log("Database connection successful!");
        console.log("PostgreSQL server time:", result.rows[0].now);
    } catch (error) {
        console.error("Database connection failed!");
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

testDatabaseConnection();