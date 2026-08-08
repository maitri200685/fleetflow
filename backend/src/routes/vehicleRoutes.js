const express = require("express");

const router = express.Router();

const {
    getAllVehicles,
    createVehicle,
    getVehicleById,
    updateVehicle,
    deleteVehicle
} = require("../controllers/vehicleController");

const { getVehicleMaintenanceHistory } = require("../controllers/maintenanceController");
const { getVehicleFuelHistory } = require("../controllers/fuelController");
const { getVehicleExpenses } = require("../controllers/expenseController");
const { getVehicleDocuments } = require("../controllers/documentController");

// ==========================================
// VEHICLE HISTORY SUBROUTES
// ==========================================
router.get("/:id/maintenance", getVehicleMaintenanceHistory);
router.get("/:id/fuel", getVehicleFuelHistory);
router.get("/:id/expenses", getVehicleExpenses);
router.get("/:id/documents", getVehicleDocuments);

// ==========================================
// VEHICLE CRUD ROUTES
// ==========================================
router.get("/", getAllVehicles);
router.post("/", createVehicle);
router.get("/:id", getVehicleById);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

module.exports = router;