# Database Setup Guide

## Overview
This directory contains the exact database schema for the QOrder POS System, extracted directly from the running `pos_system_local` database.

## Files

### `database_schema_clean.sql`
- **Purpose**: Clean, executable SQL script that creates all tables exactly as they exist in the current database
- **Source**: Generated from the live `pos_system_local` database using mysqldump
- **Usage**: Can be used to recreate the database structure on any MySQL server

### `database_schema_exact.sql`
- **Purpose**: Raw mysqldump output with all MySQL-specific commands
- **Usage**: Reference file showing the complete database structure

### `database_schema.sql` (Legacy)
- **Purpose**: Original schema file (may be outdated)
- **Note**: Use `database_schema_clean.sql` for the most accurate structure

## Database Connection Details
- **Database Name**: `pos_system_local`
- **Username**: `root`
- **Password**: `root`
- **Host**: `localhost`
- **Port**: `3306` (default MySQL port)

## How to Use

### Option 1: Using the Clean Schema Script (Recommended)
```bash
# Navigate to the project directory
cd d:\Projects\qorder

# Execute the clean schema script
Get-Content scripts/database_schema_clean.sql | mysql -u root -proot
```

### Option 2: Using MySQL Command Line
```bash
# Connect to MySQL
mysql -u root -proot

# Source the script
source scripts/database_schema_clean.sql;
```

### Option 3: Using MySQL Workbench
1. Open MySQL Workbench
2. Connect to your MySQL server (root/root)
3. Open the `database_schema_clean.sql` file
4. Execute the script

## Tables Created

The script creates the following 15 tables:

1. **`customers`** - Customer information and loyalty data
2. **`inventory`** - Product inventory with pricing and stock levels
3. **`inventory_transfers`** - Stock transfers between locations
4. **`investments`** - Partner investment tracking
5. **`location_inventory`** - Location-specific inventory levels
6. **`locations`** - Store/warehouse locations
7. **`message_logs`** - WhatsApp message history
8. **`partners`** - Business partners information
9. **`payment_methods`** - Available payment options
10. **`payments`** - Payment transaction records
11. **`sales`** - Sales transaction headers
12. **`sales_items`** - Individual items in sales transactions
13. **`settings`** - System configuration settings
14. **`user_sessions`** - User authentication sessions
15. **`users`** - System users and employees

## Features

- ✅ **Exact Structure**: Matches the live database 100%
- ✅ **Foreign Key Constraints**: All relationships properly defined
- ✅ **Indexes**: All indexes and unique constraints included
- ✅ **Data Types**: Exact column types and sizes
- ✅ **Default Values**: All default values preserved
- ✅ **Character Set**: UTF8MB4 for full Unicode support
- ✅ **Engine**: InnoDB for ACID compliance and foreign keys

## Automatic vs Manual Setup

### Automatic Setup (Backend)
When you run `npm start` in the backend, the system automatically:
- Creates all tables if they don't exist
- Inserts default data (users, customers, settings, etc.)
- Handles both MySQL and PostgreSQL

### Manual Setup (This Script)
Use this script when you need to:
- Set up a fresh database manually
- Recreate the exact structure on another server
- Reset the database structure without default data
- Migrate to a new environment

## Verification

After running the script, verify the setup:

```sql
-- Check all tables are created
USE pos_system_local;
SHOW TABLES;

-- Verify table structure (example)
DESCRIBE users;
DESCRIBE customers;
DESCRIBE sales;
```

## Notes

- The script includes `DROP TABLE IF EXISTS` statements, so it's safe to run multiple times
- Foreign key constraints are properly handled with dependency order
- The script creates the database if it doesn't exist
- All tables use InnoDB engine for transaction support
- Character set is UTF8MB4 for full emoji and international character support

## Troubleshooting

### Common Issues

1. **Access Denied**: Ensure MySQL is running and credentials are correct
2. **Database Exists**: The script will recreate tables safely
3. **Foreign Key Errors**: The script handles constraint order automatically
4. **Character Set Issues**: Script sets proper UTF8MB4 encoding

### Getting Help

If you encounter issues:
1. Check MySQL service is running
2. Verify connection credentials
3. Ensure sufficient privileges for database creation
4. Check MySQL error logs for detailed error messages