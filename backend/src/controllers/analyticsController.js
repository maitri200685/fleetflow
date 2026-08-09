const pool = require("../config/database");
const { sendSuccess, sendError } = require("../utils/validation");

/**
 * Helper to validate date string YYYY-MM-DD
 */
const isValidDateStr = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return false;
    const timestamp = Date.parse(dateStr);
    return !isNaN(timestamp);
};

// ==========================================
// 1. OVERVIEW ANALYTICS
// ==========================================
const getOverviewAnalytics = async (req, res) => {
    try {
        // Vehicle metrics
        const vehRes = await pool.query("SELECT status::text FROM vehicles");
        const totalVehicles = vehRes.rows.length;
        const availableVehicles = vehRes.rows.filter(v => (v.status || "").toUpperCase() === "AVAILABLE").length;
        const vehiclesInTransit = vehRes.rows.filter(v => ["IN_TRANSIT", "IN TRANSIT", "ON TRIP"].includes((v.status || "").toUpperCase())).length;
        const vehiclesUnderMaintenance = vehRes.rows.filter(v => (v.status || "").toUpperCase() === "MAINTENANCE").length;
        const inactiveVehicles = vehRes.rows.filter(v => ["INACTIVE", "OUT_OF_SERVICE", "OUT OF SERVICE"].includes((v.status || "").toUpperCase())).length;

        // Driver metrics
        const drvRes = await pool.query("SELECT status::text FROM drivers");
        const totalDrivers = drvRes.rows.length;
        const availableDrivers = drvRes.rows.filter(d => (d.status || "").toLowerCase() === "available").length;
        const driversOnTrip = drvRes.rows.filter(d => ["on trip", "in transit", "assigned"].includes((d.status || "").toLowerCase())).length;

        // Customer metrics
        const custRes = await pool.query("SELECT COUNT(*)::int as count FROM customers");
        const totalCustomers = custRes.rows[0]?.count || 0;

        // Trip metrics & Cargo
        const tripRes = await pool.query("SELECT status, COALESCE(cargo_weight_kg, cargo_weight, 0) as cargo FROM trips");
        const totalTrips = tripRes.rows.length;
        const completedTrips = tripRes.rows.filter(t => (t.status || "").toLowerCase() === "completed").length;
        const cancelledTrips = tripRes.rows.filter(t => (t.status || "").toLowerCase() === "cancelled").length;
        const activeTrips = tripRes.rows.filter(t => ["in transit", "assigned", "scheduled"].includes((t.status || "").toLowerCase())).length;
        const totalCargoTransported = tripRes.rows
            .filter(t => (t.status || "").toLowerCase() !== "cancelled")
            .reduce((sum, t) => sum + parseFloat(t.cargo || 0), 0);

        return sendSuccess(res, 200, "Fleet overview analytics fetched successfully", {
            total_vehicles: totalVehicles,
            available_vehicles: availableVehicles,
            vehicles_in_transit: vehiclesInTransit,
            vehicles_under_maintenance: vehiclesUnderMaintenance,
            inactive_vehicles: inactiveVehicles,
            total_drivers: totalDrivers,
            available_drivers: availableDrivers,
            drivers_on_trip: driversOnTrip,
            total_customers: totalCustomers,
            total_trips: totalTrips,
            active_trips: activeTrips,
            completed_trips: completedTrips,
            cancelled_trips: cancelledTrips,
            total_cargo_transported: Math.round(totalCargoTransported * 100) / 100
        });
    } catch (error) {
        console.error("Error fetching overview analytics:", error.message);
        return sendError(res, 500, "Failed to fetch overview analytics", error);
    }
};

// ==========================================
// 2. TRIP ANALYTICS
// ==========================================
const getTripAnalytics = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (start_date && !isValidDateStr(start_date)) return sendError(res, 400, "Invalid start_date format (expected YYYY-MM-DD)");
        if (end_date && !isValidDateStr(end_date)) return sendError(res, 400, "Invalid end_date format (expected YYYY-MM-DD)");

        let dateWhere = "";
        const params = [];
        let paramIdx = 1;

        if (start_date) {
            dateWhere += ` AND COALESCE(t.start_datetime, t.scheduled_start, t.created_at) >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            dateWhere += ` AND COALESCE(t.start_datetime, t.scheduled_start, t.created_at) <= $${paramIdx++}`;
            params.push(`${end_date} 23:59:59`);
        }

        // Totals
        const totalQuery = `SELECT t.status FROM trips t WHERE 1=1 ${dateWhere}`;
        const totalRes = await pool.query(totalQuery, params);
        const rows = totalRes.rows;

        const totalTrips = rows.length;
        const completedTrips = rows.filter(r => (r.status || "").toLowerCase() === "completed").length;
        const assignedTrips = rows.filter(r => (r.status || "").toLowerCase() === "assigned").length;
        const inTransitTrips = rows.filter(r => (r.status || "").toLowerCase() === "in transit").length;
        const cancelledTrips = rows.filter(r => (r.status || "").toLowerCase() === "cancelled").length;

        // Monthly Breakdown
        const monthlyQuery = `
            SELECT TO_CHAR(COALESCE(t.start_datetime, t.scheduled_start, t.created_at), 'YYYY-MM') as month,
                   COUNT(*)::int as count,
                   COUNT(CASE WHEN LOWER(t.status) = 'completed' THEN 1 END)::int as completed
            FROM trips t
            WHERE 1=1 ${dateWhere}
            GROUP BY month
            ORDER BY month ASC
        `;
        const monthlyRes = await pool.query(monthlyQuery, params);

        // Trips by Vehicle
        const vehQuery = `
            SELECT v.id as vehicle_id, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number,
                   COUNT(t.id)::int as count,
                   COUNT(CASE WHEN LOWER(t.status) = 'completed' THEN 1 END)::int as completed_count
            FROM trips t
            JOIN vehicles v ON t.vehicle_id = v.id
            WHERE 1=1 ${dateWhere}
            GROUP BY v.id, vehicle_number
            ORDER BY count DESC
            LIMIT 10
        `;
        const vehRes = await pool.query(vehQuery, params);

        // Trips by Driver
        const drvQuery = `
            SELECT d.id as driver_id, COALESCE(d.name, d.full_name) as driver_name,
                   COUNT(t.id)::int as count,
                   COUNT(CASE WHEN LOWER(t.status) = 'completed' THEN 1 END)::int as completed_count
            FROM trips t
            JOIN drivers d ON t.driver_id = d.id
            WHERE 1=1 ${dateWhere}
            GROUP BY d.id, driver_name
            ORDER BY count DESC
            LIMIT 10
        `;
        const drvRes = await pool.query(drvQuery, params);

        // Trips by Customer
        const custQuery = `
            SELECT c.id as customer_id, COALESCE(c.company_name, c.contact_person, c.contact_name) as customer_name,
                   COUNT(t.id)::int as count,
                   SUM(COALESCE(t.cargo_weight_kg, t.cargo_weight, 0))::numeric as total_cargo
            FROM trips t
            JOIN customers c ON t.customer_id = c.id
            WHERE 1=1 ${dateWhere}
            GROUP BY c.id, customer_name
            ORDER BY count DESC
            LIMIT 10
        `;
        const custRes = await pool.query(custQuery, params);

        return sendSuccess(res, 200, "Trip analytics fetched successfully", {
            total_trips: totalTrips,
            completed_trips: completedTrips,
            assigned_trips: assignedTrips,
            in_transit_trips: inTransitTrips,
            cancelled_trips: cancelledTrips,
            trips_by_month: monthlyRes.rows,
            trips_by_vehicle: vehRes.rows,
            trips_by_driver: drvRes.rows,
            trips_by_customer: custRes.rows.map(r => ({ ...r, total_cargo: parseFloat(r.total_cargo || 0) }))
        });
    } catch (error) {
        console.error("Error fetching trip analytics:", error.message);
        return sendError(res, 500, "Failed to fetch trip analytics", error);
    }
};

// ==========================================
// 3. FINANCIAL ANALYTICS
// ==========================================
const getFinancialAnalytics = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (start_date && !isValidDateStr(start_date)) return sendError(res, 400, "Invalid start_date format (expected YYYY-MM-DD)");
        if (end_date && !isValidDateStr(end_date)) return sendError(res, 400, "Invalid end_date format (expected YYYY-MM-DD)");

        let dateWhere = "";
        const params = [];
        let paramIdx = 1;

        if (start_date) {
            dateWhere += ` AND e.expense_date >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            dateWhere += ` AND e.expense_date <= $${paramIdx++}`;
            params.push(end_date);
        }

        const expQuery = `SELECT e.*, COALESCE(e.category, e.expense_type) as cat_val FROM expenses e WHERE 1=1 ${dateWhere}`;
        const expRes = await pool.query(expQuery, params);
        const rows = expRes.rows;

        const totalExpenses = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const getCatSum = (cat) => rows.filter(r => (r.cat_val || "").toLowerCase() === cat.toLowerCase()).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const fuelCost = getCatSum("Fuel");
        const maintenanceCost = getCatSum("Maintenance");
        const tollCost = getCatSum("Toll");
        const parkingCost = getCatSum("Parking");
        const insuranceCost = getCatSum("Insurance");
        const permitCost = getCatSum("Permit");
        const repairCost = getCatSum("Repair");
        const driverExpenses = getCatSum("Driver Expense") + getCatSum("Driver Allowance");
        const knownSum = fuelCost + maintenanceCost + tollCost + parkingCost + insuranceCost + permitCost + repairCost + driverExpenses;
        const otherExpenses = Math.max(0, totalExpenses - knownSum);

        // Monthly Expenses
        const monthlyQuery = `
            SELECT TO_CHAR(e.expense_date, 'YYYY-MM') as month,
                   SUM(e.amount)::numeric as amount
            FROM expenses e
            WHERE 1=1 ${dateWhere}
            GROUP BY month
            ORDER BY month ASC
        `;
        const monthlyRes = await pool.query(monthlyQuery, params);

        // Category Breakdown
        const categoryMap = {};
        rows.forEach(r => {
            const cat = r.cat_val || "Other";
            categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(r.amount || 0);
        });
        const categoryBreakdown = Object.keys(categoryMap).map(cat => ({
            category: cat,
            amount: Math.round(categoryMap[cat] * 100) / 100,
            percentage: totalExpenses > 0 ? Math.round((categoryMap[cat] / totalExpenses) * 10000) / 100 : 0
        })).sort((a, b) => b.amount - a.amount);

        // Vehicle Expense Breakdown
        const vehExpQuery = `
            SELECT v.id as vehicle_id, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number,
                   SUM(e.amount)::numeric as amount
            FROM expenses e
            JOIN vehicles v ON e.vehicle_id = v.id
            WHERE 1=1 ${dateWhere}
            GROUP BY v.id, vehicle_number
            ORDER BY amount DESC
            LIMIT 10
        `;
        const vehExpRes = await pool.query(vehExpQuery, params);

        // Trip Expense Breakdown
        const tripExpQuery = `
            SELECT t.id as trip_id, COALESCE(t.trip_number, t.trip_code) as trip_number,
                   SUM(e.amount)::numeric as amount
            FROM expenses e
            JOIN trips t ON e.trip_id = t.id
            WHERE 1=1 ${dateWhere}
            GROUP BY t.id, trip_number
            ORDER BY amount DESC
            LIMIT 10
        `;
        const tripExpRes = await pool.query(tripExpQuery, params);

        return sendSuccess(res, 200, "Financial analytics fetched successfully", {
            total_expenses: Math.round(totalExpenses * 100) / 100,
            fuel_cost: Math.round(fuelCost * 100) / 100,
            maintenance_cost: Math.round(maintenanceCost * 100) / 100,
            toll_cost: Math.round(tollCost * 100) / 100,
            parking_cost: Math.round(parkingCost * 100) / 100,
            insurance_cost: Math.round(insuranceCost * 100) / 100,
            permit_cost: Math.round(permitCost * 100) / 100,
            repair_cost: Math.round(repairCost * 100) / 100,
            driver_expenses: Math.round(driverExpenses * 100) / 100,
            other_expenses: Math.round(otherExpenses * 100) / 100,
            monthly_expenses: monthlyRes.rows.map(r => ({ ...r, amount: parseFloat(r.amount || 0) })),
            category_breakdown: categoryBreakdown,
            vehicle_expense_breakdown: vehExpRes.rows.map(r => ({ ...r, amount: parseFloat(r.amount || 0) })),
            trip_expense_breakdown: tripExpRes.rows.map(r => ({ ...r, amount: parseFloat(r.amount || 0) }))
        });
    } catch (error) {
        console.error("Error fetching financial analytics:", error.message);
        return sendError(res, 500, "Failed to fetch financial analytics", error);
    }
};

// ==========================================
// 4. FUEL ANALYTICS
// ==========================================
const getFuelAnalytics = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (start_date && !isValidDateStr(start_date)) return sendError(res, 400, "Invalid start_date format (expected YYYY-MM-DD)");
        if (end_date && !isValidDateStr(end_date)) return sendError(res, 400, "Invalid end_date format (expected YYYY-MM-DD)");

        let dateWhere = "";
        const params = [];
        let paramIdx = 1;

        if (start_date) {
            dateWhere += ` AND f.fuel_date >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            dateWhere += ` AND f.fuel_date <= $${paramIdx++}`;
            params.push(end_date);
        }

        const fuelQuery = `
            SELECT f.*, COALESCE(f.liters, f.quantity_liters, 0) as lit_val,
                   COALESCE(f.odometer, f.odometer_km, 0) as odo_val
            FROM fuel_records f
            WHERE 1=1 ${dateWhere}
            ORDER BY f.fuel_date ASC
        `;
        const fuelRes = await pool.query(fuelQuery, params);
        const rows = fuelRes.rows;

        const totalLiters = rows.reduce((sum, r) => sum + parseFloat(r.lit_val || 0), 0);
        const totalFuelCost = rows.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0);
        const averagePricePerLiter = totalLiters > 0 ? Math.round((totalFuelCost / totalLiters) * 100) / 100 : 0;

        // Vehicle-wise aggregated consumption
        const vehWiseQuery = `
            SELECT v.id as vehicle_id, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number,
                   SUM(COALESCE(f.liters, f.quantity_liters, 0))::numeric as total_liters,
                   SUM(f.total_cost)::numeric as total_cost,
                   MAX(COALESCE(f.odometer, f.odometer_km, 0)) - MIN(COALESCE(f.odometer, f.odometer_km, 0)) as distance_delta
            FROM fuel_records f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE 1=1 ${dateWhere}
            GROUP BY v.id, vehicle_number
            ORDER BY total_cost DESC
        `;
        const vehWiseRes = await pool.query(vehWiseQuery, params);

        const vehicleWiseConsumption = [];
        const vehicleWiseCost = [];
        const vehicleWiseKmPerLiter = [];
        let globalEfficiencySum = 0;
        let globalEfficiencyCount = 0;

        vehWiseRes.rows.forEach(r => {
            const lit = parseFloat(r.total_liters || 0);
            const cost = parseFloat(r.total_cost || 0);
            const dist = parseFloat(r.distance_delta || 0);
            const eff = (lit > 0 && dist > 0) ? Math.round((dist / lit) * 100) / 100 : null;

            if (eff !== null) {
                globalEfficiencySum += eff;
                globalEfficiencyCount++;
            }

            vehicleWiseConsumption.push({
                vehicle_id: r.vehicle_id,
                vehicle_number: r.vehicle_number,
                total_liters: Math.round(lit * 100) / 100,
                total_cost: Math.round(cost * 100) / 100,
                avg_efficiency: eff
            });

            vehicleWiseCost.push({
                vehicle_id: r.vehicle_id,
                vehicle_number: r.vehicle_number,
                total_cost: Math.round(cost * 100) / 100
            });

            vehicleWiseKmPerLiter.push({
                vehicle_id: r.vehicle_id,
                vehicle_number: r.vehicle_number,
                avg_km_per_liter: eff !== null ? eff : 0
            });
        });

        const averageFuelEfficiency = globalEfficiencyCount > 0
            ? Math.round((globalEfficiencySum / globalEfficiencyCount) * 100) / 100
            : 0;

        // Monthly Fuel Consumption
        const monthlyQuery = `
            SELECT TO_CHAR(f.fuel_date, 'YYYY-MM') as month,
                   SUM(COALESCE(f.liters, f.quantity_liters, 0))::numeric as total_liters,
                   SUM(f.total_cost)::numeric as total_cost
            FROM fuel_records f
            WHERE 1=1 ${dateWhere}
            GROUP BY month
            ORDER BY month ASC
        `;
        const monthlyRes = await pool.query(monthlyQuery, params);

        return sendSuccess(res, 200, "Fuel analytics fetched successfully", {
            total_liters: Math.round(totalLiters * 100) / 100,
            total_fuel_cost: Math.round(totalFuelCost * 100) / 100,
            average_price_per_liter: averagePricePerLiter,
            average_fuel_efficiency: averageFuelEfficiency,
            vehicle_wise_fuel_consumption: vehicleWiseConsumption,
            vehicle_wise_fuel_cost: vehicleWiseCost,
            vehicle_wise_km_per_liter: vehicleWiseKmPerLiter,
            monthly_fuel_consumption: monthlyRes.rows.map(r => ({
                month: r.month,
                total_liters: parseFloat(r.total_liters || 0),
                total_cost: parseFloat(r.total_cost || 0)
            }))
        });
    } catch (error) {
        console.error("Error fetching fuel analytics:", error.message);
        return sendError(res, 500, "Failed to fetch fuel analytics", error);
    }
};

// ==========================================
// 5. MAINTENANCE ANALYTICS
// ==========================================
const getMaintenanceAnalytics = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (start_date && !isValidDateStr(start_date)) return sendError(res, 400, "Invalid start_date format (expected YYYY-MM-DD)");
        if (end_date && !isValidDateStr(end_date)) return sendError(res, 400, "Invalid end_date format (expected YYYY-MM-DD)");

        let dateWhere = "";
        const params = [];
        let paramIdx = 1;

        if (start_date) {
            dateWhere += ` AND m.service_date >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            dateWhere += ` AND m.service_date <= $${paramIdx++}`;
            params.push(end_date);
        }

        const maintQuery = `SELECT m.* FROM maintenance m WHERE 1=1 ${dateWhere}`;
        const maintRes = await pool.query(maintQuery, params);
        const rows = maintRes.rows;

        const totalMaintenanceRecords = rows.length;
        const completedMaintenance = rows.filter(r => (r.status || "").toLowerCase() === "completed").length;
        const scheduledMaintenance = rows.filter(r => (r.status || "").toLowerCase() === "scheduled").length;
        const inProgressMaintenance = rows.filter(r => (r.status || "").toLowerCase() === "in progress").length;
        const cancelledMaintenance = rows.filter(r => (r.status || "").toLowerCase() === "cancelled").length;

        const totalMaintenanceCost = rows.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0);

        // Monthly Maintenance Cost
        const monthlyQuery = `
            SELECT TO_CHAR(m.service_date, 'YYYY-MM') as month,
                   SUM(m.cost)::numeric as amount
            FROM maintenance m
            WHERE 1=1 ${dateWhere}
            GROUP BY month
            ORDER BY month ASC
        `;
        const monthlyRes = await pool.query(monthlyQuery, params);

        // Vehicle Maintenance Cost
        const vehMaintQuery = `
            SELECT v.id as vehicle_id, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number,
                   SUM(m.cost)::numeric as amount
            FROM maintenance m
            JOIN vehicles v ON m.vehicle_id = v.id
            WHERE 1=1 ${dateWhere}
            GROUP BY v.id, vehicle_number
            ORDER BY amount DESC
            LIMIT 10
        `;
        const vehMaintRes = await pool.query(vehMaintQuery, params);

        // Upcoming Maintenance
        const upcomingQuery = `
            SELECT m.*, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number
            FROM maintenance m
            JOIN vehicles v ON m.vehicle_id = v.id
            WHERE (LOWER(m.status) = 'scheduled' OR m.service_date >= CURRENT_DATE)
            ORDER BY m.service_date ASC
            LIMIT 5
        `;
        const upcomingRes = await pool.query(upcomingQuery);

        // Vehicles Currently Under Maintenance (cast status::text for enum compatibility)
        const underMaintQuery = `
            SELECT v.id as vehicle_id, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number,
                   v.status::text as vehicle_status, m.service_type, m.maintenance_type, m.service_date
            FROM vehicles v
            LEFT JOIN maintenance m ON m.vehicle_id = v.id AND LOWER(m.status) = 'in progress'
            WHERE UPPER(v.status::text) = 'MAINTENANCE' OR LOWER(m.status) = 'in progress'
        `;
        const underMaintRes = await pool.query(underMaintQuery);

        return sendSuccess(res, 200, "Maintenance analytics fetched successfully", {
            total_maintenance_records: totalMaintenanceRecords,
            completed_maintenance: completedMaintenance,
            scheduled_maintenance: scheduledMaintenance,
            in_progress_maintenance: inProgressMaintenance,
            cancelled_maintenance: cancelledMaintenance,
            total_maintenance_cost: Math.round(totalMaintenanceCost * 100) / 100,
            monthly_maintenance_cost: monthlyRes.rows.map(r => ({ month: r.month, amount: parseFloat(r.amount || 0) })),
            vehicle_maintenance_cost: vehMaintRes.rows.map(r => ({ ...r, amount: parseFloat(r.amount || 0) })),
            upcoming_maintenance: upcomingRes.rows,
            vehicles_currently_under_maintenance: underMaintRes.rows
        });
    } catch (error) {
        console.error("Error fetching maintenance analytics:", error.message);
        return sendError(res, 500, "Failed to fetch maintenance analytics", error);
    }
};

// ==========================================
// 6. UTILIZATION ANALYTICS
// ==========================================
const getUtilizationAnalytics = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (start_date && !isValidDateStr(start_date)) return sendError(res, 400, "Invalid start_date format (expected YYYY-MM-DD)");
        if (end_date && !isValidDateStr(end_date)) return sendError(res, 400, "Invalid end_date format (expected YYYY-MM-DD)");

        let dateWhere = "";
        const params = [];
        let paramIdx = 1;

        if (start_date) {
            dateWhere += ` AND COALESCE(t.start_datetime, t.scheduled_start, t.created_at) >= $${paramIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            dateWhere += ` AND COALESCE(t.start_datetime, t.scheduled_start, t.created_at) <= $${paramIdx++}`;
            params.push(`${end_date} 23:59:59`);
        }

        // Vehicle Trip Counts & Utilization (cast v.status::text)
        const vehUtilQuery = `
            SELECT v.id as vehicle_id, COALESCE(v.vehicle_number, v.registration_number, v.vehicle_code) as vehicle_number,
                   v.status::text as status,
                   COUNT(t.id)::int as trip_count,
                   COUNT(CASE WHEN LOWER(t.status) = 'completed' THEN 1 END)::int as completed_count,
                   COUNT(CASE WHEN LOWER(t.status) = 'cancelled' THEN 1 END)::int as cancelled_count
            FROM vehicles v
            LEFT JOIN trips t ON t.vehicle_id = v.id ${dateWhere}
            GROUP BY v.id, vehicle_number, v.status
            ORDER BY trip_count DESC
        `;
        const vehUtilRes = await pool.query(vehUtilQuery, params);

        const vehicleTripCounts = vehUtilRes.rows.map(r => {
            const tc = parseInt(r.trip_count || 0);
            const cc = parseInt(r.completed_count || 0);
            const utilPct = tc > 0 ? Math.round((cc / tc) * 10000) / 100 : 0;
            return {
                vehicle_id: r.vehicle_id,
                vehicle_number: r.vehicle_number,
                status: r.status,
                trip_count: tc,
                completed_count: cc,
                cancelled_count: parseInt(r.cancelled_count || 0),
                utilization_percentage: utilPct
            };
        });

        // Driver Trip Counts (cast d.status::text)
        const drvUtilQuery = `
            SELECT d.id as driver_id, COALESCE(d.name, d.full_name) as driver_name,
                   d.status::text as status,
                   COUNT(t.id)::int as trip_count,
                   COUNT(CASE WHEN LOWER(t.status) = 'completed' THEN 1 END)::int as completed_count,
                   COUNT(CASE WHEN LOWER(t.status) = 'cancelled' THEN 1 END)::int as cancelled_count
            FROM drivers d
            LEFT JOIN trips t ON t.driver_id = d.id ${dateWhere}
            GROUP BY d.id, driver_name, d.status
            ORDER BY trip_count DESC
        `;
        const drvUtilRes = await pool.query(drvUtilQuery, params);

        const driverTripCounts = drvUtilRes.rows.map(r => {
            const tc = parseInt(r.trip_count || 0);
            const cc = parseInt(r.completed_count || 0);
            const compRate = tc > 0 ? Math.round((cc / tc) * 10000) / 100 : 0;
            return {
                driver_id: r.driver_id,
                driver_name: r.driver_name,
                status: r.status,
                trip_count: tc,
                completed_count: cc,
                cancelled_count: parseInt(r.cancelled_count || 0),
                completion_rate: compRate
            };
        });

        const activeVehicles = vehicleTripCounts.filter(v => v.trip_count > 0).length;
        const totalVehiclesCount = vehicleTripCounts.length;
        const fleetUtilizationRate = totalVehiclesCount > 0 ? Math.round((activeVehicles / totalVehiclesCount) * 10000) / 100 : 0;

        const activeDrivers = driverTripCounts.filter(d => d.trip_count > 0).length;
        const totalDriversCount = driverTripCounts.length;
        const driverUtilizationRate = totalDriversCount > 0 ? Math.round((activeDrivers / totalDriversCount) * 10000) / 100 : 0;

        const totalCompleted = vehicleTripCounts.reduce((acc, v) => acc + v.completed_count, 0);
        const totalCancelled = vehicleTripCounts.reduce((acc, v) => acc + v.cancelled_count, 0);

        const sortedVehicles = [...vehicleTripCounts].sort((a, b) => b.trip_count - a.trip_count);

        return sendSuccess(res, 200, "Utilization analytics fetched successfully", {
            vehicle_trip_counts: vehicleTripCounts,
            vehicle_utilization_indicators: {
                total_vehicles: totalVehiclesCount,
                active_assigned_vehicles: activeVehicles,
                fleet_utilization_rate: fleetUtilizationRate
            },
            driver_trip_counts: driverTripCounts,
            driver_utilization_indicators: {
                total_drivers: totalDriversCount,
                active_assigned_drivers: activeDrivers,
                driver_utilization_rate: driverUtilizationRate
            },
            completed_cancelled_ratios: {
                total_completed: totalCompleted,
                total_cancelled: totalCancelled,
                ratio: totalCancelled > 0 ? Math.round((totalCompleted / totalCancelled) * 100) / 100 : totalCompleted
            },
            most_used_vehicles: sortedVehicles.slice(0, 5),
            least_used_vehicles: [...sortedVehicles].reverse().slice(0, 5)
        });
    } catch (error) {
        console.error("Error fetching utilization analytics:", error.message);
        return sendError(res, 500, "Failed to fetch utilization analytics", error);
    }
};

// ==========================================
// 7. EXECUTIVE REPORT & INSIGHTS API
// ==========================================
const getReportData = async (req, res) => {
    try {
        const { type = "overall", start_date, end_date } = req.query;

        if (start_date && !isValidDateStr(start_date)) return sendError(res, 400, "Invalid start_date format (expected YYYY-MM-DD)");
        if (end_date && !isValidDateStr(end_date)) return sendError(res, 400, "Invalid end_date format (expected YYYY-MM-DD)");

        // Fetch subsets safely
        const [overviewRes, tripsRes, finRes, fuelRes, maintRes, utilRes] = await Promise.all([
            pool.query("SELECT status::text FROM vehicles"),
            pool.query("SELECT status, COALESCE(cargo_weight_kg, cargo_weight, 0) as cargo FROM trips"),
            pool.query("SELECT amount, COALESCE(category, expense_type) as cat FROM expenses"),
            pool.query("SELECT COALESCE(liters, quantity_liters, 0) as lit, total_cost FROM fuel_records"),
            pool.query("SELECT status, cost FROM maintenance"),
            pool.query("SELECT v.vehicle_number, COUNT(t.id)::int as count FROM vehicles v LEFT JOIN trips t ON t.vehicle_id = v.id GROUP BY v.vehicle_number ORDER BY count DESC LIMIT 1")
        ]);

        // Generate executive insights dynamically from live data
        const insights = [];
        const topVehicle = utilRes.rows[0];
        if (topVehicle && topVehicle.count > 0) {
            insights.push(`Vehicle ${topVehicle.vehicle_number || 'Fleet Unit'} has the highest trip activity (${topVehicle.count} trips).`);
        } else {
            insights.push("Fleet vehicle dispatch activity is currently operational.");
        }

        const totalFuelCost = fuelRes.rows.reduce((a, b) => a + parseFloat(b.total_cost || 0), 0);
        if (totalFuelCost > 0) {
            insights.push(`Fuel expenditure accounts for operational fuel refueling of $${totalFuelCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`);
        }

        const inMaintCount = overviewRes.rows.filter(v => (v.status || "").toUpperCase() === "MAINTENANCE").length;
        if (inMaintCount > 0) {
            insights.push(`${inMaintCount} vehicle(s) are currently under active maintenance.`);
        } else {
            insights.push("All active fleet vehicles are operational with 0 vehicles currently down for maintenance.");
        }

        const totLiters = fuelRes.rows.reduce((a, b) => a + parseFloat(b.lit || 0), 0);
        if (totLiters > 0) {
            insights.push(`Average fleet fuel logging reflects ${totLiters.toLocaleString()} liters consumed across logged routes.`);
        }

        return sendSuccess(res, 200, "Executive report fetched successfully", {
            report_type: type,
            generated_at: new Date().toISOString(),
            date_filter: { start_date: start_date || null, end_date: end_date || null },
            executive_insights: insights
        });
    } catch (error) {
        console.error("Error fetching report data:", error.message);
        return sendError(res, 500, "Failed to fetch report data", error);
    }
};

module.exports = {
    getOverviewAnalytics,
    getTripAnalytics,
    getFinancialAnalytics,
    getFuelAnalytics,
    getMaintenanceAnalytics,
    getUtilizationAnalytics,
    getReportData
};
