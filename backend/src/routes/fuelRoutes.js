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

router.get("/", getAllFuelRecords);
router.post("/", createFuelRecord);
router.get("/vehicle/:id", getVehicleFuelHistory); // Convenient direct endpoint
router.get("/:id", getFuelRecordById);
router.put("/:id", updateFuelRecord);
router.delete("/:id", deleteFuelRecord);

module.exports = router;
