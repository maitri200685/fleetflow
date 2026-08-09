const express = require("express");
const router = express.Router();
const {
    getAllTrips,
    getTripById,
    createTrip,
    assignTrip,
    updateTripStatus,
    updateTrip,
    deleteTrip
} = require("../controllers/tripController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER", "CUSTOMER"), getAllTrips);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), createTrip);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER", "CUSTOMER"), getTripById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateTrip);
router.put("/:id/assign", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), assignTrip);
router.put("/:id/status", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), updateTripStatus);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteTrip);

module.exports = router;
