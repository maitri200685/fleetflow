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

router.get("/", getAllTrips);
router.post("/", createTrip);
router.get("/:id", getTripById);
router.put("/:id", updateTrip);
router.put("/:id/assign", assignTrip);
router.put("/:id/status", updateTripStatus);
router.delete("/:id", deleteTrip);

module.exports = router;
