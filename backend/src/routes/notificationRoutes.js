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

router.get("/", getAllNotifications);
router.post("/", createNotification);
router.put("/read-all", markAllAsRead);
router.get("/:id", getNotificationById);
router.put("/:id/read", markAsRead);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

module.exports = router;
