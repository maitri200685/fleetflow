-- FleetFlow Database Update / Migration Script
-- Ensures all tables for Modules 2-10 exist with exact requested columns, constraints, and indexes.

-- 1. DRIVERS TABLE
DROP TABLE IF EXISTS drivers CASCADE;

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    date_of_birth DATE,
    address TEXT,
    emergency_contact VARCHAR(50),
    joining_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_driver_status CHECK (status IN ('Available', 'On Trip', 'Off Duty', 'Inactive', 'Suspended'))
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_code ON drivers(driver_code);
CREATE INDEX idx_drivers_license ON drivers(license_number);

-- 2. CUSTOMERS TABLE
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Active';

UPDATE customers SET customer_code = 'CUST-1001' WHERE customer_code IS NULL;
UPDATE customers SET contact_person = contact_name WHERE contact_person IS NULL AND contact_name IS NOT NULL;
UPDATE customers SET postal_code = pincode WHERE postal_code IS NULL AND pincode IS NOT NULL;
UPDATE customers SET status = 'Active' WHERE status IS NULL;

ALTER TABLE customers ALTER COLUMN customer_code SET NOT NULL;
ALTER TABLE customers ADD CONSTRAINT unique_customer_code UNIQUE (customer_code);

-- 3. TRIPS TABLE
DROP TABLE IF EXISTS trips CASCADE;

CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_code VARCHAR(50) UNIQUE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES drivers(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    cargo_description TEXT,
    cargo_weight_kg DECIMAL(10,2) CHECK (cargo_weight_kg >= 0),
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    distance_km DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
    estimated_cost DECIMAL(12,2) DEFAULT 0,
    actual_cost DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_trip_status CHECK (status IN ('Scheduled', 'Assigned', 'In Transit', 'Completed', 'Cancelled', 'Delayed'))
);

CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_customer ON trips(customer_id);
CREATE INDEX idx_trips_status ON trips(status);

-- 4. MAINTENANCE TABLE
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS maintenance CASCADE;

CREATE TABLE maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(100) NOT NULL,
    description TEXT,
    service_date DATE NOT NULL,
    odometer_km DECIMAL(12,2) DEFAULT 0 CHECK (odometer_km >= 0),
    cost DECIMAL(12,2) DEFAULT 0 CHECK (cost >= 0),
    service_center VARCHAR(150),
    next_service_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_maintenance_status CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled'))
);

CREATE INDEX idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX idx_maintenance_status ON maintenance(status);

-- 5. FUEL RECORDS TABLE
DROP TABLE IF EXISTS fuel_records CASCADE;

CREATE TABLE fuel_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    fuel_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fuel_type VARCHAR(50) NOT NULL DEFAULT 'DIESEL',
    quantity_liters DECIMAL(10,2) NOT NULL CHECK (quantity_liters > 0),
    price_per_liter DECIMAL(10,2) NOT NULL CHECK (price_per_liter >= 0),
    total_cost DECIMAL(12,2) NOT NULL CHECK (total_cost >= 0),
    odometer_km DECIMAL(12,2) NOT NULL CHECK (odometer_km >= 0),
    station_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fuel_records_vehicle ON fuel_records(vehicle_id);
CREATE INDEX idx_fuel_records_date ON fuel_records(fuel_date);

-- 6. EXPENSES TABLE
DROP TABLE IF EXISTS expenses CASCADE;

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
    expense_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_expense_type CHECK (expense_type IN ('Fuel', 'Maintenance', 'Toll', 'Parking', 'Driver Allowance', 'Insurance', 'Other'))
);

CREATE INDEX idx_expenses_vehicle ON expenses(vehicle_id);
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_expenses_type ON expenses(expense_type);

-- 7. DOCUMENTS TABLE
DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_doc_owner CHECK (vehicle_id IS NOT NULL OR driver_id IS NOT NULL),
    CONSTRAINT check_doc_status CHECK (status IN ('Active', 'Expired', 'Expiring Soon', 'Inactive'))
);

CREATE INDEX idx_documents_vehicle ON documents(vehicle_id);
CREATE INDEX idx_documents_driver ON documents(driver_id);
CREATE INDEX idx_documents_status ON documents(status);

-- 8. NOTIFICATIONS TABLE
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(is_read);

