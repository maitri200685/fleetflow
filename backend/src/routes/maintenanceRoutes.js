const express = require("express");
const router = express.Router();
const {
    getAllMaintenance,
    getMaintenanceById,
    getVehicleMaintenanceHistory,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance
} = require("../controllers/maintenanceController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "MAINTENANCE_STAFF"), getAllMaintenance);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "MAINTENANCE_STAFF"), createMaintenance);
router.get("/vehicle/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "MAINTENANCE_STAFF"), getVehicleMaintenanceHistory);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "MAINTENANCE_STAFF"), getMaintenanceById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "MAINTENANCE_STAFF"), updateMaintenance);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteMaintenance);

module.exports = router;
