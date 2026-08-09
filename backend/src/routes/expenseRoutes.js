const express = require("express");
const router = express.Router();
const {
    getAllExpenses,
    getExpenseById,
    getVehicleExpenses,
    getTripExpenses,
    getExpenseSummary,
    getVehicleExpenseSummary,
    getTripExpenseSummary,
    createExpense,
    updateExpense,
    deleteExpense
} = require("../controllers/expenseController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getAllExpenses);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), createExpense);
router.get("/summary", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getExpenseSummary);
router.get("/vehicle/:id/summary", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getVehicleExpenseSummary);
router.get("/vehicle/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getVehicleExpenses);
router.get("/trip/:id/summary", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getTripExpenseSummary);
router.get("/trip/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getTripExpenses);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getExpenseById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateExpense);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteExpense);

module.exports = router;
