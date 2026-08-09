const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"];

// Helper: Format maintenance output record with comprehensive aliases
const formatMaintenance = (row) => {
    if (!row) return null;
    const typeVal = row.service_type || row.maintenance_type || "";
    const odoVal = row.odometer !== null && row.odometer !== undefined ? parseFloat(row.odometer) : (row.odometer_km ? parseFloat(row.odometer_km) : 0);
    const vehNum = row.vehicle_number || row.registration_number || row.vehicle_code || "N/A";

    return {
        ...row,
        service_type: typeVal,
        maintenance_type: typeVal,
        odometer: odoVal,
        odometer_km: odoVal,
        vehicle_number: vehNum,
        vehicle_code: vehNum
    };
};

// ==========================================
// GET ALL MAINTENANCE RECORDS
// ==========================================
const getAllMaintenance = async (req, res) => {
    try {
        const { status, vehicle_id } = req.query;
        let query = `
            SELECT 
                m.*,
                v.vehicle_number, v.vehicle_code, v.registration_number, v.vehicle_type, v.brand, v.model
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
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            query += ` AND m.vehicle_id = $${paramIdx++}`;
            params.push(vehicle_id);
        }

        query += " ORDER BY m.service_date DESC, m.created_at DESC";

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatMaintenance);

        return sendList(res, 200, formatted);
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
                v.vehicle_number, v.vehicle_code, v.registration_number, v.vehicle_type, v.brand, v.model
            FROM maintenance m
            JOIN vehicles v ON m.vehicle_id = v.id
            WHERE m.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Maintenance record not found");
        }

        return sendSuccess(res, 200, "Maintenance record fetched successfully", formatMaintenance(result.rows[0]));
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
            SELECT m.*, v.vehicle_number, v.vehicle_code, v.registration_number
            FROM maintenance m
            JOIN vehicles v ON m.vehicle_id = v.id
            WHERE m.vehicle_id = $1
            ORDER BY m.service_date DESC, m.created_at DESC
            `,
            [id]
        );

        const formatted = result.rows.map(formatMaintenance);
        return sendList(res, 200, formatted);
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
        service_type,
        maintenance_type,
        description,
        service_date,
        odometer,
        odometer_km,
        cost,
        service_center,
        next_service_date,
        status
    } = req.body;

    const effectiveType = service_type || maintenance_type;
    const effectiveOdometer = odometer !== undefined ? odometer : odometer_km;

    // Required Field Validations
    if (!vehicle_id) {
        return sendError(res, 400, "vehicle_id is required");
    }
    if (!isValidUuid(vehicle_id)) {
        return sendError(res, 400, "Invalid vehicle_id UUID format");
    }

    if (!effectiveType || typeof effectiveType !== "string" || !effectiveType.trim()) {
        return sendError(res, 400, "service_type / maintenance_type is required");
    }

    if (!service_date || isNaN(Date.parse(service_date))) {
        return sendError(res, 400, "valid service_date is required");
    }

    if (!description || typeof description !== "string" || !description.trim()) {
        return sendError(res, 400, "description is required");
    }

    if (cost !== undefined && cost !== null && parseFloat(cost) < 0) {
        return sendError(res, 400, "Maintenance cost cannot be negative");
    }

    if (effectiveOdometer !== undefined && effectiveOdometer !== null && parseFloat(effectiveOdometer) < 0) {
        return sendError(res, 400, "Odometer value cannot be negative");
    }

    if (next_service_date && isNaN(Date.parse(next_service_date))) {
        return sendError(res, 400, "valid next_service_date is required");
    }

    const mainStatus = status || "Scheduled";
    if (!VALID_STATUSES.includes(mainStatus)) {
        return sendError(res, 400, `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}`);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Verify vehicle exists
        const vRes = await client.query("SELECT id, status, current_mileage_km FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicle = vRes.rows[0];

        // 2. Active Trip Protection (Phase 8): Check if vehicle is currently on active trip
        const activeTrip = await client.query(
            "SELECT id FROM trips WHERE vehicle_id = $1 AND status IN ('Assigned', 'In Transit')",
            [vehicle_id]
        );
        if (activeTrip.rows.length > 0 || vehicle.status === "IN_TRANSIT") {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Vehicle is currently assigned to an active trip");
        }

        const typeVal = effectiveType.trim();
        const descVal = description.trim();
        const costVal = cost ? parseFloat(cost) : 0;
        const odoVal = effectiveOdometer ? parseFloat(effectiveOdometer) : 0;

        const result = await client.query(
            `
            INSERT INTO maintenance (
                vehicle_id,
                maintenance_type,
                service_type,
                description,
                service_date,
                odometer_km,
                odometer,
                cost,
                service_center,
                next_service_date,
                status
            )
            VALUES (
                $1, $2, $2, $3, $4, $5, $5, $6, $7, $8, $9
            )
            RETURNING *
            `,
            [
                vehicle_id,
                typeVal,
                descVal,
                service_date,
                odoVal,
                costVal,
                service_center || null,
                next_service_date || null,
                mainStatus
            ]
        );

        // Vehicle Status Synchronization (Phase 9)
        if (mainStatus === "In Progress") {
            await client.query(
                "UPDATE vehicles SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [vehicle_id]
            );
        } else if (mainStatus === "Completed" || mainStatus === "Cancelled") {
            if (vehicle.status !== "OUT_OF_SERVICE" && vehicle.status !== "INACTIVE") {
                await client.query(
                    "UPDATE vehicles SET status = 'AVAILABLE', last_service_date = COALESCE($1, last_service_date), next_service_date = COALESCE($2, next_service_date), updated_at = CURRENT_TIMESTAMP WHERE id = $3",
                    [service_date, next_service_date || null, vehicle_id]
                );
            }
        }

        await client.query("COMMIT");
        return sendSuccess(res, 201, "Maintenance record created successfully", formatMaintenance(result.rows[0]));
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
        service_type,
        maintenance_type,
        description,
        service_date,
        odometer,
        odometer_km,
        cost,
        service_center,
        next_service_date,
        status
    } = req.body;

    const effectiveType = service_type !== undefined ? service_type : maintenance_type;
    const effectiveOdometer = odometer !== undefined ? odometer : odometer_km;

    if (effectiveType !== undefined && (typeof effectiveType !== "string" || !effectiveType.trim())) {
        return sendError(res, 400, "service_type / maintenance_type is required");
    }

    if (service_date !== undefined && isNaN(Date.parse(service_date))) {
        return sendError(res, 400, "valid service_date is required");
    }

    if (description !== undefined && (typeof description !== "string" || !description.trim())) {
        return sendError(res, 400, "description is required");
    }

    if (cost !== undefined && cost !== null && parseFloat(cost) < 0) {
        return sendError(res, 400, "Maintenance cost cannot be negative");
    }

    if (effectiveOdometer !== undefined && effectiveOdometer !== null && parseFloat(effectiveOdometer) < 0) {
        return sendError(res, 400, "Odometer value cannot be negative");
    }

    if (next_service_date !== undefined && next_service_date !== null && next_service_date.trim() !== "" && isNaN(Date.parse(next_service_date))) {
        return sendError(res, 400, "valid next_service_date is required");
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
        const vehicleId = record.vehicle_id;

        // Fetch vehicle status
        const vRes = await client.query("SELECT status FROM vehicles WHERE id = $1", [vehicleId]);
        const vehicleStatus = vRes.rows.length > 0 ? vRes.rows[0].status : "AVAILABLE";

        const newStatus = status || record.status;

        // Active Trip Protection check if moving into active maintenance
        if (newStatus === "In Progress" || newStatus === "Scheduled") {
            const activeTrip = await client.query(
                "SELECT id FROM trips WHERE vehicle_id = $1 AND status IN ('Assigned', 'In Transit')",
                [vehicleId]
            );
            if (activeTrip.rows.length > 0 || vehicleStatus === "IN_TRANSIT") {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Vehicle is currently assigned to an active trip");
            }
        }

        const typeVal = effectiveType ? effectiveType.trim() : null;
        const descVal = description ? description.trim() : null;
        const costVal = cost !== undefined ? parseFloat(cost) : null;
        const odoVal = effectiveOdometer !== undefined ? parseFloat(effectiveOdometer) : null;

        const result = await client.query(
            `
            UPDATE maintenance
            SET
                maintenance_type = COALESCE($1, maintenance_type),
                service_type = COALESCE($1, service_type),
                description = COALESCE($2, description),
                service_date = COALESCE($3, service_date),
                odometer_km = COALESCE($4, odometer_km),
                odometer = COALESCE($4, odometer),
                cost = COALESCE($5, cost),
                service_center = COALESCE($6, service_center),
                next_service_date = COALESCE($7, next_service_date),
                status = COALESCE($8, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
            `,
            [
                typeVal,
                descVal,
                service_date || null,
                odoVal,
                costVal,
                service_center || null,
                next_service_date || null,
                status || null,
                id
            ]
        );

        // Vehicle Status Synchronization (Phase 9)
        if (newStatus === "In Progress") {
            await client.query("UPDATE vehicles SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicleId]);
        } else if ((record.status === "In Progress" || record.status === "Scheduled") && (newStatus === "Completed" || newStatus === "Cancelled")) {
            if (vehicleStatus !== "OUT_OF_SERVICE" && vehicleStatus !== "INACTIVE") {
                await client.query("UPDATE vehicles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicleId]);
            }
        }

        await client.query("COMMIT");
        return sendSuccess(res, 200, "Maintenance record updated successfully", formatMaintenance(result.rows[0]));
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
    const { id } = req.params;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid UUID format for maintenance ID");
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

        const deleteRes = await client.query(
            "DELETE FROM maintenance WHERE id = $1 RETURNING *",
            [id]
        );

        // Restore vehicle status if record was in progress
        if (record.status === "In Progress" || record.status === "Scheduled") {
            const vRes = await client.query("SELECT status FROM vehicles WHERE id = $1", [record.vehicle_id]);
            const vehicleStatus = vRes.rows.length > 0 ? vRes.rows[0].status : "AVAILABLE";
            if (vehicleStatus === "MAINTENANCE") {
                await client.query("UPDATE vehicles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [record.vehicle_id]);
            }
        }

        await client.query("COMMIT");
        return sendSuccess(res, 200, "Maintenance record deleted successfully", formatMaintenance(deleteRes.rows[0]));
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error deleting maintenance record:", error.message);
        return sendError(res, 500, "Failed to delete maintenance record", error);
    } finally {
        client.release();
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
