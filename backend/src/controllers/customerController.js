const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_STATUSES = ["Active", "Inactive"];

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

        return sendList(res, 200, result.rows);
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

        return sendSuccess(res, 200, "Customer fetched successfully", result.rows[0]);
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
            contact_name, // fallback for legacy schema
            email,
            phone,
            address,
            city,
            state,
            postal_code,
            pincode, // fallback for legacy schema
            status
        } = req.body;

        const effectiveContactPerson = contact_person || contact_name;
        const effectivePostalCode = postal_code || pincode;

        if (!customer_code || !effectiveContactPerson || !email || !phone || !address || !city) {
            return sendError(
                res,
                400,
                "customer_code, contact_person (or contact_name), email, phone, address, and city are required"
            );
        }

        const custStatus = status || "Active";

        if (!VALID_STATUSES.includes(custStatus)) {
            return sendError(
                res,
                400,
                `Invalid status. Allowed values are: ${VALID_STATUSES.join(", ")}`
            );
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
                customer_code,
                company_name || null,
                effectiveContactPerson,
                email,
                phone,
                address,
                city,
                state || null,
                effectivePostalCode || null,
                custStatus
            ]
        );

        return sendSuccess(res, 201, "Customer created successfully", result.rows[0]);
    } catch (error) {
        console.error("Error creating customer:", error.message);

        if (error.code === "23505") {
            return sendError(
                res,
                409,
                "Customer code or email already exists"
            );
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
        const effectivePostalCode = postal_code || pincode;

        if (status && !VALID_STATUSES.includes(status)) {
            return sendError(
                res,
                400,
                `Invalid status. Allowed values are: ${VALID_STATUSES.join(", ")}`
            );
        }

        const existing = await pool.query("SELECT id FROM customers WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Customer not found");
        }

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
                customer_code,
                company_name,
                effectiveContactPerson,
                email,
                phone,
                address,
                city,
                state,
                effectivePostalCode,
                status,
                id
            ]
        );

        return sendSuccess(res, 200, "Customer updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating customer:", error.message);

        if (error.code === "23505") {
            return sendError(
                res,
                409,
                "Customer code or email already exists"
            );
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

        const result = await pool.query(
            "DELETE FROM customers WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Customer not found");
        }

        return sendSuccess(res, 200, "Customer deleted successfully", result.rows[0]);
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
