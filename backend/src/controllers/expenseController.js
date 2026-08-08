const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_EXPENSE_TYPES = [
    "Fuel",
    "Maintenance",
    "Toll",
    "Parking",
    "Driver Allowance",
    "Insurance",
    "Other"
];

// ==========================================
// GET ALL EXPENSES
// ==========================================
const getAllExpenses = async (req, res) => {
    try {
        const { vehicle_id, trip_id, expense_type } = req.query;
        let query = `
            SELECT 
                e.*,
                v.vehicle_code, v.registration_number,
                t.trip_code, t.origin, t.destination
            FROM expenses e
            LEFT JOIN vehicles v ON e.vehicle_id = v.id
            LEFT JOIN trips t ON e.trip_id = t.id
            WHERE 1=1
        `;
        const params = [];
        let paramIdx = 1;

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID");
            query += ` AND e.vehicle_id = $${paramIdx++}`;
            params.push(vehicle_id);
        }
        if (trip_id) {
            if (!isValidUuid(trip_id)) return sendError(res, 400, "Invalid trip_id UUID");
            query += ` AND e.trip_id = $${paramIdx++}`;
            params.push(trip_id);
        }
        if (expense_type) {
            query += ` AND e.expense_type = $${paramIdx++}`;
            params.push(expense_type);
        }

        query += " ORDER BY e.expense_date DESC, e.created_at DESC";

        const result = await pool.query(query, params);
        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching expenses:", error.message);
        return sendError(res, 500, "Failed to fetch expenses", error);
    }
};

// ==========================================
// GET EXPENSE BY ID
// ==========================================
const getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for expense ID");
        }

        const result = await pool.query(
            `
            SELECT 
                e.*,
                v.vehicle_code, v.registration_number,
                t.trip_code
            FROM expenses e
            LEFT JOIN vehicles v ON e.vehicle_id = v.id
            LEFT JOIN trips t ON e.trip_id = t.id
            WHERE e.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Expense record not found");
        }

        return sendSuccess(res, 200, "Expense record fetched successfully", result.rows[0]);
    } catch (error) {
        console.error("Error fetching expense:", error.message);
        return sendError(res, 500, "Failed to fetch expense", error);
    }
};

// ==========================================
// GET VEHICLE EXPENSES
// ==========================================
const getVehicleExpenses = async (req, res) => {
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
            "SELECT * FROM expenses WHERE vehicle_id = $1 ORDER BY expense_date DESC",
            [id]
        );

        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching vehicle expenses:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle expenses", error);
    }
};

// ==========================================
// GET TRIP EXPENSES
// ==========================================
const getTripExpenses = async (req, res) => {
    try {
        const { id } = req.params; // trip_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for trip ID");
        }

        const tRes = await pool.query("SELECT id FROM trips WHERE id = $1", [id]);
        if (tRes.rows.length === 0) {
            return sendError(res, 404, "Trip not found");
        }

        const result = await pool.query(
            "SELECT * FROM expenses WHERE trip_id = $1 ORDER BY expense_date DESC",
            [id]
        );

        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching trip expenses:", error.message);
        return sendError(res, 500, "Failed to fetch trip expenses", error);
    }
};

// ==========================================
// CREATE EXPENSE
// ==========================================
const createExpense = async (req, res) => {
    try {
        const {
            vehicle_id,
            trip_id,
            expense_type,
            amount,
            expense_date,
            description
        } = req.body;

        if (!expense_type || amount === undefined) {
            return sendError(res, 400, "expense_type and amount are required");
        }

        if (!VALID_EXPENSE_TYPES.includes(expense_type)) {
            return sendError(res, 400, `Invalid expense_type. Allowed values: ${VALID_EXPENSE_TYPES.join(", ")}`);
        }

        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            return sendError(res, 400, "amount must be greater than 0");
        }

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [vehicle_id]);
            if (vRes.rows.length === 0) return sendError(res, 404, "Vehicle not found");
        }

        if (trip_id) {
            if (!isValidUuid(trip_id)) return sendError(res, 400, "Invalid trip_id UUID format");
            const tRes = await pool.query("SELECT id FROM trips WHERE id = $1", [trip_id]);
            if (tRes.rows.length === 0) return sendError(res, 404, "Trip not found");
        }

        const expDate = expense_date || new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `
            INSERT INTO expenses (
                vehicle_id,
                trip_id,
                expense_type,
                amount,
                expense_date,
                description
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [
                vehicle_id || null,
                trip_id || null,
                expense_type,
                amt,
                expDate,
                description || null
            ]
        );

        return sendSuccess(res, 201, "Expense created successfully", result.rows[0]);
    } catch (error) {
        console.error("Error creating expense:", error.message);
        return sendError(res, 500, "Failed to create expense", error);
    }
};

// ==========================================
// UPDATE EXPENSE
// ==========================================
const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for expense ID");
        }

        const {
            vehicle_id,
            trip_id,
            expense_type,
            amount,
            expense_date,
            description
        } = req.body;

        if (expense_type && !VALID_EXPENSE_TYPES.includes(expense_type)) {
            return sendError(res, 400, `Invalid expense_type. Allowed values: ${VALID_EXPENSE_TYPES.join(", ")}`);
        }

        if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
            return sendError(res, 400, "amount must be greater than 0");
        }

        const existing = await pool.query("SELECT id FROM expenses WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Expense record not found");
        }

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [vehicle_id]);
            if (vRes.rows.length === 0) return sendError(res, 404, "Vehicle not found");
        }

        if (trip_id) {
            if (!isValidUuid(trip_id)) return sendError(res, 400, "Invalid trip_id UUID format");
            const tRes = await pool.query("SELECT id FROM trips WHERE id = $1", [trip_id]);
            if (tRes.rows.length === 0) return sendError(res, 404, "Trip not found");
        }

        const result = await pool.query(
            `
            UPDATE expenses
            SET
                vehicle_id = COALESCE($1, vehicle_id),
                trip_id = COALESCE($2, trip_id),
                expense_type = COALESCE($3, expense_type),
                amount = COALESCE($4, amount),
                expense_date = COALESCE($5, expense_date),
                description = COALESCE($6, description),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
            `,
            [
                vehicle_id,
                trip_id,
                expense_type,
                amount,
                expense_date,
                description,
                id
            ]
        );

        return sendSuccess(res, 200, "Expense updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating expense:", error.message);
        return sendError(res, 500, "Failed to update expense", error);
    }
};

// ==========================================
// DELETE EXPENSE
// ==========================================
const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for expense ID");
        }

        const result = await pool.query(
            "DELETE FROM expenses WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Expense record not found");
        }

        return sendSuccess(res, 200, "Expense deleted successfully", result.rows[0]);
    } catch (error) {
        console.error("Error deleting expense:", error.message);
        return sendError(res, 500, "Failed to delete expense", error);
    }
};

module.exports = {
    getAllExpenses,
    getExpenseById,
    getVehicleExpenses,
    getTripExpenses,
    createExpense,
    updateExpense,
    deleteExpense
};
