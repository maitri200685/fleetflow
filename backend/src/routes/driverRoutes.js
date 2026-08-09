const express = require("express");
const router = express.Router();
const {
    getAllDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    deleteDriver
} = require("../controllers/driverController");
const { getDriverDocuments } = require("../controllers/documentController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getAllDrivers);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), createDriver);
router.get("/:id/documents", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getDriverDocuments);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getDriverById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateDriver);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteDriver);

module.exports = router;
