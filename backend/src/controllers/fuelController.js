const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

// ==========================================
// GET ALL FUEL RECORDS
// ==========================================
const getAllFuelRecords = async (req, res) => {
    try {
        const { vehicle_id } = req.query;
        let query = `
            SELECT 
                f.*,
                v.vehicle_code, v.registration_number, v.vehicle_type
            FROM fuel_records f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID");
            query += " AND f.vehicle_id = $1";
            params.push(vehicle_id);
        }

        query += " ORDER BY f.fuel_date DESC, f.created_at DESC";

        const result = await pool.query(query, params);
        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching fuel records:", error.message);
        return sendError(res, 500, "Failed to fetch fuel records", error);
    }
};

// ==========================================
// GET FUEL RECORD BY ID
// ==========================================
const getFuelRecordById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for fuel record ID");
        }

        const result = await pool.query(
            `
            SELECT 
                f.*,
                v.vehicle_code, v.registration_number
            FROM fuel_records f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE f.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Fuel record not found");
        }

        return sendSuccess(res, 200, "Fuel record fetched successfully", result.rows[0]);
    } catch (error) {
        console.error("Error fetching fuel record:", error.message);
        return sendError(res, 500, "Failed to fetch fuel record", error);
    }
};

// ==========================================
// GET VEHICLE FUEL HISTORY
// ==========================================
const getVehicleFuelHistory = async (req, res) => {
    try {
        const { id } = req.params; // vehicle_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for vehicle ID");
        }

        const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [id]);
        if (vRes.rows.length === 0) {
            return sendError(res, 404, "Vehicle not found");
        }

        const result = await pool.query(
            `
            SELECT * FROM fuel_records
            WHERE vehicle_id = $1
            ORDER BY fuel_date DESC, created_at DESC
            `,
            [id]
        );

        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching vehicle fuel history:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle fuel history", error);
    }
};

// ==========================================
// CREATE FUEL RECORD
// ==========================================
const createFuelRecord = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            vehicle_id,
            fuel_date,
            fuel_type,
            quantity_liters,
            price_per_liter,
            total_cost,
            odometer_km,
            station_name
        } = req.body;

        // Validation
        if (!vehicle_id || !quantity_liters || price_per_liter === undefined || odometer_km === undefined) {
            client.release();
            return sendError(
                res,
                400,
                "vehicle_id, quantity_liters, price_per_liter, and odometer_km are required"
            );
        }

        if (!isValidUuid(vehicle_id)) {
            client.release();
            return sendError(res, 400, "Invalid vehicle_id UUID format");
        }

        const qty = parseFloat(quantity_liters);
        const price = parseFloat(price_per_liter);
        const odo = parseFloat(odometer_km);

        if (qty <= 0) {
            client.release();
            return sendError(res, 400, "quantity_liters must be greater than 0");
        }
        if (price < 0) {
            client.release();
            return sendError(res, 400, "price_per_liter cannot be negative");
        }
        if (odo < 0) {
            client.release();
            return sendError(res, 400, "odometer_km cannot be negative");
        }

        // Automatic backend total_cost calculation
        const calculatedTotalCost = total_cost !== undefined && total_cost !== null
            ? parseFloat(total_cost)
            : Math.round(qty * price * 100) / 100;

        await client.query("BEGIN");

        // Verify vehicle exists
        const vRes = await client.query("SELECT id, fuel_type, current_mileage_km FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            client.release();
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicle = vRes.rows[0];

        const fDate = fuel_date || new Date().toISOString().split('T')[0];
        const fType = fuel_type || vehicle.fuel_type || "DIESEL";

        const result = await client.query(
            `
            INSERT INTO fuel_records (
                vehicle_id,
                fuel_date,
                fuel_type,
                quantity_liters,
                price_per_liter,
                total_cost,
                odometer_km,
                station_name
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            )
            RETURNING *
            `,
            [
                vehicle_id,
                fDate,
                fType,
                qty,
                price,
                calculatedTotalCost,
                odo,
                station_name || null
            ]
        );

        // Update vehicle current_mileage_km if higher
        if (odo > parseFloat(vehicle.current_mileage_km || 0)) {
            await client.query(
                "UPDATE vehicles SET current_mileage_km = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [odo, vehicle_id]
            );
        }

        await client.query("COMMIT");
        client.release();

        return sendSuccess(res, 201, "Fuel record created successfully", result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        console.error("Error creating fuel record:", error.message);
        return sendError(res, 500, "Failed to create fuel record", error);
    }
};

// ==========================================
// UPDATE FUEL RECORD
// ==========================================
const updateFuelRecord = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for fuel record ID");
        }

        const {
            fuel_date,
            fuel_type,
            quantity_liters,
            price_per_liter,
            total_cost,
            odometer_km,
            station_name
        } = req.body;

        const existing = await pool.query("SELECT * FROM fuel_records WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Fuel record not found");
        }
        const record = existing.rows[0];

        const qty = quantity_liters !== undefined ? parseFloat(quantity_liters) : parseFloat(record.quantity_liters);
        const price = price_per_liter !== undefined ? parseFloat(price_per_liter) : parseFloat(record.price_per_liter);

        if (qty <= 0) return sendError(res, 400, "quantity_liters must be greater than 0");
        if (price < 0) return sendError(res, 400, "price_per_liter cannot be negative");

        const calculatedTotalCost = total_cost !== undefined
            ? parseFloat(total_cost)
            : Math.round(qty * price * 100) / 100;

        const result = await pool.query(
            `
            UPDATE fuel_records
            SET
                fuel_date = COALESCE($1, fuel_date),
                fuel_type = COALESCE($2, fuel_type),
                quantity_liters = COALESCE($3, quantity_liters),
                price_per_liter = COALESCE($4, price_per_liter),
                total_cost = $5,
                odometer_km = COALESCE($6, odometer_km),
                station_name = COALESCE($7, station_name),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
            `,
            [
                fuel_date,
                fuel_type,
                quantity_liters,
                price_per_liter,
                calculatedTotalCost,
                odometer_km,
                station_name,
                id
            ]
        );

        return sendSuccess(res, 200, "Fuel record updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating fuel record:", error.message);
        return sendError(res, 500, "Failed to update fuel record", error);
    }
};

// ==========================================
// DELETE FUEL RECORD
// ==========================================
const deleteFuelRecord = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for fuel record ID");
        }

        const result = await pool.query(
            "DELETE FROM fuel_records WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Fuel record not found");
        }

        return sendSuccess(res, 200, "Fuel record deleted successfully", result.rows[0]);
    } catch (error) {
        console.error("Error deleting fuel record:", error.message);
        return sendError(res, 500, "Failed to delete fuel record", error);
    }
};

module.exports = {
    getAllFuelRecords,
    getFuelRecordById,
    getVehicleFuelHistory,
    createFuelRecord,
    updateFuelRecord,
    deleteFuelRecord
};
