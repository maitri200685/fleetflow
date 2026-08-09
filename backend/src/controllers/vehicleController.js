const pool = require("../config/database");
const { isValidUuid, sendError } = require("../utils/validation");

const VALID_STATUSES = [
    "Available", "In Transit", "Maintenance", "Inactive",
    "AVAILABLE", "IN_TRANSIT", "MAINTENANCE", "OUT_OF_SERVICE"
];

// Helper: Normalize status string to database storage format
const toDbStatus = (status) => {
    if (!status) return "AVAILABLE";
    const upper = status.toUpperCase();
    if (upper === "AVAILABLE" || status === "Available") return "AVAILABLE";
    if (upper === "IN_TRANSIT" || status === "In Transit" || upper === "IN TRANSIT") return "IN_TRANSIT";
    if (upper === "MAINTENANCE" || status === "Maintenance") return "MAINTENANCE";
    if (upper === "OUT_OF_SERVICE" || status === "Inactive" || upper === "INACTIVE") return "OUT_OF_SERVICE";
    return status;
};

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

        // Format rows for frontend and API compatibility
        const formattedData = result.rows.map((row) => ({
            ...row,
            vehicle_number: row.vehicle_number || row.registration_number || row.vehicle_code,
            capacity: row.capacity !== null && row.capacity !== undefined ? parseFloat(row.capacity) : (row.capacity_kg ? parseFloat(row.capacity_kg) : 0),
            status: row.status
        }));

        res.status(200).json({
            success: true,
            count: formattedData.length,
            data: formattedData
        });

    } catch (error) {
        console.error("Error fetching vehicles:", error.message);
        return sendError(res, 500, "Failed to fetch vehicles", error);
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

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        const row = result.rows[0];
        const formatted = {
            ...row,
            vehicle_number: row.vehicle_number || row.registration_number || row.vehicle_code,
            capacity: row.capacity !== null && row.capacity !== undefined ? parseFloat(row.capacity) : (row.capacity_kg ? parseFloat(row.capacity_kg) : 0),
            status: row.status
        };

        res.status(200).json({
            success: true,
            data: formatted
        });

    } catch (error) {
        console.error("Error fetching vehicle:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle", error);
    }
};


// ==========================================
// CREATE NEW VEHICLE
// ==========================================
const createVehicle = async (req, res) => {
    try {
        const {
            vehicle_number,
            vehicle_code,
            registration_number,
            vehicle_type,
            model,
            capacity,
            capacity_kg,
            status,
            brand,
            fuel_type,
            manufacturing_year,
            current_mileage_km
        } = req.body;

        const effectiveNumber = vehicle_number || registration_number || vehicle_code;
        const effectiveCode = vehicle_code || vehicle_number || registration_number;
        const effectiveReg = registration_number || vehicle_number || vehicle_code;
        const effectiveCapacity = capacity !== undefined ? capacity : capacity_kg;
        const effectiveStatus = status || "Available";

        // Required field validation
        if (!effectiveNumber || typeof effectiveNumber !== "string" || !effectiveNumber.trim()) {
            return res.status(400).json({
                success: false,
                message: "vehicle_number, vehicle_code, or registration_number is required"
            });
        }

        if (!vehicle_type || typeof vehicle_type !== "string" || !vehicle_type.trim()) {
            return res.status(400).json({
                success: false,
                message: "vehicle_type is required"
            });
        }

        if (effectiveCapacity === undefined || effectiveCapacity === null || isNaN(parseFloat(effectiveCapacity)) || parseFloat(effectiveCapacity) <= 0) {
            return res.status(400).json({
                success: false,
                message: "capacity must be a valid numeric value greater than zero"
            });
        }

        if (!VALID_STATUSES.includes(effectiveStatus)) {
            return res.status(400).json({
                success: false,
                message: "status must be one of: Available, In Transit, Maintenance, Inactive"
            });
        }

        // Check for duplicate vehicle number
        const duplicateCheck = await pool.query(
            `
            SELECT id FROM vehicles
            WHERE LOWER(vehicle_number) = LOWER($1)
               OR LOWER(registration_number) = LOWER($1)
               OR LOWER(vehicle_code) = LOWER($1)
            `,
            [effectiveNumber.trim()]
        );

        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Vehicle number already exists"
            });
        }

        // Insert vehicle into PostgreSQL using parameterized query
        const numVal = effectiveNumber.trim();
        const codeVal = effectiveCode.trim();
        const regVal = effectiveReg.trim();
        const capVal = parseFloat(effectiveCapacity);
        const fuelVal = fuel_type || "Diesel";
        const statusDb = toDbStatus(effectiveStatus);

        const result = await pool.query(
            `
            INSERT INTO vehicles (
                vehicle_number,
                registration_number,
                vehicle_code,
                vehicle_type,
                model,
                capacity,
                capacity_kg,
                status,
                brand,
                fuel_type,
                manufacturing_year,
                current_mileage_km
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11
            )
            RETURNING *
            `,
            [
                numVal,
                regVal,
                codeVal,
                vehicle_type.trim(),
                model ? model.trim() : null,
                capVal,
                statusDb,
                brand || null,
                fuelVal,
                manufacturing_year || null,
                current_mileage_km || 0
            ]
        );

        const createdRow = result.rows[0];
        const formattedCreated = {
            ...createdRow,
            vehicle_number: createdRow.vehicle_number || createdRow.registration_number || createdRow.vehicle_code,
            capacity: parseFloat(createdRow.capacity || createdRow.capacity_kg),
            status: createdRow.status
        };

        res.status(201).json({
            success: true,
            message: "Vehicle created successfully",
            data: formattedCreated
        });

    } catch (error) {
        console.error("Error creating vehicle:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Vehicle number already exists"
            });
        }

        return sendError(res, 500, "Failed to create vehicle", error);
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

        const existingVehicle = await pool.query("SELECT * FROM vehicles WHERE id = $1", [id]);
        if (existingVehicle.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        const {
            vehicle_number,
            vehicle_code,
            registration_number,
            vehicle_type,
            model,
            capacity,
            capacity_kg,
            status,
            brand,
            fuel_type,
            manufacturing_year,
            current_mileage_km
        } = req.body;

        const effectiveNumber = vehicle_number !== undefined ? vehicle_number : (registration_number !== undefined ? registration_number : vehicle_code);
        const effectiveCapacity = capacity !== undefined ? capacity : capacity_kg;

        // Validation for provided capacity
        if (effectiveCapacity !== undefined && (isNaN(parseFloat(effectiveCapacity)) || parseFloat(effectiveCapacity) <= 0)) {
            return res.status(400).json({
                success: false,
                message: "capacity must be a valid numeric value greater than zero"
            });
        }

        // Validation for provided status
        if (status !== undefined && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "status must be one of: Available, In Transit, Maintenance, Inactive"
            });
        }

        // Validation for duplicate vehicle number if changed
        if (effectiveNumber && typeof effectiveNumber === "string" && effectiveNumber.trim()) {
            const duplicateCheck = await pool.query(
                `
                SELECT id FROM vehicles
                WHERE (LOWER(vehicle_number) = LOWER($1) OR LOWER(registration_number) = LOWER($1) OR LOWER(vehicle_code) = LOWER($1))
                  AND id != $2
                `,
                [effectiveNumber.trim(), id]
            );

            if (duplicateCheck.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Vehicle number already exists"
                });
            }
        }

        const statusDb = status ? toDbStatus(status) : null;
        const numVal = effectiveNumber ? effectiveNumber.trim() : null;
        const capVal = effectiveCapacity !== undefined ? parseFloat(effectiveCapacity) : null;

        const result = await pool.query(
            `
            UPDATE vehicles
            SET
                vehicle_number = COALESCE($1, vehicle_number),
                registration_number = COALESCE($1, registration_number),
                vehicle_code = COALESCE($1, vehicle_code),
                vehicle_type = COALESCE($2, vehicle_type),
                model = COALESCE($3, model),
                capacity = COALESCE($4, capacity),
                capacity_kg = COALESCE($4, capacity_kg),
                status = COALESCE($5, status),
                brand = COALESCE($6, brand),
                fuel_type = COALESCE($7, fuel_type),
                manufacturing_year = COALESCE($8, manufacturing_year),
                current_mileage_km = COALESCE($9, current_mileage_km),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
            RETURNING *
            `,
            [
                numVal,
                vehicle_type ? vehicle_type.trim() : null,
                model ? model.trim() : null,
                capVal,
                statusDb,
                brand || null,
                fuel_type || null,
                manufacturing_year || null,
                current_mileage_km || null,
                id
            ]
        );

        const updatedRow = result.rows[0];
        const formattedUpdated = {
            ...updatedRow,
            vehicle_number: updatedRow.vehicle_number || updatedRow.registration_number || updatedRow.vehicle_code,
            capacity: parseFloat(updatedRow.capacity || updatedRow.capacity_kg),
            status: updatedRow.status
        };

        res.status(200).json({
            success: true,
            message: "Vehicle updated successfully",
            data: formattedUpdated
        });

    } catch (error) {
        console.error("Error updating vehicle:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Vehicle number already exists"
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

        const existingVehicle = await pool.query("SELECT * FROM vehicles WHERE id = $1", [id]);
        if (existingVehicle.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        const result = await pool.query(
            "DELETE FROM vehicles WHERE id = $1 RETURNING *",
            [id]
        );

        const deletedRow = result.rows[0];
        const formattedDeleted = {
            ...deletedRow,
            vehicle_number: deletedRow.vehicle_number || deletedRow.registration_number || deletedRow.vehicle_code,
            capacity: parseFloat(deletedRow.capacity || deletedRow.capacity_kg),
            status: deletedRow.status
        };

        res.status(200).json({
            success: true,
            message: "Vehicle deleted successfully",
            data: formattedDeleted
        });

    } catch (error) {
        console.error("Error deleting vehicle:", error.message);
        return sendError(res, 500, "Failed to delete vehicle", error);
    }
};

module.exports = {
    getAllVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    deleteVehicle
};