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

router.get("/", getAllDrivers);
router.post("/", createDriver);
router.get("/:id/documents", getDriverDocuments);
router.get("/:id", getDriverById);
router.put("/:id", updateDriver);
router.delete("/:id", deleteDriver);

module.exports = router;
