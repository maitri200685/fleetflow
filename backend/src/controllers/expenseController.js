const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_CATEGORIES = [
    "Fuel",
    "Maintenance",
    "Toll",
    "Parking",
    "Insurance",
    "Permit",
    "Repair",
    "Driver Expense",
    "Driver Allowance",
    "Other"
];

// Helper: Normalize expense output format with JOINed aliases
const formatExpense = (row) => {
    if (!row) return null;
    const catVal = row.category || row.expense_type || "Other";
    const numVal = row.expense_number || `EXP-${row.id.slice(0, 8)}`;
    const amtVal = row.amount !== undefined && row.amount !== null ? parseFloat(row.amount) : 0;
    const vehNum = row.vehicle_number || row.registration_number || row.vehicle_code || "N/A";
    const tripNum = row.trip_number || row.trip_code || "N/A";
    const drvName = row.driver_name || row.driver_full_name || row.full_name || "N/A";

    return {
        ...row,
        expense_number: numVal,
        category: catVal,
        expense_type: catVal,
        amount: amtVal,
        vehicle_number: vehNum,
        vehicle_code: vehNum,
        trip_number: tripNum,
        trip_code: tripNum,
        driver_name: drvName
    };
};

// Helper: Standard SQL SELECT with JOINs
const BASE_SELECT = `
    SELECT 
        e.*,
        v.vehicle_number, v.vehicle_code, v.registration_number,
        t.trip_number, t.trip_code, t.origin, t.destination,
        d.name as driver_name, d.full_name as driver_full_name
    FROM expenses e
    LEFT JOIN vehicles v ON e.vehicle_id = v.id
    LEFT JOIN trips t ON e.trip_id = t.id
    LEFT JOIN drivers d ON e.driver_id = d.id
`;

// ==========================================
// GET ALL EXPENSES
// ==========================================
const getAllExpenses = async (req, res) => {
    try {
        const { vehicle_id, trip_id, driver_id, category, expense_type, start_date, end_date } = req.query;
        let query = `${BASE_SELECT} WHERE 1=1`;
        const params = [];
        let paramIdx = 1;

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            query += ` AND e.vehicle_id = $${paramIdx++}`;
            params.push(vehicle_id);
        }
        if (trip_id) {
            if (!isValidUuid(trip_id)) return sendError(res, 400, "Invalid trip_id UUID format");
            query += ` AND e.trip_id = $${paramIdx++}`;
            params.push(trip_id);
        }
        if (driver_id) {
            if (!isValidUuid(driver_id)) return sendError(res, 400, "Invalid driver_id UUID format");
            query += ` AND e.driver_id = $${paramIdx++}`;
            params.push(driver_id);
        }
        const effectiveCategory = category || expense_type;
        if (effectiveCategory) {
            query += ` AND (LOWER(e.category) = LOWER($${paramIdx}) OR LOWER(e.expense_type) = LOWER($${paramIdx}))`;
            paramIdx++;
            params.push(effectiveCategory);
        }
        if (start_date) {
            if (isNaN(Date.parse(start_date))) return sendError(res, 400, "Invalid start_date format");
            query += ` AND e.expense_date >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            if (isNaN(Date.parse(end_date))) return sendError(res, 400, "Invalid end_date format");
            query += ` AND e.expense_date <= $${paramIdx++}`;
            params.push(end_date);
        }

        query += " ORDER BY e.expense_date DESC, e.created_at DESC";

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatExpense);

        return sendList(res, 200, formatted);
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

        const result = await pool.query(`${BASE_SELECT} WHERE e.id = $1`, [id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, "Expense record not found");
        }

        return sendSuccess(res, 200, "Expense record fetched successfully", formatExpense(result.rows[0]));
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

        const result = await pool.query(`${BASE_SELECT} WHERE e.vehicle_id = $1 ORDER BY e.expense_date DESC`, [id]);
        const formatted = result.rows.map(formatExpense);

        return sendList(res, 200, formatted);
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

        const result = await pool.query(`${BASE_SELECT} WHERE e.trip_id = $1 ORDER BY e.expense_date DESC`, [id]);
        const formatted = result.rows.map(formatExpense);

        return sendList(res, 200, formatted);
    } catch (error) {
        console.error("Error fetching trip expenses:", error.message);
        return sendError(res, 500, "Failed to fetch trip expenses", error);
    }
};

// ==========================================
// GET EXPENSE SUMMARY
// ==========================================
const getExpenseSummary = async (req, res) => {
    try {
        const { vehicle_id, trip_id, category, start_date, end_date } = req.query;
        let query = "SELECT * FROM expenses WHERE 1=1";
        const params = [];
        let paramIdx = 1;

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            query += ` AND vehicle_id = $${paramIdx++}`;
            params.push(vehicle_id);
        }
        if (trip_id) {
            if (!isValidUuid(trip_id)) return sendError(res, 400, "Invalid trip_id UUID format");
            query += ` AND trip_id = $${paramIdx++}`;
            params.push(trip_id);
        }
        if (category) {
            query += ` AND (LOWER(category) = LOWER($${paramIdx}) OR LOWER(expense_type) = LOWER($${paramIdx}))`;
            paramIdx++;
            params.push(category);
        }
        if (start_date) {
            query += ` AND expense_date >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND expense_date <= $${paramIdx++}`;
            params.push(end_date);
        }

        const result = await pool.query(query, params);
        const rows = result.rows;

        const totalExpenses = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const fuelExpenses = rows.filter(r => (r.category || r.expense_type) === "Fuel").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const maintenanceExpenses = rows.filter(r => (r.category || r.expense_type) === "Maintenance" || (r.category || r.expense_type) === "Repair").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const tollExpenses = rows.filter(r => (r.category || r.expense_type) === "Toll").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const parkingExpenses = rows.filter(r => (r.category || r.expense_type) === "Parking").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const otherExpenses = totalExpenses - (fuelExpenses + maintenanceExpenses + tollExpenses + parkingExpenses);

        return sendSuccess(res, 200, "Expense summary fetched successfully", {
            expense_count: rows.length,
            total_expenses: Math.round(totalExpenses * 100) / 100,
            fuel_expenses: Math.round(fuelExpenses * 100) / 100,
            maintenance_expenses: Math.round(maintenanceExpenses * 100) / 100,
            toll_expenses: Math.round(tollExpenses * 100) / 100,
            parking_expenses: Math.round(parkingExpenses * 100) / 100,
            other_expenses: Math.round(otherExpenses * 100) / 100
        });
    } catch (error) {
        console.error("Error fetching expense summary:", error.message);
        return sendError(res, 500, "Failed to fetch expense summary", error);
    }
};

// ==========================================
// GET VEHICLE EXPENSE SUMMARY
// ==========================================
const getVehicleExpenseSummary = async (req, res) => {
    try {
        const { id } = req.params; // vehicle_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for vehicle ID");
        }

        const vRes = await pool.query("SELECT id, vehicle_number, vehicle_code, registration_number FROM vehicles WHERE id = $1", [id]);
        if (vRes.rows.length === 0) {
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicle = vRes.rows[0];

        const result = await pool.query("SELECT * FROM expenses WHERE vehicle_id = $1", [id]);
        const rows = result.rows;

        const totalExpenses = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const fuelExpenses = rows.filter(r => (r.category || r.expense_type) === "Fuel").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const maintenanceExpenses = rows.filter(r => (r.category || r.expense_type) === "Maintenance" || (r.category || r.expense_type) === "Repair").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const otherExpenses = totalExpenses - (fuelExpenses + maintenanceExpenses);

        return sendSuccess(res, 200, "Vehicle expense summary fetched successfully", {
            vehicle_id: id,
            vehicle_number: vehicle.vehicle_number || vehicle.registration_number || vehicle.vehicle_code,
            expense_count: rows.length,
            total_expenses: Math.round(totalExpenses * 100) / 100,
            fuel_expenses: Math.round(fuelExpenses * 100) / 100,
            maintenance_expenses: Math.round(maintenanceExpenses * 100) / 100,
            other_expenses: Math.round(otherExpenses * 100) / 100
        });
    } catch (error) {
        console.error("Error fetching vehicle expense summary:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle expense summary", error);
    }
};

// ==========================================
// GET TRIP EXPENSE SUMMARY
// ==========================================
const getTripExpenseSummary = async (req, res) => {
    try {
        const { id } = req.params; // trip_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for trip ID");
        }

        const tRes = await pool.query(
            `
            SELECT t.*, v.vehicle_number, v.registration_number, d.name as driver_name
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.id = $1
            `,
            [id]
        );
        if (tRes.rows.length === 0) {
            return sendError(res, 404, "Trip not found");
        }
        const trip = tRes.rows[0];

        const result = await pool.query("SELECT * FROM expenses WHERE trip_id = $1", [id]);
        const rows = result.rows;

        const totalExpenses = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const fuelExpenses = rows.filter(r => (r.category || r.expense_type) === "Fuel").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const tollExpenses = rows.filter(r => (r.category || r.expense_type) === "Toll").reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const otherExpenses = totalExpenses - (fuelExpenses + tollExpenses);

        return sendSuccess(res, 200, "Trip expense summary fetched successfully", {
            trip_id: id,
            trip_number: trip.trip_number || trip.trip_code,
            vehicle_number: trip.vehicle_number || trip.registration_number || "N/A",
            driver_name: trip.driver_name || "N/A",
            expense_count: rows.length,
            total_expenses: Math.round(totalExpenses * 100) / 100,
            fuel_expenses: Math.round(fuelExpenses * 100) / 100,
            toll_expenses: Math.round(tollExpenses * 100) / 100,
            other_expenses: Math.round(otherExpenses * 100) / 100
        });
    } catch (error) {
        console.error("Error fetching trip expense summary:", error.message);
        return sendError(res, 500, "Failed to fetch trip expense summary", error);
    }
};

// Helper: Common validation logic for Create & Update
const validateExpenseInput = async (req, isUpdate = false) => {
    const {
        expense_number,
        expense_date,
        category,
        expense_type,
        amount,
        description,
        vehicle_id,
        trip_id,
        driver_id
    } = req.body;

    const numVal = expense_number && typeof expense_number === "string" && expense_number.trim() ? expense_number.trim() : null;
    const catVal = category || expense_type;
    const amtVal = amount !== undefined ? parseFloat(amount) : null;

    if (!isUpdate) {
        if (expense_number === "" || expense_number === null) return { error: "expense_number is required", status: 400 };
        if (expense_date && isNaN(Date.parse(expense_date))) return { error: "valid expense_date is required", status: 400 };
        if (!catVal) return { error: "category / expense_type is required", status: 400 };
        if (amtVal === null || isNaN(amtVal) || amtVal <= 0) return { error: "amount must be greater than 0", status: 400 };
    } else {
        if (expense_date !== undefined && isNaN(Date.parse(expense_date))) return { error: "valid expense_date is required", status: 400 };
        if (amtVal !== null && (isNaN(amtVal) || amtVal <= 0)) return { error: "amount must be greater than 0", status: 400 };
    }

    if (catVal && !VALID_CATEGORIES.some(c => c.toLowerCase() === catVal.toLowerCase())) {
        return { error: `Invalid category. Allowed values: ${VALID_CATEGORIES.join(", ")}`, status: 400 };
    }

    // Entity Exists & Relationship Validations (Phase 5)
    let tripObj = null;
    if (trip_id) {
        if (!isValidUuid(trip_id)) return { error: "Invalid trip_id UUID format", status: 400 };
        const tRes = await pool.query("SELECT id, vehicle_id, driver_id FROM trips WHERE id = $1", [trip_id]);
        if (tRes.rows.length === 0) return { error: "Trip not found", status: 404 };
        tripObj = tRes.rows[0];
    }

    if (vehicle_id) {
        if (!isValidUuid(vehicle_id)) return { error: "Invalid vehicle_id UUID format", status: 400 };
        const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) return { error: "Vehicle not found", status: 404 };

        if (tripObj && tripObj.vehicle_id && tripObj.vehicle_id !== vehicle_id) {
            return { error: "Selected vehicle is not assigned to this trip", status: 409 };
        }
    }

    if (driver_id) {
        if (!isValidUuid(driver_id)) return { error: "Invalid driver_id UUID format", status: 400 };
        const dRes = await pool.query("SELECT id FROM drivers WHERE id = $1", [driver_id]);
        if (dRes.rows.length === 0) return { error: "Driver not found", status: 404 };

        if (tripObj && tripObj.driver_id && tripObj.driver_id !== driver_id) {
            return { error: "Selected driver is not assigned to this trip", status: 409 };
        }
    }

    return { numVal, catVal, amtVal, tripObj };
};

// ==========================================
// CREATE EXPENSE
// ==========================================
const createExpense = async (req, res) => {
    try {
        const val = await validateExpenseInput(req, false);
        if (val.error) return sendError(res, val.status, val.error);

        const {
            expense_number,
            expense_date,
            category,
            expense_type,
            amount,
            description,
            vendor,
            reference_number,
            vehicle_id,
            trip_id,
            driver_id,
            notes
        } = req.body;

        const effectiveNumber = val.numVal || `EXP-${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const effectiveCategory = val.catVal;
        const effectiveAmount = val.amtVal;
        const effectiveDate = expense_date || new Date().toISOString().split('T')[0];
        const effectiveDesc = description && description.trim() ? description.trim() : `${effectiveCategory} Expense`;

        // Auto-assign vehicle_id or driver_id from trip if trip_id is present and omitted
        let finalVehicleId = vehicle_id || (val.tripObj ? val.tripObj.vehicle_id : null);
        let finalDriverId = driver_id || (val.tripObj ? val.tripObj.driver_id : null);

        // Duplicate expense_number check (Phase 4)
        if (val.numVal) {
            const dupCheck = await pool.query(
                "SELECT id FROM expenses WHERE LOWER(expense_number) = LOWER($1)",
                [effectiveNumber]
            );
            if (dupCheck.rows.length > 0) {
                return sendError(res, 409, "Expense number already exists");
            }
        }

        const result = await pool.query(
            `
            INSERT INTO expenses (
                expense_number,
                expense_date,
                category,
                expense_type,
                amount,
                description,
                vendor,
                reference_number,
                vehicle_id,
                trip_id,
                driver_id,
                notes
            )
            VALUES (
                $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
            RETURNING *
            `,
            [
                effectiveNumber,
                effectiveDate,
                effectiveCategory,
                effectiveAmount,
                effectiveDesc,
                vendor ? vendor.trim() : null,
                reference_number ? reference_number.trim() : null,
                finalVehicleId,
                trip_id || null,
                finalDriverId,
                notes ? notes.trim() : null
            ]
        );

        // Fetch JOINed inserted record
        const joinedRes = await pool.query(`${BASE_SELECT} WHERE e.id = $1`, [result.rows[0].id]);
        return sendSuccess(res, 201, "Expense created successfully", formatExpense(joinedRes.rows[0]));
    } catch (error) {
        console.error("Error creating expense:", error.message);
        if (error.code === "23505") {
            return sendError(res, 409, "Expense number already exists");
        }
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

        const existing = await pool.query("SELECT * FROM expenses WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Expense record not found");
        }
        const record = existing.rows[0];

        const val = await validateExpenseInput(req, true);
        if (val.error) return sendError(res, val.status, val.error);

        const {
            expense_number,
            expense_date,
            category,
            expense_type,
            amount,
            description,
            vendor,
            reference_number,
            vehicle_id,
            trip_id,
            driver_id,
            notes
        } = req.body;

        const effectiveNumber = expense_number ? expense_number.trim() : record.expense_number;
        const effectiveCategory = category || expense_type || record.category;

        if (expense_number && expense_number.trim() !== record.expense_number) {
            const dupCheck = await pool.query(
                "SELECT id FROM expenses WHERE LOWER(expense_number) = LOWER($1) AND id != $2",
                [expense_number.trim(), id]
            );
            if (dupCheck.rows.length > 0) {
                return sendError(res, 409, "Expense number already exists");
            }
        }

        const result = await pool.query(
            `
            UPDATE expenses
            SET
                expense_number = COALESCE($1, expense_number),
                expense_date = COALESCE($2, expense_date),
                category = COALESCE($3, category),
                expense_type = COALESCE($3, expense_type),
                amount = COALESCE($4, amount),
                description = COALESCE($5, description),
                vendor = COALESCE($6, vendor),
                reference_number = COALESCE($7, reference_number),
                vehicle_id = COALESCE($8, vehicle_id),
                trip_id = COALESCE($9, trip_id),
                driver_id = COALESCE($10, driver_id),
                notes = COALESCE($11, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *
            `,
            [
                effectiveNumber,
                expense_date || null,
                effectiveCategory,
                amount !== undefined ? parseFloat(amount) : null,
                description ? description.trim() : null,
                vendor ? vendor.trim() : null,
                reference_number ? reference_number.trim() : null,
                vehicle_id || null,
                trip_id || null,
                driver_id || null,
                notes ? notes.trim() : null,
                id
            ]
        );

        const joinedRes = await pool.query(`${BASE_SELECT} WHERE e.id = $1`, [id]);
        return sendSuccess(res, 200, "Expense updated successfully", formatExpense(joinedRes.rows[0]));
    } catch (error) {
        console.error("Error updating expense:", error.message);
        if (error.code === "23505") {
            return sendError(res, 409, "Expense number already exists");
        }
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

        return sendSuccess(res, 200, "Expense deleted successfully", formatExpense(result.rows[0]));
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
    getExpenseSummary,
    getVehicleExpenseSummary,
    getTripExpenseSummary,
    createExpense,
    updateExpense,
    deleteExpense
};
