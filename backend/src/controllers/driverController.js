const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_STATUSES = ["Available", "On Trip", "Off Duty", "Inactive", "Suspended"];

// Email Validation Regex Pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone Validation Regex Pattern (at least 7 digits)
const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]{6,15}$/;

// Format driver object for API output consistency
const formatDriver = (row) => {
    if (!row) return null;
    const nameVal = row.name || row.full_name || "";
    return {
        ...row,
        name: nameVal,
        full_name: nameVal,
        driver_code: row.driver_code || `DRV-${row.id ? row.id.substring(0, 8) : Date.now()}`
    };
};

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
        const formatted = result.rows.map(formatDriver);

        return sendList(res, 200, formatted);
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

        return sendSuccess(res, 200, "Driver fetched successfully", formatDriver(result.rows[0]));
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
            name,
            full_name,
            phone,
            email,
            license_number,
            license_expiry,
            driver_code,
            date_of_birth,
            address,
            emergency_contact,
            joining_date,
            status
        } = req.body;

        const effectiveName = name || full_name;

        // 1. Name validation
        if (!effectiveName || typeof effectiveName !== "string" || !effectiveName.trim()) {
            return sendError(res, 400, "name or full_name is required");
        }

        // 2. Phone validation (if supplied)
        if (phone && (typeof phone !== "string" || !phone.trim() || !PHONE_REGEX.test(phone.trim()))) {
            return sendError(res, 400, "valid phone number is required");
        }

        // 3. Email validation (if supplied)
        if (email && (typeof email !== "string" || !EMAIL_REGEX.test(email.trim()))) {
            return sendError(res, 400, "invalid email format");
        }

        // 4. License Expiry validation (if supplied)
        if (license_expiry && isNaN(Date.parse(license_expiry))) {
            return sendError(res, 400, "valid license_expiry date is required");
        }

        // 5. Status validation
        const driverStatus = status || "Available";
        if (!VALID_STATUSES.includes(driverStatus)) {
            return sendError(res, 400, "status must be one of: Available, On Trip, Inactive");
        }

        const timestamp = Date.now();
        const effectiveCode = driver_code || `DRV-${timestamp}`;
        const licenseVal = license_number ? license_number.trim() : `DL-TEMP-${timestamp}`;
        const defaultExpiryStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const expiryVal = license_expiry || defaultExpiryStr;
        const nameVal = effectiveName.trim();
        const phoneVal = phone ? phone.trim() : null;
        const emailVal = email ? email.trim() : null;

        // Check for duplicate driver_code, email, or license_number
        const duplicateCheck = await pool.query(
            `
            SELECT id FROM drivers
            WHERE (LOWER(driver_code) = LOWER($1) AND $1 IS NOT NULL)
               OR (LOWER(license_number) = LOWER($2) AND $2 IS NOT NULL)
               OR (LOWER(email) = LOWER($3) AND $3 IS NOT NULL)
            `,
            [driver_code ? driver_code.trim() : null, license_number ? license_number.trim() : null, emailVal]
        );

        if (duplicateCheck.rows.length > 0) {
            return sendError(res, 409, "Driver code, email, or license number already exists");
        }

        const result = await pool.query(
            `
            INSERT INTO drivers (
                driver_code,
                name,
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
                $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
            RETURNING *
            `,
            [
                effectiveCode,
                nameVal,
                phoneVal,
                emailVal,
                licenseVal,
                expiryVal,
                date_of_birth || null,
                address || null,
                emergency_contact || null,
                joining_date || null,
                driverStatus
            ]
        );

        return sendSuccess(res, 201, "Driver created successfully", formatDriver(result.rows[0]));
    } catch (error) {
        console.error("Error creating driver:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Driver code, email, or license number already exists");
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

        const existing = await pool.query("SELECT id FROM drivers WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        const {
            name,
            full_name,
            phone,
            email,
            license_number,
            license_expiry,
            driver_code,
            date_of_birth,
            address,
            emergency_contact,
            joining_date,
            status
        } = req.body;

        const effectiveName = name !== undefined ? name : full_name;

        // Validation for provided phone
        if (phone !== undefined && (typeof phone !== "string" || !phone.trim() || !PHONE_REGEX.test(phone.trim()))) {
            return sendError(res, 400, "valid phone number is required");
        }

        // Validation for provided email
        if (email !== undefined && email !== null && email.trim() !== "" && !EMAIL_REGEX.test(email.trim())) {
            return sendError(res, 400, "invalid email format");
        }

        // Validation for provided license expiry
        if (license_expiry !== undefined && isNaN(Date.parse(license_expiry))) {
            return sendError(res, 400, "valid license_expiry date is required");
        }

        // Validation for provided status
        if (status !== undefined && !VALID_STATUSES.includes(status)) {
            return sendError(res, 400, "status must be one of: Available, On Trip, Inactive");
        }

        // Validation for duplicate license number or driver_code if changed
        if ((license_number && typeof license_number === "string" && license_number.trim()) || (driver_code && typeof driver_code === "string" && driver_code.trim())) {
            const duplicateCheck = await pool.query(
                `
                SELECT id FROM drivers
                WHERE ((LOWER(license_number) = LOWER($1) AND $1 IS NOT NULL) OR (LOWER(driver_code) = LOWER($2) AND $2 IS NOT NULL))
                  AND id != $3
                `,
                [license_number ? license_number.trim() : null, driver_code ? driver_code.trim() : null, id]
            );
            if (duplicateCheck.rows.length > 0) {
                return sendError(res, 409, "Driver code, email, or license number already exists");
            }
        }

        const nameVal = effectiveName ? effectiveName.trim() : null;
        const phoneVal = phone ? phone.trim() : null;
        const emailVal = email !== undefined ? (email ? email.trim() : null) : null;
        const licenseVal = license_number ? license_number.trim() : null;

        const result = await pool.query(
            `
            UPDATE drivers
            SET
                name = COALESCE($1, name),
                full_name = COALESCE($1, full_name),
                phone = COALESCE($2, phone),
                email = COALESCE($3, email),
                license_number = COALESCE($4, license_number),
                license_expiry = COALESCE($5, license_expiry),
                driver_code = COALESCE($6, driver_code),
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
                nameVal,
                phoneVal,
                emailVal,
                licenseVal,
                license_expiry || null,
                driver_code || null,
                date_of_birth || null,
                address || null,
                emergency_contact || null,
                joining_date || null,
                status || null,
                id
            ]
        );

        return sendSuccess(res, 200, "Driver updated successfully", formatDriver(result.rows[0]));
    } catch (error) {
        console.error("Error updating driver:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Driver code, email, or license number already exists");
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

        const existing = await pool.query("SELECT id FROM drivers WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        const result = await pool.query(
            "DELETE FROM drivers WHERE id = $1 RETURNING *",
            [id]
        );

        return sendSuccess(res, 200, "Driver deleted successfully", formatDriver(result.rows[0]));
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
