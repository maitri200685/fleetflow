# FleetFlow

### Fleet Management & Logistics Operations Platform

FleetFlow is a full-stack fleet management and logistics operations platform designed to centralize vehicle, driver, customer, trip, maintenance, fuel, expense, compliance, notification, and analytics workflows in a single web application.

The system connects operational modules through a shared PostgreSQL database and RESTful backend APIs, with authentication, validation, relational integrity, cross-module synchronization, and executive reporting.

---

# Overview

FleetFlow provides a centralized system for managing fleet operations from vehicle acquisition through trip dispatch, maintenance, fuel tracking, expenses, compliance, notifications, and performance analysis.

Instead of managing fleet information across disconnected spreadsheets or separate systems, FleetFlow provides a unified workflow where operational data is connected across modules.

### Core Workflow

```text
Authentication
      ↓
Fleet Resources
      ↓
Vehicle + Driver + Customer
      ↓
Trip Dispatch
      ↓
Maintenance + Fuel + Expenses
      ↓
Document Compliance
      ↓
Notifications & Alerts
      ↓
Fleet Analytics
      ↓
Executive Reports
```

---

# Key Features

## Authentication & Authorization

* User registration and login
* JWT-based authentication
* Password hashing with bcrypt
* Protected API endpoints
* Protected frontend routes
* Role-based authorization
* Secure logout
* User-specific notification access

## Vehicle Management

* Vehicle registration
* Vehicle information management
* Vehicle status tracking
* Availability management
* Vehicle-trip relationship validation
* Maintenance status synchronization

## Driver Management

* Driver registration
* Driver information management
* Driver availability tracking
* License information
* Driver-trip assignment
* Driver status synchronization

## Customer Management

* Customer registration
* Customer information management
* Customer directory
* Customer-trip relationships

## Trip Dispatching

* Trip creation and management
* Vehicle assignment
* Driver assignment
* Customer assignment
* Trip status tracking
* Dispatch conflict prevention
* Automatic vehicle status synchronization
* Automatic driver status synchronization

## Maintenance Management

* Maintenance scheduling
* Service records
* Maintenance status tracking
* Maintenance cost tracking
* Vehicle maintenance locking
* Maintenance completion workflow
* Vehicle status restoration

## Fuel Management

* Fuel refill records
* Fuel quantity tracking
* Fuel cost tracking
* Odometer tracking
* Fuel efficiency calculation
* Vehicle fuel history
* Odometer validation

## Expense Management

* Expense recording
* Expense categories
* Vendor and reference tracking
* Vehicle-linked expenses
* Trip-linked expenses
* Driver-linked expenses
* Financial summaries
* Relationship validation
* Expense filtering

## Document & Compliance Management

* Vehicle documents
* Driver documents
* Document number tracking
* Issue and expiry date tracking
* Compliance status calculation
* Expiry monitoring
* Document filtering
* Owner validation
* Duplicate document prevention

## Notifications & Alerting

* Expired document alerts
* Expiring document alerts
* Driver license alerts
* Maintenance alerts
* Vehicle maintenance alerts
* Upcoming trip alerts
* Notification severity levels
* Read/unread notifications
* Mark-all-as-read
* Automatic notification generation
* Notification deduplication

## Analytics & Executive Reports

* Fleet overview
* Trip performance
* Financial analytics
* Fuel analytics
* Maintenance analytics
* Vehicle utilization
* Driver performance indicators
* Executive reporting
* Date-range filtering
* CSV export
* Print/PDF reporting
* Dynamic operational insights

---

# System Modules

| Module         | Purpose                                     |
| -------------- | ------------------------------------------- |
| Authentication | User registration, login and authorization  |
| Dashboard      | Fleet overview and operational alerts       |
| Vehicles       | Vehicle registry and status management      |
| Drivers        | Driver registry and availability management |
| Customers      | Customer and logistics directory            |
| Trips          | Dispatching and trip lifecycle management   |
| Maintenance    | Vehicle servicing and maintenance tracking  |
| Fuel           | Fuel records and efficiency analysis        |
| Expenses       | Operational expense management              |
| Documents      | Compliance and document management          |
| Notifications  | Operational alerts and notifications        |
| Analytics      | Fleet analytics and executive reporting     |

---

# System Architecture

```text
┌──────────────────────────────────────────────┐
│                  User Browser                │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│              React + Vite Frontend           │
│                                              │
│ Dashboard | Vehicles | Drivers | Trips       │
│ Maintenance | Fuel | Expenses | Documents   │
│ Notifications | Analytics                   │
└───────────────────────┬──────────────────────┘
                        │
                 REST API + JWT
                        │
                        ▼
┌──────────────────────────────────────────────┐
│             Node.js + Express API            │
│                                              │
│ Controllers | Routes | Middleware | Auth     │
│ Validation | Business Logic                  │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│                PostgreSQL                    │
│                                              │
│ Vehicles | Drivers | Customers | Trips       │
│ Maintenance | Fuel | Expenses | Documents   │
│ Notifications | Users                        │
└──────────────────────────────────────────────┘
```

---

# Technology Stack

## Frontend

* React
* Vite
* JavaScript
* React Router
* HTML5
* CSS
* REST API integration

## Backend

* Node.js
* Express.js
* JWT
* bcrypt
* RESTful API architecture

## Database

* PostgreSQL
* Foreign keys
* Primary keys
* Unique constraints
* Check constraints
* Relational joins
* Aggregation queries

## Development Tools

* Git
* GitHub
* npm
* VS Code
* PowerShell

---

# Project Structure

```text
fleet/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
│   │
│   ├── .env.example
│   ├── package.json
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── context/
│   │   └── ...
│   │
│   ├── .env.example
│   ├── package.json
│   └── ...
│
├── verify-backend.js
├── README.md
├── .gitignore
└── ...
```

---

# Database Architecture

FleetFlow uses PostgreSQL as its central relational database.

### Main Entities

```text
Users
 │
 └── Notifications

Vehicles
 ├── Trips
 ├── Maintenance
 ├── Fuel Records
 ├── Expenses
 └── Documents

Drivers
 ├── Trips
 ├── Expenses
 └── Documents

Customers
 └── Trips

Trips
 └── Expenses
```

### Data Integrity

The database uses:

* Primary keys
* Foreign keys
* Unique constraints
* Check constraints
* Cascading relationships where appropriate
* Referential integrity
* Validation at API level

---


# Operational Workflow

FleetFlow is designed around a connected fleet-management workflow.

```text
1. Authenticate User
        ↓
2. Register Fleet Resources
        ↓
3. Add Vehicles & Drivers
        ↓
4. Register Customers
        ↓
5. Create & Dispatch Trips
        ↓
6. Track Vehicle / Driver Status
        ↓
7. Manage Maintenance
        ↓
8. Record Fuel
        ↓
9. Record Expenses
        ↓
10. Manage Compliance Documents
        ↓
11. Generate Operational Alerts
        ↓
12. Analyze Fleet Performance
        ↓
13. Generate Executive Reports
```

Cross-module validation prevents invalid operational states, such as assigning a vehicle already in an active trip or dispatching a vehicle currently under maintenance.

---

# UI & Design

FleetFlow follows a professional enterprise SaaS design approach.

The interface emphasizes:

* Clear information hierarchy
* Consistent typography
* Structured data tables
* Compact KPI cards
* Practical dashboards
* Clear status indicators
* Consistent forms and modals
* Responsive layouts
* Minimal visual distraction
* Operational usability

The design intentionally avoids excessive gradients, glowing effects, neon styling, and generic AI-generated dashboard aesthetics.

---

# Project Status

| Area                     | Status   |
| ------------------------ | -------- |
| Authentication           | Complete |
| Dashboard                | Complete |
| Vehicle Management       | Complete |
| Driver Management        | Complete |
| Customer Management      | Complete |
| Trip Dispatching         | Complete |
| Maintenance              | Complete |
| Fuel Management          | Complete |
| Expense Management       | Complete |
| Document Compliance      | Complete |
| Notifications            | Complete |
| Analytics & Reports      | Complete |
| Cross-Module Integration | Complete |
| Security Audit           | Complete |
| Regression Testing       | Complete |
| Production Build         | Complete |
| Local Verification       | Complete |

---

# Author

## Maitri Prajapati

**Information Technology Engineering**
**LD College of Engineering**

---

# FleetFlow

**Centralized fleet operations. Connected workflows. Data-driven decisions.**
