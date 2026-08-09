const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_TRIP_STATUSES = [
    "Scheduled",
    "Assigned",
    "In Transit",
    "Completed",
    "Cancelled",
    "Delayed"
];

// Helper: Normalize vehicle status check (vehicles DB uses uppercase e.g. AVAILABLE, IN_TRANSIT, MAINTENANCE, OUT_OF_SERVICE)
const isVehicleAvailable = (status) => {
    if (!status) return false;
    const upper = status.toUpperCase();
    return upper === "AVAILABLE";
};

// Helper: Normalize driver status check (drivers DB uses 'Available', 'On Trip', 'Off Duty', 'Inactive', 'Suspended')
const isDriverAvailable = (status) => {
    return status === "Available";
};

// ==========================================
// GET ALL TRIPS
// ==========================================
const getAllTrips = async (req, res) => {
    try {
        const { status, vehicle_id, driver_id, customer_id } = req.query;
        let query = `
            SELECT 
                t.*,
                v.vehicle_code, v.registration_number, v.vehicle_type,
                d.driver_code, d.full_name as driver_name, d.phone as driver_phone,
                c.customer_code, c.company_name as customer_company, c.contact_person as customer_contact
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            params.push(status);
        }
        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID");
            query += ` AND t.vehicle_id = $${paramIndex++}`;
            params.push(vehicle_id);
        }
        if (driver_id) {
            if (!isValidUuid(driver_id)) return sendError(res, 400, "Invalid driver_id UUID");
            query += ` AND t.driver_id = $${paramIndex++}`;
            params.push(driver_id);
        }
        if (customer_id) {
            if (!isValidUuid(customer_id)) return sendError(res, 400, "Invalid customer_id UUID");
            query += ` AND t.customer_id = $${paramIndex++}`;
            params.push(customer_id);
        }

        query += " ORDER BY t.created_at DESC";

        const result = await pool.query(query, params);
        return sendList(res, 200, result.rows);
    } catch (error) {
        console.error("Error fetching trips:", error.message);
        return sendError(res, 500, "Failed to fetch trips", error);
    }
};

// ==========================================
// GET TRIP BY ID
// ==========================================
const getTripById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for trip ID");
        }

        const result = await pool.query(
            `
            SELECT 
                t.*,
                v.vehicle_code, v.registration_number, v.vehicle_type, v.capacity_kg as vehicle_capacity,
                d.driver_code, d.full_name as driver_name, d.phone as driver_phone, d.status as driver_status,
                c.customer_code, c.company_name as customer_company, c.contact_person as customer_contact
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE t.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Trip not found");
        }

        return sendSuccess(res, 200, "Trip fetched successfully", result.rows[0]);
    } catch (error) {
        console.error("Error fetching trip:", error.message);
        return sendError(res, 500, "Failed to fetch trip", error);
    }
};

// ==========================================
// CREATE NEW TRIP
// ==========================================
const createTrip = async (req, res) => {
    const {
        trip_code,
        vehicle_id,
        driver_id,
        customer_id,
        origin,
        destination,
        cargo_description,
        cargo_weight_kg,
        scheduled_start,
        scheduled_end,
        distance_km,
        estimated_cost,
        status
    } = req.body;

    // Validation before acquiring client
    if (!trip_code || !customer_id || !origin || !destination) {
        return sendError(
            res,
            400,
            "trip_code, customer_id, origin, and destination are required"
        );
    }

    if (!isValidUuid(customer_id)) {
        return sendError(res, 400, "Invalid customer_id UUID format");
    }

    if (vehicle_id && !isValidUuid(vehicle_id)) {
        return sendError(res, 400, "Invalid vehicle_id UUID format");
    }

    if (driver_id && !isValidUuid(driver_id)) {
        return sendError(res, 400, "Invalid driver_id UUID format");
    }

    if (cargo_weight_kg !== undefined && cargo_weight_kg < 0) {
        return sendError(res, 400, "cargo_weight_kg cannot be negative");
    }

    if (scheduled_start && scheduled_end) {
        if (new Date(scheduled_start) > new Date(scheduled_end)) {
            return sendError(res, 400, "scheduled_start cannot be after scheduled_end");
        }
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Verify Customer exists
        const custRes = await client.query("SELECT id, status FROM customers WHERE id = $1", [customer_id]);
        if (custRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Customer not found");
        }
        if (custRes.rows[0].status === "Inactive") {
            await client.query("ROLLBACK");
            return sendError(res, 400, "Cannot assign trip to an Inactive customer");
        }

        let vehicleObj = null;
        if (vehicle_id) {
            const vRes = await client.query("SELECT id, status, capacity_kg FROM vehicles WHERE id = $1", [vehicle_id]);
            if (vRes.rows.length === 0) {
                await client.query("ROLLBACK");
                return sendError(res, 404, "Vehicle not found");
            }
            vehicleObj = vRes.rows[0];

            if (!isVehicleAvailable(vehicleObj.status)) {
                await client.query("ROLLBACK");
                return sendError(res, 400, `Vehicle is not available (Current status: ${vehicleObj.status})`);
            }

            if (cargo_weight_kg && parseFloat(cargo_weight_kg) > parseFloat(vehicleObj.capacity_kg)) {
                await client.query("ROLLBACK");
                return sendError(
                    res,
                    400,
                    `Cargo weight (${cargo_weight_kg} kg) exceeds vehicle capacity (${vehicleObj.capacity_kg} kg)`
                );
            }
        }

        let driverObj = null;
        if (driver_id) {
            const dRes = await client.query("SELECT id, status FROM drivers WHERE id = $1", [driver_id]);
            if (dRes.rows.length === 0) {
                await client.query("ROLLBACK");
                return sendError(res, 404, "Driver not found");
            }
            driverObj = dRes.rows[0];

            if (!isDriverAvailable(driverObj.status)) {
                await client.query("ROLLBACK");
                return sendError(res, 400, `Driver is not available (Current status: ${driverObj.status})`);
            }
        }

        let initialStatus = status || "Scheduled";
        if (vehicle_id && driver_id && (!status || status === "Scheduled")) {
            initialStatus = "Assigned";
        }

        if (!VALID_TRIP_STATUSES.includes(initialStatus)) {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Invalid trip status. Allowed values: ${VALID_TRIP_STATUSES.join(", ")}`);
        }

        const insertRes = await client.query(
            `
            INSERT INTO trips (
                trip_code,
                vehicle_id,
                driver_id,
                customer_id,
                origin,
                destination,
                cargo_description,
                cargo_weight_kg,
                scheduled_start,
                scheduled_end,
                distance_km,
                estimated_cost,
                status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING *
            `,
            [
                trip_code,
                vehicle_id || null,
                driver_id || null,
                customer_id,
                origin,
                destination,
                cargo_description || null,
                cargo_weight_kg || 0,
                scheduled_start || null,
                scheduled_end || null,
                distance_km || 0,
                estimated_cost || 0,
                initialStatus
            ]
        );

        // Update vehicle and driver status if assigned/in transit
        if (vehicle_id && (initialStatus === "Assigned" || initialStatus === "In Transit")) {
            await client.query("UPDATE vehicles SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicle_id]);
        }
        if (driver_id && (initialStatus === "Assigned" || initialStatus === "In Transit")) {
            await client.query("UPDATE drivers SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [driver_id]);
        }

        await client.query("COMMIT");
        return sendSuccess(res, 201, "Trip created successfully", insertRes.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating trip:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Trip code already exists");
        }

        return sendError(res, 500, "Failed to create trip", error);
    } finally {
        client.release();
    }
};

// ==========================================
// ASSIGN TRIP (MODULE 5 BUSINESS LOGIC)
// ==========================================
const assignTrip = async (req, res) => {
    const { id } = req.params;
    const { vehicle_id, driver_id } = req.body;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid trip ID UUID format");
    }

    if (!vehicle_id || !driver_id) {
        return sendError(res, 400, "vehicle_id and driver_id are required for assignment");
    }

    if (!isValidUuid(vehicle_id) || !isValidUuid(driver_id)) {
        return sendError(res, 400, "Invalid vehicle_id or driver_id UUID format");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Fetch trip
        const tripRes = await client.query("SELECT * FROM trips WHERE id = $1", [id]);
        if (tripRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Trip not found");
        }
        const trip = tripRes.rows[0];

        if (trip.status === "Completed" || trip.status === "Cancelled") {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Cannot reassign a trip that is already ${trip.status}`);
        }

        // 2. Fetch & Validate Vehicle
        const vRes = await client.query("SELECT id, status, capacity_kg FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicle = vRes.rows[0];

        // If vehicle is changed, verify vehicle is available
        if (trip.vehicle_id !== vehicle_id && !isVehicleAvailable(vehicle.status)) {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Vehicle is not available (Current status: ${vehicle.status})`);
        }

        if (trip.cargo_weight_kg && parseFloat(trip.cargo_weight_kg) > parseFloat(vehicle.capacity_kg)) {
            await client.query("ROLLBACK");
            return sendError(
                res,
                400,
                `Trip cargo weight (${trip.cargo_weight_kg} kg) exceeds vehicle capacity (${vehicle.capacity_kg} kg)`
            );
        }

        // 3. Fetch & Validate Driver
        const dRes = await client.query("SELECT id, status FROM drivers WHERE id = $1", [driver_id]);
        if (dRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Driver not found");
        }
        const driver = dRes.rows[0];

        if (driver.status === "Suspended" || driver.status === "Inactive") {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Driver cannot be assigned because status is ${driver.status}`);
        }

        if (trip.driver_id !== driver_id && !isDriverAvailable(driver.status)) {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Driver is not available (Current status: ${driver.status})`);
        }

        // Release old vehicle/driver if being replaced
        if (trip.vehicle_id && trip.vehicle_id !== vehicle_id) {
            await client.query("UPDATE vehicles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.vehicle_id]);
        }
        if (trip.driver_id && trip.driver_id !== driver_id) {
            await client.query("UPDATE drivers SET status = 'Available', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.driver_id]);
        }

        // Update trip assignment
        const updatedTripRes = await client.query(
            `
            UPDATE trips
            SET
                vehicle_id = $1,
                driver_id = $2,
                status = 'Assigned',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
            `,
            [vehicle_id, driver_id, id]
        );

        // Update new vehicle & driver to On Trip / In Transit
        await client.query("UPDATE vehicles SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicle_id]);
        await client.query("UPDATE drivers SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [driver_id]);

        await client.query("COMMIT");
        return sendSuccess(res, 200, "Trip assigned successfully", updatedTripRes.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error assigning trip:", error.message);
        return sendError(res, 500, "Failed to assign trip", error);
    } finally {
        client.release();
    }
};

// ==========================================
// UPDATE TRIP STATUS
// ==========================================
const updateTripStatus = async (req, res) => {
    const { id } = req.params;
    const { status, actual_start, actual_end, actual_cost } = req.body;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid trip ID UUID format");
    }

    if (!status || !VALID_TRIP_STATUSES.includes(status)) {
        return sendError(res, 400, `Invalid status. Allowed values: ${VALID_TRIP_STATUSES.join(", ")}`);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const tripRes = await client.query("SELECT * FROM trips WHERE id = $1", [id]);
        if (tripRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Trip not found");
        }
        const trip = tripRes.rows[0];

        let effectiveActualStart = actual_start || trip.actual_start;
        let effectiveActualEnd = actual_end || trip.actual_end;

        if (status === "In Transit" && !effectiveActualStart) {
            effectiveActualStart = new Date().toISOString();
        }
        if ((status === "Completed" || status === "Cancelled") && !effectiveActualEnd) {
            effectiveActualEnd = new Date().toISOString();
        }

        const updateRes = await client.query(
            `
            UPDATE trips
            SET
                status = $1,
                actual_start = $2,
                actual_end = $3,
                actual_cost = COALESCE($4, actual_cost),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
            `,
            [status, effectiveActualStart, effectiveActualEnd, actual_cost, id]
        );

        // Handle Vehicle & Driver Status Transitions
        if (status === "Completed" || status === "Cancelled") {
            if (trip.vehicle_id) {
                await client.query("UPDATE vehicles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.vehicle_id]);
            }
            if (trip.driver_id) {
                await client.query("UPDATE drivers SET status = 'Available', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.driver_id]);
            }
        } else if (status === "In Transit" || status === "Assigned") {
            if (trip.vehicle_id) {
                await client.query("UPDATE vehicles SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.vehicle_id]);
            }
            if (trip.driver_id) {
                await client.query("UPDATE drivers SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.driver_id]);
            }
        }

        await client.query("COMMIT");
        return sendSuccess(res, 200, `Trip status updated to ${status}`, updateRes.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating trip status:", error.message);
        return sendError(res, 500, "Failed to update trip status", error);
    } finally {
        client.release();
    }
};

// ==========================================
// UPDATE TRIP
// ==========================================
const updateTrip = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for trip ID");
        }

        const {
            trip_code,
            origin,
            destination,
            cargo_description,
            cargo_weight_kg,
            scheduled_start,
            scheduled_end,
            actual_start,
            actual_end,
            distance_km,
            estimated_cost,
            actual_cost,
            status
        } = req.body;

        if (status && !VALID_TRIP_STATUSES.includes(status)) {
            return sendError(res, 400, `Invalid status. Allowed values: ${VALID_TRIP_STATUSES.join(", ")}`);
        }

        const existing = await pool.query("SELECT id FROM trips WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Trip not found");
        }

        const result = await pool.query(
            `
            UPDATE trips
            SET
                trip_code = COALESCE($1, trip_code),
                origin = COALESCE($2, origin),
                destination = COALESCE($3, destination),
                cargo_description = COALESCE($4, cargo_description),
                cargo_weight_kg = COALESCE($5, cargo_weight_kg),
                scheduled_start = COALESCE($6, scheduled_start),
                scheduled_end = COALESCE($7, scheduled_end),
                actual_start = COALESCE($8, actual_start),
                actual_end = COALESCE($9, actual_end),
                distance_km = COALESCE($10, distance_km),
                estimated_cost = COALESCE($11, estimated_cost),
                actual_cost = COALESCE($12, actual_cost),
                status = COALESCE($13, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $14
            RETURNING *
            `,
            [
                trip_code,
                origin,
                destination,
                cargo_description,
                cargo_weight_kg,
                scheduled_start,
                scheduled_end,
                actual_start,
                actual_end,
                distance_km,
                estimated_cost,
                actual_cost,
                status,
                id
            ]
        );

        return sendSuccess(res, 200, "Trip updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating trip:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Trip code already exists");
        }

        return sendError(res, 500, "Failed to update trip", error);
    }
};

// ==========================================
// DELETE TRIP
// ==========================================
const deleteTrip = async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid UUID format for trip ID");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const tripRes = await client.query("SELECT * FROM trips WHERE id = $1", [id]);
        if (tripRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Trip not found");
        }
        const trip = tripRes.rows[0];

        // Delete trip
        const deleteRes = await client.query("DELETE FROM trips WHERE id = $1 RETURNING *", [id]);

        // Release vehicle & driver if active
        if (trip.status === "In Transit" || trip.status === "Assigned") {
            if (trip.vehicle_id) {
                await client.query("UPDATE vehicles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.vehicle_id]);
            }
            if (trip.driver_id) {
                await client.query("UPDATE drivers SET status = 'Available', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [trip.driver_id]);
            }
        }

        await client.query("COMMIT");
        return sendSuccess(res, 200, "Trip deleted successfully", deleteRes.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error deleting trip:", error.message);
        return sendError(res, 500, "Failed to delete trip", error);
    } finally {
        client.release();
    }
};

module.exports = {
    getAllTrips,
    getTripById,
    createTrip,
    assignTrip,
    updateTripStatus,
    updateTrip,
    deleteTrip
};
