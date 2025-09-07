-- Database Schema Backup Script
-- Generated before cleanup operations
-- Run this to backup your current schema

-- Create backup database
CREATE DATABASE IF NOT EXISTS qorder_backup;
USE qorder_backup;

-- Backup all tables structure and data
CREATE TABLE users_backup AS SELECT * FROM qorder.users;
CREATE TABLE customers_backup AS SELECT * FROM qorder.customers;
CREATE TABLE partners_backup AS SELECT * FROM qorder.partners;
CREATE TABLE investments_backup AS SELECT * FROM qorder.investments;
CREATE TABLE inventory_backup AS SELECT * FROM qorder.inventory;
CREATE TABLE sales_backup AS SELECT * FROM qorder.sales;
CREATE TABLE sales_items_backup AS SELECT * FROM qorder.sales_items;
CREATE TABLE payments_backup AS SELECT * FROM qorder.payments;
CREATE TABLE refunds_backup AS SELECT * FROM qorder.refunds;
CREATE TABLE settings_backup AS SELECT * FROM qorder.settings;
CREATE TABLE employees_backup AS SELECT * FROM qorder.employees;
CREATE TABLE time_tracking_backup AS SELECT * FROM qorder.time_tracking;
CREATE TABLE payment_methods_backup AS SELECT * FROM qorder.payment_methods;

-- Backup unused tables (to be dropped)
CREATE TABLE locations_backup AS SELECT * FROM qorder.locations;
CREATE TABLE location_inventory_backup AS SELECT * FROM qorder.location_inventory;
CREATE TABLE inventory_transfers_backup AS SELECT * FROM qorder.inventory_transfers;
CREATE TABLE user_sessions_backup AS SELECT * FROM qorder.user_sessions;
CREATE TABLE tax_rates_backup AS SELECT * FROM qorder.tax_rates;
CREATE TABLE categories_backup AS SELECT * FROM qorder.categories;
CREATE TABLE suppliers_backup AS SELECT * FROM qorder.suppliers;
CREATE TABLE integration_logs_backup AS SELECT * FROM qorder.integration_logs;

-- Show backup completion
SELECT 'Schema backup completed successfully' AS status;
SELECT COUNT(*) AS total_tables_backed_up FROM information_schema.tables WHERE table_schema = 'qorder_backup';