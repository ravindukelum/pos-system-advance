const mysql = require('mysql2/promise');
require('dotenv').config();

// Determine database type and configuration
const isPostgreSQL = process.env.DATABASE_URL ? true : false;
let dbConfig;

if (isPostgreSQL) {
  // PostgreSQL configuration for Render
  const { Pool } = require('pg');
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
} else {
  // MySQL configuration for local development
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'pos_system_local'
  };
}

let db;

// Initialize database connection
const initializeDatabase = async () => {
  try {
    if (isPostgreSQL) {
      // PostgreSQL connection
      const { Pool } = require('pg');
      db = new Pool(dbConfig);
      console.log('Connected to PostgreSQL database.');
    } else {
      // MySQL connection
      // First connect without database to create it if it doesn't exist
      const connection = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port
      });
      
      await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
      await connection.end();
      
      // Now connect to the database
      db = await mysql.createConnection(dbConfig);
      console.log('Connected to MySQL database.');
    }
    
    return db;
  } catch (err) {
    console.error('Error connecting to database:', err.message);
    throw err;
  }
};

class Database {
  constructor() {
    this.db = null;
  }

  // Initialize database connection and tables
  async initialize() {
    this.db = await initializeDatabase();
    await this.initializeTables();
  }

  // Execute query for both MySQL and PostgreSQL
  async executeQuery(sql, params = []) {
    if (isPostgreSQL) {
      const result = await this.db.query(sql, params);
      return result;
    } else {
      const [result] = await this.db.execute(sql, params);
      return result;
    }
  }

  // Get database connection
  getDb() {
    return this.db;
  }

  // Initialize database tables
  async initializeTables() {
    try {
      // Users table for authentication
      const usersTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          role VARCHAR(20) CHECK (role IN ('admin', 'manager', 'cashier', 'employee')) NOT NULL DEFAULT 'cashier',
          status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'suspended')) NOT NULL DEFAULT 'active',
          permissions JSONB DEFAULT '{}',
          last_login TIMESTAMP,
          reset_token VARCHAR(255),
          reset_token_expires TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          role ENUM('admin', 'manager', 'cashier', 'employee') NOT NULL DEFAULT 'cashier',
          status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
          permissions JSON,
          last_login TIMESTAMP NULL,
          reset_token VARCHAR(255),
          reset_token_expires TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(usersTableSQL);



      // User sessions table for JWT blacklisting
      const userCountSQL = 'SELECT COUNT(*) as count FROM users';
      const userCountResult = await this.executeQuery(userCountSQL);
      const userCount = isPostgreSQL ? userCountResult.rows[0].count : userCountResult[0].count;
      
      if (userCount === 0) {
        try {
          const bcrypt = require('bcryptjs');
          const defaultPassword = await bcrypt.hash('admin123', 12);
          const managerPassword = await bcrypt.hash('manager123', 12);
          const cashierPassword = await bcrypt.hash('cashier123', 12);
          
          // Create admin user
          const createAdminSQL = `
            INSERT INTO users (username, email, password_hash, full_name, role, status, permissions) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          const adminPermissions = JSON.stringify({
            'reports.view': true,
            'payments.view': true,
            'users.view': true,
            'users.create': true,
            'users.update': true,
            'users.delete': true,
            'users.manage_roles': true,
            'users.lock': true,
            'users.unlock': true
          });
          
          await this.executeQuery(createAdminSQL, [
            'admin', 'admin@pos.local', defaultPassword, 'System Administrator', 'admin', 'active', adminPermissions
          ]);
          
          // Create manager user
          const managerPermissions = JSON.stringify({
            'reports.view': true,
            'payments.view': true,
            'users.view': true
          });
          
          await this.executeQuery(createAdminSQL, [
            'manager', 'manager@pos.local', managerPassword, 'Store Manager', 'manager', 'active', managerPermissions
          ]);
          
          // Create cashier user
          const cashierPermissions = JSON.stringify({
            'payments.view': true,
            'sales.view': true,
            'sales.create': true,
            'customers.view': true,
            'customers.create': true,
            'customers.update': true
          });
          
          await this.executeQuery(createAdminSQL, [
            'cashier', 'cashier@pos.local', cashierPassword, 'Cashier', 'cashier', 'active', cashierPermissions
          ]);
          
          // Create additional cashier users
          const cashier2Password = await bcrypt.hash('cashier2123', 12);
          const cashier3Password = await bcrypt.hash('cashier3123', 12);
          
          await this.executeQuery(createAdminSQL, [
            'cashier2', 'cashier2@pos.local', cashier2Password, 'Sarah Johnson', 'cashier', 'active', cashierPermissions
          ]);
          
          await this.executeQuery(createAdminSQL, [
            'cashier3', 'cashier3@pos.local', cashier3Password, 'Mike Davis', 'cashier', 'active', cashierPermissions
          ]);
          
          console.log('Default users created:');
          console.log('- Admin: admin/admin123');
          console.log('- Manager: manager/manager123');
          console.log('- Cashier: cashier/cashier123');
          console.log('- Cashier 2: cashier2/cashier2123');
          console.log('- Cashier 3: cashier3/cashier3123');
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            throw err;
          }
          console.log('Default users already exist');
        }
      }

      // User sessions table for JWT blacklisting
      const sessionsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      ` : `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;
      
      await this.executeQuery(sessionsTableSQL);

      // Enhanced Users table for proper user management
      // Add additional user management columns if they don't exist
      if (!isPostgreSQL) {
        const addUserManagementColumns = [
          'ALTER TABLE users ADD COLUMN phone VARCHAR(50)',
          'ALTER TABLE users ADD COLUMN address TEXT',
          'ALTER TABLE users ADD COLUMN department VARCHAR(255)',
          'ALTER TABLE users ADD COLUMN position VARCHAR(255)',
          'ALTER TABLE users ADD COLUMN is_locked BOOLEAN DEFAULT FALSE',
          'ALTER TABLE users ADD COLUMN locked_at TIMESTAMP NULL',
          'ALTER TABLE users ADD COLUMN locked_by INT',
          'ALTER TABLE users ADD COLUMN lock_reason TEXT',
          'ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0',
          'ALTER TABLE users ADD COLUMN profile_image TEXT',
          'ALTER TABLE users ADD COLUMN notes TEXT'
        ];
        
        for (const sql of addUserManagementColumns) {
          try {
            await this.executeQuery(sql);
          } catch (err) {
            // Column already exists, ignore error
            if (!err.message.includes('Duplicate column') && !err.message.includes('already exists')) {
              console.log('User management column addition info:', err.message);
            }
          }
        }
      }

      // Customers table
      const customersTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS customers (
          id SERIAL PRIMARY KEY,
          customer_code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          date_of_birth DATE,
          gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
          loyalty_points INT DEFAULT 0,
          total_spent DECIMAL(12,2) DEFAULT 0.00,
          discount_percentage DECIMAL(5,2) DEFAULT 0.00,
          notes TEXT,
          status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          date_of_birth DATE,
          gender ENUM('male', 'female', 'other'),
          loyalty_points INT DEFAULT 0,
          total_spent DECIMAL(12,2) DEFAULT 0.00,
          discount_percentage DECIMAL(5,2) DEFAULT 0.00,
          notes TEXT,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(customersTableSQL);
      // Partners table
      const partnersTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS partners (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(20) CHECK (type IN ('investor', 'supplier')) NOT NULL,
          phone_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS partners (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type ENUM('investor', 'supplier') NOT NULL,
          phone_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(partnersTableSQL);

      // Investments table
      const investmentsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS investments (
          id SERIAL PRIMARY KEY,
          partner_id INT NOT NULL,
          partner_name VARCHAR(255) NOT NULL,
          type VARCHAR(20) CHECK (type IN ('invest', 'withdraw')) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (partner_id) REFERENCES partners (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS investments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          partner_id INT NOT NULL,
          partner_name VARCHAR(255) NOT NULL,
          type ENUM('invest', 'withdraw') NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (partner_id) REFERENCES partners (id)
        )
      `;
      
      await this.executeQuery(investmentsTableSQL);

      // Add notes column to existing investments table if it doesn't exist
      if (!isPostgreSQL) {
        try {
          await this.executeQuery(`ALTER TABLE investments ADD COLUMN notes TEXT`);
        } catch (err) {
          // Column already exists, ignore error
          if (!err.message.includes('Duplicate column name')) {
            console.log('Note: investments table notes column may already exist');
          }
        }
      }

      // Locations table for multi-location support
      const locationsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS locations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          address TEXT,
          phone VARCHAR(50),
          manager_id INT,
          settings JSONB DEFAULT '{}',
          status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (manager_id) REFERENCES users (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS locations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          address TEXT,
          phone VARCHAR(50),
          manager_id INT,
          settings JSON,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (manager_id) REFERENCES users (id)
        )
      `;
      
      await this.executeQuery(locationsTableSQL);

      // Inventory table
      const inventoryTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS inventory (
          id SERIAL PRIMARY KEY,
          item_name VARCHAR(255) NOT NULL,
          sku VARCHAR(100) UNIQUE NOT NULL,
          barcode VARCHAR(255),
          qr_code VARCHAR(255),
          category VARCHAR(255),
          brand VARCHAR(255),
          supplier VARCHAR(255),
          unit VARCHAR(50) DEFAULT 'pcs',
          buy_price DECIMAL(10,2) NOT NULL,
          sell_price DECIMAL(10,2) NOT NULL,
          quantity INT NOT NULL DEFAULT 0,
          min_stock INT DEFAULT 0,
          max_stock INT DEFAULT 1000,
          reorder_point INT DEFAULT 5,
          reorder_quantity INT DEFAULT 20,
          cost_price DECIMAL(10,2),
          wholesale_price DECIMAL(10,2),
          tax_rate DECIMAL(5,2) DEFAULT 0.00,
          tax_exempt BOOLEAN DEFAULT FALSE,
          expiry_date DATE,
          manufacture_date DATE,
          batch_number VARCHAR(100),
          location VARCHAR(255),
          weight DECIMAL(8,3),
          dimensions VARCHAR(100),
          description TEXT,
          image_url VARCHAR(500),
          status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'discontinued')) DEFAULT 'active',
          track_serial BOOLEAN DEFAULT FALSE,
          allow_negative_stock BOOLEAN DEFAULT FALSE,
          warranty_days INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_name VARCHAR(255) NOT NULL,
          sku VARCHAR(100) UNIQUE NOT NULL,
          barcode VARCHAR(255),
          qr_code VARCHAR(255),
          category VARCHAR(255),
          brand VARCHAR(255),
          supplier VARCHAR(255),
          unit VARCHAR(50) DEFAULT 'pcs',
          buy_price DECIMAL(10,2) NOT NULL,
          sell_price DECIMAL(10,2) NOT NULL,
          quantity INT NOT NULL DEFAULT 0,
          min_stock INT DEFAULT 0,
          max_stock INT DEFAULT 1000,
          reorder_point INT DEFAULT 5,
          reorder_quantity INT DEFAULT 20,
          cost_price DECIMAL(10,2),
          wholesale_price DECIMAL(10,2),
          tax_rate DECIMAL(5,2) DEFAULT 0.00,
          tax_exempt BOOLEAN DEFAULT FALSE,
          expiry_date DATE,
          manufacture_date DATE,
          batch_number VARCHAR(100),
          location VARCHAR(255),
          weight DECIMAL(8,3),
          dimensions VARCHAR(100),
          description TEXT,
          image_url VARCHAR(500),
          status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
          track_serial BOOLEAN DEFAULT FALSE,
          allow_negative_stock BOOLEAN DEFAULT FALSE,
          warranty_days INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(inventoryTableSQL);
      
      // Location inventory table (moved after inventory table creation)
      const locationInventoryTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS location_inventory (
          id SERIAL PRIMARY KEY,
          location_id INT NOT NULL,
          item_id INT NOT NULL,
          quantity INT NOT NULL DEFAULT 0,
          min_stock INT DEFAULT 0,
          max_stock INT DEFAULT 1000,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES inventory (id) ON DELETE CASCADE,
          UNIQUE(location_id, item_id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS location_inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          location_id INT NOT NULL,
          item_id INT NOT NULL,
          quantity INT NOT NULL DEFAULT 0,
          min_stock INT DEFAULT 0,
          max_stock INT DEFAULT 1000,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES inventory (id) ON DELETE CASCADE,
          UNIQUE KEY unique_location_item (location_id, item_id)
        )
      `;
      
      await this.executeQuery(locationInventoryTableSQL);

      // Inventory transfers table (moved after inventory table creation)
      const transfersTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS inventory_transfers (
          id SERIAL PRIMARY KEY,
          from_location INT NOT NULL,
          to_location INT NOT NULL,
          item_id INT NOT NULL,
          quantity INT NOT NULL,
          transferred_by INT NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (from_location) REFERENCES locations (id),
          FOREIGN KEY (to_location) REFERENCES locations (id),
          FOREIGN KEY (item_id) REFERENCES inventory (id),
          FOREIGN KEY (transferred_by) REFERENCES users (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS inventory_transfers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          from_location INT NOT NULL,
          to_location INT NOT NULL,
          item_id INT NOT NULL,
          quantity INT NOT NULL,
          transferred_by INT NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (from_location) REFERENCES locations (id),
          FOREIGN KEY (to_location) REFERENCES locations (id),
          FOREIGN KEY (item_id) REFERENCES inventory (id),
          FOREIGN KEY (transferred_by) REFERENCES users (id)
        )
      `;
      
      await this.executeQuery(transfersTableSQL);
      
      // Add missing columns to existing inventory table if they don't exist (MySQL only)
      if (!isPostgreSQL) {
        try {
          await this.executeQuery('ALTER TABLE inventory ADD COLUMN category VARCHAR(255)');
        } catch (err) {
          // Column already exists, ignore error
        }
        
        try {
          await this.executeQuery('ALTER TABLE inventory ADD COLUMN supplier VARCHAR(255)');
        } catch (err) {
          // Column already exists, ignore error
        }
        
        try {
          await this.executeQuery('ALTER TABLE inventory ADD COLUMN min_stock INT DEFAULT 0');
        } catch (err) {
          // Column already exists, ignore error
        }
        
        try {
          await this.executeQuery('ALTER TABLE inventory ADD COLUMN description TEXT');
        } catch (err) {
          // Column already exists, ignore error
        }
        
        try {
          await this.executeQuery('ALTER TABLE inventory ADD COLUMN barcode VARCHAR(255)');
        } catch (err) {
          // Column already exists, ignore error
        }
      }

      // Sales table (invoice header)
      const salesTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS sales (
          id SERIAL PRIMARY KEY,
          invoice VARCHAR(100) UNIQUE NOT NULL,
          date DATE NOT NULL,
          customer_id INT,
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          customer_email VARCHAR(255),
          cashier_id INT,
          cashier_name VARCHAR(255),
          payment_method VARCHAR(50) DEFAULT 'cash',
          payment_reference VARCHAR(255),
          payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          discount_type VARCHAR(20) CHECK (discount_type IN ('fixed', 'percentage')) DEFAULT 'fixed',
          total_amount DECIMAL(10,2) NOT NULL,
          paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          change_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          loyalty_points_earned INT DEFAULT 0,
          loyalty_points_redeemed INT DEFAULT 0,
          status VARCHAR(20) CHECK (status IN ('paid', 'unpaid', 'partial', 'cancelled', 'refunded')) NOT NULL,
          notes TEXT,
          receipt_printed BOOLEAN DEFAULT FALSE,
          voided BOOLEAN DEFAULT FALSE,
          voided_by INT,
          voided_at TIMESTAMP,
          void_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers (id),
          FOREIGN KEY (cashier_id) REFERENCES users (id),
          FOREIGN KEY (voided_by) REFERENCES users (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS sales (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice VARCHAR(100) UNIQUE NOT NULL,
          date DATE NOT NULL,
          customer_id INT,
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          customer_email VARCHAR(255),
          cashier_id INT,
          cashier_name VARCHAR(255),
          payment_method VARCHAR(50) DEFAULT 'cash',
          payment_reference VARCHAR(255),
          payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'pending',
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          discount_type ENUM('fixed', 'percentage') DEFAULT 'fixed',
          total_amount DECIMAL(10,2) NOT NULL,
          paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          change_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          loyalty_points_earned INT DEFAULT 0,
          loyalty_points_redeemed INT DEFAULT 0,
          status ENUM('paid', 'unpaid', 'partial', 'cancelled', 'refunded') NOT NULL,
          notes TEXT,
          receipt_printed BOOLEAN DEFAULT FALSE,
          voided BOOLEAN DEFAULT FALSE,
          voided_by INT,
          voided_at TIMESTAMP NULL,
          void_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers (id),
          FOREIGN KEY (cashier_id) REFERENCES users (id),
          FOREIGN KEY (voided_by) REFERENCES users (id)
        )
      `;
      
      await this.executeQuery(salesTableSQL);

      // Sales items table (invoice line items)
      const salesItemsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS sales_items (
          id SERIAL PRIMARY KEY,
          sale_id INT NOT NULL,
          item_id INT NOT NULL,
          item_name VARCHAR(255) NOT NULL,
          sku VARCHAR(100) NOT NULL,
          quantity INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          line_total DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES inventory (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS sales_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sale_id INT NOT NULL,
          item_id INT NOT NULL,
          item_name VARCHAR(255) NOT NULL,
          sku VARCHAR(100) NOT NULL,
          quantity INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          line_total DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES inventory (id)
        )
      `;
      
      await this.executeQuery(salesItemsTableSQL);

      // Payments table
      const paymentsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          sale_id INT NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          transaction_id VARCHAR(255),
          payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
          stripe_payment_intent VARCHAR(255),
          notes TEXT,
          processed_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (processed_by) REFERENCES users (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sale_id INT NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          transaction_id VARCHAR(255),
          payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'pending',
          stripe_payment_intent VARCHAR(255),
          notes TEXT,
          processed_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (processed_by) REFERENCES users (id)
        )
      `;
      
      await this.executeQuery(paymentsTableSQL);

      // Add processed_by column to existing payments table if it doesn't exist
      if (!isPostgreSQL) {
        try {
          await this.executeQuery(`ALTER TABLE payments ADD COLUMN processed_by INT`);
          await this.executeQuery(`ALTER TABLE payments ADD FOREIGN KEY (processed_by) REFERENCES users (id)`);
        } catch (err) {
          // Column already exists, ignore error
          if (!err.message.includes('Duplicate column name')) {
            console.log('Note: payments table processed_by column may already exist');
          }
        }
      }

      // Refunds table
      const refundsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS refunds (
          id SERIAL PRIMARY KEY,
          payment_id INT NOT NULL,
          sale_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          reason TEXT,
          refund_status VARCHAR(20) CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
          stripe_refund_id VARCHAR(255),
          processed_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (processed_by) REFERENCES users (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS refunds (
          id INT AUTO_INCREMENT PRIMARY KEY,
          payment_id INT NOT NULL,
          sale_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          reason TEXT,
          refund_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
          stripe_refund_id VARCHAR(255),
          processed_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (processed_by) REFERENCES users (id)
        )
      `;
      
      await this.executeQuery(refundsTableSQL);

      // Tax rates table
      const taxRatesTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS tax_rates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          rate DECIMAL(5,2) NOT NULL,
          type VARCHAR(20) CHECK (type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
          status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS tax_rates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          rate DECIMAL(5,2) NOT NULL,
          type ENUM('inclusive', 'exclusive') DEFAULT 'exclusive',
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(taxRatesTableSQL);

      // Payment methods table
      const paymentMethodsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS payment_methods (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          config JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS payment_methods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          config JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(paymentMethodsTableSQL);

      // Insert default payment methods
      const paymentMethodsCount = await this.executeQuery('SELECT COUNT(*) as count FROM payment_methods');
      const pmCount = isPostgreSQL ? paymentMethodsCount.rows[0].count : paymentMethodsCount[0].count;
      
      if (pmCount === 0) {
        try {
          const defaultPaymentMethods = [
            ['Cash', 'cash', true, '{}'],
            ['Credit Card', 'card', true, '{}'],
            ['Debit Card', 'card', true, '{}'],
            ['Mobile Payment', 'digital', true, '{}'],
            ['Bank Transfer', 'transfer', true, '{}']
          ];
          
          for (const method of defaultPaymentMethods) {
            await this.executeQuery(
              'INSERT INTO payment_methods (name, type, enabled, config) VALUES (?, ?, ?, ?)',
              method
            );
          }
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            console.error('Error inserting default payment methods:', err);
          }
        }
      }

      // Categories table
      const categoriesTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          parent_id INT,
          status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES categories (id)
        )
      ` : `
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          parent_id INT,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES categories (id)
        )
      `;
      
      await this.executeQuery(categoriesTableSQL);

      // Suppliers table  
      const suppliersTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS suppliers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          tax_number VARCHAR(100),
          payment_terms TEXT,
          status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS suppliers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          tax_number VARCHAR(100),
          payment_terms TEXT,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(suppliersTableSQL);

      // System settings table with dedicated columns
      const settingsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          shopName VARCHAR(255) DEFAULT 'My POS Shop',
          shopPhone VARCHAR(50) DEFAULT '',
          shopEmail VARCHAR(255) DEFAULT '',
          shopAddress TEXT,
          shopCity VARCHAR(100) DEFAULT '',
          shopState VARCHAR(100) DEFAULT '',
          shopZipCode VARCHAR(20) DEFAULT '',
          shopLogoUrl VARCHAR(500) DEFAULT '',
          taxRate DECIMAL(5,2) DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'USD',
          countryCode VARCHAR(10) DEFAULT '+94',

          receiptFooter TEXT,
          businessRegistration VARCHAR(255) DEFAULT '',
          taxId VARCHAR(255) DEFAULT '',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shopName VARCHAR(255) DEFAULT 'My POS Shop',
          shopPhone VARCHAR(50) DEFAULT '',
          shopEmail VARCHAR(255) DEFAULT '',
          shopAddress TEXT,
          shopCity VARCHAR(100) DEFAULT '',
          shopState VARCHAR(100) DEFAULT '',
          shopZipCode VARCHAR(20) DEFAULT '',
          shopLogoUrl VARCHAR(500) DEFAULT '',
          taxRate DECIMAL(5,2) DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'USD',
          countryCode VARCHAR(10) DEFAULT '+94',

          receiptFooter TEXT,
          businessRegistration VARCHAR(255) DEFAULT '',
          taxId VARCHAR(255) DEFAULT '',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(settingsTableSQL);

      // Insert default settings if none exist
      const settingsCount = await this.executeQuery('SELECT COUNT(*) as count FROM settings');
      const sCount = isPostgreSQL ? settingsCount.rows[0].count : settingsCount[0].count;
      
      if (sCount === 0) {
        try {
          const insertSettingsSQL = `INSERT INTO settings (
            shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
            taxRate, currency, countryCode, receiptFooter,
            businessRegistration, taxId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          
          await this.executeQuery(insertSettingsSQL, [
            'My POS Shop', '', '', '', '', '', '', '',
            0, 'USD', '+94', 'Thank you for your business!', '', ''
          ]);
          
          console.log('Default settings created successfully');
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            console.error('Error inserting default settings:', err);
          }
        }
      }

      // Add sample inventory data
      const inventoryCount = await this.executeQuery('SELECT COUNT(*) as count FROM inventory');
      const invCount = isPostgreSQL ? inventoryCount.rows[0].count : inventoryCount[0].count;
      
      if (invCount === 0) {
        try {
          const sampleInventory = [
            ['Sample Product 1', 'SKU001', '1234567890123', '', 'Electronics', 'Samsung', 'Tech Supplier', 'pcs', 100.00, 150.00, 50, 5, 100],
            ['Sample Product 2', 'SKU002', '2345678901234', '', 'Clothing', 'Nike', 'Fashion Supplier', 'pcs', 50.00, 80.00, 30, 3, 50],
            ['Sample Product 3', 'SKU003', '3456789012345', '', 'Food', 'Nestle', 'Food Supplier', 'pcs', 20.00, 35.00, 100, 10, 200]
          ];
          
          const insertInventorySQL = `INSERT INTO inventory (
            item_name, sku, barcode, qr_code, category, brand, supplier, unit, buy_price, sell_price, quantity, min_stock, max_stock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          
          for (const item of sampleInventory) {
            await this.executeQuery(insertInventorySQL, item);
          }
          
          console.log('Sample inventory data created successfully');
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            console.error('Error inserting sample inventory:', err);
          }
        }
      }

      // Add sample customer data
      const customerCount = await this.executeQuery('SELECT COUNT(*) as count FROM customers');
      const custCount = isPostgreSQL ? customerCount.rows[0].count : customerCount[0].count;
      
      if (custCount === 0) {
        try {
          const sampleCustomers = [
            ['CUST001', 'W.A.R.K Weerasooriya', 'wark@example.com', '0768472903', '123 Main St, Colombo', null, 'male', 0, 0.00, 0.00, '', 'active'],
            ['CUST002', 'John Doe', 'john@example.com', '0771234567', '456 Oak Ave, Kandy', null, 'male', 50, 250.00, 5.00, '', 'active'],
            ['CUST003', 'Jane Smith', 'jane@example.com', '0779876543', '789 Pine Rd, Galle', null, 'female', 25, 125.00, 0.00, '', 'active']
          ];
          
          const insertCustomerSQL = `INSERT INTO customers (
            customer_code, name, email, phone, address, date_of_birth, gender, loyalty_points, total_spent, discount_percentage, notes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          
          for (const customer of sampleCustomers) {
            await this.executeQuery(insertCustomerSQL, customer);
          }
          
          console.log('Sample customer data created successfully');
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            console.error('Error inserting sample customers:', err);
          }
        }
      }

      console.log('Database tables initialized.');
    } catch (err) {
      console.error('Error creating tables:', err);
      throw err;
    }
  }

  getDb() {
    return this.db;
  }

  async close() {
    if (this.db) {
      try {
        await this.db.end();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error closing database:', err.message);
      }
    }
  }
}

module.exports = Database;