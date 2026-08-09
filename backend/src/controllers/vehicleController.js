const pool = require("../config/database");
const { isValidUuid, sendError } = require("../utils/validation");

// ==========================================
// GET ALL VEHICLES
// ==========================================
const getAllVehicles = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM vehicles
            ORDER BY created_at DESC
        `);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Error fetching vehicles:", error.message);
        return sendError(res, 500, "Failed to fetch vehicles", error);
    }
};


// ==========================================
// CREATE NEW VEHICLE
// ==========================================
const createVehicle = async (req, res) => {
    try {
        const {
            vehicle_code,
            registration_number,
            vehicle_type,
            brand,
            model,
            manufacturing_year,
            capacity_kg,
            fuel_type,
            current_mileage_km,
            insurance_expiry,
            pollution_expiry,
            last_service_date,
            next_service_date
        } = req.body;

        // Validate required fields
        if (
            !vehicle_code ||
            !registration_number ||
            !vehicle_type ||
            !capacity_kg ||
            !fuel_type
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "vehicle_code, registration_number, vehicle_type, capacity_kg and fuel_type are required"
            });
        }

        // Insert vehicle into PostgreSQL
        const result = await pool.query(
            `
            INSERT INTO vehicles (
                vehicle_code,
                registration_number,
                vehicle_type,
                brand,
                model,
                manufacturing_year,
                capacity_kg,
                fuel_type,
                current_mileage_km,
                insurance_expiry,
                pollution_expiry,
                last_service_date,
                next_service_date
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13
            )
            RETURNING *
            `,
            [
                vehicle_code,
                registration_number,
                vehicle_type,
                brand || null,
                model || null,
                manufacturing_year || null,
                capacity_kg,
                fuel_type,
                current_mileage_km || 0,
                insurance_expiry || null,
                pollution_expiry || null,
                last_service_date || null,
                next_service_date || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Vehicle created successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error creating vehicle:", error.message);

        // Duplicate vehicle code or registration number
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "Vehicle code or registration number already exists"
            });
        }

        return sendError(res, 500, "Failed to create vehicle", error);
    }
};


// ==========================================
// GET VEHICLE BY ID
// ==========================================
const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid UUID format for vehicle ID"
            });
        }

        const result = await pool.query(
            `
            SELECT *
            FROM vehicles
            WHERE id = $1
            `,
            [id]
        );

        // Vehicle not found
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error fetching vehicle:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle", error);
    }
};


// ==========================================
// UPDATE VEHICLE
// ==========================================
const updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid UUID format for vehicle ID"
            });
        }

        const {
            vehicle_code,
            registration_number,
            vehicle_type,
            brand,
            model,
            manufacturing_year,
            capacity_kg,
            fuel_type,
            current_mileage_km,
            insurance_expiry,
            pollution_expiry,
            last_service_date,
            next_service_date,
            status
        } = req.body;

        // Check if vehicle exists
        const existingVehicle = await pool.query(
            `
            SELECT id
            FROM vehicles
            WHERE id = $1
            `,
            [id]
        );

        if (existingVehicle.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        // Update vehicle
        const result = await pool.query(
            `
            UPDATE vehicles
            SET
                vehicle_code = COALESCE($1, vehicle_code),
                registration_number = COALESCE($2, registration_number),
                vehicle_type = COALESCE($3, vehicle_type),
                brand = COALESCE($4, brand),
                model = COALESCE($5, model),
                manufacturing_year = COALESCE($6, manufacturing_year),
                capacity_kg = COALESCE($7, capacity_kg),
                fuel_type = COALESCE($8, fuel_type),
                current_mileage_km = COALESCE($9, current_mileage_km),
                insurance_expiry = COALESCE($10, insurance_expiry),
                pollution_expiry = COALESCE($11, pollution_expiry),
                last_service_date = COALESCE($12, last_service_date),
                next_service_date = COALESCE($13, next_service_date),
                status = COALESCE($14, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $15
            RETURNING *
            `,
            [
                vehicle_code,
                registration_number,
                vehicle_type,
                brand,
                model,
                manufacturing_year,
                capacity_kg,
                fuel_type,
                current_mileage_km,
                insurance_expiry,
                pollution_expiry,
                last_service_date,
                next_service_date,
                status,
                id
            ]
        );

        res.status(200).json({
            success: true,
            message: "Vehicle updated successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error updating vehicle:", error.message);

        // Duplicate vehicle code or registration number
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "Vehicle code or registration number already exists"
            });
        }

        return sendError(res, 500, "Failed to update vehicle", error);
    }
};


// ==========================================
// DELETE VEHICLE
// ==========================================
const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid UUID format for vehicle ID"
            });
        }

        // Check if vehicle exists
        const existingVehicle = await pool.query(
            `
            SELECT *
            FROM vehicles
            WHERE id = $1
            `,
            [id]
        );

        if (existingVehicle.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        // Delete vehicle
        const result = await pool.query(
            `
            DELETE FROM vehicles
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        res.status(200).json({
            success: true,
            message: "Vehicle deleted successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error deleting vehicle:", error.message);
        return sendError(res, 500, "Failed to delete vehicle", error);
    }
};


// ==========================================
// EXPORT CONTROLLERS
// ==========================================
module.exports = {
    getAllVehicles,
    createVehicle,
    getVehicleById,
    updateVehicle,
    deleteVehicle
};