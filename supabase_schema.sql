-- =============================================================================
-- shoPPilot IMS - Complete Supabase PostgreSQL Database Schema
-- Run this complete script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. MASTER TABLES
-- -----------------------------------------------------------------------------

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id VARCHAR(50) PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
    brand_id VARCHAR(50) PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id VARCHAR(50) PRIMARY KEY,
    warehouse_name VARCHAR(255) NOT NULL,
    location TEXT,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id VARCHAR(50) PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_type VARCHAR(100) DEFAULT 'Retail', -- 'Retail', 'Wholesale', 'Corporate', 'Distributor', 'Dealer'
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    current_due NUMERIC(14,2) DEFAULT 0,
    opening_due NUMERIC(14,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration for existing customers table:
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(100) DEFAULT 'Retail';

-- Users (Application Operators & Roles)
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'Viewer', -- 'Admin', 'Manager', 'Sales', 'Viewer'
    status VARCHAR(30) DEFAULT 'Active',
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Catalog
CREATE TABLE IF NOT EXISTS products (
    product_id VARCHAR(50) PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category_id VARCHAR(50) REFERENCES categories(category_id) ON DELETE SET NULL,
    brand_id VARCHAR(50) REFERENCES brands(brand_id) ON DELETE SET NULL,
    upc VARCHAR(100) DEFAULT '1', -- Units per Carton (Pack Size)
    stock NUMERIC(14,3) DEFAULT 0,
    reorder_level NUMERIC(14,3) DEFAULT 10,
    expiry_date DATE,
    status VARCHAR(30) DEFAULT 'Active',
    unit_price NUMERIC(14,2) DEFAULT 0, -- Cost Price
    sale_price NUMERIC(14,2) DEFAULT 0,
    mrp_price NUMERIC(14,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouse Multi-Stock Levels
CREATE TABLE IF NOT EXISTS warehouse_stock (
    product_id VARCHAR(50) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    warehouse_name VARCHAR(255),
    stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    lastupdated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (product_id, warehouse_id)
);

-- -----------------------------------------------------------------------------
-- 2. TRANSACTION TABLES
-- -----------------------------------------------------------------------------

-- Purchases (Supplier Inbound)
CREATE TABLE IF NOT EXISTS transactions_purchase (
    purchase_id VARCHAR(50) PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    warehouse_id VARCHAR(50) REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
    supplier_id VARCHAR(50) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE CASCADE,
    batch_no VARCHAR(100),
    expiry_date DATE,
    quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(14,2) DEFAULT 0,
    mrp_price NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) DEFAULT 0,
    created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales (POS & Invoices)
CREATE TABLE IF NOT EXISTS transactions_sales (
    sale_id VARCHAR(50) PRIMARY KEY,
    invoice_no VARCHAR(100) NOT NULL,
    memo_no VARCHAR(100),
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE SET NULL,
    warehouse_id VARCHAR(50) REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE CASCADE,
    batch_no VARCHAR(100),
    quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    sale_price NUMERIC(14,2) DEFAULT 0,
    gross_total NUMERIC(14,2) DEFAULT 0,
    discount NUMERIC(14,2) DEFAULT 0,
    net_total NUMERIC(14,2) DEFAULT 0,
    payment_type VARCHAR(50) DEFAULT 'Cash',
    paid_amount NUMERIC(14,2) DEFAULT 0,
    due_amount NUMERIC(14,2) DEFAULT 0,
    created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Movement Ledger
CREATE TABLE IF NOT EXISTS inventory_ledger (
    ledger_id VARCHAR(50) PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    product_id VARCHAR(50) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    warehouse_id VARCHAR(50) REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
    batch_no VARCHAR(100),
    type VARCHAR(30) NOT NULL, -- 'IN' or 'OUT'
    reference_id VARCHAR(100), -- 'INV-...', 'PU-...', 'TRF-...', 'RET-...'
    quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    balance_stock NUMERIC(14,3) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Payments (Accounts Receivable)
CREATE TABLE IF NOT EXISTS customer_payments (
    payment_id VARCHAR(50) PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE SET NULL,
    invoice_no VARCHAR(100),
    memo_no VARCHAR(100),
    category VARCHAR(100),
    bank_name VARCHAR(255),
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    payment_mode VARCHAR(50) DEFAULT 'Cash',
    narration TEXT,
    created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deposits & Cash Settlement
CREATE TABLE IF NOT EXISTS deposits (
    deposit_id VARCHAR(50) PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deposit_type VARCHAR(100) DEFAULT 'Bank Deposit', -- 'Bank Deposit' or 'Expense / Other'
    destination VARCHAR(255) NOT NULL,
    slip_no VARCHAR(100),
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    note TEXT,
    created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Operating Expenses
CREATE TABLE IF NOT EXISTS expenses (
    expense_id VARCHAR(50) PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    category VARCHAR(255) NOT NULL,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    note TEXT,
    created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. SETTINGS & CONFIGURATION TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings_banks (
    bank_id VARCHAR(50) PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings_expense_categories (
    ec_id VARCHAR(50) PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings_customer_types (
    ct_id VARCHAR(50) PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration for settings_expense_categories and settings_customer_types
ALTER TABLE IF EXISTS settings_expense_categories ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Active';
ALTER TABLE IF EXISTS deposits ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Active';
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Active';
CREATE TABLE IF NOT EXISTS settings_customer_types (
    ct_id VARCHAR(50) PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE INDEX IF NOT EXISTS idx_purch_date ON transactions_purchase(date DESC);
CREATE INDEX IF NOT EXISTS idx_purch_prod ON transactions_purchase(product_id);
CREATE INDEX IF NOT EXISTS idx_purch_wh ON transactions_purchase(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purch_supplier ON transactions_purchase(supplier_id);

CREATE INDEX IF NOT EXISTS idx_sales_date ON transactions_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_inv ON transactions_sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_memo ON transactions_sales(memo_no);
CREATE INDEX IF NOT EXISTS idx_sales_cust ON transactions_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_prod ON transactions_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_wh ON transactions_sales(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_ledger_prod_date ON inventory_ledger(product_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_wh ON inventory_ledger(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON inventory_ledger(reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON inventory_ledger(type);

CREATE INDEX IF NOT EXISTS idx_payments_cust_date ON customer_payments(customer_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_inv ON customer_payments(invoice_no);
CREATE INDEX IF NOT EXISTS idx_deposits_date ON deposits(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_purchase ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_expense_categories ENABLE ROW LEVEL SECURITY;

-- Create public/anon policies for all operations so the client web app functions smoothly
-- (You can later restrict these per user role using Supabase Auth JWT claims if required)

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon all on %I" ON %I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow anon all on %I" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6. DEFAULT SEED DATA
-- -----------------------------------------------------------------------------

-- Default System Settings
INSERT INTO settings (key, value) VALUES
    ('COMPANY_NAME', 'shoPPilot'),
    ('CURRENCY_SYMBOL', '৳'),
    ('INVOICE_PREFIX', 'INV'),
    ('LOW_STOCK_ALERT_LEVEL', '10'),
    ('LOW_STOCK_ALERT_DAYS', '5'),
    ('EXPIRY_ALERT_DAYS', '30'),
    ('OPENING_CASH_BALANCE', '0')
ON CONFLICT (key) DO NOTHING;

-- Default Admin User (U0001 / admin123)
INSERT INTO users (user_id, name, email, role, status, password) VALUES
    ('U0001', 'Admin Operator', 'admin@shoppilot.com', 'Admin', 'Active', 'admin123')
ON CONFLICT (user_id) DO NOTHING;

-- Default Warehouses
INSERT INTO warehouses (warehouse_id, warehouse_name, location, status) VALUES
    ('W001', 'MouloviBazar', 'Central Dhaka', 'Active'),
    ('W002', 'Begumganj 2', 'Begumganj Hub', 'Active'),
    ('W003', 'Begumganj 3', 'Begumganj Secondary', 'Active'),
    ('W004', 'Armanitola', 'Old Dhaka Hub', 'Active')
ON CONFLICT (warehouse_id) DO NOTHING;

-- Default Expense Categories
INSERT INTO settings_expense_categories (ec_id, category_name, status) VALUES
    ('EC0001', 'Shop Rent', 'Active'),
    ('EC0002', 'Staff Salary', 'Active'),
    ('EC0003', 'Electricity & Utilities', 'Active'),
    ('EC0004', 'Transport & Delivery', 'Active'),
    ('EC0005', 'Office Stationary & Tea', 'Active')
ON CONFLICT (ec_id) DO NOTHING;

-- Default Customer Types
INSERT INTO settings_customer_types (ct_id, type_name, status) VALUES
    ('CT0001', 'Retail', 'Active'),
    ('CT0002', 'Wholesale', 'Active'),
    ('CT0003', 'Corporate', 'Active'),
    ('CT0004', 'Distributor', 'Active'),
    ('CT0005', 'Dealer', 'Active')
ON CONFLICT (ct_id) DO NOTHING;

-- Default Banks
INSERT INTO settings_banks (bank_id, bank_name, status) VALUES
    ('BK0001', 'City Bank Ltd', 'Active'),
    ('BK0002', 'Islami Bank Bangladesh', 'Active'),
    ('BK0003', 'BRAC Bank', 'Active'),
    ('BK0004', 'Dutch-Bangla Bank', 'Active')
ON CONFLICT (bank_id) DO NOTHING;

-- Default Categories
INSERT INTO categories (category_id, category_name, status) VALUES
    ('C0001', 'Hair Care', 'Active'),
    ('C0002', 'Skin Care', 'Active'),
    ('C0003', 'Baby Care', 'Active'),
    ('C0004', 'Oral Care', 'Active'),
    ('C0005', 'Olive Oil', 'Active')
ON CONFLICT (category_id) DO NOTHING;

-- Default Brands
INSERT INTO brands (brand_id, brand_name, status) VALUES
    ('B0001', 'Vasmol', 'Active'),
    ('B0002', 'Dettol', 'Active'),
    ('B0003', 'Parachute', 'Active'),
    ('B0004', 'Sesa', 'Active'),
    ('B0005', 'Figaro', 'Active')
ON CONFLICT (brand_id) DO NOTHING;

-- Default Suppliers
INSERT INTO suppliers (supplier_id, supplier_name, contact_person, phone, status) VALUES
    ('S0001', 'Unilever Bangladesh', 'Mr. Tareq', '01912345678', 'Active'),
    ('S0002', 'Square Consumer', 'Mr. Farhan', '01812345678', 'Active')
ON CONFLICT (supplier_id) DO NOTHING;

-- Default Customers
INSERT INTO customers (customer_id, customer_name, phone, address, current_due, opening_due, status) VALUES
    ('CST0005', 'Nasim Store-HBL', '01819887733', 'Habiganj Market', 23032, 0, 'Active'),
    ('CST0001', 'Hamidul Store-MEL', '01711223344', 'MouloviBazar Market', 15400, 15400, 'Active'),
    ('CST0002', 'Masud Store-HBL', '01819887766', 'Habiganj Bazar', 8200, 8200, 'Active'),
    ('CST0003', 'Hamidul Store-HBL', '01819887755', 'Habiganj Market', 0, 0, 'Active'),
    ('CST0004', 'S.B.Traders-MEL', '01719887744', 'Moulvibazar', 45173, 45173, 'Active')
ON CONFLICT (customer_id) DO NOTHING;

-- Default Master Products
INSERT INTO products (product_id, product_name, category_id, brand_id, upc, stock, reorder_level, unit_price, sale_price, mrp_price, status) VALUES
    ('P0010', 'Amba Olive oil 150gm tin (80) 550/-', 'C0005', 'B0005', '80', 2720, 10, 380, 458.33, 550, 'Active'),
    ('P0011', 'Lucy Olive Oil 150gm tin (80) 515/-', 'C0005', 'B0005', '80', 2480, 10, 360, 429, 515, 'Active'),
    ('P0012', 'Sesa Ayurvedic 100ml 230/-', 'C0001', 'B0004', '96', 12632, 10, 155, 191.67, 230, 'Active'),
    ('P0013', 'Sesa Ayurvedic 100ml 265/-', 'C0001', 'B0004', '96', 165600, 10, 180, 220.83, 265, 'Active'),
    ('P0014', 'Sesa Ayurvedic 200ml 490/-', 'C0001', 'B0004', '48', 1344, 10, 340, 408, 490, 'Active'),
    ('P0015', 'Sesa Ayurvedic 200ml 420/-', 'C0001', 'B0004', '48', 21, 10, 290, 350, 420, 'Active'),
    ('P0016', 'Vasmol Henna Cream Hair Colour Black (12+12)ml 30/-', 'C0001', 'B0001', '192', 1200, 10, 20, 24, 30, 'Active'),
    ('P0001', 'Super Vasmol 33 Kesh Kala 100ml', 'C0001', 'B0001', '24', 120, 10, 65, 80, 85, 'Active'),
    ('P0002', 'Dettol Antiseptic Liquid 100ml', 'C0002', 'B0002', '12', 60, 10, 110, 130, 135, 'Active')
ON CONFLICT (product_id) DO NOTHING;

-- Default Multi-Warehouse Stock
INSERT INTO warehouse_stock (product_id, warehouse_id, warehouse_name, stock) VALUES
    ('P0010', 'W001', 'MouloviBazar', 2720),
    ('P0010', 'W002', 'Begumganj 2', 800),
    ('P0011', 'W001', 'MouloviBazar', 2480),
    ('P0012', 'W001', 'MouloviBazar', 12632),
    ('P0013', 'W002', 'Begumganj 2', 165600),
    ('P0013', 'W001', 'MouloviBazar', 9600),
    ('P0014', 'W001', 'MouloviBazar', 1344),
    ('P0015', 'W001', 'MouloviBazar', 21),
    ('P0016', 'W001', 'MouloviBazar', 1200),
    ('P0001', 'W001', 'MouloviBazar', 80),
    ('P0002', 'W001', 'MouloviBazar', 60)
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

