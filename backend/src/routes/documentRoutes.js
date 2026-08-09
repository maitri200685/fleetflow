const express = require("express");
const router = express.Router();
const {
    getAllDocuments,
    getDocumentById,
    getVehicleDocuments,
    getDriverDocuments,
    getComplianceSummary,
    createDocument,
    updateDocument,
    deleteDocument
} = require("../controllers/documentController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getAllDocuments);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), createDocument);
router.get("/compliance/summary", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getComplianceSummary);
router.get("/vehicle/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getVehicleDocuments);
router.get("/driver/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getDriverDocuments);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getDocumentById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateDocument);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteDocument);

module.exports = router;
