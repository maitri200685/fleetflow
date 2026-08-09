const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/database");

// Route Modules
const authRoutes = require("./routes/authRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const driverRoutes = require("./routes/driverRoutes");
const customerRoutes = require("./routes/customerRoutes");
const tripRoutes = require("./routes/tripRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const fuelRoutes = require("./routes/fuelRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const documentRoutes = require("./routes/documentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

// CORS Configuration supporting environment variable ALLOWED_ORIGINS
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server-to-server, curl) or explicitly allowed origins
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
            callback(null, true);
        } else {
            callback(null, false);
        }
    }
};

app.use(cors(corsOptions));
app.use(express.json());

// API Routes Registration
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/fuel", fuelRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);

// Basic API health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "FleetFlow API is running"
    });
});

// Database health check
app.get("/api/health/db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS current_time");

        res.json({
            success: true,
            message: "FleetFlow backend is connected to PostgreSQL",
            database: process.env.DB_NAME,
            server_time: result.rows[0].current_time
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        const isProd = process.env.NODE_ENV === "production";
        res.status(500).json({
            success: false,
            message: "Database connection failed",
            ...(isProd ? {} : { error: error.message })
        });
    }
});

// 404 Route Not Found Middleware
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route '${req.originalUrl}' not found`
    });
});

// Centralized Global Error Handler Middleware
app.use((err, req, res, next) => {
    console.error("Unhandled Server Error:", err.stack || err.message);
    const statusCode = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === "production";
    res.status(statusCode).json({
        success: false,
        message: (statusCode >= 500 && isProd) ? "Internal Server Error" : (err.message || "Internal Server Error")
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`FleetFlow backend running on http://localhost:${PORT}`);
});