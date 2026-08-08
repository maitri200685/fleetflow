const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_NOTIFICATION_TYPES = [
    "Insurance Expiry",
    "PUC Expiry",
    "License Expiry",
    "Maintenance Due",
    "Trip Delayed",
    "Vehicle Unavailable",
    "Driver Unavailable",
    "General"
];

// ==========================================
// GET ALL NOTIFICATIONS
// ==========================================
const getAllNotifications = async (req, res) => {
    try {
        const { unread, is_read, user_id, notification_type } = req.query;
        let query = "SELECT * FROM notifications WHERE 1=1";
        const params = [];
        let paramIdx = 1;

        if (unread === "true" || is_read === "false") {
            query += ` AND is_read = false`;
        } else if (is_read === "true") {
            query += ` AND is_read = true`;
        }

        if (user_id) {
            if (!isValidUuid(user_id)) return sendError(res, 400, "Invalid user_id UUID format");
            query += ` AND user_id = $${paramIdx++}`;
            params.push(user_id);
        }

        if (notification_type) {
            query += ` AND notification_type = $${paramIdx++}`;
            params.push(notification_type);
        }

        query += " ORDER BY created_at DESC";

        const result = await pool.query(query, params);
        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching notifications:", error.message);
        return sendError(res, 500, "Failed to fetch notifications", error);
    }
};

// ==========================================
// GET NOTIFICATION BY ID
// ==========================================
const getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for notification ID");
        }

        const result = await pool.query(
            "SELECT * FROM notifications WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }

        return sendSuccess(res, 200, "Notification fetched successfully", result.rows[0]);
    } catch (error) {
        console.error("Error fetching notification:", error.message);
        return sendError(res, 500, "Failed to fetch notification", error);
    }
};

// ==========================================
// CREATE NOTIFICATION
// ==========================================
const createNotification = async (req, res) => {
    try {
        const {
            user_id,
            notification_type,
            title,
            message,
            related_entity_type,
            related_entity_id,
            is_read
        } = req.body;

        if (!notification_type || !title || !message) {
            return sendError(res, 400, "notification_type, title, and message are required");
        }

        if (!VALID_NOTIFICATION_TYPES.includes(notification_type)) {
            return sendError(res, 400, `Invalid notification_type. Allowed values: ${VALID_NOTIFICATION_TYPES.join(", ")}`);
        }

        if (user_id) {
            if (!isValidUuid(user_id)) return sendError(res, 400, "Invalid user_id UUID format");
            const uRes = await pool.query("SELECT id FROM users WHERE id = $1", [user_id]);
            if (uRes.rows.length === 0) return sendError(res, 404, "User not found");
        }

        if (related_entity_id && !isValidUuid(related_entity_id)) {
            return sendError(res, 400, "Invalid related_entity_id UUID format");
        }

        const result = await pool.query(
            `
            INSERT INTO notifications (
                user_id,
                notification_type,
                title,
                message,
                related_entity_type,
                related_entity_id,
                is_read
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                user_id || null,
                notification_type,
                title,
                message,
                related_entity_type || null,
                related_entity_id || null,
                is_read || false
            ]
        );

        return sendSuccess(res, 201, "Notification created successfully", result.rows[0]);
    } catch (error) {
        console.error("Error creating notification:", error.message);
        return sendError(res, 500, "Failed to create notification", error);
    }
};

// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for notification ID");
        }

        const result = await pool.query(
            `
            UPDATE notifications
            SET is_read = true
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }

        return sendSuccess(res, 200, "Notification marked as read", result.rows[0]);
    } catch (error) {
        console.error("Error marking notification as read:", error.message);
        return sendError(res, 500, "Failed to mark notification as read", error);
    }
};

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================
const markAllAsRead = async (req, res) => {
    try {
        const { user_id } = req.body || {};
        let query = "UPDATE notifications SET is_read = true WHERE is_read = false";
        const params = [];

        if (user_id) {
            if (!isValidUuid(user_id)) return sendError(res, 400, "Invalid user_id UUID format");
            query += " AND user_id = $1";
            params.push(user_id);
        }

        query += " RETURNING *";

        const result = await pool.query(query, params);
        return sendSuccess(res, 200, `${result.rowCount} notification(s) marked as read`, { count: result.rowCount });
    } catch (error) {
        console.error("Error marking all notifications as read:", error.message);
        return sendError(res, 500, "Failed to mark all notifications as read", error);
    }
};

// ==========================================
// UPDATE NOTIFICATION
// ==========================================
const updateNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for notification ID");
        }

        const {
            notification_type,
            title,
            message,
            related_entity_type,
            related_entity_id,
            is_read
        } = req.body;

        if (notification_type && !VALID_NOTIFICATION_TYPES.includes(notification_type)) {
            return sendError(res, 400, `Invalid notification_type. Allowed values: ${VALID_NOTIFICATION_TYPES.join(", ")}`);
        }

        const existing = await pool.query("SELECT id FROM notifications WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }

        const result = await pool.query(
            `
            UPDATE notifications
            SET
                notification_type = COALESCE($1, notification_type),
                title = COALESCE($2, title),
                message = COALESCE($3, message),
                related_entity_type = COALESCE($4, related_entity_type),
                related_entity_id = COALESCE($5, related_entity_id),
                is_read = COALESCE($6, is_read)
            WHERE id = $7
            RETURNING *
            `,
            [
                notification_type,
                title,
                message,
                related_entity_type,
                related_entity_id,
                is_read,
                id
            ]
        );

        return sendSuccess(res, 200, "Notification updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating notification:", error.message);
        return sendError(res, 500, "Failed to update notification", error);
    }
};

// ==========================================
// DELETE NOTIFICATION
// ==========================================
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for notification ID");
        }

        const result = await pool.query(
            "DELETE FROM notifications WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }

        return sendSuccess(res, 200, "Notification deleted successfully", result.rows[0]);
    } catch (error) {
        console.error("Error deleting notification:", error.message);
        return sendError(res, 500, "Failed to delete notification", error);
    }
};

module.exports = {
    getAllNotifications,
    getNotificationById,
    createNotification,
    markAsRead,
    markAllAsRead,
    updateNotification,
    deleteNotification
};
