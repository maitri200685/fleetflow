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

router.get("/", getAllDocuments);
router.post("/", createDocument);
router.get("/vehicle/:id", getVehicleDocuments);
router.get("/driver/:id", getDriverDocuments);
router.get("/:id", getDocumentById);
router.put("/:id", updateDocument);
router.delete("/:id", deleteDocument);

module.exports = router;
