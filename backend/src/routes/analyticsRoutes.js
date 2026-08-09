const express = require("express");
const router = express.Router();
const {
    getOverviewAnalytics,
    getTripAnalytics,
    getFinancialAnalytics,
    getFuelAnalytics,
    getMaintenanceAnalytics,
    getUtilizationAnalytics,
    getReportData
} = require("../controllers/analyticsController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/overview", authenticateToken, getOverviewAnalytics);
router.get("/trips", authenticateToken, getTripAnalytics);
router.get("/financial", authenticateToken, getFinancialAnalytics);
router.get("/fuel", authenticateToken, getFuelAnalytics);
router.get("/maintenance", authenticateToken, getMaintenanceAnalytics);
router.get("/utilization", authenticateToken, getUtilizationAnalytics);
router.get("/report", authenticateToken, getReportData);

module.exports = router;
