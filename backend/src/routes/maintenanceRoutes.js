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

router.get("/", getAllMaintenance);
router.post("/", createMaintenance);
router.get("/vehicle/:id", getVehicleMaintenanceHistory); // Convenient direct endpoint
router.get("/:id", getMaintenanceById);
router.put("/:id", updateMaintenance);
router.delete("/:id", deleteMaintenance);

module.exports = router;
