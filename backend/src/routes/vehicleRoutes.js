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

const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// ==========================================
// VEHICLE HISTORY SUBROUTES
// ==========================================
router.get("/:id/maintenance", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "MAINTENANCE_STAFF"), getVehicleMaintenanceHistory);
router.get("/:id/fuel", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getVehicleFuelHistory);
router.get("/:id/expenses", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getVehicleExpenses);
router.get("/:id/documents", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getVehicleDocuments);

// ==========================================
// VEHICLE CRUD ROUTES
// ==========================================
router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER", "MAINTENANCE_STAFF"), getAllVehicles);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), createVehicle);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER", "MAINTENANCE_STAFF"), getVehicleById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateVehicle);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteVehicle);

module.exports = router;