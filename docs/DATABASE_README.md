# QOrder Database Documentation

## Overview
This document describes the clean database schema for the QOrder POS system after cleanup and consolidation.

## Database Setup

### Fresh Installation
To create a fresh database with all tables:

```sql
-- Drop existing database (if needed)
DROP DATABASE IF EXISTS qorder;

-- Create new database
CREATE DATABASE qorder;
USE qorder;

-- Run the schema file
source database_schema.sql;
```

### Schema File
The complete database schema is available in `database_schema.sql` which includes:
- All table definitions with latest structure
- Foreign key constraints with CASCADE DELETE
- Default data insertion
- Proper indexing

## Table Structure

### Core Tables
1. **users** - System users and authentication
2. **customers** - Customer information and loyalty data
3. **inventory** - Product catalog and stock management
4. **sales** - Sales transactions
5. **sales_items** - Individual items in sales
6. **payments** - Payment records
7. **payment_methods** - Available payment options

### Supporting Tables
8. **partners** - Business partners (investors/suppliers)
9. **investments** - Investment tracking
10. **refunds** - Refund records
11. **settings** - System configuration
12. **employees** - Employee management
13. **time_tracking** - Employee time tracking
14. **message_logs** - WhatsApp messaging logs

## Key Features

### Database Compatibility
- Supports both MySQL and PostgreSQL
- Environment-based configuration
- Automatic database creation

### Data Integrity
- Foreign key constraints
- CASCADE DELETE for related records
- Proper data types and constraints

### Default Data
- Default payment methods
- System settings
- Admin user account

## Migration Notes

### Removed Features
- Location-based inventory (unused)
- Legacy migration system
- Unused table structures
- Debug and test files

### Consolidated Features
- All schema changes integrated into main tables
- WhatsApp messaging support built-in
- Simplified foreign key relationships

## Environment Variables

```env
# MySQL (Local Development)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_PORT=3306
DB_NAME=qorder

# PostgreSQL (Production)
DATABASE_URL=postgresql://user:password@host:port/database
```

## Backup and Recovery

Before dropping tables, always backup your data:

```sql
-- Backup all data
mysqldump -u root -p qorder > qorder_backup.sql

-- Restore from backup
mysql -u root -p qorder < qorder_backup.sql
```