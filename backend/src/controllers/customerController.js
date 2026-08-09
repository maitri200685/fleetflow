const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_STATUSES = ["Active", "Inactive"];

// Email Validation Regex Pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone Validation Regex Pattern (at least 7 digits)
const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]{6,15}$/;

// Format customer object for API output consistency
const formatCustomer = (row) => {
    if (!row) return null;
    const contactVal = row.contact_person || row.contact_name || "";
    const companyVal = row.company_name || contactVal || "N/A";
    return {
        ...row,
        contact_person: contactVal,
        contact_name: contactVal,
        company_name: companyVal,
        customer_code: row.customer_code || `CUST-${row.id ? row.id.substring(0, 8) : Date.now()}`
    };
};

// ==========================================
// GET ALL CUSTOMERS
// ==========================================
const getAllCustomers = async (req, res) => {
    try {
        const { status } = req.query;
        let query = "SELECT * FROM customers";
        const params = [];

        if (status) {
            query += " WHERE status = $1";
            params.push(status);
        }

        query += " ORDER BY created_at DESC";

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatCustomer);

        return sendList(res, 200, formatted);
    } catch (error) {
        console.error("Error fetching customers:", error.message);
        return sendError(res, 500, "Failed to fetch customers", error);
    }
};

// ==========================================
// GET CUSTOMER BY ID
// ==========================================
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for customer ID");
        }

        const result = await pool.query(
            "SELECT * FROM customers WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Customer not found");
        }

        return sendSuccess(res, 200, "Customer fetched successfully", formatCustomer(result.rows[0]));
    } catch (error) {
        console.error("Error fetching customer:", error.message);
        return sendError(res, 500, "Failed to fetch customer", error);
    }
};

// ==========================================
// CREATE NEW CUSTOMER
// ==========================================
const createCustomer = async (req, res) => {
    try {
        const {
            customer_code,
            company_name,
            contact_person,
            contact_name,
            email,
            phone,
            address,
            city,
            state,
            postal_code,
            pincode,
            status
        } = req.body;

        const effectiveContactPerson = contact_person || contact_name;
        const effectiveCompany = company_name || effectiveContactPerson;

        // 1. Company Name validation
        if (!effectiveCompany || typeof effectiveCompany !== "string" || !effectiveCompany.trim()) {
            return sendError(res, 400, "company_name is required");
        }

        // 2. Contact Person validation
        if (!effectiveContactPerson || typeof effectiveContactPerson !== "string" || !effectiveContactPerson.trim()) {
            return sendError(res, 400, "contact_person is required");
        }

        // 3. Phone validation
        if (!phone || typeof phone !== "string" || !phone.trim() || !PHONE_REGEX.test(phone.trim())) {
            return sendError(res, 400, "valid phone number is required");
        }

        // 4. Email validation (if supplied)
        if (email && (typeof email !== "string" || !EMAIL_REGEX.test(email.trim()))) {
            return sendError(res, 400, "invalid email format");
        }

        // 5. Address validation
        if (!address || typeof address !== "string" || !address.trim()) {
            return sendError(res, 400, "address is required");
        }

        // 6. Status validation
        const custStatus = status || "Active";
        if (!VALID_STATUSES.includes(custStatus)) {
            return sendError(res, 400, "status must be one of: Active, Inactive");
        }

        const timestamp = Date.now();
        const effectiveCode = customer_code || `CUST-${timestamp}`;
        const companyVal = effectiveCompany.trim();
        const contactVal = effectiveContactPerson.trim();
        const phoneVal = phone.trim();
        const emailVal = email ? email.trim() : null;
        const addressVal = address.trim();
        const cityVal = city ? city.trim() : "Default City";
        const stateVal = state ? state.trim() : null;
        const postalVal = postal_code || pincode || null;

        // Check for duplicate customer_code or email
        const duplicateCheck = await pool.query(
            `
            SELECT id FROM customers
            WHERE (LOWER(customer_code) = LOWER($1) AND $1 IS NOT NULL)
               OR (LOWER(email) = LOWER($2) AND $2 IS NOT NULL)
            `,
            [customer_code ? customer_code.trim() : null, emailVal]
        );

        if (duplicateCheck.rows.length > 0) {
            return sendError(res, 409, "Customer code or email already exists");
        }

        const result = await pool.query(
            `
            INSERT INTO customers (
                customer_code,
                company_name,
                contact_person,
                contact_name,
                email,
                phone,
                address,
                city,
                state,
                postal_code,
                pincode,
                status
            )
            VALUES (
                $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $9, $10
            )
            RETURNING *
            `,
            [
                effectiveCode,
                companyVal,
                contactVal,
                emailVal,
                phoneVal,
                addressVal,
                cityVal,
                stateVal,
                postalVal,
                custStatus
            ]
        );

        return sendSuccess(res, 201, "Customer created successfully", formatCustomer(result.rows[0]));
    } catch (error) {
        console.error("Error creating customer:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Customer code or email already exists");
        }

        return sendError(res, 500, "Failed to create customer", error);
    }
};

// ==========================================
// UPDATE CUSTOMER
// ==========================================
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for customer ID");
        }

        const existing = await pool.query("SELECT id FROM customers WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Customer not found");
        }

        const {
            customer_code,
            company_name,
            contact_person,
            contact_name,
            email,
            phone,
            address,
            city,
            state,
            postal_code,
            pincode,
            status
        } = req.body;

        const effectiveContactPerson = contact_person !== undefined ? contact_person : contact_name;

        // Validation for provided company name
        if (company_name !== undefined && (typeof company_name !== "string" || !company_name.trim())) {
            return sendError(res, 400, "company_name is required");
        }

        // Validation for provided contact person
        if (effectiveContactPerson !== undefined && (typeof effectiveContactPerson !== "string" || !effectiveContactPerson.trim())) {
            return sendError(res, 400, "contact_person is required");
        }

        // Validation for provided phone
        if (phone !== undefined && (typeof phone !== "string" || !phone.trim() || !PHONE_REGEX.test(phone.trim()))) {
            return sendError(res, 400, "valid phone number is required");
        }

        // Validation for provided email
        if (email !== undefined && email !== null && email.trim() !== "" && !EMAIL_REGEX.test(email.trim())) {
            return sendError(res, 400, "invalid email format");
        }

        // Validation for provided address
        if (address !== undefined && (typeof address !== "string" || !address.trim())) {
            return sendError(res, 400, "address is required");
        }

        // Validation for provided status
        if (status !== undefined && !VALID_STATUSES.includes(status)) {
            return sendError(res, 400, "status must be one of: Active, Inactive");
        }

        // Validation for duplicate customer code or email if changed
        if ((customer_code && typeof customer_code === "string" && customer_code.trim()) || (email && typeof email === "string" && email.trim())) {
            const duplicateCheck = await pool.query(
                `
                SELECT id FROM customers
                WHERE ((LOWER(customer_code) = LOWER($1) AND $1 IS NOT NULL) OR (LOWER(email) = LOWER($2) AND $2 IS NOT NULL))
                  AND id != $3
                `,
                [customer_code ? customer_code.trim() : null, email ? email.trim() : null, id]
            );

            if (duplicateCheck.rows.length > 0) {
                return sendError(res, 409, "Customer code or email already exists");
            }
        }

        const companyVal = company_name ? company_name.trim() : null;
        const contactVal = effectiveContactPerson ? effectiveContactPerson.trim() : null;
        const phoneVal = phone ? phone.trim() : null;
        const emailVal = email !== undefined ? (email ? email.trim() : null) : null;
        const addressVal = address ? address.trim() : null;
        const postalVal = postal_code || pincode || null;

        const result = await pool.query(
            `
            UPDATE customers
            SET
                customer_code = COALESCE($1, customer_code),
                company_name = COALESCE($2, company_name),
                contact_person = COALESCE($3, contact_person),
                contact_name = COALESCE($3, contact_name),
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                address = COALESCE($6, address),
                city = COALESCE($7, city),
                state = COALESCE($8, state),
                postal_code = COALESCE($9, postal_code),
                pincode = COALESCE($9, pincode),
                status = COALESCE($10, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
            RETURNING *
            `,
            [
                customer_code ? customer_code.trim() : null,
                companyVal,
                contactVal,
                emailVal,
                phoneVal,
                addressVal,
                city || null,
                state || null,
                postalVal,
                status || null,
                id
            ]
        );

        return sendSuccess(res, 200, "Customer updated successfully", formatCustomer(result.rows[0]));
    } catch (error) {
        console.error("Error updating customer:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Customer code or email already exists");
        }

        return sendError(res, 500, "Failed to update customer", error);
    }
};

// ==========================================
// DELETE CUSTOMER
// ==========================================
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for customer ID");
        }

        const existing = await pool.query("SELECT id FROM customers WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Customer not found");
        }

        const result = await pool.query(
            "DELETE FROM customers WHERE id = $1 RETURNING *",
            [id]
        );

        return sendSuccess(res, 200, "Customer deleted successfully", formatCustomer(result.rows[0]));
    } catch (error) {
        console.error("Error deleting customer:", error.message);

        if (error.code === "23503") {
            return sendError(
                res,
                409,
                "Cannot delete customer because referenced in existing trips"
            );
        }

        return sendError(res, 500, "Failed to delete customer", error);
    }
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
