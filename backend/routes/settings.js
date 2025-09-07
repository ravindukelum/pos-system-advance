const express = require('express');
const router = express.Router();
const Database = require('../database/db');

require('dotenv').config();

// Create database instance
const dbInstance = Database.getInstance();
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
    
    // Convert snake_case database fields to camelCase for frontend
    const settings = {
      id: rows[0].id,
      shopName: rows[0].shop_name,
      shopPhone: rows[0].shop_phone,
      shopEmail: rows[0].shop_email,
      shopAddress: rows[0].shop_address,
      shopCity: rows[0].shop_city,
      shopState: rows[0].shop_state,
      shopZipCode: rows[0].shop_zip_code,
      shopLogoUrl: '', // Not stored in current schema
      taxRate: rows[0].tax_rate,
      currency: rows[0].currency,
      countryCode: rows[0].country_code,
      warrantyPeriod: rows[0].warranty_period,
      warrantyTerms: rows[0].warranty_terms,
      receiptFooter: rows[0].receipt_footer,
      businessRegistration: rows[0].business_registration,
      taxId: rows[0].tax_id,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };
    
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
  try {
    const {
      shopName = 'My POS Shop',
      shopPhone = '',
      shopEmail = '',
      shopAddress = '',
      shopCity = '',
      shopState = '',
      shopZipCode = '',
      shopLogoUrl = '',
      taxRate = 0,
      currency = 'USD',
      countryCode = '+1',
      warrantyPeriod = 30,
      warrantyTerms = 'Standard warranty terms apply.',
      receiptFooter = 'Thank you for your business!',
      businessRegistration = '',
      taxId = ''
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
    console.log('Checking for existing settings...');
    let existingResult, existingRows;
    try {
      existingResult = await executeQuery('SELECT id FROM settings ORDER BY id DESC LIMIT 1');
      existingRows = existingResult.rows || existingResult;
      console.log('Existing settings query result:', existingRows);
    } catch (error) {
      console.error('Error checking existing settings:', error);
      existingRows = [];
    }

    if (existingRows.length > 0) {
      // Update existing settings using correct snake_case column names
      const updateQuery = `UPDATE settings SET 
        shop_name = ?, shop_phone = ?, shop_email = ?, shop_address = ?, shop_city = ?, shop_state = ?, shop_zip_code = ?,
        tax_rate = ?, currency = ?, country_code = ?, warranty_period = ?, warranty_terms = ?, receipt_footer = ?,
        business_registration = ?, tax_id = ?
        WHERE id = ?`;
      
      const updateParams = [
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode,
        taxRate, currency, countryCode, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId, existingRows[0].id
      ];
      
      // Debug: Check for undefined values
      console.log('Update params:', updateParams);
      const hasUndefined = updateParams.some(param => param === undefined);
      if (hasUndefined) {
        console.error('Found undefined parameters:', updateParams.map((p, i) => ({ index: i, value: p, isUndefined: p === undefined })));
        return res.status(400).json({ error: 'Invalid parameters provided' });
      }
      
      await executeQuery(updateQuery, updateParams);
      
      // Fetch and return updated settings
      const updatedResult = await executeQuery('SELECT * FROM settings WHERE id = ?', [existingRows[0].id]);
      const updatedRows = updatedResult.rows || updatedResult;
      
      // Convert to camelCase for frontend
      const updatedSettings = {
        id: updatedRows[0].id,
        shopName: updatedRows[0].shop_name,
        shopPhone: updatedRows[0].shop_phone,
        shopEmail: updatedRows[0].shop_email,
        shopAddress: updatedRows[0].shop_address,
        shopCity: updatedRows[0].shop_city,
        shopState: updatedRows[0].shop_state,
        shopZipCode: updatedRows[0].shop_zip_code,
        shopLogoUrl: '',
        taxRate: updatedRows[0].tax_rate,
        currency: updatedRows[0].currency,
        countryCode: updatedRows[0].country_code,
        warrantyPeriod: updatedRows[0].warranty_period,
        warrantyTerms: updatedRows[0].warranty_terms,
        receiptFooter: updatedRows[0].receipt_footer,
        businessRegistration: updatedRows[0].business_registration,
        taxId: updatedRows[0].tax_id,
        createdAt: updatedRows[0].created_at,
        updatedAt: updatedRows[0].updated_at
      };
      
      res.json(updatedSettings);
    } else {
      // Insert new settings using correct snake_case column names
      const insertQuery = `INSERT INTO settings (
        shop_name, shop_phone, shop_email, shop_address, shop_city, shop_state, shop_zip_code,
        tax_rate, currency, country_code, warranty_period, warranty_terms, receipt_footer,
        business_registration, tax_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const insertParams = [
        shopName, shopPhone, shopEmail, shopAddress, shopCity, shopState, shopZipCode,
        taxRate, currency, countryCode, warrantyPeriod, warrantyTerms, receiptFooter,
        businessRegistration, taxId
      ];
      
      // Debug: Check for undefined values
      console.log('Insert params:', insertParams);
      const hasUndefined = insertParams.some(param => param === undefined);
      if (hasUndefined) {
        console.error('Found undefined parameters:', insertParams.map((p, i) => ({ index: i, value: p, isUndefined: p === undefined })));
        return res.status(400).json({ error: 'Invalid parameters provided' });
      }
      
      const insertResult = await executeQuery(insertQuery, insertParams);
      
      // Fetch and return new settings
      const newResult = await executeQuery('SELECT * FROM settings WHERE id = ?', [insertResult.insertId]);
      const newRows = newResult.rows || newResult;
      
      // Convert to camelCase for frontend
      const newSettings = {
        id: newRows[0].id,
        shopName: newRows[0].shop_name,
        shopPhone: newRows[0].shop_phone,
        shopEmail: newRows[0].shop_email,
        shopAddress: newRows[0].shop_address,
        shopCity: newRows[0].shop_city,
        shopState: newRows[0].shop_state,
        shopZipCode: newRows[0].shop_zip_code,
        shopLogoUrl: '',
        taxRate: newRows[0].tax_rate,
        currency: newRows[0].currency,
        countryCode: newRows[0].country_code,
        warrantyPeriod: newRows[0].warranty_period,
        warrantyTerms: newRows[0].warranty_terms,
        receiptFooter: newRows[0].receipt_footer,
        businessRegistration: newRows[0].business_registration,
        taxId: newRows[0].tax_id,
        createdAt: newRows[0].created_at,
        updatedAt: newRows[0].updated_at
      };
      
      res.json(newSettings);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;