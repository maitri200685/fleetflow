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

// Helper: Normalize vehicle status check (vehicles DB uses AVAILABLE, IN_TRANSIT, MAINTENANCE, OUT_OF_SERVICE)
const isVehicleAvailable = (status) => {
    if (!status) return false;
    const upper = status.toUpperCase();
    return upper === "AVAILABLE";
};

// Helper: Normalize driver status check (drivers DB uses 'Available', 'On Trip', 'Off Duty', 'Inactive', 'Suspended')
const isDriverAvailable = (status) => {
    return status === "Available";
};

// Helper: Format trip output object with comprehensive aliases
const formatTrip = (row) => {
    if (!row) return null;
    const tripNum = row.trip_number || row.trip_code || "";
    const sourceVal = row.source || row.origin || "";
    const destVal = row.destination || "";
    const weightVal = row.cargo_weight !== null && row.cargo_weight !== undefined ? parseFloat(row.cargo_weight) : (row.cargo_weight_kg ? parseFloat(row.cargo_weight_kg) : 0);
    const startVal = row.start_datetime || row.scheduled_start || null;
    const endVal = row.expected_end_datetime || row.scheduled_end || null;

    return {
        ...row,
        trip_number: tripNum,
        trip_code: tripNum,
        source: sourceVal,
        origin: sourceVal,
        cargo_weight: weightVal,
        cargo_weight_kg: weightVal,
        start_datetime: startVal,
        scheduled_start: startVal,
        expected_end_datetime: endVal,
        scheduled_end: endVal,
        customer_name: row.customer_company || row.customer_name || row.customer_contact || "N/A",
        customer: row.customer_company || row.customer_name || row.customer_contact || "N/A",
        vehicle_number: row.vehicle_number || row.registration_number || row.vehicle_code || "N/A",
        vehicle: row.vehicle_number || row.registration_number || row.vehicle_code || "N/A",
        driver_name: row.driver_name || row.full_name || "N/A",
        driver: row.driver_name || row.full_name || "N/A"
    };
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
                v.vehicle_number, v.vehicle_code, v.registration_number, v.vehicle_type,
                d.driver_code, d.name as driver_name, d.full_name as driver_full_name, d.phone as driver_phone,
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
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            query += ` AND t.vehicle_id = $${paramIndex++}`;
            params.push(vehicle_id);
        }
        if (driver_id) {
            if (!isValidUuid(driver_id)) return sendError(res, 400, "Invalid driver_id UUID format");
            query += ` AND t.driver_id = $${paramIndex++}`;
            params.push(driver_id);
        }
        if (customer_id) {
            if (!isValidUuid(customer_id)) return sendError(res, 400, "Invalid customer_id UUID format");
            query += ` AND t.customer_id = $${paramIndex++}`;
            params.push(customer_id);
        }

        query += " ORDER BY t.created_at DESC";

        const result = await pool.query(query, params);
        const formatted = result.rows.map(formatTrip);

        return sendList(res, 200, formatted);
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
                v.vehicle_number, v.vehicle_code, v.registration_number, v.vehicle_type, COALESCE(v.capacity, v.capacity_kg) as vehicle_capacity,
                d.driver_code, d.name as driver_name, d.full_name as driver_full_name, d.phone as driver_phone, d.status as driver_status,
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

        return sendSuccess(res, 200, "Trip fetched successfully", formatTrip(result.rows[0]));
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
        trip_number,
        trip_code,
        vehicle_id,
        driver_id,
        customer_id,
        source,
        origin,
        destination,
        cargo_description,
        cargo_weight,
        cargo_weight_kg,
        start_datetime,
        scheduled_start,
        expected_end_datetime,
        scheduled_end,
        distance_km,
        estimated_cost,
        status,
        notes
    } = req.body;

    const effectiveTripCode = trip_number || trip_code || `TRIP-${Date.now()}`;
    const effectiveSource = source || origin;
    const effectiveStart = start_datetime || scheduled_start;
    const effectiveEnd = expected_end_datetime || scheduled_end;
    const effectiveWeight = cargo_weight !== undefined ? cargo_weight : cargo_weight_kg;

    // Required Fields Validation
    if (!customer_id) {
        return sendError(res, 400, "customer_id is required");
    }
    if (!isValidUuid(customer_id)) {
        return sendError(res, 400, "Invalid customer_id UUID format");
    }

    if (!vehicle_id) {
        return sendError(res, 400, "vehicle_id is required");
    }
    if (!isValidUuid(vehicle_id)) {
        return sendError(res, 400, "Invalid vehicle_id UUID format");
    }

    if (!driver_id) {
        return sendError(res, 400, "driver_id is required");
    }
    if (!isValidUuid(driver_id)) {
        return sendError(res, 400, "Invalid driver_id UUID format");
    }

    if (!effectiveSource || typeof effectiveSource !== "string" || !effectiveSource.trim()) {
        return sendError(res, 400, "source / origin is required");
    }

    if (!destination || typeof destination !== "string" || !destination.trim()) {
        return sendError(res, 400, "destination is required");
    }

    if (!effectiveStart || isNaN(Date.parse(effectiveStart))) {
        return sendError(res, 400, "valid start_datetime / scheduled_start is required");
    }

    if (!effectiveEnd || isNaN(Date.parse(effectiveEnd))) {
        return sendError(res, 400, "valid expected_end_datetime / scheduled_end is required");
    }

    if (new Date(effectiveStart) >= new Date(effectiveEnd)) {
        return sendError(res, 400, "scheduled_start cannot be after scheduled_end");
    }

    if (effectiveWeight !== undefined && effectiveWeight !== null && (isNaN(parseFloat(effectiveWeight)) || parseFloat(effectiveWeight) <= 0)) {
        return sendError(res, 400, "cargo_weight must be a positive numeric value");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Duplicate Trip Number Check
        const dupCheck = await client.query(
            "SELECT id FROM trips WHERE LOWER(trip_code) = LOWER($1) OR LOWER(trip_number) = LOWER($1)",
            [effectiveTripCode.trim()]
        );
        if (dupCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Trip number already exists");
        }

        // 2. Verify Customer Exists & Active
        const custRes = await client.query("SELECT id, status FROM customers WHERE id = $1", [customer_id]);
        if (custRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Customer not found");
        }
        if (custRes.rows[0].status === "Inactive") {
            await client.query("ROLLBACK");
            return sendError(res, 400, "Cannot assign trip to an Inactive customer");
        }

        // 3. Verify Vehicle Exists, Active & Available
        const vRes = await client.query("SELECT id, status, COALESCE(capacity, capacity_kg) as capacity_kg FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicleObj = vRes.rows[0];

        if (!isVehicleAvailable(vehicleObj.status)) {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Vehicle is not available (Current status: ${vehicleObj.status})`);
        }

        if (effectiveWeight && parseFloat(effectiveWeight) > parseFloat(vehicleObj.capacity_kg)) {
            await client.query("ROLLBACK");
            return sendError(
                res,
                400,
                `Cargo weight (${effectiveWeight} kg) exceeds vehicle capacity (${vehicleObj.capacity_kg} kg)`
            );
        }

        // Active Trip Conflict Check for Vehicle
        const activeVehicleTrip = await client.query(
            "SELECT id FROM trips WHERE vehicle_id = $1 AND status IN ('Assigned', 'In Transit')",
            [vehicle_id]
        );
        if (activeVehicleTrip.rows.length > 0) {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Vehicle is already assigned to an active trip");
        }

        // Vehicle Maintenance Lock Check (Phase 7 & Phase 18)
        const activeMaintenance = await client.query(
            "SELECT id FROM maintenance WHERE vehicle_id = $1 AND status IN ('Scheduled', 'In Progress')",
            [vehicle_id]
        );
        if (activeMaintenance.rows.length > 0 || vehicleObj.status === "MAINTENANCE") {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Vehicle is currently under maintenance and cannot be assigned to a trip");
        }

        // 4. Verify Driver Exists, Active & Available
        const dRes = await client.query("SELECT id, status FROM drivers WHERE id = $1", [driver_id]);
        if (dRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Driver not found");
        }
        const driverObj = dRes.rows[0];

        if (!isDriverAvailable(driverObj.status)) {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Driver is not available (Current status: ${driverObj.status})`);
        }

        // Active Trip Conflict Check for Driver
        const activeDriverTrip = await client.query(
            "SELECT id FROM trips WHERE driver_id = $1 AND status IN ('Assigned', 'In Transit')",
            [driver_id]
        );
        if (activeDriverTrip.rows.length > 0) {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Driver is already assigned to an active trip");
        }

        let initialStatus = status || "Assigned";
        if (!VALID_TRIP_STATUSES.includes(initialStatus)) {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Invalid trip status. Allowed values: ${VALID_TRIP_STATUSES.join(", ")}`);
        }

        const insertRes = await client.query(
            `
            INSERT INTO trips (
                trip_code,
                trip_number,
                vehicle_id,
                driver_id,
                customer_id,
                origin,
                source,
                destination,
                cargo_description,
                cargo_weight_kg,
                cargo_weight,
                scheduled_start,
                start_datetime,
                scheduled_end,
                expected_end_datetime,
                distance_km,
                estimated_cost,
                status,
                notes
            )
            VALUES (
                $1, $1, $2, $3, $4, $5, $5, $6, $7, $8, $8, $9, $9, $10, $10, $11, $12, $13, $14
            )
            RETURNING *
            `,
            [
                effectiveTripCode.trim(),
                vehicle_id,
                driver_id,
                customer_id,
                effectiveSource.trim(),
                destination.trim(),
                cargo_description || null,
                effectiveWeight ? parseFloat(effectiveWeight) : 0,
                effectiveStart,
                effectiveEnd,
                distance_km || 0,
                estimated_cost || 0,
                initialStatus,
                notes || null
            ]
        );

        // Update vehicle & driver status if assigned / in transit
        if (initialStatus === "Assigned" || initialStatus === "In Transit") {
            await client.query("UPDATE vehicles SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicle_id]);
            await client.query("UPDATE drivers SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [driver_id]);
        }

        await client.query("COMMIT");
        return sendSuccess(res, 201, "Trip created successfully", formatTrip(insertRes.rows[0]));
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating trip:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Trip number already exists");
        }

        return sendError(res, 500, "Failed to create trip", error);
    } finally {
        client.release();
    }
};

// ==========================================
// ASSIGN TRIP
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

        // Validate Vehicle
        const vRes = await client.query("SELECT id, status, COALESCE(capacity, capacity_kg) as capacity_kg FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicle = vRes.rows[0];

        if (trip.vehicle_id !== vehicle_id) {
            if (!isVehicleAvailable(vehicle.status)) {
                await client.query("ROLLBACK");
                return sendError(res, 400, `Vehicle is not available (Current status: ${vehicle.status})`);
            }
            const activeVehicleTrip = await client.query(
                "SELECT id FROM trips WHERE vehicle_id = $1 AND status IN ('Assigned', 'In Transit') AND id != $2",
                [vehicle_id, id]
            );
            if (activeVehicleTrip.rows.length > 0) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Vehicle is already assigned to an active trip");
            }
            // Maintenance check
            const activeMaintenance = await client.query(
                "SELECT id FROM maintenance WHERE vehicle_id = $1 AND status IN ('Scheduled', 'In Progress')",
                [vehicle_id]
            );
            if (activeMaintenance.rows.length > 0 || vehicle.status === "MAINTENANCE") {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Vehicle is currently under maintenance and cannot be assigned to a trip");
            }
        }

        if (trip.cargo_weight_kg && parseFloat(trip.cargo_weight_kg) > parseFloat(vehicle.capacity_kg)) {
            await client.query("ROLLBACK");
            return sendError(
                res,
                400,
                `Trip cargo weight (${trip.cargo_weight_kg} kg) exceeds vehicle capacity (${vehicle.capacity_kg} kg)`
            );
        }

        // Validate Driver
        const dRes = await client.query("SELECT id, status FROM drivers WHERE id = $1", [driver_id]);
        if (dRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Driver not found");
        }
        const driver = dRes.rows[0];

        if (trip.driver_id !== driver_id) {
            if (!isDriverAvailable(driver.status)) {
                await client.query("ROLLBACK");
                return sendError(res, 400, `Driver is not available (Current status: ${driver.status})`);
            }
            const activeDriverTrip = await client.query(
                "SELECT id FROM trips WHERE driver_id = $1 AND status IN ('Assigned', 'In Transit') AND id != $2",
                [driver_id, id]
            );
            if (activeDriverTrip.rows.length > 0) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Driver is already assigned to an active trip");
            }
        }

        // Release old vehicle/driver if changed
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
        return sendSuccess(res, 200, "Trip assigned successfully", formatTrip(updatedTripRes.rows[0]));
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

        // Status Transition Rules Validation
        if (trip.status === "Completed" && status !== "Completed") {
            await client.query("ROLLBACK");
            return sendError(res, 400, "Cannot change status of a completed trip");
        }
        if (trip.status === "Cancelled" && status !== "Cancelled") {
            await client.query("ROLLBACK");
            return sendError(res, 400, "Cannot change status of a cancelled trip");
        }

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

        // Vehicle & Driver Status Synchronization
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
        return sendSuccess(res, 200, `Trip status updated to ${status}`, formatTrip(updateRes.rows[0]));
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
            trip_number,
            trip_code,
            source,
            origin,
            destination,
            cargo_description,
            cargo_weight,
            cargo_weight_kg,
            start_datetime,
            scheduled_start,
            expected_end_datetime,
            scheduled_end,
            actual_start,
            actual_end,
            distance_km,
            estimated_cost,
            actual_cost,
            status,
            notes
        } = req.body;

        if (status && !VALID_TRIP_STATUSES.includes(status)) {
            return sendError(res, 400, `Invalid status. Allowed values: ${VALID_TRIP_STATUSES.join(", ")}`);
        }

        const effectiveStart = start_datetime || scheduled_start;
        const effectiveEnd = expected_end_datetime || scheduled_end;
        if (effectiveStart && effectiveEnd && new Date(effectiveStart) >= new Date(effectiveEnd)) {
            return sendError(res, 400, "scheduled_start cannot be after scheduled_end");
        }

        const existing = await pool.query("SELECT id, status FROM trips WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Trip not found");
        }

        const tripNum = trip_number || trip_code;
        const srcVal = source || origin;
        const weightVal = cargo_weight !== undefined ? cargo_weight : cargo_weight_kg;

        const result = await pool.query(
            `
            UPDATE trips
            SET
                trip_code = COALESCE($1, trip_code),
                trip_number = COALESCE($1, trip_number),
                origin = COALESCE($2, origin),
                source = COALESCE($2, source),
                destination = COALESCE($3, destination),
                cargo_description = COALESCE($4, cargo_description),
                cargo_weight_kg = COALESCE($5, cargo_weight_kg),
                cargo_weight = COALESCE($5, cargo_weight),
                scheduled_start = COALESCE($6, scheduled_start),
                start_datetime = COALESCE($6, start_datetime),
                scheduled_end = COALESCE($7, scheduled_end),
                expected_end_datetime = COALESCE($7, expected_end_datetime),
                actual_start = COALESCE($8, actual_start),
                actual_end = COALESCE($9, actual_end),
                distance_km = COALESCE($10, distance_km),
                estimated_cost = COALESCE($11, estimated_cost),
                actual_cost = COALESCE($12, actual_cost),
                status = COALESCE($13, status),
                notes = COALESCE($14, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $15
            RETURNING *
            `,
            [
                tripNum ? tripNum.trim() : null,
                srcVal ? srcVal.trim() : null,
                destination ? destination.trim() : null,
                cargo_description || null,
                weightVal !== undefined ? parseFloat(weightVal) : null,
                effectiveStart || null,
                effectiveEnd || null,
                actual_start || null,
                actual_end || null,
                distance_km || null,
                estimated_cost || null,
                actual_cost || null,
                status || null,
                notes || null,
                id
            ]
        );

        return sendSuccess(res, 200, "Trip updated successfully", formatTrip(result.rows[0]));
    } catch (error) {
        console.error("Error updating trip:", error.message);

        if (error.code === "23505") {
            return sendError(res, 409, "Trip number already exists");
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
        return sendSuccess(res, 200, "Trip deleted successfully", formatTrip(deleteRes.rows[0]));
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
