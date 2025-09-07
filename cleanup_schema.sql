-- Database Cleanup Script
-- This script removes unused tables and columns from the QOrder database
-- IMPORTANT: Run backup_schema.sql BEFORE executing this script

USE qorder;

-- Phase 1: Drop unused tables
SELECT 'Starting Phase 1: Dropping unused tables...' AS status;

-- Drop location-related tables (unused feature)
DROP TABLE IF EXISTS inventory_transfers;
DROP TABLE IF EXISTS location_inventory;
DROP TABLE IF EXISTS locations;

-- Drop other unused tables
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS tax_rates;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS integration_logs;

SELECT 'Phase 1 completed: Unused tables dropped' AS status;

-- Phase 2: Remove unused columns from existing tables
SELECT 'Starting Phase 2: Removing unused columns...' AS status;

-- Remove unused columns from users table
ALTER TABLE users 
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS date_of_birth,
DROP COLUMN IF EXISTS profile_picture,
DROP COLUMN IF EXISTS emergency_contact,
DROP COLUMN IF EXISTS notes;

-- Remove unused columns from customers table
ALTER TABLE customers 
DROP COLUMN IF EXISTS date_of_birth,
DROP COLUMN IF EXISTS notes;

-- Remove unused columns from inventory table
ALTER TABLE inventory 
DROP COLUMN IF EXISTS location_id,
DROP COLUMN IF EXISTS reorder_point,
DROP COLUMN IF EXISTS reorder_quantity,
DROP COLUMN IF EXISTS unit,
DROP COLUMN IF EXISTS weight,
DROP COLUMN IF EXISTS dimensions,
DROP COLUMN IF EXISTS image_url;

-- Remove unused columns from sales table
ALTER TABLE sales 
DROP COLUMN IF EXISTS location_id,
DROP COLUMN IF EXISTS notes;

SELECT 'Phase 2 completed: Unused columns removed' AS status;

-- Phase 3: Clean up any remaining references
SELECT 'Starting Phase 3: Final cleanup...' AS status;

-- Remove any foreign key constraints that might reference dropped tables
-- (MySQL will automatically drop constraints when tables are dropped)

-- Verify cleanup
SELECT 'Cleanup completed successfully!' AS status;

-- Show remaining tables
SELECT 'Remaining tables:' AS info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'qorder' 
ORDER BY table_name;

-- Show table sizes after cleanup
SELECT 'Table sizes after cleanup:' AS info;
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'qorder'
ORDER BY (data_length + index_length) DESC;