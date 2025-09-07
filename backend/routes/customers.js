const express = require('express');
const { body, validationResult } = require('express-validator');
const Database = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get shared database instance
const dbInstance = Database.getInstance();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in customers route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  const isPostgreSQL = process.env.DATABASE_URL ? true : false;
  return await dbInstance.executeQuery(sql, params);
};

// Generate customer code
const generateCustomerCode = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `CUST${timestamp}${random}`.toUpperCase();
};

// Validation middleware
const validateCustomer = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().isMobilePhone().withMessage('Valid phone number is required'),
  body('gender').optional({ checkFalsy: true }).isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('discount_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount percentage must be between 0 and 100')
];

// Get all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status = 'active', limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    
    if (search) {
      sql += ' AND (name LIKE ? OR customer_code LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    sql += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const result = await executeQuery(sql, params);
    const customers = result.rows || result;
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countSql += ' AND (name LIKE ? OR customer_code LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (status !== 'all') {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    
    const countResult = await executeQuery(countSql, countParams);
    const total = (countResult.rows || countResult)[0].total;
    
    res.json({ 
      customers,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + customers.length < parseInt(total)
      }
    });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get customer by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const sql = 'SELECT * FROM customers WHERE id = ?';
    const result = await executeQuery(sql, [req.params.id]);
    const customers = result.rows || result;
    
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get customer's purchase history
    const salesSql = `
      SELECT id, invoice, date, total_amount, status, created_at
      FROM sales 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const salesResult = await executeQuery(salesSql, [req.params.id]);
    const sales = salesResult.rows || salesResult;
    
    res.json({ 
      customer: customers[0],
      recent_sales: sales
    });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get customer by customer code
router.get('/code/:code', authenticateToken, async (req, res) => {
  try {
    const sql = 'SELECT * FROM customers WHERE customer_code = ?';
    const result = await executeQuery(sql, [req.params.code]);
    const customers = result.rows || result;
    
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ customer: customers[0] });
  } catch (err) {
    console.error('Get customer by code error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new customer
router.post('/', authenticateToken, validateCustomer, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      name, 
      email = null, 
      phone, 
      address = null, 
      date_of_birth = null, 
      gender = null, 
      discount_percentage = 0,
      notes = null 
    } = req.body;

    // Check if customer with same phone already exists
    const checkSql = 'SELECT id FROM customers WHERE phone = ?';
    const existingResult = await executeQuery(checkSql, [phone]);
    const existing = existingResult.rows || existingResult;
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Customer with this phone number already exists' });
    }

    const customer_code = generateCustomerCode();
    
    const sql = `
      INSERT INTO customers (
        customer_code, name, email, phone, address, date_of_birth, 
        gender, discount_percentage, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // Handle empty date_of_birth - convert empty string to null
    const processedDateOfBirth = date_of_birth && date_of_birth.trim() !== '' ? date_of_birth : null;
    // Handle empty email - convert empty string to null
    const processedEmail = email && email.trim() !== '' ? email : null;
    // Handle empty address - convert empty string to null
    const processedAddress = address && address.trim() !== '' ? address : null;
    // Handle empty notes - convert empty string to null
    const processedNotes = notes && notes.trim() !== '' ? notes : null;
    
    const result = await executeQuery(sql, [
      customer_code, name, processedEmail, phone, processedAddress, processedDateOfBirth,
      gender, discount_percentage, processedNotes, 'active'
    ]);
    
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const customerId = isPostgreSQL ? result.rows[0]?.id : result.insertId;

    res.status(201).json({
      message: 'Customer created successfully',
      customer: { 
        id: customerId,
        customer_code,
        name, 
        email, 
        phone, 
        address, 
        date_of_birth, 
        gender,
        loyalty_points: 0,
        total_spent: 0,
        discount_percentage,
        notes,
        status: 'active'
      }
    });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update customer
router.put('/:id', authenticateToken, validateCustomer, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      name, 
      email, 
      phone, 
      address, 
      date_of_birth, 
      gender,
      discount_percentage,
      notes,
      status
    } = req.body;

    // Check if customer with same email or phone already exists (excluding current customer)
    if (email || phone) {
      let checkSql = 'SELECT id FROM customers WHERE id != ? AND (';
      const checkParams = [req.params.id];
      const conditions = [];
      
      if (email) {
        conditions.push('email = ?');
        checkParams.push(email);
      }
      
      if (phone) {
        conditions.push('phone = ?');
        checkParams.push(phone);
      }
      
      checkSql += conditions.join(' OR ') + ')';
      
      const existingResult = await executeQuery(checkSql, checkParams);
      const existing = existingResult.rows || existingResult;
      
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Customer with this email or phone already exists' });
      }
    }

    const sql = `
      UPDATE customers SET 
        name = ?, email = ?, phone = ?, address = ?, date_of_birth = ?, 
        gender = ?, discount_percentage = ?, notes = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    // Handle empty date_of_birth - convert empty string to null
    const processedDateOfBirth = date_of_birth && date_of_birth.trim() !== '' ? date_of_birth : null;
    
    const result = await executeQuery(sql, [
      name, email, phone, address, processedDateOfBirth,
      gender, discount_percentage, notes, status || 'active', req.params.id
    ]);

    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update customer loyalty points
router.patch('/:id/loyalty', authenticateToken, async (req, res) => {
  try {
    const { points, operation = 'add' } = req.body;
    
    if (points === undefined || points < 0) {
      return res.status(400).json({ error: 'Valid points amount required' });
    }
    
    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({ error: 'Operation must be add, subtract, or set' });
    }
    
    let sql;
    let params;
    
    switch (operation) {
      case 'add':
        sql = 'UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = NOW() WHERE id = ?';
        params = [points, req.params.id];
        break;
      case 'subtract':
        sql = 'UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points - ?), updated_at = NOW() WHERE id = ?';
        params = [points, req.params.id];
        break;
      case 'set':
        sql = 'UPDATE customers SET loyalty_points = ?, updated_at = NOW() WHERE id = ?';
        params = [points, req.params.id];
        break;
    }
    
    const result = await executeQuery(sql, params);
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Loyalty points updated successfully' });
  } catch (err) {
    console.error('Update loyalty points error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get customer analytics
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Get customer purchase analytics
    const analyticsSql = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as average_order,
        MAX(total_amount) as highest_order,
        MIN(date) as first_purchase,
        MAX(date) as last_purchase,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as completed_orders
      FROM sales 
      WHERE customer_id = ?
    `;
    
    const analyticsResult = await executeQuery(analyticsSql, [customerId]);
    const analytics = (analyticsResult.rows || analyticsResult)[0];
    
    // Get monthly spending for last 12 months
    const monthlySql = `
      SELECT 
        YEAR(date) as year,
        MONTH(date) as month,
        SUM(total_amount) as total,
        COUNT(*) as orders
      FROM sales 
      WHERE customer_id = ? AND date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY YEAR(date), MONTH(date)
      ORDER BY year DESC, month DESC
    `;
    
    const monthlyResult = await executeQuery(monthlySql, [customerId]);
    const monthlySpending = monthlyResult.rows || monthlyResult;
    
    // Get top purchased items
    const topItemsSql = `
      SELECT 
        si.item_name,
        SUM(si.quantity) as total_quantity,
        SUM(si.line_total) as total_spent
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.customer_id = ?
      GROUP BY si.item_name
      ORDER BY total_quantity DESC
      LIMIT 5
    `;
    
    const topItemsResult = await executeQuery(topItemsSql, [customerId]);
    const topItems = topItemsResult.rows || topItemsResult;
    
    res.json({
      analytics: {
        ...analytics,
        total_spent: parseFloat(analytics.total_spent || 0),
        average_order: parseFloat(analytics.average_order || 0),
        highest_order: parseFloat(analytics.highest_order || 0)
      },
      monthly_spending: monthlySpending,
      top_items: topItems
    });
    
  } catch (err) {
    console.error('Get customer analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete customer (soft delete)
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const sql = 'UPDATE customers SET status = ?, updated_at = NOW() WHERE id = ?';
    const result = await executeQuery(sql, ['inactive', req.params.id]);
    
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deactivated successfully' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;