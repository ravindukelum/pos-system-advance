# Database Cleanup Analysis - Updated

Based on comprehensive analysis of frontend API calls and backend route handlers, here's what tables and columns are actually being used:

## USED TABLES AND COLUMNS

### 1. users
**Used columns:**
- id, username, email, full_name, role, status, phone, address, department, position
- is_locked, locked_at, failed_login_attempts, last_login, created_at, updated_at, permissions
- password_hash (for authentication)

### 2. customers
**Used columns:**
- id, name, email, phone, customer_code, created_at, updated_at
- Used in: Sales, Reports, Customer management

### 3. partners
**Used columns:**
- id, name, type (investor/supplier), created_at
- Used in: Dashboard overview, Investments

### 4. investments
**Used columns:**
- id, partner_id, amount, type (invest/withdraw), created_at
- Used in: Dashboard overview, Investment tracking

### 5. inventory
**Used columns:**
- id, item_name, sku, category, quantity, unit_price, buy_price, warranty_days, created_at
- Used in: Sales, Reports, Inventory management, Barcode scanning

### 6. sales
**Used columns:**
- id, date, total_amount, paid_amount, tax_amount, discount_amount, status, created_at
- Used in: Sales management, Reports, Dashboard analytics

### 7. sales_items
**Used columns:**
- id, sale_id, item_id, item_name, quantity, unit_price, line_total, created_at
- Used in: Sales details, Product performance reports

### 8. payments
**Used columns:**
- id, sale_id, payment_method, amount, transaction_reference, created_at
- Used in: Payment processing, Transaction history

### 9. payment_methods
**Used columns:**
- id, name, enabled
- Used in: Payment processing

### 10. settings
**Used columns:**
- id, shop_name, shop_phone, shop_email, shop_address, shop_city, shop_state, shop_zip_code
- tax_rate, currency, country_code, warranty_period, warranty_terms, receipt_footer
- business_registration, tax_id, created_at, updated_at

## UNUSED TABLES (TO BE REMOVED)

1. **locations** - Referenced in routes but not used by frontend
2. **user_sessions** - Not referenced anywhere
3. **inventory_transfers** - Not referenced anywhere
4. **location_inventory** - Not referenced anywhere
5. **employees** - Not used by frontend (users table handles this)
6. **time_tracking** - Not used by frontend
7. **refunds** - Not actively used in current implementation

## UNUSED COLUMNS (TO BE REMOVED)

### users table:
- locked_by, lock_reason (not used in current auth implementation)

### inventory table:
- location_id (locations not used)
- supplier_id (not actively used)
- reorder_level, reorder_quantity (not used in current implementation)

### settings table:
- shop_logo_url (not used in current implementation)
- low_stock_threshold, auto_backup, backup_frequency (not actively used)

## CLEANUP RECOMMENDATIONS

### Phase 1: Remove unused tables
- Drop: locations, user_sessions, inventory_transfers, location_inventory, employees, time_tracking, refunds

### Phase 2: Remove unused columns
- Remove unused columns from users, inventory, and settings tables

### Phase 3: Optimize remaining tables
- Ensure proper indexing on frequently queried columns
- Optimize data types where appropriate

This cleanup will significantly reduce database complexity while maintaining all functionality currently used by the application.