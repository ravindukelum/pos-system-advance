const express = require('express');
const Database = require('../database/db');
const router = express.Router();

// Create database instance
const dbInstance = Database.getInstance();
let dbInitialized = false;

// Initialize database connection
dbInstance.initialize().then(() => {
  dbInitialized = true;
}).catch(err => {
  console.error('Failed to initialize database in partners route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  if (!dbInitialized) {
    throw new Error('Database not initialized');
  }
  
  // Convert PostgreSQL-style parameters ($1, $2) to MySQL-style (?) if needed
  const isPostgreSQL = process.env.DATABASE_URL ? true : false;
  if (!isPostgreSQL && sql.includes('$')) {
    let paramIndex = 1;
    sql = sql.replace(/\$\d+/g, () => '?');
  }
  
  return await dbInstance.executeQuery(sql, params);
};

// Helper function to get database-agnostic parameter placeholder
const getParamPlaceholder = (index) => {
  const isPostgreSQL = process.env.DATABASE_URL ? true : false;
  return isPostgreSQL ? `$${index}` : '?';
};

// Get all partners
router.get('/', async (req, res) => {
  try {
    const sql = 'SELECT * FROM partners ORDER BY created_at DESC';
    const result = await executeQuery(sql);
    const rows = result.rows || result;
    res.json({ partners: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get partner by ID
router.get('/:id', async (req, res) => {
  try {
    const sql = `SELECT * FROM partners WHERE id = ${getParamPlaceholder(1)}`;
    const result = await executeQuery(sql, [req.params.id]);
    const rows = result.rows || result;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }
    res.json({ partner: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new partner
router.post('/', async (req, res) => {
  const { name, type, phone_no } = req.body;
  
  if (!name || !type) {
    res.status(400).json({ error: 'Name and type are required' });
    return;
  }
  
  if (!['investor', 'supplier'].includes(type)) {
    res.status(400).json({ error: 'Type must be either investor or supplier' });
    return;
  }
  
  try {
    const sql = `INSERT INTO partners (name, type, phone_no) VALUES (${getParamPlaceholder(1)}, ${getParamPlaceholder(2)}, ${getParamPlaceholder(3)})`;
    const result = await executeQuery(sql, [name, type, phone_no]);
    
    const insertId = result.insertId || result.rows?.[0]?.id || result.lastInsertRowid;
    res.status(201).json({
      message: 'Partner created successfully',
      partner: { id: insertId, name, type, phone_no }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update partner
router.put('/:id', async (req, res) => {
  const { name, type, phone_no } = req.body;
  
  if (!name || !type) {
    res.status(400).json({ error: 'Name and type are required' });
    return;
  }
  
  if (!['investor', 'supplier'].includes(type)) {
    res.status(400).json({ error: 'Type must be either investor or supplier' });
    return;
  }
  
  try {
    const sql = `UPDATE partners SET name = ${getParamPlaceholder(1)}, type = ${getParamPlaceholder(2)}, phone_no = ${getParamPlaceholder(3)} WHERE id = ${getParamPlaceholder(4)}`;
    const result = await executeQuery(sql, [name, type, phone_no, req.params.id]);
    
    const affectedRows = result.affectedRows || result.rowCount || 0;
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }
    res.json({ message: 'Partner updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete partner
router.delete('/:id', async (req, res) => {
  try {
    const sql = `DELETE FROM partners WHERE id = ${getParamPlaceholder(1)}`;
    const result = await executeQuery(sql, [req.params.id]);
    
    const affectedRows = result.affectedRows || result.rowCount || 0;
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }
    res.json({ message: 'Partner deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;