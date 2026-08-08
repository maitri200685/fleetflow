const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

// Recommended statuses: Available, On Trip, Off Duty, Inactive, Suspended
const VALID_STATUSES = ["Available", "On Trip", "Off Duty", "Inactive", "Suspended"];

// ==========================================
// GET ALL DRIVERS
// ==========================================
const getAllDrivers = async (req, res) => {
    try {
        const { status } = req.query;
        let query = "SELECT * FROM drivers";
        const params = [];

        if (status) {
            query += " WHERE status = $1";
            params.push(status);
        }

        query += " ORDER BY created_at DESC";

        const result = await pool.query(query, params);

        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching drivers:", error.message);
        return sendError(res, 500, "Failed to fetch drivers", error);
    }
};

// ==========================================
// GET DRIVER BY ID
// ==========================================
const getDriverById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for driver ID");
        }

        const result = await pool.query(
            "SELECT * FROM drivers WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        return sendSuccess(res, 200, "Driver fetched successfully", result.rows[0]);
    } catch (error) {
        console.error("Error fetching driver:", error.message);
        return sendError(res, 500, "Failed to fetch driver", error);
    }
};

// ==========================================
// CREATE NEW DRIVER
// ==========================================
const createDriver = async (req, res) => {
    try {
        const {
            driver_code,
            full_name,
            phone,
            email,
            license_number,
            license_expiry,
            date_of_birth,
            address,
            emergency_contact,
            joining_date,
            status
        } = req.body;

        // Required fields validation
        if (!driver_code || !full_name || !license_number || !license_expiry) {
            return sendError(
                res,
                400,
                "driver_code, full_name, license_number, and license_expiry are required"
            );
        }

        const driverStatus = status || "Available";

        if (!VALID_STATUSES.includes(driverStatus)) {
            return sendError(
                res,
                400,
                `Invalid status. Allowed values are: ${VALID_STATUSES.join(", ")}`
            );
        }

        const result = await pool.query(
            `
            INSERT INTO drivers (
                driver_code,
                full_name,
                phone,
                email,
                license_number,
                license_expiry,
                date_of_birth,
                address,
                emergency_contact,
                joining_date,
                status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
            RETURNING *
            `,
            [
                driver_code,
                full_name,
                phone || null,
                email || null,
                license_number,
                license_expiry,
                date_of_birth || null,
                address || null,
                emergency_contact || null,
                joining_date || null,
                driverStatus
            ]
        );

        return sendSuccess(res, 201, "Driver created successfully", result.rows[0]);
    } catch (error) {
        console.error("Error creating driver:", error.message);

        // Unique constraint violation in Postgres
        if (error.code === "23505") {
            return sendError(
                res,
                409,
                "Driver code, email, or license number already exists"
            );
        }

        return sendError(res, 500, "Failed to create driver", error);
    }
};

// ==========================================
// UPDATE DRIVER
// ==========================================
const updateDriver = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for driver ID");
        }

        const {
            driver_code,
            full_name,
            phone,
            email,
            license_number,
            license_expiry,
            date_of_birth,
            address,
            emergency_contact,
            joining_date,
            status
        } = req.body;

        if (status && !VALID_STATUSES.includes(status)) {
            return sendError(
                res,
                400,
                `Invalid status. Allowed values are: ${VALID_STATUSES.join(", ")}`
            );
        }

        // Check driver existence
        const existing = await pool.query("SELECT id FROM drivers WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        const result = await pool.query(
            `
            UPDATE drivers
            SET
                driver_code = COALESCE($1, driver_code),
                full_name = COALESCE($2, full_name),
                phone = COALESCE($3, phone),
                email = COALESCE($4, email),
                license_number = COALESCE($5, license_number),
                license_expiry = COALESCE($6, license_expiry),
                date_of_birth = COALESCE($7, date_of_birth),
                address = COALESCE($8, address),
                emergency_contact = COALESCE($9, emergency_contact),
                joining_date = COALESCE($10, joining_date),
                status = COALESCE($11, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *
            `,
            [
                driver_code,
                full_name,
                phone,
                email,
                license_number,
                license_expiry,
                date_of_birth,
                address,
                emergency_contact,
                joining_date,
                status,
                id
            ]
        );

        return sendSuccess(res, 200, "Driver updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating driver:", error.message);

        if (error.code === "23505") {
            return sendError(
                res,
                409,
                "Driver code, email, or license number already exists"
            );
        }

        return sendError(res, 500, "Failed to update driver", error);
    }
};

// ==========================================
// DELETE DRIVER
// ==========================================
const deleteDriver = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for driver ID");
        }

        const result = await pool.query(
            "DELETE FROM drivers WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        return sendSuccess(res, 200, "Driver deleted successfully", result.rows[0]);
    } catch (error) {
        console.error("Error deleting driver:", error.message);

        if (error.code === "23503") {
            return sendError(
                res,
                409,
                "Cannot delete driver because driver is referenced in active trips or documents"
            );
        }

        return sendError(res, 500, "Failed to delete driver", error);
    }
};

module.exports = {
    getAllDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    deleteDriver
};
