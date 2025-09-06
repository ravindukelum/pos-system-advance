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

      // Create default admin user if no users exist
      const userCountSQL = 'SELECT COUNT(*) as count FROM users';
      const userCountResult = await this.executeQuery(userCountSQL);
      const userCount = isPostgreSQL ? userCountResult.rows[0].count : userCountResult[0].count;
      
      if (userCount === 0) {
        try {
          const bcrypt = require('bcryptjs');
          const defaultPassword = await bcrypt.hash('admin123', 12);
          const createAdminSQL = `
            INSERT INTO users (username, email, password_hash, full_name, role, status) 
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          await this.executeQuery(createAdminSQL, [
            'admin', 'admin@pos.local', defaultPassword, 'System Administrator', 'admin', 'active'
          ]);
          console.log('Default admin user created: admin/admin123');
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            throw err;
          }
          console.log('Admin user already exists');
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

      // Location inventory table
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

      // Inventory transfers table
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(inventoryTableSQL);
      
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

      // System settings table
      const settingsTableSQL = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          value TEXT,
          type VARCHAR(50) DEFAULT 'string',
          description TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          \`key\` VARCHAR(255) UNIQUE NOT NULL,
          value TEXT,
          type VARCHAR(50) DEFAULT 'string',
          description TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await this.executeQuery(settingsTableSQL);

      // Insert default settings
      const settingsCount = await this.executeQuery('SELECT COUNT(*) as count FROM settings');
      const sCount = isPostgreSQL ? settingsCount.rows[0].count : settingsCount[0].count;
      
      if (sCount === 0) {
        try {
          const defaultSettings = [
            ['company_name', 'POS System', 'string', 'Company name for receipts'],
            ['company_address', '', 'string', 'Company address for receipts'],
            ['company_phone', '', 'string', 'Company phone for receipts'],
            ['company_email', '', 'string', 'Company email for receipts'],
            ['default_tax_rate', '0', 'number', 'Default tax rate percentage'],
            ['currency_symbol', 'RS', 'string', 'Currency symbol'],
            ['receipt_footer', 'Thank you for your business!', 'string', 'Receipt footer message'],
            ['loyalty_points_rate', '1', 'number', 'Points per dollar spent'],
            ['low_stock_threshold', '5', 'number', 'Low stock warning threshold']
          ];
          
          const keyColumn = isPostgreSQL ? 'key' : '\`key\`';
          for (const setting of defaultSettings) {
            await this.executeQuery(
              `INSERT INTO settings (${keyColumn}, value, type, description) VALUES (?, ?, ?, ?)`,
              setting
            );
          }
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            console.error('Error inserting default settings:', err);
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