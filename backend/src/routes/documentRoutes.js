const express = require("express");
const router = express.Router();
const {
    getAllDocuments,
    getDocumentById,
    getVehicleDocuments,
    getDriverDocuments,
    createDocument,
    updateDocument,
    deleteDocument
} = require("../controllers/documentController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getAllDocuments);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), createDocument);
router.get("/vehicle/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getVehicleDocuments);
router.get("/driver/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "DRIVER"), getDriverDocuments);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getDocumentById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateDocument);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteDocument);

module.exports = router;
