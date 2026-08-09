const express = require("express");
const router = express.Router();
const {
    getAllExpenses,
    getExpenseById,
    getVehicleExpenses,
    getTripExpenses,
    createExpense,
    updateExpense,
    deleteExpense
} = require("../controllers/expenseController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getAllExpenses);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), createExpense);
router.get("/vehicle/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getVehicleExpenses);
router.get("/trip/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getTripExpenses);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getExpenseById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateExpense);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteExpense);

module.exports = router;
