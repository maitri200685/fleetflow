const express = require("express");
const router = express.Router();
const {
    getAllFuelRecords,
    getFuelRecordById,
    getVehicleFuelHistory,
    createFuelRecord,
    updateFuelRecord,
    deleteFuelRecord
} = require("../controllers/fuelController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getAllFuelRecords);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), createFuelRecord);
router.get("/vehicle/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getVehicleFuelHistory);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getFuelRecordById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateFuelRecord);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteFuelRecord);

module.exports = router;
