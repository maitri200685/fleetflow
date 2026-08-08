
-- ============================================================
-- FleetFlow Management System
-- Database Schema
-- PostgreSQL
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 2. ENUM TYPES
-- ============================================================

-- User roles
CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'FLEET_MANAGER',
    'DRIVER',
    'MAINTENANCE_STAFF',
    'CUSTOMER'
);

-- User account status
CREATE TYPE user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

-- Vehicle status
CREATE TYPE vehicle_status AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'IN_TRANSIT',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
);

-- Driver status
CREATE TYPE driver_status AS ENUM (
    'AVAILABLE',
    'ON_DUTY',
    'ON_DELIVERY',
    'OFF_DUTY',
    'SUSPENDED'
);

-- Delivery status
CREATE TYPE delivery_status AS ENUM (
    'CREATED',
    'ASSIGNED',
    'DRIVER_ACCEPTED',
    'PICKED_UP',
    'IN_TRANSIT',
    'ARRIVED',
    'DELIVERED',
    'DELAYED',
    'RESCHEDULED',
    'CANCELLED'
);

-- Delivery priority
CREATE TYPE delivery_priority AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);

-- Maintenance status
CREATE TYPE maintenance_status AS ENUM (
    'REQUESTED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


-- ============================================================
-- 3. USERS
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    phone VARCHAR(20),

    role user_role NOT NULL,

    status user_status NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 4. DRIVERS
-- ============================================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE,

    license_number VARCHAR(50) NOT NULL UNIQUE,

    license_expiry DATE NOT NULL,

    experience_years INTEGER DEFAULT 0,

    status driver_status NOT NULL DEFAULT 'OFF_DUTY',

    rating DECIMAL(3,2) DEFAULT 0.00,

    total_deliveries INTEGER DEFAULT 0,

    successful_deliveries INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_driver_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 5. CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID UNIQUE,

    company_name VARCHAR(150),

    contact_name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL UNIQUE,

    phone VARCHAR(20) NOT NULL,

    address TEXT NOT NULL,

    city VARCHAR(100) NOT NULL,

    state VARCHAR(100),

    pincode VARCHAR(10),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_customer_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- ============================================================
-- 6. VEHICLES
-- ============================================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_code VARCHAR(50) NOT NULL UNIQUE,

    registration_number VARCHAR(30) NOT NULL UNIQUE,

    vehicle_type VARCHAR(50) NOT NULL,

    brand VARCHAR(100),

    model VARCHAR(100),

    manufacturing_year INTEGER,

    capacity_kg DECIMAL(10,2) NOT NULL,

    fuel_type VARCHAR(30) NOT NULL,

    current_mileage_km DECIMAL(12,2) DEFAULT 0,

    status vehicle_status NOT NULL DEFAULT 'AVAILABLE',

    insurance_expiry DATE,

    pollution_expiry DATE,

    last_service_date DATE,

    next_service_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_vehicle_capacity
        CHECK (capacity_kg > 0)
);


-- ============================================================
-- 7. ROUTES
-- ============================================================

CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    route_name VARCHAR(150),

    pickup_address TEXT NOT NULL,

    pickup_latitude DECIMAL(10,7),

    pickup_longitude DECIMAL(10,7),

    destination_address TEXT NOT NULL,

    destination_latitude DECIMAL(10,7),

    destination_longitude DECIMAL(10,7),

    distance_km DECIMAL(10,2),

    estimated_duration_minutes INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 8. DELIVERIES
-- ============================================================

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_number VARCHAR(50) NOT NULL UNIQUE,

    customer_id UUID NOT NULL,

    driver_id UUID,

    vehicle_id UUID,

    route_id UUID,

    package_description TEXT NOT NULL,

    package_weight_kg DECIMAL(10,2) NOT NULL,

    priority delivery_priority NOT NULL DEFAULT 'NORMAL',

    status delivery_status NOT NULL DEFAULT 'CREATED',

    delivery_deadline TIMESTAMP WITH TIME ZONE,

    actual_delivery_time TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_delivery_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id),

    CONSTRAINT fk_delivery_driver
        FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_delivery_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_delivery_route
        FOREIGN KEY (route_id)
        REFERENCES routes(id)
        ON DELETE SET NULL,

    CONSTRAINT check_package_weight
        CHECK (package_weight_kg > 0)
);


-- ============================================================
-- 9. DELIVERY HISTORY
-- ============================================================

CREATE TABLE delivery_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    delivery_id UUID NOT NULL,

    previous_status delivery_status,

    new_status delivery_status NOT NULL,

    changed_by UUID,

    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_delivery
        FOREIGN KEY (delivery_id)
        REFERENCES deliveries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_history_user
        FOREIGN KEY (changed_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- ============================================================
-- 10. MAINTENANCE RECORDS
-- ============================================================

CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id UUID NOT NULL,

    issue_description TEXT NOT NULL,

    priority delivery_priority NOT NULL DEFAULT 'NORMAL',

    status maintenance_status NOT NULL DEFAULT 'REQUESTED',

    service_cost DECIMAL(12,2) DEFAULT 0,

    parts_replaced TEXT,

    technician_name VARCHAR(100),

    scheduled_date DATE,

    completed_date DATE,

    next_service_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_maintenance_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 11. FUEL RECORDS
-- ============================================================

CREATE TABLE fuel_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id UUID NOT NULL,

    fuel_quantity_liters DECIMAL(10,2) NOT NULL,

    fuel_cost DECIMAL(12,2) NOT NULL,

    odometer_km DECIMAL(12,2) NOT NULL,

    fuel_station VARCHAR(150),

    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_fuel_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    CONSTRAINT check_fuel_quantity
        CHECK (fuel_quantity_liters > 0),

    CONSTRAINT check_fuel_cost
        CHECK (fuel_cost >= 0)
);


-- ============================================================
-- 12. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 13. DOCUMENTS
-- ============================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id UUID,

    document_type VARCHAR(100) NOT NULL,

    file_url TEXT NOT NULL,

    expiry_date DATE,

    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 14. INDEXES
-- ============================================================

CREATE INDEX idx_users_email
    ON users(email);

CREATE INDEX idx_vehicles_status
    ON vehicles(status);

CREATE INDEX idx_drivers_status
    ON drivers(status);

CREATE INDEX idx_deliveries_status
    ON deliveries(status);

CREATE INDEX idx_deliveries_customer
    ON deliveries(customer_id);

CREATE INDEX idx_deliveries_driver
    ON deliveries(driver_id);

CREATE INDEX idx_deliveries_vehicle
    ON deliveries(vehicle_id);

CREATE INDEX idx_delivery_history_delivery
    ON delivery_history(delivery_id);

CREATE INDEX idx_maintenance_vehicle
    ON maintenance_records(vehicle_id);

CREATE INDEX idx_fuel_vehicle
    ON fuel_records(vehicle_id);

CREATE INDEX idx_notifications_user
    ON notifications(user_id);


-- ============================================================
-- END OF FLEETFLOW DATABASE SCHEMA
-- ============================================================

