# FleetFlow Backend API Documentation

Welcome to the **FleetFlow Fleet Management System API Documentation**. This document covers all backend API endpoints across Modules 1 through 10, including request formats, response structures, HTTP status codes, and business validation rules.

---

## Base URL & Setup
- **Default Server Base URL**: `http://localhost:5000/api`
- **Content-Type Header**: `application/json`
- **Database Engine**: PostgreSQL with UUID Primary Keys

---

## Response Formats

### Standard Success Response (Single Resource)
```json
{
  "success": true,
  "message": "Resource created/fetched/updated successfully",
  "data": { ... }
}
```

### Standard Success Response (Resource List)
```json
{
  "success": true,
  "count": 5,
  "data": [ ... ]
}
```

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## HTTP Status Codes

| Code | Meaning | Description |
| :--- | :--- | :--- |
| `200` | OK | Request succeeded (GET, PUT, DELETE) |
| `201` | Created | Resource successfully created (POST) |
| `400` | Bad Request | Validation error, invalid UUID, or business rule violation |
| `404` | Not Found | Requested entity or route does not exist |
| `409` | Conflict | Duplicate unique constraint violation (driver code, license, email, trip code, etc.) |
| `500` | Internal Error | Unexpected database failure or server exception |

---

## Module 1: Vehicles (`/api/vehicles`)

### Endpoints
- `GET /api/vehicles` — List all vehicles
- `GET /api/vehicles/:id` — Fetch vehicle by UUID
- `POST /api/vehicles` — Create a new vehicle
- `PUT /api/vehicles/:id` — Update vehicle
- `DELETE /api/vehicles/:id` — Delete vehicle

### Sample POST Request Body
```json
{
  "vehicle_code": "VH-1001",
  "registration_number": "GJ-01-AB-1234",
  "vehicle_type": "TRUCK",
  "brand": "Tata",
  "model": "407",
  "manufacturing_year": 2023,
  "capacity_kg": 2500,
  "fuel_type": "DIESEL",
  "current_mileage_km": 12000
}
```

---

## Module 2: Drivers (`/api/drivers`)

### Endpoints
- `GET /api/drivers` — List all drivers (Optional query filter: `?status=Available`)
- `GET /api/drivers/:id` — Fetch driver by UUID
- `POST /api/drivers` — Create driver
- `PUT /api/drivers/:id` — Update driver details
- `DELETE /api/drivers/:id` — Delete driver
- `GET /api/drivers/:id/documents` — Fetch driver documents

### Sample POST Request Body
```json
{
  "driver_code": "DRV-101",
  "full_name": "John Doe",
  "phone": "9876543210",
  "email": "john@fleetflow.com",
  "license_number": "DL-1234567890",
  "license_expiry": "2028-12-31",
  "date_of_birth": "1990-05-15",
  "address": "123 Main St",
  "emergency_contact": "9876543211",
  "joining_date": "2023-01-10",
  "status": "Available"
}
```

---

## Module 3: Customers (`/api/customers`)

### Endpoints
- `GET /api/customers` — List all customers (Optional query filter: `?status=Active`)
- `GET /api/customers/:id` — Fetch customer by UUID
- `POST /api/customers` — Create customer
- `PUT /api/customers/:id` — Update customer
- `DELETE /api/customers/:id` — Delete customer

### Sample POST Request Body
```json
{
  "customer_code": "CUST-101",
  "company_name": "Logistics Express Ltd",
  "contact_person": "Alice Smith",
  "email": "alice@logistics.com",
  "phone": "9123456789",
  "address": "100 Industry Park",
  "city": "Ahmedabad",
  "state": "Gujarat",
  "postal_code": "380001",
  "status": "Active"
}
```

---

## Modules 4 & 5: Trips & Business Assignment Logic (`/api/trips`)

### Endpoints
- `GET /api/trips` — List all trips (Filters: `status`, `vehicle_id`, `driver_id`, `customer_id`)
- `GET /api/trips/:id` — Fetch trip by UUID
- `POST /api/trips` — Create a trip
- `PUT /api/trips/:id` — Update trip details
- `PUT /api/trips/:id/assign` — Assign vehicle and driver to a trip
- `PUT /api/trips/:id/status` — Update trip status (e.g. `In Transit`, `Completed`, `Cancelled`)
- `DELETE /api/trips/:id` — Delete trip

### Business Rules Enforced
1. **Entity Verification**: Vehicle, Driver, Customer must exist in database.
2. **Driver Availability**: Prevents assignment of `Off Duty`, `Inactive`, or `Suspended` drivers.
3. **Vehicle Availability**: Prevents assignment of vehicles in `MAINTENANCE` or `OUT_OF_SERVICE`.
4. **Capacity Validation**: `cargo_weight_kg` must be $\le$ `vehicle.capacity_kg`.
5. **Scheduled Dates**: Enforces `scheduled_start <= scheduled_end`.
6. **Automatic State Synchronization**:
   - Assigning/In Transit $\rightarrow$ Vehicle status set to `IN_TRANSIT`, Driver status set to `On Trip`.
   - Completed/Cancelled $\rightarrow$ Vehicle status restored to `AVAILABLE`, Driver status restored to `Available`.

### Sample POST Request Body
```json
{
  "trip_code": "TRIP-2026-001",
  "vehicle_id": "5bf0b7e2-38bc-4be4-a3c5-61a16fa8f70d",
  "driver_id": "3a92b21c-42ef-45fa-b41f-829d8920a112",
  "customer_id": "fc9537db-1360-4b53-a2eb-80df98a0df14",
  "origin": "Warehouse A, Ahmedabad",
  "destination": "Distribution Hub B, Mumbai",
  "cargo_description": "Consumer Electronics",
  "cargo_weight_kg": 1500,
  "scheduled_start": "2026-08-10T08:00:00Z",
  "scheduled_end": "2026-08-10T20:00:00Z",
  "estimated_cost": 12000
}
```

---

## Module 6: Maintenance (`/api/maintenance`)

### Endpoints
- `GET /api/maintenance` — List all maintenance records
- `GET /api/maintenance/:id` — Fetch maintenance record by UUID
- `POST /api/maintenance` — Create maintenance record
- `PUT /api/maintenance/:id` — Update maintenance record
- `DELETE /api/maintenance/:id` — Delete maintenance record
- `GET /api/vehicles/:id/maintenance` — Fetch vehicle maintenance history

### Business Rules Enforced
- Cost and odometer readings cannot be negative.
- If status is set to `In Progress`, vehicle status automatically updates to `MAINTENANCE`. When completed or cancelled, vehicle status reverts to `AVAILABLE`.

---

## Module 7: Fuel Records (`/api/fuel`)

### Endpoints
- `GET /api/fuel` — List fuel records
- `GET /api/fuel/:id` — Fetch fuel record by UUID
- `POST /api/fuel` — Create fuel record
- `PUT /api/fuel/:id` — Update fuel record
- `DELETE /api/fuel/:id` — Delete fuel record
- `GET /api/vehicles/:id/fuel` — Fetch vehicle fuel history

### Business Rules Enforced
- `quantity_liters` $> 0$, `price_per_liter` $\ge 0$, `odometer_km` $\ge 0$.
- `total_cost` is automatically calculated on the backend (`quantity_liters * price_per_liter`).
- Vehicle `current_mileage_km` is automatically updated if the fuel record odometer exceeds the current recorded vehicle mileage.

---

## Module 8: Expenses (`/api/expenses`)

### Endpoints
- `GET /api/expenses` — List expenses
- `GET /api/expenses/:id` — Fetch expense by UUID
- `POST /api/expenses` — Create expense
- `PUT /api/expenses/:id` — Update expense
- `DELETE /api/expenses/:id` — Delete expense
- `GET /api/vehicles/:id/expenses` — Fetch vehicle expenses
- `GET /api/expenses/trip/:id` — Fetch trip expenses

---

## Module 9: Documents (`/api/documents`)

### Endpoints
- `GET /api/documents` — List documents
- `GET /api/documents/:id` — Fetch document by UUID
- `POST /api/documents` — Create document
- `PUT /api/documents/:id` — Update document
- `DELETE /api/documents/:id` — Delete document
- `GET /api/vehicles/:id/documents` — Fetch vehicle documents
- `GET /api/drivers/:id/documents` — Fetch driver documents

### Business Rules Enforced
- Document must belong to at least one entity (`vehicle_id` or `driver_id` is required).
- Dynamic Expiry Status Computation: `Expired` (past expiry date), `Expiring Soon` ($\le 30$ days remaining), `Active` (valid).

---

## Module 10: Notifications (`/api/notifications`)

### Endpoints
- `GET /api/notifications` — List notifications (Query `?unread=true` filters unread notifications)
- `GET /api/notifications/:id` — Fetch notification by UUID
- `POST /api/notifications` — Create notification
- `PUT /api/notifications/:id` — Update notification
- `PUT /api/notifications/:id/read` — Mark single notification as read
- `PUT /api/notifications/read-all` — Mark all notifications as read
- `DELETE /api/notifications/:id` — Delete notification
