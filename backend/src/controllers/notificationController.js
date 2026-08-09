const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_SEVERITIES = ["critical", "warning", "info", "success"];

const VALID_NOTIFICATION_TYPES = [
    "DOCUMENT_EXPIRED",
    "DOCUMENT_EXPIRING",
    "LICENSE_EXPIRED",
    "LICENSE_EXPIRING",
    "MAINTENANCE_DUE",
    "VEHICLE_MAINTENANCE",
    "UPCOMING_TRIP",
    "TRIP_STATUS",
    "FLEET_WARNING",
    "Insurance Expiry",
    "PUC Expiry",
    "License Expiry",
    "Maintenance Due",
    "Trip Delayed",
    "Vehicle Unavailable",
    "Driver Unavailable",
    "General"
];

// Helper: Format notification object output with aliases
const formatNotification = (row) => {
    if (!row) return null;
    const typeVal = row.type || row.notification_type || "General";
    const entityType = row.entity_type || row.related_entity_type || null;
    const entityId = row.entity_id || row.related_entity_id || null;
    const sev = row.severity || "info";

    return {
        ...row,
        type: typeVal,
        notification_type: typeVal,
        entity_type: entityType,
        related_entity_type: entityType,
        entity_id: entityId,
        related_entity_id: entityId,
        severity: sev
    };
};

/**
 * Service Helper: Generates & synchronizes real fleet notifications from database
 */
const generateFleetNotifications = async (userId) => {
    if (!userId || !isValidUuid(userId)) return;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 2);

        // 1. Scan Documents for Expired & Expiring Soon
        const docRes = await pool.query(`
            SELECT d.*, v.vehicle_number, v.vehicle_code, dr.name as driver_name
            FROM documents d
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            LEFT JOIN drivers dr ON d.driver_id = dr.id
        `);

        for (const doc of docRes.rows) {
            if (!doc.expiry_date) continue;
            const exp = new Date(doc.expiry_date);
            exp.setHours(0, 0, 0, 0);

            const ownerName = doc.vehicle_number || doc.vehicle_code || doc.driver_name || "Resource";

            if (exp < today) {
                // Deduplicate check
                const dup = await pool.query(
                    "SELECT id FROM notifications WHERE user_id = $1 AND (type = 'DOCUMENT_EXPIRED' OR notification_type = 'DOCUMENT_EXPIRED') AND (entity_id = $2 OR related_entity_id = $2)",
                    [userId, doc.id]
                );
                if (dup.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO notifications (user_id, type, notification_type, title, message, severity, entity_type, related_entity_type, entity_id, related_entity_id, is_read)
                         VALUES ($1, 'DOCUMENT_EXPIRED', 'DOCUMENT_EXPIRED', $2, $3, 'critical', 'Document', 'Document', $4, $4, false)`,
                        [userId, `Document Expired (${doc.document_type})`, `${doc.document_type} #${doc.document_number} for ${ownerName} expired on ${doc.expiry_date.toISOString().split('T')[0]}.`, doc.id]
                    );
                }
            } else if (exp <= thirtyDaysLater) {
                const dup = await pool.query(
                    "SELECT id FROM notifications WHERE user_id = $1 AND (type = 'DOCUMENT_EXPIRING' OR notification_type = 'DOCUMENT_EXPIRING') AND (entity_id = $2 OR related_entity_id = $2)",
                    [userId, doc.id]
                );
                if (dup.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO notifications (user_id, type, notification_type, title, message, severity, entity_type, related_entity_type, entity_id, related_entity_id, is_read)
                         VALUES ($1, 'DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRING', $2, $3, 'warning', 'Document', 'Document', $4, $4, false)`,
                        [userId, `Document Expiring Soon (${doc.document_type})`, `${doc.document_type} #${doc.document_number} for ${ownerName} expires on ${doc.expiry_date.toISOString().split('T')[0]}.`, doc.id]
                    );
                }
            }
        }

        // 2. Scan Drivers for Expired & Expiring Licenses
        const drvRes = await pool.query("SELECT * FROM drivers");
        for (const drv of drvRes.rows) {
            if (!drv.license_expiry) continue;
            const exp = new Date(drv.license_expiry);
            exp.setHours(0, 0, 0, 0);

            if (exp < today) {
                const dup = await pool.query(
                    "SELECT id FROM notifications WHERE user_id = $1 AND (type = 'LICENSE_EXPIRED' OR notification_type = 'LICENSE_EXPIRED') AND (entity_id = $2 OR related_entity_id = $2)",
                    [userId, drv.id]
                );
                if (dup.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO notifications (user_id, type, notification_type, title, message, severity, entity_type, related_entity_type, entity_id, related_entity_id, is_read)
                         VALUES ($1, 'LICENSE_EXPIRED', 'LICENSE_EXPIRED', $2, $3, 'critical', 'Driver', 'Driver', $4, $4, false)`,
                        [userId, `Driver License Expired`, `Driver ${drv.name || drv.full_name}'s license #${drv.license_number} expired on ${drv.license_expiry}.`, drv.id]
                    );
                }
            } else if (exp <= thirtyDaysLater) {
                const dup = await pool.query(
                    "SELECT id FROM notifications WHERE user_id = $1 AND (type = 'LICENSE_EXPIRING' OR notification_type = 'LICENSE_EXPIRING') AND (entity_id = $2 OR related_entity_id = $2)",
                    [userId, drv.id]
                );
                if (dup.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO notifications (user_id, type, notification_type, title, message, severity, entity_type, related_entity_type, entity_id, related_entity_id, is_read)
                         VALUES ($1, 'LICENSE_EXPIRING', 'LICENSE_EXPIRING', $2, $3, 'warning', 'Driver', 'Driver', $4, $4, false)`,
                        [userId, `Driver License Expiring Soon`, `Driver ${drv.name || drv.full_name}'s license #${drv.license_number} expires on ${drv.license_expiry}.`, drv.id]
                    );
                }
            }
        }

        // 3. Scan Maintenance Records for Due / Pending Maintenance
        const maintRes = await pool.query(`
            SELECT m.*, v.vehicle_number, v.vehicle_code
            FROM maintenance m
            LEFT JOIN vehicles v ON m.vehicle_id = v.id
            WHERE m.status IN ('Scheduled', 'In Progress')
        `);
        for (const m of maintRes.rows) {
            const vehNum = m.vehicle_number || m.vehicle_code || "Vehicle";
            const mType = m.status === "In Progress" ? "VEHICLE_MAINTENANCE" : "MAINTENANCE_DUE";
            const title = m.status === "In Progress" ? `Vehicle Under Maintenance` : `Scheduled Maintenance Due`;
            const msg = `Vehicle ${vehNum} has ${m.service_type || m.maintenance_type || 'service'} maintenance (${m.status}).`;

            const dup = await pool.query(
                "SELECT id FROM notifications WHERE user_id = $1 AND (type = $2 OR notification_type = $2) AND (entity_id = $3 OR related_entity_id = $3)",
                [userId, mType, m.id]
            );
            if (dup.rows.length === 0) {
                await pool.query(
                    `INSERT INTO notifications (user_id, type, notification_type, title, message, severity, entity_type, related_entity_type, entity_id, related_entity_id, is_read)
                     VALUES ($1, $2, $2, $3, $4, 'warning', 'Maintenance', 'Maintenance', $5, $5, false)`,
                    [userId, mType, title, msg, m.id]
                );
            }
        }

        // 4. Scan Upcoming Trips (Starting within next 24-48 hours)
        const tripRes = await pool.query(`
            SELECT t.*, v.vehicle_number, c.company_name, d.name as driver_name
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE LOWER(t.status) IN ('assigned', 'scheduled')
        `);
        for (const t of tripRes.rows) {
            const tripNum = t.trip_number || t.trip_code || "Trip";
            const startTime = t.start_datetime || t.scheduled_start;
            if (startTime) {
                const st = new Date(startTime);
                if (st >= today && st <= tomorrow) {
                    const dup = await pool.query(
                        "SELECT id FROM notifications WHERE user_id = $1 AND (type = 'UPCOMING_TRIP' OR notification_type = 'UPCOMING_TRIP') AND (entity_id = $2 OR related_entity_id = $2)",
                        [userId, t.id]
                    );
                    if (dup.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO notifications (user_id, type, notification_type, title, message, severity, entity_type, related_entity_type, entity_id, related_entity_id, is_read)
                             VALUES ($1, 'UPCOMING_TRIP', 'UPCOMING_TRIP', $2, $3, 'info', 'Trip', 'Trip', $4, $4, false)`,
                            [userId, `Upcoming Trip ${tripNum}`, `Trip ${tripNum} to ${t.destination} is scheduled to start on ${st.toLocaleDateString("en-GB")}.`, t.id]
                        );
                    }
                }
            }
        }

    } catch (err) {
        console.error("Error generating fleet notifications:", err.message);
    }
};

// ==========================================
// GET ALL NOTIFICATIONS
// ==========================================
const getAllNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { unread, is_read, type, notification_type, severity, page = 1, limit = 50 } = req.query;

        // Auto sync fleet alerts for authenticated user
        if (userId && isValidUuid(userId)) {
            await generateFleetNotifications(userId);
        }

        let query = "SELECT * FROM notifications WHERE 1=1";
        const params = [];
        let paramIdx = 1;

        if (userId && isValidUuid(userId)) {
            query += ` AND (user_id = $${paramIdx++} OR user_id IS NULL)`;
            params.push(userId);
        }

        if (unread === "true" || is_read === "false") {
            query += ` AND is_read = false`;
        } else if (is_read === "true") {
            query += ` AND is_read = true`;
        }

        const effectiveType = type || notification_type;
        if (effectiveType) {
            query += ` AND (LOWER(type) = LOWER($${paramIdx}) OR LOWER(notification_type) = LOWER($${paramIdx}))`;
            paramIdx++;
            params.push(effectiveType);
        }

        if (severity) {
            query += ` AND LOWER(severity) = LOWER($${paramIdx++})`;
            params.push(severity);
        }

        query += " ORDER BY created_at DESC";

        // Pagination
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offsetNum = (pageNum - 1) * limitNum;

        query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(limitNum, offsetNum);

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatNotification);

        return sendList(res, 200, formatted);
    } catch (error) {
        console.error("Error fetching notifications:", error.message);
        return sendError(res, 500, "Failed to fetch notifications", error);
    }
};

// ==========================================
// GET UNREAD NOTIFICATIONS
// ==========================================
const getUnreadNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (userId && isValidUuid(userId)) {
            await generateFleetNotifications(userId);
        }

        let query = "SELECT * FROM notifications WHERE is_read = false";
        const params = [];

        if (userId && isValidUuid(userId)) {
            query += " AND (user_id = $1 OR user_id IS NULL)";
            params.push(userId);
        }

        query += " ORDER BY created_at DESC";

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatNotification);

        return res.status(200).json({
            success: true,
            message: "Unread notifications fetched successfully",
            count: formatted.length,
            unread_count: formatted.length,
            data: formatted
        });
    } catch (error) {
        console.error("Error fetching unread notifications:", error.message);
        return sendError(res, 500, "Failed to fetch unread notifications", error);
    }
};

// ==========================================
// GET NOTIFICATION BY ID
// ==========================================
const getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

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

        const notif = result.rows[0];

        // User isolation check
        if (userId && isValidUuid(userId) && notif.user_id && notif.user_id !== userId && req.user?.role !== "ADMIN") {
            return sendError(res, 403, "Access denied to notification");
        }

        return sendSuccess(res, 200, "Notification fetched successfully", formatNotification(notif));
    } catch (error) {
        console.error("Error fetching notification:", error.message);
        return sendError(res, 500, "Failed to fetch notification", error);
    }
};

// ==========================================
// GENERATE / SYNCHRONIZE NOTIFICATIONS ENDPOINT
// ==========================================
const generateNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, "Authentication required");

        if (isValidUuid(userId)) {
            await generateFleetNotifications(userId);
        }

        let query = "SELECT * FROM notifications WHERE 1=1";
        const params = [];

        if (isValidUuid(userId)) {
            query += " AND (user_id = $1 OR user_id IS NULL)";
            params.push(userId);
        }

        query += " ORDER BY created_at DESC";

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatNotification);

        return sendSuccess(res, 200, "Fleet notifications generated and synchronized successfully", formatted);
    } catch (error) {
        console.error("Error generating notifications endpoint:", error.message);
        return sendError(res, 500, "Failed to generate notifications", error);
    }
};

// ==========================================
// CREATE NOTIFICATION (MANUAL)
// ==========================================
const createNotification = async (req, res) => {
    try {
        const {
            user_id,
            type,
            notification_type,
            title,
            message,
            severity,
            entity_type,
            related_entity_type,
            entity_id,
            related_entity_id,
            is_read
        } = req.body;

        const effectiveType = type || notification_type;
        const effectiveEntityType = entity_type || related_entity_type;
        const effectiveEntityId = entity_id || related_entity_id;
        const effectiveSeverity = severity && VALID_SEVERITIES.includes(severity) ? severity : "info";

        if (!effectiveType || !title || !message) {
            return sendError(res, 400, "notification_type / type, title, and message are required");
        }

        // Ownership: use req.user.id if user_id not explicitly provided
        let targetUserId = user_id || req.user?.id;
        if (targetUserId && !isValidUuid(targetUserId)) {
            targetUserId = null;
        }

        if (targetUserId) {
            const uRes = await pool.query("SELECT id FROM users WHERE id = $1", [targetUserId]);
            if (uRes.rows.length === 0) return sendError(res, 404, "User not found");
        }

        if (effectiveEntityId && !isValidUuid(effectiveEntityId)) {
            return sendError(res, 400, "Invalid entity_id UUID format");
        }

        const result = await pool.query(
            `
            INSERT INTO notifications (
                user_id,
                type,
                notification_type,
                title,
                message,
                severity,
                entity_type,
                related_entity_type,
                entity_id,
                related_entity_id,
                is_read
            )
            VALUES ($1, $2, $2, $3, $4, $5, $6, $6, $7, $7, $8)
            RETURNING *
            `,
            [
                targetUserId || null,
                effectiveType,
                title.trim(),
                message.trim(),
                effectiveSeverity,
                effectiveEntityType || null,
                effectiveEntityId || null,
                is_read || false
            ]
        );

        return sendSuccess(res, 201, "Notification created successfully", formatNotification(result.rows[0]));
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
        const userId = req.user?.id;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for notification ID");
        }

        const existing = await pool.query("SELECT * FROM notifications WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }
        const notif = existing.rows[0];

        // User isolation check
        if (userId && isValidUuid(userId) && notif.user_id && notif.user_id !== userId && req.user?.role !== "ADMIN") {
            return sendError(res, 403, "Access denied to notification");
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

        return sendSuccess(res, 200, "Notification marked as read", formatNotification(result.rows[0]));
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
        const userId = req.user?.id;

        let query = "UPDATE notifications SET is_read = true WHERE is_read = false";
        const params = [];

        if (userId && isValidUuid(userId)) {
            query += " AND (user_id = $1 OR user_id IS NULL)";
            params.push(userId);
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

        const existing = await pool.query("SELECT * FROM notifications WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }

        const {
            type,
            notification_type,
            title,
            message,
            severity,
            entity_type,
            entity_id,
            is_read
        } = req.body;

        const effectiveType = type || notification_type;

        const result = await pool.query(
            `
            UPDATE notifications
            SET
                type = COALESCE($1, type),
                notification_type = COALESCE($1, notification_type),
                title = COALESCE($2, title),
                message = COALESCE($3, message),
                severity = COALESCE($4, severity),
                entity_type = COALESCE($5, entity_type),
                related_entity_type = COALESCE($5, related_entity_type),
                entity_id = COALESCE($6, entity_id),
                related_entity_id = COALESCE($6, related_entity_id),
                is_read = COALESCE($7, is_read)
            WHERE id = $8
            RETURNING *
            `,
            [
                effectiveType,
                title,
                message,
                severity,
                entity_type,
                entity_id,
                is_read,
                id
            ]
        );

        return sendSuccess(res, 200, "Notification updated successfully", formatNotification(result.rows[0]));
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
        const userId = req.user?.id;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for notification ID");
        }

        const existing = await pool.query("SELECT * FROM notifications WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Notification not found");
        }
        const notif = existing.rows[0];

        // User isolation check
        if (userId && isValidUuid(userId) && notif.user_id && notif.user_id !== userId && req.user?.role !== "ADMIN") {
            return sendError(res, 403, "Access denied to notification");
        }

        const result = await pool.query(
            "DELETE FROM notifications WHERE id = $1 RETURNING *",
            [id]
        );

        return sendSuccess(res, 200, "Notification deleted successfully", formatNotification(result.rows[0]));
    } catch (error) {
        console.error("Error deleting notification:", error.message);
        return sendError(res, 500, "Failed to delete notification", error);
    }
};

module.exports = {
    getAllNotifications,
    getUnreadNotifications,
    getNotificationById,
    generateNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    updateNotification,
    deleteNotification
};
