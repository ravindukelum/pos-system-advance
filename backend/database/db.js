const mysql = require('mysql2/promise');
require('dotenv').config();

// Determine database type
const isPostgreSQL = process.env.DATABASE_URL ? true : false;
let dbConfig;

if (isPostgreSQL) {
  // PostgreSQL configuration for production
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
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'pos_system_local'
  };
}

let db;
let isInitialized = false;
let initializationPromise = null;

// Initialize database connection
const initializeDatabase = async () => {
  if (isInitialized) {
    return db;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      if (isPostgreSQL) {
        const { Pool } = require('pg');
        db = new Pool(dbConfig);
        
        // Test connection
        const client = await db.connect();
        console.log('Connected to PostgreSQL database');
        client.release();
      } else {
        // Create MySQL connection
        db = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL database');
      }
      isInitialized = true;
      return db;
    } catch (error) {
      console.error('Database connection failed:', error);
      initializationPromise = null;
      throw error;
    }
  })();
  
  return initializationPromise;
};

let tablesInitialized = false;
let tableInitializationPromise = null;

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    await initializeDatabase();
    this.db = db;
    
    if (tablesInitialized) {
      return;
    }
    
    if (tableInitializationPromise) {
      await tableInitializationPromise;
      return;
    }
    
    tableInitializationPromise = this.initializeTables();
    await tableInitializationPromise;
    tablesInitialized = true;
  }

  async executeQuery(sql, params = []) {
    try {
      if (isPostgreSQL) {
        const result = await this.db.query(sql, params);
        return result;
      } else {
        const [rows] = await this.db.execute(sql, params);
        return rows;
      }
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  getDb() {
    return this.db;
  }

  async initializeTables() {
    try {
      console.log('Initializing database tables...');

      // Create users table
      const createUsersTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          role VARCHAR(20) DEFAULT 'cashier',
          status VARCHAR(20) DEFAULT 'active',
          phone VARCHAR(20),
          address TEXT,
          department VARCHAR(50),
          position VARCHAR(50),
          is_locked BOOLEAN DEFAULT FALSE,
          locked_at TIMESTAMP,
          failed_login_attempts INTEGER DEFAULT 0,
          last_login TIMESTAMP,
          permissions TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          role VARCHAR(20) DEFAULT 'cashier',
          status VARCHAR(20) DEFAULT 'active',
          phone VARCHAR(20),
          address TEXT,
          department VARCHAR(50),
          position VARCHAR(50),
          is_locked BOOLEAN DEFAULT FALSE,
          locked_at TIMESTAMP NULL,
          failed_login_attempts INT DEFAULT 0,
          last_login TIMESTAMP NULL,
          permissions TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;

      await this.executeQuery(createUsersTable);

      // Create customers table
      const createCustomersTable = isPostgreSQL ? `
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

      await this.executeQuery(createCustomersTable);

      // Create partners table
      const createPartnersTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS partners (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL,
          phone_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS partners (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL,
          phone_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await this.executeQuery(createPartnersTable);

      // Create investments table
      const createInvestmentsTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS investments (
          id SERIAL PRIMARY KEY,
          partner_id INTEGER REFERENCES partners(id),
          partner_name VARCHAR(255),
          amount DECIMAL(10,2) NOT NULL,
          type VARCHAR(20) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS investments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          partner_id INT,
          partner_name VARCHAR(255),
          amount DECIMAL(10,2) NOT NULL,
          type VARCHAR(20) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (partner_id) REFERENCES partners(id)
        )
      `;

      await this.executeQuery(createInvestmentsTable);

      // Create inventory table
      const createInventoryTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS inventory (
          id SERIAL PRIMARY KEY,
          item_name VARCHAR(100) NOT NULL,
          sku VARCHAR(50) UNIQUE,
          category VARCHAR(50),
          supplier VARCHAR(255),
          quantity INTEGER DEFAULT 0,
          min_stock INTEGER DEFAULT 0,
          unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          sell_price DECIMAL(10,2),
          buy_price DECIMAL(10,2),
          description TEXT,
          barcode VARCHAR(255),
          warranty_days INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_name VARCHAR(100) NOT NULL,
          sku VARCHAR(50) UNIQUE,
          category VARCHAR(50),
          supplier VARCHAR(255),
          quantity INT DEFAULT 0,
          min_stock INT DEFAULT 0,
          unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          sell_price DECIMAL(10,2),
          buy_price DECIMAL(10,2),
          description TEXT,
          barcode VARCHAR(255),
          warranty_days INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await this.executeQuery(createInventoryTable);

      // Create sales table
      const createSalesTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS sales (
          id SERIAL PRIMARY KEY,
          invoice VARCHAR(100) UNIQUE,
          date DATE NOT NULL,
          customer_id INTEGER,
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          total_amount DECIMAL(10,2) NOT NULL,
          paid_amount DECIMAL(10,2) DEFAULT 0,
          tax_amount DECIMAL(10,2) DEFAULT 0,
          discount_amount DECIMAL(10,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'unpaid',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS sales (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice VARCHAR(100) UNIQUE,
          date DATE NOT NULL,
          customer_id INT,
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          total_amount DECIMAL(10,2) NOT NULL,
          paid_amount DECIMAL(10,2) DEFAULT 0,
          tax_amount DECIMAL(10,2) DEFAULT 0,
          discount_amount DECIMAL(10,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'unpaid',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await this.executeQuery(createSalesTable);

      // Create sales_items table
      const createSalesItemsTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS sales_items (
          id SERIAL PRIMARY KEY,
          sale_id INTEGER REFERENCES sales(id),
          item_id INTEGER REFERENCES inventory(id),
          item_name VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          line_total DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS sales_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sale_id INT,
          item_id INT,
          item_name VARCHAR(100) NOT NULL,
          quantity INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          line_total DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales(id),
          FOREIGN KEY (item_id) REFERENCES inventory(id)
        )
      `;

      await this.executeQuery(createSalesItemsTable);

      // Create payments table
      const createPaymentsTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          sale_id INTEGER REFERENCES sales(id),
          payment_method VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          transaction_reference VARCHAR(100),
          processed_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sale_id INT,
          payment_method VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          transaction_reference VARCHAR(100),
          processed_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales(id)
        )
      `;

      await this.executeQuery(createPaymentsTable);

      // Create payment_methods table
      const createPaymentMethodsTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS payment_methods (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE
        )
      ` : `
        CREATE TABLE IF NOT EXISTS payment_methods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE
        )
      `;

      await this.executeQuery(createPaymentMethodsTable);

      // Create settings table
      const createSettingsTable = isPostgreSQL ? `
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          shop_name VARCHAR(100) DEFAULT 'My POS Shop',
          shop_phone VARCHAR(20),
          shop_email VARCHAR(100),
          shop_address TEXT,
          shop_city VARCHAR(50),
          shop_state VARCHAR(50),
          shop_zip_code VARCHAR(20),
          tax_rate DECIMAL(5,2) DEFAULT 0.00,
          currency VARCHAR(10) DEFAULT 'USD',
          country_code VARCHAR(10) DEFAULT '+1',
          warranty_period INTEGER DEFAULT 30,
          warranty_terms TEXT,
          receipt_footer TEXT,
          business_registration VARCHAR(100),
          tax_id VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ` : `
        CREATE TABLE IF NOT EXISTS settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shop_name VARCHAR(100) DEFAULT 'My POS Shop',
          shop_phone VARCHAR(20),
          shop_email VARCHAR(100),
          shop_address TEXT,
          shop_city VARCHAR(50),
          shop_state VARCHAR(50),
          shop_zip_code VARCHAR(20),
          tax_rate DECIMAL(5,2) DEFAULT 0.00,
          currency VARCHAR(10) DEFAULT 'USD',
          country_code VARCHAR(10) DEFAULT '+1',
          warranty_period INT DEFAULT 30,
          warranty_terms TEXT,
          receipt_footer TEXT,
          business_registration VARCHAR(100),
          tax_id VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;

      await this.executeQuery(createSettingsTable);

      // Create user_sessions table for JWT token management
      const createUserSessionsTable = isPostgreSQL ? `
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

      await this.executeQuery(createUserSessionsTable);

      // Run migrations to update existing tables
      await this.runMigrations();

      // Insert default data
      await this.insertDefaultData();

      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Error initializing tables:', error);
      throw error;
    }
  }

  async runMigrations() {
    try {
      console.log('Running database migrations...');
      
      // Migration: Add missing columns to customers table
      const customerMigrations = [
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth DATE',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(10)',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points INT DEFAULT 0',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(12,2) DEFAULT 0.00',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'active\''
      ];

      // Migration: Add missing columns to sales table
      const salesMigrations = [
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0.00'
      ];

      // Migration: Add missing columns to sales_items table
      const salesItemsMigrations = [
        'ALTER TABLE sales_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100)'
      ];

      // Migration: Add missing columns to inventory table
      const inventoryMigrations = [
        'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      ];

      // For MySQL, we need to check column existence before adding
      if (!isPostgreSQL) {
        // Helper function to check if column exists
        const columnExists = async (tableName, columnName) => {
          try {
            const result = await this.executeQuery(
              `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
              [tableName, columnName]
            );
            return result[0].count > 0;
          } catch (error) {
            return false;
          }
        };

        // MySQL migrations with existence checks
        const mysqlMigrations = [
          { table: 'customers', column: 'address', sql: 'ALTER TABLE customers ADD COLUMN address TEXT' },
          { table: 'customers', column: 'date_of_birth', sql: 'ALTER TABLE customers ADD COLUMN date_of_birth DATE' },
          { table: 'customers', column: 'gender', sql: 'ALTER TABLE customers ADD COLUMN gender ENUM(\'male\', \'female\', \'other\')' },
          { table: 'customers', column: 'loyalty_points', sql: 'ALTER TABLE customers ADD COLUMN loyalty_points INT DEFAULT 0' },
          { table: 'customers', column: 'total_spent', sql: 'ALTER TABLE customers ADD COLUMN total_spent DECIMAL(12,2) DEFAULT 0.00' },
          { table: 'customers', column: 'discount_percentage', sql: 'ALTER TABLE customers ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0.00' },
          { table: 'customers', column: 'notes', sql: 'ALTER TABLE customers ADD COLUMN notes TEXT' },
          { table: 'customers', column: 'status', sql: 'ALTER TABLE customers ADD COLUMN status ENUM(\'active\', \'inactive\') DEFAULT \'active\'' },
          { table: 'sales', column: 'subtotal', sql: 'ALTER TABLE sales ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0.00' },
          { table: 'sales_items', column: 'sku', sql: 'ALTER TABLE sales_items ADD COLUMN sku VARCHAR(100)' },
          { table: 'inventory', column: 'updated_at', sql: 'ALTER TABLE inventory ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
        ];

        for (const migration of mysqlMigrations) {
          try {
            const exists = await columnExists(migration.table, migration.column);
            if (!exists) {
              await this.executeQuery(migration.sql);
              console.log(`Added column ${migration.column} to ${migration.table}`);
            }
          } catch (err) {
            console.log(`Migration skipped for ${migration.table}.${migration.column}:`, err.message);
          }
        }
      } else {
        for (const migration of customerMigrations) {
          try {
            await this.executeQuery(migration);
          } catch (err) {
            // Ignore duplicate column errors
            if (!err.message.includes('already exists')) {
              console.log('Migration info:', err.message);
            }
          }
        }
        
        for (const migration of salesMigrations) {
          try {
            await this.executeQuery(migration);
          } catch (err) {
            // Ignore duplicate column errors
            if (!err.message.includes('already exists')) {
              console.log('Migration info:', err.message);
            }
          }
        }
        
        for (const migration of salesItemsMigrations) {
          try {
            await this.executeQuery(migration);
          } catch (err) {
            // Ignore duplicate column errors
            if (!err.message.includes('already exists')) {
              console.log('Migration info:', err.message);
            }
          }
        }
        
        for (const migration of inventoryMigrations) {
          try {
            await this.executeQuery(migration);
          } catch (err) {
            // Ignore duplicate column errors
            if (!err.message.includes('already exists')) {
              console.log('Migration info:', err.message);
            }
          }
        }
      }

      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Error running migrations:', error);
      // Don't throw error to prevent initialization failure
    }
  }

  async insertDefaultData() {
    try {
      // Insert default users
      const checkUsersSQL = 'SELECT COUNT(*) as count FROM users';
      const userCountResult = await this.executeQuery(checkUsersSQL);
      const userCount = isPostgreSQL ? userCountResult.rows[0].count : userCountResult[0].count;

      if (userCount == 0) {
        const bcrypt = require('bcryptjs');
        const adminPassword = await bcrypt.hash('admin123', 10);
        const managerPassword = await bcrypt.hash('manager123', 10);
        const cashierPassword = await bcrypt.hash('cashier123', 10);
        const salesPassword = await bcrypt.hash('sales123', 10);

        const insertUsersSQL = isPostgreSQL ? `
          INSERT INTO users (username, email, password_hash, full_name, role, status, phone, department, position) VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9),
          ($10, $11, $12, $13, $14, $15, $16, $17, $18),
          ($19, $20, $21, $22, $23, $24, $25, $26, $27),
          ($28, $29, $30, $31, $32, $33, $34, $35, $36)
        ` : `
          INSERT IGNORE INTO users (username, email, password_hash, full_name, role, status, phone, department, position) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertUsersSQL, [
          'admin', 'admin@example.com', adminPassword, 'System Administrator', 'admin', 'active', '+1234567890', 'Management', 'Administrator',
          'manager', 'manager@example.com', managerPassword, 'Store Manager', 'manager', 'active', '+1234567891', 'Management', 'Store Manager',
          'cashier', 'cashier@example.com', cashierPassword, 'Cashier User', 'cashier', 'active', '+1234567892', 'Sales', 'Cashier',
          'sales', 'sales@example.com', salesPassword, 'Sales Representative', 'cashier', 'active', '+1234567893', 'Sales', 'Sales Rep'
        ]);
      }

      // Insert default customers
      const checkCustomersSQL = 'SELECT COUNT(*) as count FROM customers';
      const customerCountResult = await this.executeQuery(checkCustomersSQL);
      const customerCount = isPostgreSQL ? customerCountResult.rows[0].count : customerCountResult[0].count;

      if (customerCount == 0) {
        const insertCustomersSQL = isPostgreSQL ? `
          INSERT INTO customers (customer_code, name, email, phone, address, date_of_birth, gender, loyalty_points, total_spent, discount_percentage, notes, status) VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
          ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24),
          ($25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36),
          ($37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48),
          ($49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60)
        ` : `
          INSERT INTO customers (customer_code, name, email, phone, address, date_of_birth, gender, loyalty_points, total_spent, discount_percentage, notes, status) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertCustomersSQL, [
          'CUST001', 'John Smith', 'john.smith@email.com', '+1234567801', '123 Main St, City, State 12345', '1985-03-15', 'male', 150, 1250.75, 5.0, 'VIP customer, prefers morning appointments', 'active',
          'CUST002', 'Sarah Johnson', 'sarah.johnson@email.com', '+1234567802', '456 Oak Ave, City, State 12346', '1990-07-22', 'female', 75, 890.50, 0.0, 'Regular customer, likes product recommendations', 'active',
          'CUST003', 'Michael Brown', 'michael.brown@email.com', '+1234567803', '789 Pine Rd, City, State 12347', '1978-11-08', 'male', 200, 2150.25, 10.0, 'Bulk buyer, corporate account', 'active',
          'CUST004', 'Emily Davis', 'emily.davis@email.com', '+1234567804', '321 Elm St, City, State 12348', '1995-01-30', 'female', 25, 345.00, 0.0, 'New customer, referred by Sarah Johnson', 'active',
          'CUST005', 'David Wilson', 'david.wilson@email.com', '+1234567805', '654 Maple Dr, City, State 12349', '1982-09-12', 'male', 100, 750.80, 2.5, 'Seasonal customer, prefers email communication', 'active'
        ]);
      }

      // Insert default partners
      const checkPartnersSQL = 'SELECT COUNT(*) as count FROM partners';
      const partnerCountResult = await this.executeQuery(checkPartnersSQL);
      const partnerCount = isPostgreSQL ? partnerCountResult.rows[0].count : partnerCountResult[0].count;

      if (partnerCount == 0) {
        const insertPartnersSQL = isPostgreSQL ? `
          INSERT INTO partners (name, type, phone_no) VALUES
          ($1, $2, $3),
          ($4, $5, $6),
          ($7, $8, $9)
        ` : `
          INSERT INTO partners (name, type, phone_no) VALUES
          (?, ?, ?),
          (?, ?, ?),
          (?, ?, ?)
        `;

        await this.executeQuery(insertPartnersSQL, [
          'Tech Supplies Inc', 'supplier', '+1555001001',
          'Global Electronics', 'supplier', '+1555001002',
          'Investment Partners LLC', 'investor', '+1555001003'
        ]);
      }

      // Insert default investments
      const checkInvestmentsSQL = 'SELECT COUNT(*) as count FROM investments';
      const investmentCountResult = await this.executeQuery(checkInvestmentsSQL);
      const investmentCount = isPostgreSQL ? investmentCountResult.rows[0].count : investmentCountResult[0].count;

      if (investmentCount == 0) {
        const insertInvestmentsSQL = isPostgreSQL ? `
          INSERT INTO investments (partner_id, partner_name, amount, type, notes) VALUES
          ($1, $2, $3, $4, $5),
          ($6, $7, $8, $9, $10)
        ` : `
          INSERT INTO investments (partner_id, partner_name, amount, type, notes) VALUES
          (?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertInvestmentsSQL, [
          3, 'Investment Partners LLC', 50000.00, 'equity', 'Initial seed funding for business expansion',
          3, 'Investment Partners LLC', 25000.00, 'loan', 'Equipment purchase loan at 5% interest'
        ]);
      }

      // Insert default inventory items
      const checkInventorySQL = 'SELECT COUNT(*) as count FROM inventory';
      const inventoryCountResult = await this.executeQuery(checkInventorySQL);
      const inventoryCount = isPostgreSQL ? inventoryCountResult.rows[0].count : inventoryCountResult[0].count;

      if (inventoryCount == 0) {
        const insertInventorySQL = isPostgreSQL ? `
          INSERT INTO inventory (item_name, sku, category, supplier, quantity, min_stock, unit_price, sell_price, buy_price, description, barcode, warranty_days) VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
          ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24),
          ($25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36),
          ($37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48),
          ($49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60),
          ($61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72)
        ` : `
          INSERT INTO inventory (item_name, sku, category, supplier, quantity, min_stock, unit_price, sell_price, buy_price, description, barcode, warranty_days) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertInventorySQL, [
          'Wireless Mouse', 'WM001', 'Electronics', 'Tech Supplies Inc', 50, 10, 15.99, 24.99, 12.00, 'Ergonomic wireless mouse with USB receiver', '1234567890123', 365,
          'Bluetooth Keyboard', 'KB001', 'Electronics', 'Tech Supplies Inc', 30, 5, 45.99, 69.99, 38.00, 'Compact bluetooth keyboard for all devices', '1234567890124', 365,
          'USB-C Cable', 'CB001', 'Accessories', 'Global Electronics', 100, 20, 8.99, 14.99, 6.50, 'High-speed USB-C charging and data cable', '1234567890125', 180,
          'Laptop Stand', 'LS001', 'Accessories', 'Tech Supplies Inc', 25, 5, 29.99, 49.99, 22.00, 'Adjustable aluminum laptop stand', '1234567890126', 730,
          'Webcam HD', 'WC001', 'Electronics', 'Global Electronics', 15, 3, 59.99, 89.99, 48.00, '1080p HD webcam with built-in microphone', '1234567890127', 365,
          'Phone Case', 'PC001', 'Accessories', 'Tech Supplies Inc', 75, 15, 12.99, 19.99, 9.50, 'Protective silicone phone case', '1234567890128', 90
        ]);
      }

      // Insert default payment methods
      const checkPaymentMethodsSQL = 'SELECT COUNT(*) as count FROM payment_methods';
      const paymentMethodCountResult = await this.executeQuery(checkPaymentMethodsSQL);
      const paymentMethodCount = isPostgreSQL ? paymentMethodCountResult.rows[0].count : paymentMethodCountResult[0].count;

      if (paymentMethodCount == 0) {
        const insertPaymentMethodsSQL = isPostgreSQL ? `
          INSERT INTO payment_methods (name, enabled) VALUES
          ($1, $2),
          ($3, $4),
          ($5, $6),
          ($7, $8),
          ($9, $10)
        ` : `
          INSERT INTO payment_methods (name, enabled) VALUES
          (?, ?),
          (?, ?),
          (?, ?),
          (?, ?),
          (?, ?)
        `;

        await this.executeQuery(insertPaymentMethodsSQL, [
          'Cash', true,
          'Credit Card', true,
          'Debit Card', true,
          'Mobile Payment', true,
          'Bank Transfer', false
        ]);
      }

      // Insert sample sales
      const checkSalesSQL = 'SELECT COUNT(*) as count FROM sales';
      const salesCountResult = await this.executeQuery(checkSalesSQL);
      const salesCount = isPostgreSQL ? salesCountResult.rows[0].count : salesCountResult[0].count;

      if (salesCount == 0) {
        const insertSalesSQL = isPostgreSQL ? `
          INSERT INTO sales (invoice, date, customer_id, customer_name, customer_phone, total_amount, paid_amount, tax_amount, discount_amount, status) VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
          ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20),
          ($21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
        ` : `
          INSERT INTO sales (invoice, date, customer_id, customer_name, customer_phone, total_amount, paid_amount, tax_amount, discount_amount, status) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertSalesSQL, [
          'INV001', '2024-01-15', 1, 'John Smith', '+1234567801', 94.97, 94.97, 7.60, 0.00, 'paid',
          'INV002', '2024-01-16', 2, 'Sarah Johnson', '+1234567802', 14.99, 14.99, 1.20, 5.00, 'paid',
          'INV003', '2024-01-17', null, 'Walk-in Customer', null, 49.99, 0.00, 4.00, 0.00, 'unpaid'
        ]);
      }

      // Insert sample sales items
      const checkSalesItemsSQL = 'SELECT COUNT(*) as count FROM sales_items';
      const salesItemsCountResult = await this.executeQuery(checkSalesItemsSQL);
      const salesItemsCount = isPostgreSQL ? salesItemsCountResult.rows[0].count : salesItemsCountResult[0].count;

      if (salesItemsCount == 0) {
        const insertSalesItemsSQL = isPostgreSQL ? `
          INSERT INTO sales_items (sale_id, item_id, item_name, quantity, unit_price, line_total) VALUES
          ($1, $2, $3, $4, $5, $6),
          ($7, $8, $9, $10, $11, $12),
          ($13, $14, $15, $16, $17, $18),
          ($19, $20, $21, $22, $23, $24),
          ($25, $26, $27, $28, $29, $30)
        ` : `
          INSERT INTO sales_items (sale_id, item_id, item_name, quantity, unit_price, line_total) VALUES
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertSalesItemsSQL, [
          1, 1, 'Wireless Mouse', 2, 24.99, 49.98,
          1, 2, 'Bluetooth Keyboard', 1, 69.99, 69.99,
          2, 3, 'USB-C Cable', 1, 14.99, 14.99,
          3, 4, 'Laptop Stand', 1, 49.99, 49.99,
          1, 3, 'USB-C Cable', 1, 14.99, 14.99
        ]);
      }

      // Insert sample payments
      const checkPaymentsSQL = 'SELECT COUNT(*) as count FROM payments';
      const paymentsCountResult = await this.executeQuery(checkPaymentsSQL);
      const paymentsCount = isPostgreSQL ? paymentsCountResult.rows[0].count : paymentsCountResult[0].count;

      if (paymentsCount == 0) {
        const insertPaymentsSQL = isPostgreSQL ? `
          INSERT INTO payments (sale_id, payment_method, amount, transaction_reference, processed_by) VALUES
          ($1, $2, $3, $4, $5),
          ($6, $7, $8, $9, $10)
        ` : `
          INSERT INTO payments (sale_id, payment_method, amount, transaction_reference, processed_by) VALUES
          (?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertPaymentsSQL, [
          1, 'Credit Card', 94.97, 'CC123456789', 3,
          2, 'Cash', 14.99, 'CASH001', 3
        ]);
      }

      // Insert default settings
      const checkSettingsSQL = 'SELECT COUNT(*) as count FROM settings';
      const settingsCountResult = await this.executeQuery(checkSettingsSQL);
      const settingsCount = isPostgreSQL ? settingsCountResult.rows[0].count : settingsCountResult[0].count;

      if (settingsCount == 0) {
        const warrantyTerms = 'Standard warranty terms apply. Items can be returned within the warranty period with proof of purchase.';
        const receiptFooter = 'Thank you for your business! Visit us again soon.';

        const insertSettingsSQL = isPostgreSQL ? `
          INSERT INTO settings (
            shop_name, shop_phone, shop_email, shop_address, shop_city, shop_state, shop_zip_code,
            tax_rate, currency, country_code, warranty_period, 
            warranty_terms, receipt_footer, business_registration, tax_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ` : `
          INSERT INTO settings (
            shop_name, shop_phone, shop_email, shop_address, shop_city, shop_state, shop_zip_code,
            tax_rate, currency, country_code, warranty_period, 
            warranty_terms, receipt_footer, business_registration, tax_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.executeQuery(insertSettingsSQL, [
          'TechStore POS', '+1-555-123-4567', 'info@techstore.com', '123 Main Street', 'New York', 'NY', '10001',
          8.25, 'USD', '+1', 30, 
          warrantyTerms, receiptFooter, 'REG123456789', 'TAX987654321'
        ]);
      }

      console.log('Comprehensive mock data inserted successfully');
    } catch (error) {
      console.error('Error inserting default data:', error);
      throw error;
    }
  }

  getDb() {
    return this.db;
  }

  async close() {
    if (this.db) {
      if (isPostgreSQL) {
        await this.db.end();
      } else {
        await this.db.end();
      }
    }
  }
  
  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
}

Database.instance = null;

module.exports = Database;