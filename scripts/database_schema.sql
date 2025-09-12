-- QOrder Database Schema
-- Complete table creation script with latest changes
-- This script creates all necessary tables for the QOrder POS system

-- Users table
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
);

-- Customers table
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
);

-- Partners table
CREATE TABLE IF NOT EXISTS partners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('investor', 'supplier') NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('invest', 'withdraw') NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partners(id)
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100),
  quantity INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  buy_price DECIMAL(10,2) DEFAULT 0.00,
  warranty_days INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'completed',
  customer_id INT,
  cashier_id INT,
  location_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);

-- Sales items table
CREATE TABLE IF NOT EXISTS sales_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  item_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  processed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (processed_by) REFERENCES users(id)
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  shop_logo_url VARCHAR(500) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(100),
  department VARCHAR(100),
  salary DECIMAL(10,2),
  hire_date DATE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Time tracking table
CREATE TABLE IF NOT EXISTS time_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  clock_in TIMESTAMP NOT NULL,
  clock_out TIMESTAMP,
  break_duration INT DEFAULT 0,
  total_hours DECIMAL(4,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Message logs table for WhatsApp messaging
CREATE TABLE IF NOT EXISTS message_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_phone VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  template_name VARCHAR(100),
  message_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  whatsapp_message_id VARCHAR(100),
  error_message TEXT,
  sale_id INT,
  customer_id INT,
  sent_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
);

-- Insert default payment methods
INSERT IGNORE INTO payment_methods (name, enabled) VALUES
('Cash', TRUE),
('Credit Card', TRUE),
('Debit Card', TRUE),
('Bank Transfer', TRUE),
('Digital Wallet', TRUE);

-- Insert default settings
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('shop_name', 'QOrder POS'),
('shop_address', ''),
('shop_phone', ''),
('shop_email', ''),
('tax_rate', '0.00'),
('currency', 'USD'),
('receipt_footer', 'Thank you for your business!');

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (username, email, password_hash, full_name, role, status) VALUES
('admin', 'admin@qorder.com', '$2b$10$rQZ9vKzQ8vKzQ8vKzQ8vKOeJ9vKzQ8vKzQ8vKzQ8vKzQ8vKzQ8vKz', 'System Administrator', 'admin', 'active');