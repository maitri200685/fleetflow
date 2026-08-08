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

router.get("/", getAllExpenses);
router.post("/", createExpense);
router.get("/vehicle/:id", getVehicleExpenses);
router.get("/trip/:id", getTripExpenses);
router.get("/:id", getExpenseById);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
