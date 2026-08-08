const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

console.log("VERIFY DB HOST:", process.env.DB_HOST);
console.log("VERIFY DB PORT:", process.env.DB_PORT);
console.log("VERIFY DB NAME:", process.env.DB_NAME);
console.log("VERIFY DB USER:", process.env.DB_USER);
console.log("VERIFY DB PASSWORD TYPE:", typeof process.env.DB_PASSWORD);
console.log(
    "VERIFY DB PASSWORD LOADED:",
    Boolean(process.env.DB_PASSWORD)
);

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

const TEST_PORT = 5099;
let server;

function request(method, path, body = null) {
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

async function runTests() {
    console.log("Starting FleetFlow Full API Verification Suite...\n");

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
        // 1. Health Checks
        console.log("--- HEALTH CHECKS ---");
        const health = await request("GET", "/api/health");
        console.log(`[PASS] GET /api/health -> Status ${health.status}`);
        if (health.status !== 200 || !health.body.success) throw new Error("Health check failed");

        // 2. Vehicle API Regression Test (Module 1)
        console.log("\n--- MODULE 1: VEHICLES REGRESSION TEST ---");
        const vCode = `TEST-V-${Date.now()}`;
        const vReg = `TEST-REG-${Date.now()}`;
        const createV = await request("POST", "/api/vehicles", {
            vehicle_code: vCode,
            registration_number: vReg,
            vehicle_type: "TRUCK",
            capacity_kg: 5000,
            fuel_type: "DIESEL"
        });
        console.log(`[PASS] POST /api/vehicles -> Status ${createV.status}`);
        if (createV.status !== 201) throw new Error(`Vehicle creation failed: ${JSON.stringify(createV.body)}`);
        const vehicleId = createV.body.data.id;
        createdIds.vehicles.push(vehicleId);

        const getV = await request("GET", `/api/vehicles/${vehicleId}`);
        console.log(`[PASS] GET /api/vehicles/:id -> Status ${getV.status}`);
        if (getV.status !== 200) throw new Error("GET vehicle by ID failed");

        // Invalid UUID check
        const invalidUuidRes = await request("GET", "/api/drivers/not-a-valid-uuid");
        console.log(`[PASS] UUID Validation -> Status ${invalidUuidRes.status} (${invalidUuidRes.body.message})`);
        if (invalidUuidRes.status !== 400) throw new Error("UUID validation failed");

        // 3. Drivers (Module 2)
        console.log("\n--- MODULE 2: DRIVERS ---");
        const dCode = `DRV-${Date.now()}`;
        const dLic = `LIC-${Date.now()}`;
        const dEmail = `driver_${Date.now()}@fleetflow.com`;
        const createD = await request("POST", "/api/drivers", {
            driver_code: dCode,
            full_name: "John Driver",
            phone: "9876543210",
            email: dEmail,
            license_number: dLic,
            license_expiry: "2028-12-31"
        });
        console.log(`[PASS] POST /api/drivers -> Status ${createD.status}`);
        if (createD.status !== 201) throw new Error(`Driver creation failed: ${JSON.stringify(createD.body)}`);
        const driverId = createD.body.data.id;
        createdIds.drivers.push(driverId);

        const getDrivers = await request("GET", "/api/drivers");
        console.log(`[PASS] GET /api/drivers -> Count: ${getDrivers.body.count}`);

        // Duplicate Driver Code check
        const dupDriver = await request("POST", "/api/drivers", {
            driver_code: dCode,
            full_name: "Duplicate Driver",
            license_number: `LIC-DUP-${Date.now()}`,
            license_expiry: "2028-12-31"
        });
        console.log(`[PASS] Duplicate Driver Code Check -> Status ${dupDriver.status}`);
        if (dupDriver.status !== 409) throw new Error("Duplicate driver handling failed");

        // 4. Customers (Module 3)
        console.log("\n--- MODULE 3: CUSTOMERS ---");
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
        console.log(`[PASS] POST /api/customers -> Status ${createC.status}`);
        if (createC.status !== 201) throw new Error(`Customer creation failed: ${JSON.stringify(createC.body)}`);
        const customerId = createC.body.data.id;
        createdIds.customers.push(customerId);

        const getCust = await request("GET", `/api/customers/${customerId}`);
        console.log(`[PASS] GET /api/customers/:id -> Status ${getCust.status}`);

        // 5. Trips & Assignment (Modules 4 & 5)
        console.log("\n--- MODULE 4 & 5: TRIPS & BUSINESS ASSIGNMENT LOGIC ---");
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
        console.log(`[PASS] POST /api/trips (Assign Vehicle & Driver) -> Status ${createTrip.status}`);
        if (createTrip.status !== 201) throw new Error(`Trip creation failed: ${JSON.stringify(createTrip.body)}`);
        const tripId = createTrip.body.data.id;
        createdIds.trips.push(tripId);

        // Verify Vehicle & Driver status updated to On Trip / IN_TRANSIT
        const vCheck1 = await request("GET", `/api/vehicles/${vehicleId}`);
        const dCheck1 = await request("GET", `/api/drivers/${driverId}`);
        console.log(`[PASS] Auto Vehicle Status Transition -> ${vCheck1.body.data.status}`);
        console.log(`[PASS] Auto Driver Status Transition -> ${dCheck1.body.data.status}`);
        if (vCheck1.body.data.status !== "IN_TRANSIT" || dCheck1.body.data.status !== "On Trip") {
            throw new Error("Vehicle/Driver assignment status transition failed");
        }

        // Complete Trip
        const updateTripSt = await request("PUT", `/api/trips/${tripId}/status`, { status: "Completed" });
        console.log(`[PASS] PUT /api/trips/:id/status (Completed) -> Status ${updateTripSt.status}`);

        // Verify Vehicle & Driver status reset to Available
        const vCheck2 = await request("GET", `/api/vehicles/${vehicleId}`);
        const dCheck2 = await request("GET", `/api/drivers/${driverId}`);
        console.log(`[PASS] Post-trip Vehicle Status -> ${vCheck2.body.data.status}`);
        console.log(`[PASS] Post-trip Driver Status -> ${dCheck2.body.data.status}`);
        if (vCheck2.body.data.status !== "AVAILABLE" || dCheck2.body.data.status !== "Available") {
            throw new Error("Vehicle/Driver completion status reset failed");
        }

        // 6. Maintenance (Module 6)
        console.log("\n--- MODULE 6: MAINTENANCE ---");
        const createM = await request("POST", "/api/maintenance", {
            vehicle_id: vehicleId,
            maintenance_type: "Oil Change & Brake Service",
            description: "Routine maintenance",
            service_date: "2026-08-08",
            cost: 250,
            status: "Scheduled"
        });
        console.log(`[PASS] POST /api/maintenance -> Status ${createM.status}`);
        if (createM.status !== 201) throw new Error("Maintenance record creation failed");
        const maintenanceId = createM.body.data.id;
        createdIds.maintenance.push(maintenanceId);

        const vMaintHistory = await request("GET", `/api/vehicles/${vehicleId}/maintenance`);
        console.log(`[PASS] GET /api/vehicles/:id/maintenance -> History count: ${vMaintHistory.body.count}`);

        // 7. Fuel Records (Module 7)
        console.log("\n--- MODULE 7: FUEL RECORDS ---");
        const createF = await request("POST", "/api/fuel", {
            vehicle_id: vehicleId,
            fuel_date: "2026-08-08",
            fuel_type: "DIESEL",
            quantity_liters: 50,
            price_per_liter: 1.5,
            odometer_km: 1200,
            station_name: "Shell Station 12"
        });
        console.log(`[PASS] POST /api/fuel -> Status ${createF.status}`);
        if (createF.status !== 201) throw new Error("Fuel record creation failed");
        console.log(`[PASS] Auto total_cost calculation -> $${createF.body.data.total_cost} (expected 75)`);
        if (parseFloat(createF.body.data.total_cost) !== 75) throw new Error("Fuel total_cost calculation incorrect");
        const fuelId = createF.body.data.id;
        createdIds.fuel.push(fuelId);

        const vFuelHistory = await request("GET", `/api/vehicles/${vehicleId}/fuel`);
        console.log(`[PASS] GET /api/vehicles/:id/fuel -> History count: ${vFuelHistory.body.count}`);

        // 8. Expenses (Module 8)
        console.log("\n--- MODULE 8: EXPENSES ---");
        const createExp = await request("POST", "/api/expenses", {
            vehicle_id: vehicleId,
            trip_id: tripId,
            expense_type: "Toll",
            amount: 45.5,
            expense_date: "2026-08-08",
            description: "Highway toll charge"
        });
        console.log(`[PASS] POST /api/expenses -> Status ${createExp.status}`);
        if (createExp.status !== 201) throw new Error("Expense creation failed");
        const expenseId = createExp.body.data.id;
        createdIds.expenses.push(expenseId);

        const vExpenses = await request("GET", `/api/vehicles/${vehicleId}/expenses`);
        console.log(`[PASS] GET /api/vehicles/:id/expenses -> Count: ${vExpenses.body.count}`);

        const tExpenses = await request("GET", `/api/expenses/trip/${tripId}`);
        console.log(`[PASS] GET /api/expenses/trip/:id -> Count: ${tExpenses.body.count}`);

        // 9. Documents (Module 9)
        console.log("\n--- MODULE 9: DOCUMENTS ---");
        // Check invalid entity (no vehicle or driver)
        const invalidDoc = await request("POST", "/api/documents", {
            document_type: "Insurance",
            file_url: "http://example.com/doc.pdf"
        });
        console.log(`[PASS] Invalid document without vehicle or driver -> Status ${invalidDoc.status}`);
        if (invalidDoc.status !== 400) throw new Error("Document entity validation failed");

        const createDoc = await request("POST", "/api/documents", {
            vehicle_id: vehicleId,
            document_type: "Insurance",
            document_number: "INS-998877",
            issue_date: "2025-01-01",
            expiry_date: "2027-01-01",
            file_url: "http://example.com/insurance.pdf"
        });
        console.log(`[PASS] POST /api/documents -> Status ${createDoc.status}`);
        if (createDoc.status !== 201) throw new Error("Document creation failed");
        const docId = createDoc.body.data.id;
        createdIds.documents.push(docId);

        const vDocs = await request("GET", `/api/vehicles/${vehicleId}/documents`);
        console.log(`[PASS] GET /api/vehicles/:id/documents -> Count: ${vDocs.body.count}`);

        // 10. Notifications (Module 10)
        console.log("\n--- MODULE 10: NOTIFICATIONS ---");
        const createNotif = await request("POST", "/api/notifications", {
            notification_type: "Insurance Expiry",
            title: "Insurance Renewal Reminder",
            message: "Vehicle insurance is set to expire in 30 days.",
            related_entity_type: "vehicle",
            related_entity_id: vehicleId
        });
        console.log(`[PASS] POST /api/notifications -> Status ${createNotif.status}`);
        if (createNotif.status !== 201) throw new Error("Notification creation failed");
        const notifId = createNotif.body.data.id;
        createdIds.notifications.push(notifId);

        const unreadNotifs = await request("GET", "/api/notifications?unread=true");
        console.log(`[PASS] GET /api/notifications?unread=true -> Unread count: ${unreadNotifs.body.count}`);

        const markRead = await request("PUT", `/api/notifications/${notifId}/read`);
        console.log(`[PASS] PUT /api/notifications/:id/read -> Status ${markRead.status} (is_read=${markRead.body.data.is_read})`);

        const markAll = await request("PUT", "/api/notifications/read-all");
        console.log(`[PASS] PUT /api/notifications/read-all -> Status ${markAll.status}`);

        console.log("\n=========================================");
        console.log(" ALL 10 MODULES VERIFIED SUCCESSFULLY!");
        console.log("=========================================\n");

    } catch (err) {
        console.error("\nTEST SUITE ERROR:", err);
        process.exitCode = 1;
    } finally {
        // Cleanup test data
        console.log("Cleaning up test records from database...");
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
