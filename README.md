# FleetFlow — Enterprise Fleet Management System

FleetFlow is a production-grade enterprise fleet management platform designed for real-time asset tracking, driver dispatching, customer relationship management, maintenance scheduling, fuel efficiency monitoring, financial expense logging, document compliance tracking, operational alerting, and executive analytics.

---

## Key Features

1. **Authentication & Role-Based Authorization**
   - JWT-based authentication with role authorization (`ADMIN`, `FLEET_MANAGER`, `DISPATCHER`, `SAFETY_OFFICER`, `DRIVER`).
   - Secure password hashing using `bcrypt`.

2. **Vehicle Management**
   - Fleet asset lifecycle tracking (Trucks, Vans, Trailers, Cargo Fleet).
   - Mileage tracking, payload capacity management, and availability statuses (`AVAILABLE`, `IN_TRANSIT`, `MAINTENANCE`, `OUT_OF_SERVICE`).

3. **Driver Registry**
   - Driver profile management, license numbers, license expiry dates, emergency contacts, and assignment statuses (`Available`, `On Trip`, `Inactive`).

4. **Customer Management**
   - B2B customer directory, company profiles, contacts, and account statuses (`ACTIVE`, `INACTIVE`).

5. **Trip Management & Dispatch System**
   - Route dispatch planning (Origin, Destination, Cargo Weight, Schedule Range).
   - Automated vehicle and driver status synchronization (`IN_TRANSIT` / `On Trip` during dispatch; reset to `AVAILABLE` upon completion).
   - Conflict detection preventing double-booking of vehicles or drivers.

6. **Maintenance & Asset Reliability**
   - Scheduled, in-progress, completed, and cancelled maintenance records.
   - Maintenance Lock: Prevents trip assignments for vehicles currently in maintenance.

7. **Fuel Logging & Efficiency Tracking**
   - Fuel refill logs, total cost calculation, price/liter tracking.
   - Dynamic fuel efficiency calculation ($\text{km/L}$) based on odometer deltas.
   - Validation preventing invalid or lower odometer entries.

8. **Expense Tracker & Financial Logging**
   - Category-wise expense logging (`Fuel`, `Maintenance`, `Toll`, `Parking`, `Insurance`, `Permit`, `Repair`, `Driver Expense`, `Other`).
   - Strict relationship validation ensuring expenses match active vehicle-trip-driver assignments.

9. **Document Repository & Compliance Management**
   - Centralized document repository for Vehicle (`Registration`, `Insurance`, `PUC`, `Fitness Certificate`, `Permit`) and Driver (`Driving License`, `Medical Certificate`, `ID Proof`).
   - Dynamic compliance status calculation (`Valid`, `Expiring Soon` $\le 30\text{ days}$, `Expired`).

10. **System Notifications & Alerting**
    - Real-time fleet scanner for expired documents, expiring driver licenses, maintenance due, and upcoming trips.
    - Automated deduplication preventing duplicate alerts.
    - Unread count badge and user isolation guards.

11. **Fleet Analytics & Executive Reports**
    - Executive dashboard KPIs, fleet utilization rates, expense category breakdowns, fuel consumption metrics, and driver completion rates.
    - Printable executive reports and CSV exports.

---

## Technology Stack

- **Frontend**: React 18, React Router v6, Axios, Vite
- **Backend**: Node.js, Express.js, PostgreSQL (`pg` pool)
- **Security**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, CORS middleware
- **Styling**: Vanilla CSS with custom glassmorphism design system

---

## Architecture & Project Structure

```text
fleetflow/
├── backend/
│   ├── src/
│   │   ├── config/          # PostgreSQL Database connection pool
│   │   ├── controllers/     # API Business controllers (11 modules)
│   │   ├── middleware/      # JWT Authentication & authorization middleware
│   │   ├── routes/          # Express API route declarations
│   │   ├── utils/           # Validation helpers and responses
│   │   ├── server.js        # Express app entry point
│   │   └── verify-backend.js# Backend verification suite
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, Sidebar, ProtectedRoute, Modals
│   │   ├── context/         # AuthContext state management
│   │   ├── pages/           # Module UI pages (11 pages)
│   │   ├── routes/          # AppRoutes navigation configuration
│   │   ├── services/        # Axios API client setup
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher

### Environment Setup

1. **Backend Configuration**:
   Create a `.env` file in `backend/` based on `backend/.env.example`:
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=fleetflow
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   JWT_SECRET=your_super_secret_jwt_key
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

2. **Frontend Configuration**:
   Create a `.env` file in `frontend/` based on `frontend/.env.example`:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

---

## Database Initialization

Run PostgreSQL migrations to create the required tables (`users`, `vehicles`, `drivers`, `customers`, `trips`, `maintenance`, `fuel_records`, `expenses`, `documents`, `notifications`).

```bash
psql -U postgres -d fleetflow -f database/schema.sql
```

---

## Running the Application Locally

### 1. Start Backend Server
```bash
cd backend
npm install
npm run dev
```
The Express backend will start on `http://localhost:5000`.

### 2. Start Frontend Application
```bash
cd frontend
npm install
npm run dev
```
The React Vite frontend will start on `http://localhost:5173`.

---

## Testing & Verification

Run the automated backend and full-system integration test suites:

```bash
# Execute master verification suite (57 tests)
node backend/src/verify-backend.js

# Execute module-specific verification test suites
node scratch/test-trip-backend.js
node scratch/test-maintenance-backend.js
node scratch/test-fuel-backend.js
node scratch/test-expense-backend.js
node scratch/test-document-backend.js
node scratch/test-notification-backend.js
node scratch/test-analytics-backend.js

# Execute master E2E integration test suite
node scratch/test-full-system-integration.js
```

### Production Build Verification
To test frontend production bundling:
```bash
cd frontend
npm run build
```

---

## API Summary Overview

| Module | Endpoint Base | Key Methods | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth` | `POST` | User registration, login, JWT token generation |
| **Vehicles** | `/api/vehicles` | `GET, POST, PUT, DELETE` | Vehicle fleet inventory CRUD & status management |
| **Drivers** | `/api/drivers` | `GET, POST, PUT, DELETE` | Driver roster CRUD, license expiry tracking |
| **Customers** | `/api/customers` | `GET, POST, PUT, DELETE` | Customer directory CRUD |
| **Trips** | `/api/trips` | `GET, POST, PUT, DELETE` | Route dispatching, conflict detection & status sync |
| **Maintenance**| `/api/maintenance` | `GET, POST, PUT, DELETE` | Service logs, repair costs & maintenance locking |
| **Fuel** | `/api/fuel` | `GET, POST, PUT, DELETE` | Fuel refills, cost logging & km/L efficiency |
| **Expenses** | `/api/expenses` | `GET, POST, PUT, DELETE` | Operating expenses & trip-vehicle cross-validation |
| **Documents** | `/api/documents` | `GET, POST, PUT, DELETE` | Document compliance repository & auto-expiry |
| **Alerts** | `/api/notifications` | `GET, POST, PUT, DELETE` | Fleet alerts, unread counts & deduplication |
| **Analytics** | `/api/analytics` | `GET` | Fleet KPIs, utilization rate, reports & CSV export |

---

## License

Copyright © 2026 FleetFlow Enterprise. All rights reserved.
