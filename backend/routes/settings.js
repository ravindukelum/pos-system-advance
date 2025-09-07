const express = require('express');
const router = express.Router();
const Database = require('../database/db');

require('dotenv').config();

// Create database instance
const dbInstance = new Database();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in settings route:', err);
});

// Note: Settings table is now initialized in the main database initialization file (db.js)

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  return await dbInstance.executeQuery(sql, params);
};

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    const rows = result.rows || result;
    
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
        countryCode: '+94',
        warrantyPeriod: 30,
        warrantyTerms: 'Standard warranty terms apply. Items must be returned in original condition.',
        receiptFooter: 'Thank you for your business!',
        businessRegistration: '',
        taxId: ''
      };
      return res.json({ settings: defaultSettings });
    }
    
    res.json({ settings: rows[0] });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
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
      countryCode,
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

    // Check if settings exist
    const existingResult = await executeQuery('SELECT id FROM settings ORDER BY id DESC LIMIT 1');
    const existingRows = existingResult.rows || existingResult;

    if (existingRows.length > 0) {
      // Update existing settings
      const updateQuery = `UPDATE settings SET 
        shopName = ?, shopPhone = ?, shopEmail = ?, shopAddress = ?, shopCity = ?, 
        shopState = ?, shopZipCode = ?, shopLogoUrl = ?, taxRate = ?, currency = ?, countryCode = ?, warrantyPeriod = ?,
        warrantyTerms = ?, receiptFooter = ?, businessRegistration = ?, taxId = ?
        WHERE id = ?`;
      
      await executeQuery(updateQuery, [
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, countryCode, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId, existingRows[0].id
      ]);
      
      // Fetch and return updated settings
      const updatedResult = await executeQuery('SELECT * FROM settings WHERE id = ?', [existingRows[0].id]);
      const updatedRows = updatedResult.rows || updatedResult;
      res.json(updatedRows[0]);
    } else {
      // Insert new settings
      const insertQuery = `INSERT INTO settings (
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, countryCode, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const insertResult = await executeQuery(insertQuery, [
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode, shopLogoUrl,
        taxRate, currency, countryCode, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId
      ]);
      
      // Fetch and return new settings
      const newResult = await executeQuery('SELECT * FROM settings WHERE id = ?', [insertResult.insertId]);
      const newRows = newResult.rows || newResult;
      res.json(newRows[0]);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;