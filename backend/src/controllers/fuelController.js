const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

// Helper: Attach fuel efficiency and alias properties to fuel records
const attachEfficiency = (rows) => {
    // Sort chronologically ascending to calculate efficiency sequence
    const sorted = [...rows].sort((a, b) => {
        const d1 = new Date(a.fuel_date).getTime();
        const d2 = new Date(b.fuel_date).getTime();
        if (d1 !== d2) return d1 - d2;
        const o1 = parseFloat(a.odometer !== undefined ? a.odometer : (a.odometer_km || 0));
        const o2 = parseFloat(b.odometer !== undefined ? b.odometer : (b.odometer_km || 0));
        return o1 - o2;
    });

    const calculatedMap = new Map();

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const curOdo = parseFloat(current.odometer !== undefined ? current.odometer : (current.odometer_km || 0));
        const curLiters = parseFloat(current.liters !== undefined ? current.liters : (current.quantity_liters || 0));

        let efficiency = null;

        if (i > 0) {
            const prev = sorted[i - 1];
            const prevOdo = parseFloat(prev.odometer !== undefined ? prev.odometer : (prev.odometer_km || 0));
            const distance = curOdo - prevOdo;

            if (distance > 0 && curLiters > 0) {
                efficiency = Math.round((distance / curLiters) * 100) / 100;
            }
        }

        calculatedMap.set(current.id, efficiency);
    }

    // Return in requested order with normalized fields
    return rows.map(r => {
        const litersVal = r.liters !== undefined && r.liters !== null ? parseFloat(r.liters) : (r.quantity_liters ? parseFloat(r.quantity_liters) : 0);
        const odoVal = r.odometer !== undefined && r.odometer !== null ? parseFloat(r.odometer) : (r.odometer_km ? parseFloat(r.odometer_km) : 0);
        const priceVal = r.price_per_liter ? parseFloat(r.price_per_liter) : 0;
        const costVal = r.total_cost ? parseFloat(r.total_cost) : 0;
        const stationVal = r.fuel_station || r.station_name || "N/A";
        const vehNum = r.vehicle_number || r.registration_number || r.vehicle_code || "N/A";

        return {
            ...r,
            liters: litersVal,
            quantity_liters: litersVal,
            odometer: odoVal,
            odometer_km: odoVal,
            price_per_liter: priceVal,
            total_cost: costVal,
            fuel_station: stationVal,
            station_name: stationVal,
            vehicle_number: vehNum,
            vehicle_code: vehNum,
            efficiency: calculatedMap.get(r.id)
        };
    });
};

// ==========================================
// GET ALL FUEL RECORDS
// ==========================================
const getAllFuelRecords = async (req, res) => {
    try {
        const { vehicle_id } = req.query;
        let query = `
            SELECT 
                f.*,
                v.vehicle_number, v.vehicle_code, v.registration_number, v.vehicle_type
            FROM fuel_records f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            query += " AND f.vehicle_id = $1";
            params.push(vehicle_id);
        }

        query += " ORDER BY f.fuel_date DESC, f.created_at DESC";

        const result = await pool.query(query, params);
        const formatted = attachEfficiency(result.rows);

        return sendList(res, 200, formatted);
    } catch (error) {
        console.error("Error fetching fuel records:", error.message);
        return sendError(res, 500, "Failed to fetch fuel records", error);
    }
};

// ==========================================
// GET FUEL RECORD BY ID
// ==========================================
const getFuelRecordById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for fuel record ID");
        }

        const result = await pool.query(
            `
            SELECT 
                f.*,
                v.vehicle_number, v.vehicle_code, v.registration_number
            FROM fuel_records f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE f.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Fuel record not found");
        }

        // Fetch all records for this vehicle to compute correct efficiency sequence
        const vehId = result.rows[0].vehicle_id;
        const allVehRecords = await pool.query(
            "SELECT f.*, v.vehicle_number, v.vehicle_code, v.registration_number FROM fuel_records f JOIN vehicles v ON f.vehicle_id = v.id WHERE f.vehicle_id = $1",
            [vehId]
        );
        const formattedAll = attachEfficiency(allVehRecords.rows);
        const target = formattedAll.find(r => r.id === id);

        return sendSuccess(res, 200, "Fuel record fetched successfully", target || result.rows[0]);
    } catch (error) {
        console.error("Error fetching fuel record:", error.message);
        return sendError(res, 500, "Failed to fetch fuel record", error);
    }
};

// ==========================================
// GET VEHICLE FUEL HISTORY
// ==========================================
const getVehicleFuelHistory = async (req, res) => {
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
            `
            SELECT f.*, v.vehicle_number, v.vehicle_code, v.registration_number
            FROM fuel_records f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE f.vehicle_id = $1
            ORDER BY f.fuel_date DESC, f.created_at DESC
            `,
            [id]
        );

        const formatted = attachEfficiency(result.rows);
        return sendList(res, 200, formatted);
    } catch (error) {
        console.error("Error fetching vehicle fuel history:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle fuel history", error);
    }
};

// ==========================================
// GET VEHICLE FUEL SUMMARY
// ==========================================
const getVehicleFuelSummary = async (req, res) => {
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

        const result = await pool.query(
            "SELECT * FROM fuel_records WHERE vehicle_id = $1 ORDER BY fuel_date ASC, odometer_km ASC",
            [id]
        );

        if (result.rows.length === 0) {
            return sendSuccess(res, 200, "Vehicle fuel summary fetched successfully", {
                vehicle_id: id,
                total_liters: 0,
                total_cost: 0,
                average_price_per_liter: 0,
                latest_odometer: 0,
                average_fuel_efficiency: null
            });
        }

        const formatted = attachEfficiency(result.rows);
        const totalLiters = formatted.reduce((acc, r) => acc + r.liters, 0);
        const totalCost = formatted.reduce((acc, r) => acc + r.total_cost, 0);
        const avgPrice = totalLiters > 0 ? Math.round((totalCost / totalLiters) * 100) / 100 : 0;
        const latestOdo = Math.max(...formatted.map(r => r.odometer));

        // Average Efficiency: total distance travelled after first record / total fuel consumed after first record
        let avgEfficiency = null;
        if (formatted.length >= 2) {
            const firstOdo = formatted[0].odometer;
            const totalDist = latestOdo - firstOdo;
            // Sum liters of records after initial fill
            const subLiters = formatted.slice(1).reduce((acc, r) => acc + r.liters, 0);
            if (totalDist > 0 && subLiters > 0) {
                avgEfficiency = Math.round((totalDist / subLiters) * 100) / 100;
            }
        }

        return sendSuccess(res, 200, "Vehicle fuel summary fetched successfully", {
            vehicle_id: id,
            vehicle_number: vehicle.vehicle_number || vehicle.registration_number || vehicle.vehicle_code,
            total_liters: Math.round(totalLiters * 100) / 100,
            total_cost: Math.round(totalCost * 100) / 100,
            average_price_per_liter: avgPrice,
            latest_odometer: latestOdo,
            average_fuel_efficiency: avgEfficiency
        });
    } catch (error) {
        console.error("Error fetching vehicle fuel summary:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle fuel summary", error);
    }
};

// ==========================================
// CREATE FUEL RECORD
// ==========================================
const createFuelRecord = async (req, res) => {
    const {
        vehicle_id,
        fuel_date,
        liters,
        quantity_liters,
        price_per_liter,
        odometer,
        odometer_km,
        fuel_station,
        station_name,
        notes
    } = req.body;

    const effectiveLiters = liters !== undefined ? liters : quantity_liters;
    const effectiveOdometer = odometer !== undefined ? odometer : odometer_km;
    const effectiveStation = fuel_station !== undefined ? fuel_station : station_name;

    // Required Field Validations
    if (!vehicle_id) {
        return sendError(res, 400, "vehicle_id is required");
    }
    if (!isValidUuid(vehicle_id)) {
        return sendError(res, 400, "Invalid vehicle_id UUID format");
    }

    if (!fuel_date || isNaN(Date.parse(fuel_date))) {
        return sendError(res, 400, "valid fuel_date is required");
    }

    if (effectiveLiters === undefined || effectiveLiters === null || isNaN(parseFloat(effectiveLiters)) || parseFloat(effectiveLiters) <= 0) {
        return sendError(res, 400, "liters / quantity_liters must be greater than 0");
    }

    if (price_per_liter === undefined || price_per_liter === null || isNaN(parseFloat(price_per_liter)) || parseFloat(price_per_liter) <= 0) {
        return sendError(res, 400, "price_per_liter must be greater than 0");
    }

    if (effectiveOdometer === undefined || effectiveOdometer === null || isNaN(parseFloat(effectiveOdometer)) || parseFloat(effectiveOdometer) < 0) {
        return sendError(res, 400, "odometer / odometer_km must be a non-negative number");
    }

    if (effectiveStation && typeof effectiveStation === "string" && !effectiveStation.trim()) {
        return sendError(res, 400, "fuel_station / station_name cannot be empty whitespace");
    }

    const qty = parseFloat(effectiveLiters);
    const price = parseFloat(price_per_liter);
    const odo = parseFloat(effectiveOdometer);

    // Automatic Backend Total Cost Calculation: liters * price_per_liter
    const calculatedTotalCost = Math.round(qty * price * 100) / 100;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Verify Vehicle Exists & Status
        const vRes = await client.query("SELECT id, status, current_mileage_km, fuel_type FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Vehicle not found");
        }
        const vehicle = vRes.rows[0];

        if (vehicle.status === "INACTIVE" || vehicle.status === "OUT_OF_SERVICE") {
            await client.query("ROLLBACK");
            return sendError(res, 400, `Cannot record fuel log for vehicle in ${vehicle.status} status`);
        }

        // 2. Odometer Sequence Validation (Phase 4)
        const prevFuelRes = await client.query(
            "SELECT odometer_km, odometer FROM fuel_records WHERE vehicle_id = $1 ORDER BY fuel_date DESC, odometer_km DESC LIMIT 1",
            [vehicle_id]
        );
        if (prevFuelRes.rows.length > 0) {
            const prevOdo = parseFloat(prevFuelRes.rows[0].odometer !== null && prevFuelRes.rows[0].odometer !== undefined ? prevFuelRes.rows[0].odometer : prevFuelRes.rows[0].odometer_km);
            if (odo < prevOdo) {
                await client.query("ROLLBACK");
                return sendError(res, 400, `New odometer reading cannot be lower than the previous reading (${prevOdo} km)`);
            }
        }

        const stationVal = effectiveStation ? effectiveStation.trim() : null;
        const notesVal = notes ? notes.trim() : null;
        const fType = vehicle.fuel_type || "DIESEL";

        const insertRes = await client.query(
            `
            INSERT INTO fuel_records (
                vehicle_id,
                fuel_date,
                fuel_type,
                quantity_liters,
                liters,
                price_per_liter,
                total_cost,
                odometer_km,
                odometer,
                station_name,
                fuel_station,
                notes
            )
            VALUES (
                $1, $2, $3, $4, $4, $5, $6, $7, $7, $8, $8, $9
            )
            RETURNING *
            `,
            [
                vehicle_id,
                fuel_date,
                fType,
                qty,
                price,
                calculatedTotalCost,
                odo,
                stationVal,
                notesVal
            ]
        );

        // Update vehicle current_mileage_km if higher
        if (odo > parseFloat(vehicle.current_mileage_km || 0)) {
            await client.query(
                "UPDATE vehicles SET current_mileage_km = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [odo, vehicle_id]
            );
        }

        await client.query("COMMIT");

        // Format single inserted record efficiency
        const allVehRecords = await pool.query(
            "SELECT f.*, v.vehicle_number, v.vehicle_code, v.registration_number FROM fuel_records f JOIN vehicles v ON f.vehicle_id = v.id WHERE f.vehicle_id = $1",
            [vehicle_id]
        );
        const formattedAll = attachEfficiency(allVehRecords.rows);
        const createdRecord = formattedAll.find(r => r.id === insertRes.rows[0].id);

        return sendSuccess(res, 201, "Fuel record created successfully", createdRecord || insertRes.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating fuel record:", error.message);
        return sendError(res, 500, "Failed to create fuel record", error);
    } finally {
        client.release();
    }
};

// ==========================================
// UPDATE FUEL RECORD
// ==========================================
const updateFuelRecord = async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid UUID format for fuel record ID");
    }

    const {
        fuel_date,
        liters,
        quantity_liters,
        price_per_liter,
        odometer,
        odometer_km,
        fuel_station,
        station_name,
        notes
    } = req.body;

    const effectiveLiters = liters !== undefined ? liters : quantity_liters;
    const effectiveOdometer = odometer !== undefined ? odometer : odometer_km;
    const effectiveStation = fuel_station !== undefined ? fuel_station : station_name;

    if (fuel_date !== undefined && isNaN(Date.parse(fuel_date))) {
        return sendError(res, 400, "valid fuel_date is required");
    }

    if (effectiveLiters !== undefined && (isNaN(parseFloat(effectiveLiters)) || parseFloat(effectiveLiters) <= 0)) {
        return sendError(res, 400, "liters / quantity_liters must be greater than 0");
    }

    if (price_per_liter !== undefined && (isNaN(parseFloat(price_per_liter)) || parseFloat(price_per_liter) <= 0)) {
        return sendError(res, 400, "price_per_liter must be greater than 0");
    }

    if (effectiveOdometer !== undefined && (isNaN(parseFloat(effectiveOdometer)) || parseFloat(effectiveOdometer) < 0)) {
        return sendError(res, 400, "odometer / odometer_km must be a non-negative number");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query("SELECT * FROM fuel_records WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Fuel record not found");
        }
        const record = existing.rows[0];
        const vehicleId = record.vehicle_id;

        const qty = effectiveLiters !== undefined ? parseFloat(effectiveLiters) : parseFloat(record.liters || record.quantity_liters);
        const price = price_per_liter !== undefined ? parseFloat(price_per_liter) : parseFloat(record.price_per_liter);
        const odo = effectiveOdometer !== undefined ? parseFloat(effectiveOdometer) : parseFloat(record.odometer || record.odometer_km);

        // Odometer Sequence Check if updating odometer
        if (effectiveOdometer !== undefined) {
            const prevFuelRes = await client.query(
                "SELECT odometer_km, odometer FROM fuel_records WHERE vehicle_id = $1 AND id != $2 AND fuel_date <= $3 ORDER BY fuel_date DESC, odometer_km DESC LIMIT 1",
                [vehicleId, id, fuel_date || record.fuel_date]
            );
            if (prevFuelRes.rows.length > 0) {
                const prevOdo = parseFloat(prevFuelRes.rows[0].odometer !== null && prevFuelRes.rows[0].odometer !== undefined ? prevFuelRes.rows[0].odometer : prevFuelRes.rows[0].odometer_km);
                if (odo < prevOdo) {
                    await client.query("ROLLBACK");
                    return sendError(res, 400, `New odometer reading cannot be lower than the previous reading (${prevOdo} km)`);
                }
            }
        }

        const calculatedTotalCost = Math.round(qty * price * 100) / 100;
        const stationVal = effectiveStation !== undefined ? (effectiveStation ? effectiveStation.trim() : null) : null;
        const notesVal = notes !== undefined ? (notes ? notes.trim() : null) : null;

        const updateRes = await client.query(
            `
            UPDATE fuel_records
            SET
                fuel_date = COALESCE($1, fuel_date),
                quantity_liters = COALESCE($2, quantity_liters),
                liters = COALESCE($2, liters),
                price_per_liter = COALESCE($3, price_per_liter),
                total_cost = $4,
                odometer_km = COALESCE($5, odometer_km),
                odometer = COALESCE($5, odometer),
                station_name = COALESCE($6, station_name),
                fuel_station = COALESCE($6, fuel_station),
                notes = COALESCE($7, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
            `,
            [
                fuel_date || null,
                effectiveLiters !== undefined ? qty : null,
                price_per_liter !== undefined ? price : null,
                calculatedTotalCost,
                effectiveOdometer !== undefined ? odo : null,
                stationVal,
                notesVal,
                id
            ]
        );

        await client.query("COMMIT");

        // Format single record with efficiency
        const allVehRecords = await pool.query(
            "SELECT f.*, v.vehicle_number, v.vehicle_code, v.registration_number FROM fuel_records f JOIN vehicles v ON f.vehicle_id = v.id WHERE f.vehicle_id = $1",
            [vehicleId]
        );
        const formattedAll = attachEfficiency(allVehRecords.rows);
        const updatedRecord = formattedAll.find(r => r.id === id);

        return sendSuccess(res, 200, "Fuel record updated successfully", updatedRecord || updateRes.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating fuel record:", error.message);
        return sendError(res, 500, "Failed to update fuel record", error);
    } finally {
        client.release();
    }
};

// ==========================================
// DELETE FUEL RECORD
// ==========================================
const deleteFuelRecord = async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
        return sendError(res, 400, "Invalid UUID format for fuel record ID");
    }

    try {
        const result = await pool.query(
            "DELETE FROM fuel_records WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Fuel record not found");
        }

        return sendSuccess(res, 200, "Fuel record deleted successfully", result.rows[0]);
    } catch (error) {
        console.error("Error deleting fuel record:", error.message);
        return sendError(res, 500, "Failed to delete fuel record", error);
    }
};

module.exports = {
    getAllFuelRecords,
    getFuelRecordById,
    getVehicleFuelHistory,
    getVehicleFuelSummary,
    createFuelRecord,
    updateFuelRecord,
    deleteFuelRecord
};
