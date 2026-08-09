const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const express = require("express");
const cors = require("cors");
const http = require("http");

const pool = require("./config/database");

// Route Modules
const vehicleRoutes = require("./routes/vehicleRoutes");
const driverRoutes = require("./routes/driverRoutes");
const customerRoutes = require("./routes/customerRoutes");
const tripRoutes = require("./routes/tripRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const fuelRoutes = require("./routes/fuelRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const documentRoutes = require("./routes/documentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/vehicles", vehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/fuel", fuelRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/health", (req, res) => res.json({ success: true, message: "FleetFlow API is running" }));

app.get("/api/health/db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS current_time");
        res.json({
            success: true,
            message: "FleetFlow backend is connected to PostgreSQL",
            database: process.env.DB_NAME,
            server_time: result.rows[0].current_time
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Database connection failed", error: error.message });
    }
});

// 404 Route Not Found Middleware
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route '${req.originalUrl}' not found` });
});

// Centralized Error Handler Middleware
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message || "Internal Server Error" });
});

const jwt = require("jsonwebtoken");
const TEST_ADMIN_TOKEN = jwt.sign(
    { id: "test-admin-uuid", role: "ADMIN" },
    process.env.JWT_SECRET || "fleetflow_jwt_secret_key_2026_super_secure",
    { expiresIn: "1h" }
);

const TEST_PORT = 5099;
let server;

function request(method, path, body = null, token = TEST_ADMIN_TOKEN) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request(
            {
                hostname: "localhost",
                port: TEST_PORT,
                path,
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                    ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
                }
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    let json;
                    try {
                        json = JSON.parse(data);
                    } catch (e) {
                        json = data;
                    }
                    resolve({ status: res.statusCode, body: json });
                });
            }
        );
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

const testResults = [];

function recordTest(category, name, pass, detail = "") {
    testResults.push({ category, name, status: pass ? "PASS" : "FAIL", detail });
    const tag = pass ? "[PASS]" : "[FAIL]";
    console.log(`${tag} ${category} :: ${name} ${detail ? "-> " + detail : ""}`);
}

async function runTests() {
    console.log("Starting FleetFlow Comprehensive Production Verification Suite...\n");

    const createdIds = {
        vehicles: [],
        drivers: [],
        customers: [],
        trips: [],
        maintenance: [],
        fuel: [],
        expenses: [],
        documents: [],
        notifications: []
    };

    try {
        // ==========================================
        // 1. HEALTH CHECKS
        // ==========================================
        console.log("--- SECTION 1: HEALTH CHECKS ---");
        const health = await request("GET", "/api/health");
        recordTest("Health", "GET /api/health", health.status === 200 && health.body.success, `Status ${health.status}`);

        const healthDb = await request("GET", "/api/health/db");
        recordTest("Health", "GET /api/health/db", healthDb.status === 200 && healthDb.body.success, `Status ${healthDb.status}`);

        const notFoundRes = await request("GET", "/api/non-existent-route");
        recordTest("Health", "404 Route Not Found Middleware", notFoundRes.status === 404, `Status ${notFoundRes.status}`);

        // ==========================================
        // 2. MODULE 1: VEHICLES CRUD & VERIFICATION
        // ==========================================
        console.log("\n--- SECTION 2: MODULE 1 (VEHICLES CRUD) ---");
        const vCode = `TEST-V-${Date.now()}`;
        const vReg = `TEST-REG-${Date.now()}`;
        const createV = await request("POST", "/api/vehicles", {
            vehicle_code: vCode,
            registration_number: vReg,
            vehicle_type: "TRUCK",
            capacity_kg: 5000,
            fuel_type: "DIESEL"
        });
        const vehicleId = createV.body?.data?.id;
        recordTest("Vehicles", "POST /api/vehicles (Create)", createV.status === 201 && vehicleId, `Status ${createV.status}`);
        if (vehicleId) createdIds.vehicles.push(vehicleId);

        const getV = await request("GET", `/api/vehicles/${vehicleId}`);
        recordTest("Vehicles", "GET /api/vehicles/:id", getV.status === 200, `Status ${getV.status}`);

        const updateV = await request("PUT", `/api/vehicles/${vehicleId}`, { model: "407 Turbo" });
        recordTest("Vehicles", "PUT /api/vehicles/:id (Update)", updateV.status === 200 && updateV.body?.data?.model === "407 Turbo", `Status ${updateV.status}`);

        const invalidUuidRes = await request("GET", "/api/vehicles/invalid-uuid-123");
        recordTest("Vehicles", "Invalid UUID handling", invalidUuidRes.status === 400, `Status ${invalidUuidRes.status}`);

        // Second vehicle for negative tests
        const vCode2 = `TEST-V2-${Date.now()}`;
        const vReg2 = `TEST-REG2-${Date.now()}`;
        const createV2 = await request("POST", "/api/vehicles", {
            vehicle_code: vCode2,
            registration_number: vReg2,
            vehicle_type: "VAN",
            capacity_kg: 1000,
            fuel_type: "PETROL"
        });
        const vehicleId2 = createV2.body?.data?.id;
        if (vehicleId2) createdIds.vehicles.push(vehicleId2);

        // ==========================================
        // 3. MODULE 2: DRIVERS CRUD & VALIDATION
        // ==========================================
        console.log("\n--- SECTION 3: MODULE 2 (DRIVERS CRUD) ---");
        const dCode = `DRV-${Date.now()}`;
        const dLic = `LIC-${Date.now()}`;
        const dEmail = `driver_${Date.now()}@fleetflow.com`;
        const createD = await request("POST", "/api/drivers", {
            driver_code: dCode,
            full_name: "John Driver",
            phone: "9876543210",
            email: dEmail,
            license_number: dLic,
            license_expiry: "2028-12-31",
            status: "Available"
        });
        const driverId = createD.body?.data?.id;
        recordTest("Drivers", "POST /api/drivers (Create)", createD.status === 201 && driverId, `Status ${createD.status}`);
        if (driverId) createdIds.drivers.push(driverId);

        const getDrivers = await request("GET", "/api/drivers");
        recordTest("Drivers", "GET /api/drivers", getDrivers.status === 200 && Array.isArray(getDrivers.body.data), `Count ${getDrivers.body.count}`);

        const updateD = await request("PUT", `/api/drivers/${driverId}`, { phone: "9998887770" });
        recordTest("Drivers", "PUT /api/drivers/:id (Update)", updateD.status === 200 && updateD.body?.data?.phone === "9998887770", `Status ${updateD.status}`);

        const dupDriver = await request("POST", "/api/drivers", {
            driver_code: dCode,
            full_name: "Duplicate Driver",
            license_number: `LIC-DUP-${Date.now()}`,
            license_expiry: "2028-12-31"
        });
        recordTest("Drivers", "Duplicate Driver Handling", dupDriver.status === 409, `Status ${dupDriver.status}`);

        // Second driver (Suspended) for negative test
        const dCode2 = `DRV2-${Date.now()}`;
        const dLic2 = `LIC2-${Date.now()}`;
        const createD2 = await request("POST", "/api/drivers", {
            driver_code: dCode2,
            full_name: "Suspended Driver",
            license_number: dLic2,
            license_expiry: "2028-12-31",
            status: "Suspended"
        });
        const driverId2 = createD2.body?.data?.id;
        if (driverId2) createdIds.drivers.push(driverId2);

        // ==========================================
        // 4. MODULE 3: CUSTOMERS CRUD
        // ==========================================
        console.log("\n--- SECTION 4: MODULE 3 (CUSTOMERS CRUD) ---");
        const cCode = `CUST-${Date.now()}`;
        const cEmail = `cust_${Date.now()}@fleetflow.com`;
        const createC = await request("POST", "/api/customers", {
            customer_code: cCode,
            company_name: "Logistics Corp",
            contact_person: "Alice Manager",
            email: cEmail,
            phone: "9123456789",
            address: "100 Logistics Way",
            city: "Metropolis"
        });
        const customerId = createC.body?.data?.id;
        recordTest("Customers", "POST /api/customers (Create)", createC.status === 201 && customerId, `Status ${createC.status}`);
        if (customerId) createdIds.customers.push(customerId);

        const getCust = await request("GET", `/api/customers/${customerId}`);
        recordTest("Customers", "GET /api/customers/:id", getCust.status === 200, `Status ${getCust.status}`);

        const updateC = await request("PUT", `/api/customers/${customerId}`, { city: "New Metropolis" });
        recordTest("Customers", "PUT /api/customers/:id (Update)", updateC.status === 200 && updateC.body?.data?.city === "New Metropolis", `Status ${updateC.status}`);

        // ==========================================
        // 5. MODULES 4 & 5: TRIPS & BUSINESS LOGIC
        // ==========================================
        console.log("\n--- SECTION 5: MODULES 4 & 5 (TRIPS & BUSINESS LOGIC) ---");
        const tripCode = `TRIP-${Date.now()}`;
        const createTrip = await request("POST", "/api/trips", {
            trip_code: tripCode,
            vehicle_id: vehicleId,
            driver_id: driverId,
            customer_id: customerId,
            origin: "Warehouse A",
            destination: "Distribution Center B",
            cargo_description: "Electronics",
            cargo_weight_kg: 2000,
            scheduled_start: "2026-08-10T10:00:00Z",
            scheduled_end: "2026-08-10T18:00:00Z"
        });
        const tripId = createTrip.body?.data?.id;
        recordTest("Trips", "POST /api/trips (Create & Assign)", createTrip.status === 201 && tripId, `Status ${createTrip.status}`);
        if (tripId) createdIds.trips.push(tripId);

        const vCheck1 = await request("GET", `/api/vehicles/${vehicleId}`);
        const dCheck1 = await request("GET", `/api/drivers/${driverId}`);
        recordTest("Trips", "Vehicle Status Sync (IN_TRANSIT)", vCheck1.body?.data?.status === "IN_TRANSIT", `Status ${vCheck1.body?.data?.status}`);
        recordTest("Trips", "Driver Status Sync (On Trip)", dCheck1.body?.data?.status === "On Trip", `Status ${dCheck1.body?.data?.status}`);

        // Update Trip status to Completed
        const updateTripSt = await request("PUT", `/api/trips/${tripId}/status`, { status: "Completed" });
        recordTest("Trips", "PUT /api/trips/:id/status (Completed)", updateTripSt.status === 200, `Status ${updateTripSt.status}`);

        const vCheck2 = await request("GET", `/api/vehicles/${vehicleId}`);
        const dCheck2 = await request("GET", `/api/drivers/${driverId}`);
        recordTest("Trips", "Vehicle Status Reset (AVAILABLE)", vCheck2.body?.data?.status === "AVAILABLE", `Status ${vCheck2.body?.data?.status}`);
        recordTest("Trips", "Driver Status Reset (Available)", dCheck2.body?.data?.status === "Available", `Status ${dCheck2.body?.data?.status}`);

        // NEGATIVE TESTS FOR TRIPS
        console.log("\n--- BUSINESS RULE NEGATIVE TESTS (TRIPS) ---");
        // 1. Cargo weight > Vehicle capacity
        const badCapacityTrip = await request("POST", "/api/trips", {
            trip_code: `TRIP-BAD-CAP-${Date.now()}`,
            vehicle_id: vehicleId2, // Capacity 1000 kg
            driver_id: driverId,
            customer_id: customerId,
            origin: "A", destination: "B",
            cargo_weight_kg: 5000 // Exceeds 1000 kg!
        });
        recordTest("Trips Negative", "Cargo Weight Capacity Overflow", badCapacityTrip.status === 400, `Status ${badCapacityTrip.status} (${badCapacityTrip.body?.message})`);

        // 2. Assigning Suspended Driver
        const badDriverTrip = await request("POST", "/api/trips", {
            trip_code: `TRIP-BAD-DRV-${Date.now()}`,
            vehicle_id: vehicleId,
            driver_id: driverId2, // Suspended Driver!
            customer_id: customerId,
            origin: "A", destination: "B",
            cargo_weight_kg: 500
        });
        recordTest("Trips Negative", "Assigning Suspended Driver", badDriverTrip.status === 400, `Status ${badDriverTrip.status} (${badDriverTrip.body?.message})`);

        // 3. Invalid dates (start > end)
        const badDatesTrip = await request("POST", "/api/trips", {
            trip_code: `TRIP-BAD-DATE-${Date.now()}`,
            customer_id: customerId,
            origin: "A", destination: "B",
            scheduled_start: "2026-08-10T20:00:00Z",
            scheduled_end: "2026-08-10T10:00:00Z"
        });
        recordTest("Trips Negative", "Scheduled Start after End Date", badDatesTrip.status === 400, `Status ${badDatesTrip.status} (${badDatesTrip.body?.message})`);

        // ==========================================
        // 6. MODULE 6: MAINTENANCE CRUD & VEHICLE SYNC
        // ==========================================
        console.log("\n--- SECTION 6: MODULE 6 (MAINTENANCE CRUD & SYNC) ---");
        const createM = await request("POST", "/api/maintenance", {
            vehicle_id: vehicleId,
            maintenance_type: "Engine Tune-up",
            description: "Full service",
            service_date: "2026-08-09",
            cost: 300,
            status: "Scheduled"
        });
        const maintenanceId = createM.body?.data?.id;
        recordTest("Maintenance", "POST /api/maintenance (Create)", createM.status === 201 && maintenanceId, `Status ${createM.status}`);
        if (maintenanceId) createdIds.maintenance.push(maintenanceId);

        const vMaintHistory = await request("GET", `/api/vehicles/${vehicleId}/maintenance`);
        recordTest("Maintenance", "GET /api/vehicles/:id/maintenance", vMaintHistory.status === 200 && vMaintHistory.body.count >= 1, `Count ${vMaintHistory.body.count}`);

        const updateM = await request("PUT", `/api/maintenance/${maintenanceId}`, { status: "In Progress" });
        recordTest("Maintenance", "PUT /api/maintenance/:id (In Progress)", updateM.status === 200, `Status ${updateM.status}`);

        const vMaintStatus = await request("GET", `/api/vehicles/${vehicleId}`);
        recordTest("Maintenance", "Vehicle Status Sync (MAINTENANCE)", vMaintStatus.body?.data?.status === "MAINTENANCE", `Vehicle Status ${vMaintStatus.body?.data?.status}`);

        const completeM = await request("PUT", `/api/maintenance/${maintenanceId}`, { status: "Completed" });
        recordTest("Maintenance", "PUT /api/maintenance/:id (Completed)", completeM.status === 200, `Status ${completeM.status}`);

        const vMaintRestored = await request("GET", `/api/vehicles/${vehicleId}`);
        recordTest("Maintenance", "Vehicle Status Restored (AVAILABLE)", vMaintRestored.body?.data?.status === "AVAILABLE", `Vehicle Status ${vMaintRestored.body?.data?.status}`);

        const badMaintCost = await request("POST", "/api/maintenance", {
            vehicle_id: vehicleId,
            maintenance_type: "Test",
            service_date: "2026-08-09",
            cost: -100
        });
        recordTest("Maintenance Negative", "Negative Cost Rejection", badMaintCost.status === 400, `Status ${badMaintCost.status}`);

        // ==========================================
        // 7. MODULE 7: FUEL RECORDS & AUTO COST
        // ==========================================
        console.log("\n--- SECTION 7: MODULE 7 (FUEL RECORDS & AUTO COST) ---");
        const createF = await request("POST", "/api/fuel", {
            vehicle_id: vehicleId,
            fuel_date: "2026-08-09",
            fuel_type: "DIESEL",
            quantity_liters: 60,
            price_per_liter: 2.0,
            odometer_km: 1500,
            station_name: "BP Station"
        });
        const fuelId = createF.body?.data?.id;
        recordTest("Fuel", "POST /api/fuel (Create)", createF.status === 201 && fuelId, `Status ${createF.status}`);
        if (fuelId) createdIds.fuel.push(fuelId);

        recordTest("Fuel", "Auto total_cost Calculation ($120.00)", parseFloat(createF.body?.data?.total_cost) === 120, `total_cost ${createF.body?.data?.total_cost}`);

        const vCheckMileage = await request("GET", `/api/vehicles/${vehicleId}`);
        recordTest("Fuel", "Vehicle Mileage Update (1500 km)", parseFloat(vCheckMileage.body?.data?.current_mileage_km) === 1500, `Mileage ${vCheckMileage.body?.data?.current_mileage_km}`);

        const vFuelHistory = await request("GET", `/api/vehicles/${vehicleId}/fuel`);
        recordTest("Fuel", "GET /api/vehicles/:id/fuel", vFuelHistory.status === 200 && vFuelHistory.body.count >= 1, `Count ${vFuelHistory.body.count}`);

        const badFuelQty = await request("POST", "/api/fuel", {
            vehicle_id: vehicleId,
            quantity_liters: -10,
            price_per_liter: 2,
            odometer_km: 1000
        });
        recordTest("Fuel Negative", "Negative Quantity Rejection", badFuelQty.status === 400, `Status ${badFuelQty.status}`);

        // ==========================================
        // 8. MODULE 8: EXPENSES CRUD
        // ==========================================
        console.log("\n--- SECTION 8: MODULE 8 (EXPENSES CRUD) ---");
        const createExp = await request("POST", "/api/expenses", {
            vehicle_id: vehicleId,
            trip_id: tripId,
            expense_type: "Toll",
            amount: 50.0,
            expense_date: "2026-08-09",
            description: "Expressway Toll"
        });
        const expenseId = createExp.body?.data?.id;
        recordTest("Expenses", "POST /api/expenses (Create)", createExp.status === 201 && expenseId, `Status ${createExp.status}`);
        if (expenseId) createdIds.expenses.push(expenseId);

        const vExpenses = await request("GET", `/api/vehicles/${vehicleId}/expenses`);
        recordTest("Expenses", "GET /api/vehicles/:id/expenses", vExpenses.status === 200 && vExpenses.body.count >= 1, `Count ${vExpenses.body.count}`);

        const tExpenses = await request("GET", `/api/expenses/trip/${tripId}`);
        recordTest("Expenses", "GET /api/expenses/trip/:id", tExpenses.status === 200 && tExpenses.body.count >= 1, `Count ${tExpenses.body.count}`);

        const updateExp = await request("PUT", `/api/expenses/${expenseId}`, { amount: 55.0 });
        recordTest("Expenses", "PUT /api/expenses/:id (Update)", updateExp.status === 200 && parseFloat(updateExp.body?.data?.amount) === 55, `Status ${updateExp.status}`);

        const badExpAmt = await request("POST", "/api/expenses", {
            expense_type: "Toll",
            amount: 0
        });
        recordTest("Expenses Negative", "Zero/Negative Amount Rejection", badExpAmt.status === 400, `Status ${badExpAmt.status}`);

        // ==========================================
        // 9. MODULE 9: DOCUMENTS & EXPIRY STATUS
        // ==========================================
        console.log("\n--- SECTION 9: MODULE 9 (DOCUMENTS & EXPIRY) ---");
        const badDoc = await request("POST", "/api/documents", {
            document_type: "RC",
            file_url: "http://example.com/rc.pdf"
        });
        recordTest("Documents Negative", "Document without Entity Rejection", badDoc.status === 400, `Status ${badDoc.status}`);

        const createDoc = await request("POST", "/api/documents", {
            vehicle_id: vehicleId,
            document_type: "Insurance",
            document_number: "INS-112233",
            issue_date: "2025-01-01",
            expiry_date: "2027-01-01",
            file_url: "http://example.com/insurance.pdf"
        });
        const docId = createDoc.body?.data?.id;
        recordTest("Documents", "POST /api/documents (Create)", createDoc.status === 201 && docId, `Status ${createDoc.status}`);
        if (docId) createdIds.documents.push(docId);

        const vDocs = await request("GET", `/api/vehicles/${vehicleId}/documents`);
        recordTest("Documents", "GET /api/vehicles/:id/documents", vDocs.status === 200 && vDocs.body.count >= 1, `Count ${vDocs.body.count}`);

        const updateDoc = await request("PUT", `/api/documents/${docId}`, { document_number: "INS-999999" });
        recordTest("Documents", "PUT /api/documents/:id (Update)", updateDoc.status === 200 && updateDoc.body?.data?.document_number === "INS-999999", `Status ${updateDoc.status}`);

        // ==========================================
        // 10. MODULE 10: NOTIFICATIONS & READ STATUS
        // ==========================================
        console.log("\n--- SECTION 10: MODULE 10 (NOTIFICATIONS) ---");
        const createNotif = await request("POST", "/api/notifications", {
            notification_type: "General",
            title: "System Update",
            message: "System scheduled for routine audit."
        });
        const notifId = createNotif.body?.data?.id;
        recordTest("Notifications", "POST /api/notifications (Create)", createNotif.status === 201 && notifId, `Status ${createNotif.status}`);
        if (notifId) createdIds.notifications.push(notifId);

        const unreadNotifs = await request("GET", "/api/notifications?unread=true");
        recordTest("Notifications", "GET /api/notifications?unread=true", unreadNotifs.status === 200 && unreadNotifs.body.count >= 1, `Unread Count ${unreadNotifs.body.count}`);

        const markRead = await request("PUT", `/api/notifications/${notifId}/read`);
        recordTest("Notifications", "PUT /api/notifications/:id/read", markRead.status === 200 && markRead.body?.data?.is_read === true, `is_read ${markRead.body?.data?.is_read}`);

        const markAll = await request("PUT", "/api/notifications/read-all");
        recordTest("Notifications", "PUT /api/notifications/read-all", markAll.status === 200, `Status ${markAll.status}`);

        // ==========================================
        // 11. DELETE ENDPOINTS TESTING & CLEANUP
        // ==========================================
        console.log("\n--- SECTION 11: DELETE ENDPOINTS TESTING ---");
        
        const delNotif = await request("DELETE", `/api/notifications/${notifId}`);
        recordTest("DELETE", "DELETE /api/notifications/:id", delNotif.status === 200, `Status ${delNotif.status}`);
        createdIds.notifications = createdIds.notifications.filter(id => id !== notifId);

        const delDoc = await request("DELETE", `/api/documents/${docId}`);
        recordTest("DELETE", "DELETE /api/documents/:id", delDoc.status === 200, `Status ${delDoc.status}`);
        createdIds.documents = createdIds.documents.filter(id => id !== docId);

        const delExp = await request("DELETE", `/api/expenses/${expenseId}`);
        recordTest("DELETE", "DELETE /api/expenses/:id", delExp.status === 200, `Status ${delExp.status}`);
        createdIds.expenses = createdIds.expenses.filter(id => id !== expenseId);

        const delFuel = await request("DELETE", `/api/fuel/${fuelId}`);
        recordTest("DELETE", "DELETE /api/fuel/:id", delFuel.status === 200, `Status ${delFuel.status}`);
        createdIds.fuel = createdIds.fuel.filter(id => id !== fuelId);

        const delMaint = await request("DELETE", `/api/maintenance/${maintenanceId}`);
        recordTest("DELETE", "DELETE /api/maintenance/:id", delMaint.status === 200, `Status ${delMaint.status}`);
        createdIds.maintenance = createdIds.maintenance.filter(id => id !== maintenanceId);

        const delTrip = await request("DELETE", `/api/trips/${tripId}`);
        recordTest("DELETE", "DELETE /api/trips/:id", delTrip.status === 200, `Status ${delTrip.status}`);
        createdIds.trips = createdIds.trips.filter(id => id !== tripId);

        const delCust = await request("DELETE", `/api/customers/${customerId}`);
        recordTest("DELETE", "DELETE /api/customers/:id", delCust.status === 200, `Status ${delCust.status}`);
        createdIds.customers = createdIds.customers.filter(id => id !== customerId);

        const delDrv = await request("DELETE", `/api/drivers/${driverId}`);
        recordTest("DELETE", "DELETE /api/drivers/:id", delDrv.status === 200, `Status ${delDrv.status}`);
        createdIds.drivers = createdIds.drivers.filter(id => id !== driverId);

        const delVeh = await request("DELETE", `/api/vehicles/${vehicleId}`);
        recordTest("DELETE", "DELETE /api/vehicles/:id", delVeh.status === 200, `Status ${delVeh.status}`);
        createdIds.vehicles = createdIds.vehicles.filter(id => id !== vehicleId);

        const totalPassed = testResults.filter(t => t.status === "PASS").length;
        const totalFailed = testResults.filter(t => t.status === "FAIL").length;

        console.log("\n=========================================");
        console.log(` SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
        if (totalFailed === 0) {
            console.log(" ALL 10 MODULES VERIFIED SUCCESSFULLY!");
        } else {
            console.log(" SOME TESTS FAILED!");
        }
        console.log("=========================================\n");

    } catch (err) {
        console.error("\nTEST SUITE ERROR:", err);
        process.exitCode = 1;
    } finally {
        console.log("Cleaning up any remaining test records from database...");
        for (const id of createdIds.notifications) await pool.query("DELETE FROM notifications WHERE id = $1", [id]);
        for (const id of createdIds.documents) await pool.query("DELETE FROM documents WHERE id = $1", [id]);
        for (const id of createdIds.expenses) await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
        for (const id of createdIds.fuel) await pool.query("DELETE FROM fuel_records WHERE id = $1", [id]);
        for (const id of createdIds.maintenance) await pool.query("DELETE FROM maintenance WHERE id = $1", [id]);
        for (const id of createdIds.trips) await pool.query("DELETE FROM trips WHERE id = $1", [id]);
        for (const id of createdIds.customers) await pool.query("DELETE FROM customers WHERE id = $1", [id]);
        for (const id of createdIds.drivers) await pool.query("DELETE FROM drivers WHERE id = $1", [id]);
        for (const id of createdIds.vehicles) await pool.query("DELETE FROM vehicles WHERE id = $1", [id]);

        await pool.end();
        if (server) server.close();
    }
}

server = app.listen(TEST_PORT, () => {
    runTests();
});
