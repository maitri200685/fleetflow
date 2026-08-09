const express = require("express");
const router = express.Router();
const {
    getAllNotifications,
    getNotificationById,
    createNotification,
    markAsRead,
    markAllAsRead,
    updateNotification,
    deleteNotification
} = require("../controllers/notificationController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, getAllNotifications);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), createNotification);
router.put("/read-all", authenticateToken, markAllAsRead);
router.get("/:id", authenticateToken, getNotificationById);
router.put("/:id/read", authenticateToken, markAsRead);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateNotification);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteNotification);

module.exports = router;
