const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"];

// ==========================================
// GET ALL MAINTENANCE RECORDS
// ==========================================
const getAllMaintenance = async (req, res) => {
    try {
        const { status, vehicle_id } = req.query;
        let query = `
            SELECT 
                m.*,
                v.vehicle_code, v.registration_number, v.vehicle_type, v.brand, v.model
            FROM maintenance m
            JOIN vehicles v ON m.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];
        let paramIdx = 1;

        if (status) {
            query += ` AND m.status = $${paramIdx++}`;
            params.push(status);
        }
        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID");
            query += ` AND m.vehicle_id = $${paramIdx++}`;
            params.push(vehicle_id);
        }

        query += " ORDER BY m.service_date DESC, m.created_at DESC";

        const result = await pool.query(query, params);
        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching maintenance records:", error.message);
        return sendError(res, 500, "Failed to fetch maintenance records", error);
    }
};

// ==========================================
// GET MAINTENANCE BY ID
// ==========================================
const getMaintenanceById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for maintenance ID");
        }

        const result = await pool.query(
            `
            SELECT 
                m.*,
                v.vehicle_code, v.registration_number, v.vehicle_type
            FROM maintenance m
            JOIN vehicles v ON m.vehicle_id = v.id
            WHERE m.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Maintenance record not found");
        }

        return sendSuccess(res, 200, "Maintenance record fetched successfully", result.rows[0]);
    } catch (error) {
        console.error("Error fetching maintenance record:", error.message);
        return sendError(res, 500, "Failed to fetch maintenance record", error);
    }
};

// ==========================================
// GET VEHICLE MAINTENANCE HISTORY
// ==========================================
const getVehicleMaintenanceHistory = async (req, res) => {
    try {
        const { id } = req.params; // vehicle_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for vehicle ID");
        }

        // Verify vehicle exists
        const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [id]);
        if (vRes.rows.length === 0) {
            return sendError(res, 404, "Vehicle not found");
        }

        const result = await pool.query(
            `
            SELECT * FROM maintenance
            WHERE vehicle_id = $1
            ORDER BY service_date DESC, created_at DESC
            `,
            [id]
        );

        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching vehicle maintenance history:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle maintenance history", error);
    }
};

// ==========================================
// CREATE MAINTENANCE RECORD
// ==========================================
const createMaintenance = async (req, res) => {
    const {
        vehicle_id,
        maintenance_type,
        description,
        service_date,
        odometer_km,
        cost,
        service_center,
        next_service_date,
        status
    } = req.body;

    // Validation
    if (!vehicle_id || !maintenance_type || !service_date) {
        return sendError(res, 400, "vehicle_id, maintenance_type, and service_date are required");
    }

    if (!isValidUuid(vehicle_id)) {
        return sendError(res, 400, "Invalid vehicle_id UUID format");
    }

    if (cost !== undefined && parseFloat(cost) < 0) {
        return sendError(res, 400, "Maintenance cost cannot be negative");
    }

    if (odometer_km !== undefined && parseFloat(odometer_km) < 0) {
        return sendError(res, 400, "Odometer value cannot be negative");
    }

    const mainStatus = status || "Scheduled";

    if (!VALID_STATUSES.includes(mainStatus)) {
        return sendError(res, 400, `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}`);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Verify vehicle exists
        const vRes = await client.query("SELECT id, status, current_mileage_km FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Vehicle not found");
        }

        const result = await client.query(
            `
            INSERT INTO maintenance (
                vehicle_id,
                maintenance_type,
                description,
                service_date,
                odometer_km,
                cost,
                service_center,
                next_service_date,
                status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
            RETURNING *
            `,
            [
                vehicle_id,
                maintenance_type,
                description || null,
                service_date,
                odometer_km || 0,
                cost || 0,
                service_center || null,
                next_service_date || null,
                mainStatus
            ]
        );

        // Update vehicle status if maintenance is in progress
        if (mainStatus === "In Progress") {
            await client.query(
                "UPDATE vehicles SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [vehicle_id]
            );
        }

        // Update last_service_date & next_service_date on vehicle if completed
        if (mainStatus === "Completed") {
            await client.query(
                `
                UPDATE vehicles
                SET
                    last_service_date = $1,
                    next_service_date = COALESCE($2, next_service_date),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                `,
                [service_date, next_service_date || null, vehicle_id]
            );
        }

        await client.query("COMMIT");
        return sendSuccess(res, 201, "Maintenance record created successfully", result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating maintenance record:", error.message);
        return sendError(res, 500, "Failed to create maintenance record", error);
    } finally {
        client.release();
    }
};

// ==========================================
// UPDATE MAINTENANCE RECORD
// ==========================================
const updateMaintenance = async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid UUID format for maintenance ID");
    }

    const {
        maintenance_type,
        description,
        service_date,
        odometer_km,
        cost,
        service_center,
        next_service_date,
        status
    } = req.body;

    if (cost !== undefined && parseFloat(cost) < 0) {
        return sendError(res, 400, "Maintenance cost cannot be negative");
    }

    if (odometer_km !== undefined && parseFloat(odometer_km) < 0) {
        return sendError(res, 400, "Odometer value cannot be negative");
    }

    if (status && !VALID_STATUSES.includes(status)) {
        return sendError(res, 400, `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}`);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query("SELECT * FROM maintenance WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Maintenance record not found");
        }
        const record = existing.rows[0];

        const result = await client.query(
            `
            UPDATE maintenance
            SET
                maintenance_type = COALESCE($1, maintenance_type),
                description = COALESCE($2, description),
                service_date = COALESCE($3, service_date),
                odometer_km = COALESCE($4, odometer_km),
                cost = COALESCE($5, cost),
                service_center = COALESCE($6, service_center),
                next_service_date = COALESCE($7, next_service_date),
                status = COALESCE($8, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
            `,
            [
                maintenance_type,
                description,
                service_date,
                odometer_km,
                cost,
                service_center,
                next_service_date,
                status,
                id
            ]
        );

        const newStatus = status || record.status;
        const vehicleId = record.vehicle_id;

        if (newStatus === "In Progress") {
            await client.query("UPDATE vehicles SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicleId]);
        } else if (record.status === "In Progress" && (newStatus === "Completed" || newStatus === "Cancelled")) {
            await client.query("UPDATE vehicles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicleId]);
        }

        await client.query("COMMIT");
        return sendSuccess(res, 200, "Maintenance record updated successfully", result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating maintenance record:", error.message);
        return sendError(res, 500, "Failed to update maintenance record", error);
    } finally {
        client.release();
    }
};

// ==========================================
// DELETE MAINTENANCE RECORD
// ==========================================
const deleteMaintenance = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for maintenance ID");
        }

        const result = await pool.query(
            "DELETE FROM maintenance WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Maintenance record not found");
        }

        return sendSuccess(res, 200, "Maintenance record deleted successfully", result.rows[0]);
    } catch (error) {
        console.error("Error deleting maintenance record:", error.message);
        return sendError(res, 500, "Failed to delete maintenance record", error);
    }
};

module.exports = {
    getAllMaintenance,
    getMaintenanceById,
    getVehicleMaintenanceHistory,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance
};
