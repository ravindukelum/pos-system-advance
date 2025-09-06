const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  port: 3306,
  database: 'pos_system'
};

// Initialize settings table if it doesn't exist
const initializeSettingsTable = async () => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Create settings table if it doesn't exist
    await connection.execute(`CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shopName VARCHAR(255) DEFAULT '',
      shopPhone VARCHAR(50) DEFAULT '',
      shopEmail VARCHAR(255) DEFAULT '',
      shopAddress TEXT,
      shopCity VARCHAR(100) DEFAULT '',
      shopState VARCHAR(100) DEFAULT '',
      shopZipCode VARCHAR(20) DEFAULT '',
      shopLogoUrl VARCHAR(500) DEFAULT '',
      taxRate DECIMAL(5,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      warrantyPeriod INT DEFAULT 30,
      warrantyTerms TEXT,
      receiptFooter TEXT,
      businessRegistration VARCHAR(255) DEFAULT '',
      taxId VARCHAR(255) DEFAULT '',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // Add shopLogoUrl column if it doesn't exist (for existing tables)
    try {
      await connection.execute(`ALTER TABLE settings ADD COLUMN shopLogoUrl VARCHAR(500) DEFAULT '' AFTER shopZipCode`);
      console.log('shopLogoUrl column added successfully');
    } catch (error) {
      // Column might already exist, ignore the error
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding shopLogoUrl column:', error);
      }
    }

    // Check if settings exist, if not insert default
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM settings');
    
    if (rows[0].count === 0) {
      await connection.execute(`INSERT INTO settings (
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId
      ) VALUES (
        'My POS Shop', '', '', '', '', '', '', '',
        0, 'USD', 30, 'Standard warranty terms apply. Items must be returned in original condition.',
        'Thank you for your business!', '', ''
      )`);
      console.log('Default settings created successfully');
    }
  } catch (error) {
    console.error('Error initializing settings table:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Initialize table when module loads (with delay to ensure database is ready)
setTimeout(initializeSettingsTable, 3000);

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    
    if (rows.length === 0) {
      // Return default settings if none exist
      const defaultSettings = {
        shopName: 'My POS Shop',
        shopPhone: '',
        shopEmail: '',
        shopAddress: '',
        shopCity: '',
        shopState: '',
        shopZipCode: '',
        shopLogoUrl: '',
        taxRate: 0,
        currency: 'USD',
        warrantyPeriod: 30,
        warrantyTerms: 'Standard warranty terms apply. Items must be returned in original condition.',
        receiptFooter: 'Thank you for your business!',
        businessRegistration: '',
        taxId: ''
      };
      return res.json(defaultSettings);
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
  let connection;
  try {
    const {
      shopName,
      shopPhone,
      shopEmail,
      shopAddress,
      shopCity,
      shopState,
      shopZipCode,
      shopLogoUrl,
      taxRate,
      currency,
      warrantyPeriod,
      warrantyTerms,
      receiptFooter,
      businessRegistration,
      taxId
    } = req.body;

    // Validation
    if (!shopName || !shopPhone) {
      return res.status(400).json({ error: 'Shop name and phone number are required' });
    }

    if (taxRate < 0 || taxRate > 100) {
      return res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    }

    if (warrantyPeriod < 0) {
      return res.status(400).json({ error: 'Warranty period cannot be negative' });
    }

    connection = await mysql.createConnection(dbConfig);
    
    // Check if settings exist
    const [existingRows] = await connection.execute('SELECT id FROM settings ORDER BY id DESC LIMIT 1');

    if (existingRows.length > 0) {
      // Update existing settings
      const updateQuery = `UPDATE settings SET 
        shopName = ?, shopPhone = ?, shopEmail = ?, shopAddress = ?, shopCity = ?, 
        shopState = ?, shopZipCode = ?, shopLogoUrl = ?, taxRate = ?, currency = ?, warrantyPeriod = ?,
        warrantyTerms = ?, receiptFooter = ?, businessRegistration = ?, taxId = ?
        WHERE id = ?`;
      
      await connection.execute(updateQuery, [
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId, existingRows[0].id
      ]);
      
      // Fetch and return updated settings
      const [updatedRows] = await connection.execute('SELECT * FROM settings WHERE id = ?', [existingRows[0].id]);
      res.json(updatedRows[0]);
    } else {
      // Insert new settings
      const insertQuery = `INSERT INTO settings (
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const [result] = await connection.execute(insertQuery, [
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId
      ]);
      
      // Fetch and return new settings
      const [newRows] = await connection.execute('SELECT * FROM settings WHERE id = ?', [result.insertId]);
      res.json(newRows[0]);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;