const express = require('express');
const Database = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Create database instance
const dbInstance = Database.getInstance();
let dbInitialized = false;

// Initialize database connection
dbInstance.initialize().then(() => {
  dbInitialized = true;
}).catch(err => {
  console.error('Failed to initialize database in locations route:', err);
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

// Get all locations
router.get('/', async (req, res) => {
  try {
    const sql = 'SELECT * FROM locations ORDER BY created_at DESC';
    const result = await executeQuery(sql);
    const rows = result.rows || result;
    res.json({ locations: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get location by ID
router.get('/:id', async (req, res) => {
  try {
    const sql = `SELECT * FROM locations WHERE id = ${getParamPlaceholder(1)}`;
    const result = await executeQuery(sql, [req.params.id]);
    const rows = result.rows || result;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    res.json({ location: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new location
router.post('/', async (req, res) => {
  const { name, address, phone, manager_id, status = 'active' } = req.body;
  
  if (!name || !address) {
    res.status(400).json({ error: 'Name and address are required' });
    return;
  }
  
  try {
    const sql = `INSERT INTO locations (name, address, phone, manager_id, status) VALUES (${getParamPlaceholder(1)}, ${getParamPlaceholder(2)}, ${getParamPlaceholder(3)}, ${getParamPlaceholder(4)}, ${getParamPlaceholder(5)})`;
    const result = await executeQuery(sql, [name, address, phone, manager_id, status]);
    
    const insertId = result.insertId || result.rows?.[0]?.id || result.lastInsertRowid;
    res.status(201).json({
      message: 'Location created successfully',
      location: { id: insertId, name, address, phone, manager_id, status }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update location
router.put('/:id', async (req, res) => {
  const { name, address, phone, manager_id, status } = req.body;
  
  try {
    const sql = `UPDATE locations SET name = ${getParamPlaceholder(1)}, address = ${getParamPlaceholder(2)}, phone = ${getParamPlaceholder(3)}, manager_id = ${getParamPlaceholder(4)}, status = ${getParamPlaceholder(5)}, updated_at = NOW() WHERE id = ${getParamPlaceholder(6)}`;
    const result = await executeQuery(sql, [name, address, phone, manager_id, status, req.params.id]);
    
    const affectedRows = result.affectedRows || result.rowCount || 0;
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    res.json({ message: 'Location updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get location inventory
router.get('/:id/inventory', async (req, res) => {
  try {
    const sql = `
      SELECT i.*, li.quantity as location_quantity, li.min_stock as location_min_stock
      FROM inventory i
      LEFT JOIN location_inventory li ON i.id = li.item_id
      WHERE li.location_id = ${getParamPlaceholder(1)} OR li.location_id IS NULL
      ORDER BY i.item_name
    `;
    const result = await executeQuery(sql, [req.params.id]);
    const rows = result.rows || result;
    res.json({ inventory: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer inventory between locations
router.post('/:fromId/transfer/:toId', async (req, res) => {
  const { fromId, toId } = req.params;
  const { item_id, quantity, notes } = req.body;
  
  if (!item_id || !quantity || quantity <= 0) {
    res.status(400).json({ error: 'Valid item_id and quantity are required' });
    return;
  }
  
  try {
    // Check if source location has enough inventory
    const checkSql = `SELECT quantity FROM location_inventory WHERE location_id = ${getParamPlaceholder(1)} AND item_id = ${getParamPlaceholder(2)}`;
    const checkResult = await executeQuery(checkSql, [fromId, item_id]);
    const sourceInventory = checkResult.rows?.[0] || checkResult[0];
    
    if (!sourceInventory || sourceInventory.quantity < quantity) {
      res.status(400).json({ error: 'Insufficient inventory at source location' });
      return;
    }
    
    // Begin transaction
    await executeQuery('START TRANSACTION');
    
    try {
      // Reduce quantity from source
      const reduceSql = `UPDATE location_inventory SET quantity = quantity - ${getParamPlaceholder(1)} WHERE location_id = ${getParamPlaceholder(2)} AND item_id = ${getParamPlaceholder(3)}`;
      await executeQuery(reduceSql, [quantity, fromId, item_id]);
      
      // Add quantity to destination (or create if doesn't exist)
      const upsertSql = `
        INSERT INTO location_inventory (location_id, item_id, quantity) 
        VALUES (${getParamPlaceholder(1)}, ${getParamPlaceholder(2)}, ${getParamPlaceholder(3)})
        ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
      `;
      await executeQuery(upsertSql, [toId, item_id, quantity]);
      
      // Log the transfer
      const logSql = `
        INSERT INTO inventory_transfers (from_location_id, to_location_id, item_id, quantity, notes)
        VALUES (${getParamPlaceholder(1)}, ${getParamPlaceholder(2)}, ${getParamPlaceholder(3)}, ${getParamPlaceholder(4)}, ${getParamPlaceholder(5)})
      `;
      await executeQuery(logSql, [fromId, toId, item_id, quantity, notes]);
      
      await executeQuery('COMMIT');
      res.json({ message: 'Inventory transferred successfully' });
    } catch (err) {
      await executeQuery('ROLLBACK');
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get location sales
router.get('/:id/sales', async (req, res) => {
  const { start_date, end_date } = req.query;
  
  try {
    let sql = `
      SELECT s.*, COUNT(si.id) as item_count, SUM(si.line_total) as calculated_total
      FROM sales s
      LEFT JOIN sales_items si ON s.id = si.sale_id
      WHERE s.location_id = ${getParamPlaceholder(1)}
    `;
    
    const params = [req.params.id];
    
    if (start_date) {
      sql += ` AND s.date >= ${getParamPlaceholder(params.length + 1)}`;
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ` AND s.date <= ${getParamPlaceholder(params.length + 1)}`;
      params.push(end_date);
    }
    
    sql += ' GROUP BY s.id ORDER BY s.created_at DESC';
    
    const result = await executeQuery(sql, params);
    const rows = result.rows || result;
    res.json({ sales: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete location
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const sql = `DELETE FROM locations WHERE id = ${getParamPlaceholder(1)}`;
    const result = await executeQuery(sql, [req.params.id]);
    
    const affectedRows = result.affectedRows || result.rowCount || 0;
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;