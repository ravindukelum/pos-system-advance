const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Database = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Create database instance
const dbInstance = Database.getInstance();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in inventory route:', err);
});

// Get all inventory items with location quantities
router.get('/', async (req, res) => {
  try {
    const { location_id } = req.query;
    
    if (location_id) {
      // Get inventory for specific location
      const sql = `
        SELECT i.*, li.quantity as location_quantity, li.min_stock as location_min_stock, 
               li.max_stock as location_max_stock, l.name as location_name
        FROM inventory i
        LEFT JOIN location_inventory li ON i.id = li.item_id
        LEFT JOIN locations l ON li.location_id = l.id
        WHERE li.location_id = ?
        ORDER BY i.created_at DESC
      `;
      const [rows] = await db.execute(sql, [location_id]);
      res.json({ inventory: rows });
    } else {
      // Get all inventory items with total quantities across all locations
      const sql = `
        SELECT i.*, 
               COALESCE(SUM(li.quantity), 0) as total_quantity,
               COUNT(li.location_id) as locations_count
        FROM inventory i
        LEFT JOIN location_inventory li ON i.id = li.item_id
        GROUP BY i.id
        ORDER BY i.created_at DESC
      `;
      const [rows] = await db.execute(sql);
      res.json({ inventory: rows });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search inventory items by name
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }
    
    const sql = 'SELECT * FROM inventory WHERE item_name LIKE ? ORDER BY item_name';
    const [rows] = await db.execute(sql, [`%${q}%`]);
    res.json({ inventory: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get inventory item by ID
router.get('/:id', async (req, res) => {
  try {
    const sql = 'SELECT * FROM inventory WHERE id = ?';
    const [rows] = await db.execute(sql, [req.params.id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ item: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get inventory item by SKU
router.get('/sku/:sku', async (req, res) => {
  try {
    const sql = 'SELECT * FROM inventory WHERE sku = ?';
    const [rows] = await db.execute(sql, [req.params.sku]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ item: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new inventory item
router.post('/', async (req, res) => {
  try {
    const { item_name, sku, category, supplier, buy_price, sell_price, quantity, min_stock, description, barcode, warranty_days, locationQuantities } = req.body;
    
    if (!item_name || !sku || buy_price === undefined || sell_price === undefined) {
      res.status(400).json({ error: 'Item name, SKU, buy price, and sell price are required' });
      return;
    }
    
    if (buy_price < 0 || sell_price < 0) {
      res.status(400).json({ error: 'Prices cannot be negative' });
      return;
    }
    
    if (quantity !== undefined && quantity < 0) {
      res.status(400).json({ error: 'Quantity cannot be negative' });
      return;
    }
    
    if (min_stock !== undefined && min_stock < 0) {
      res.status(400).json({ error: 'Minimum stock cannot be negative' });
      return;
    }
    
    const finalQuantity = quantity || 0;
    const finalMinStock = min_stock || 0;
    
    // Create the inventory item - using direct database connection
    console.log('Request body:', req.body);
    console.log('Extracted values:', { item_name, sku, buy_price, sell_price, finalQuantity, finalMinStock });
    const sql = 'INSERT INTO inventory (item_name, sku, buy_price, sell_price, unit_price, quantity, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const params = [item_name, sku, buy_price, sell_price, buy_price, finalQuantity, finalMinStock];
    console.log('SQL params:', params);
    const [result] = await db.execute(sql, params);
    
    const itemId = result.insertId;
    
    // If location quantities are provided, create location inventory records
    if (locationQuantities && typeof locationQuantities === 'object') {
      for (const [locationId, qty] of Object.entries(locationQuantities)) {
        const locationQuantity = parseInt(qty);
        if (locationQuantity > 0) {
          const locationSql = 'INSERT INTO location_inventory (location_id, item_id, quantity, min_stock, max_stock) VALUES (?, ?, ?, ?, ?)';
          await dbInstance.executeQuery(locationSql, [parseInt(locationId), itemId, locationQuantity, 5, 100]);
        }
      }
    }
      
    res.status(201).json({
      message: 'Item created successfully',
      item: { 
        id: itemId, 
        item_name, 
        sku, 
        category, 
        supplier, 
        buy_price, 
        sell_price, 
        quantity: finalQuantity, 
        min_stock: finalMinStock, 
        description, 
        barcode 
      }
    });
  } catch (err) {
    if (err.message.includes('Duplicate entry')) {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const { item_name, sku, category, supplier, buy_price, sell_price, quantity, min_stock, description, barcode, warranty_days } = req.body;
    
    if (!item_name || !sku || buy_price === undefined || sell_price === undefined) {
      res.status(400).json({ error: 'Item name, SKU, buy price, and sell price are required' });
      return;
    }
    
    if (buy_price < 0 || sell_price < 0) {
      res.status(400).json({ error: 'Prices cannot be negative' });
      return;
    }
    
    if (quantity !== undefined && quantity < 0) {
      res.status(400).json({ error: 'Quantity cannot be negative' });
      return;
    }
    
    if (min_stock !== undefined && min_stock < 0) {
      res.status(400).json({ error: 'Minimum stock cannot be negative' });
      return;
    }
    
    const finalQuantity = quantity !== undefined ? quantity : 0;
    const finalMinStock = min_stock !== undefined ? min_stock : 0;
    const sql = 'UPDATE inventory SET item_name = ?, sku = ?, category = ?, supplier = ?, buy_price = ?, sell_price = ?, quantity = ?, min_stock = ?, description = ?, barcode = ?, warranty_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    const [result] = await db.execute(sql, [item_name, sku, category, supplier, buy_price, sell_price, finalQuantity, finalMinStock, description, barcode, warranty_days || 0, req.params.id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    if (err.message.includes('Duplicate entry')) {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update item quantity (for stock management)
router.patch('/:id/quantity', async (req, res) => {
  try {
    const { quantity, operation } = req.body;
    
    if (quantity === undefined || !operation) {
      res.status(400).json({ error: 'Quantity and operation are required' });
      return;
    }
    
    if (!['add', 'subtract', 'set'].includes(operation)) {
      res.status(400).json({ error: 'Operation must be add, subtract, or set' });
      return;
    }
    
    if (quantity < 0) {
      res.status(400).json({ error: 'Quantity cannot be negative' });
      return;
    }
    
    let sql;
    let params;
    
    switch (operation) {
      case 'add':
        sql = 'UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        params = [quantity, req.params.id];
        break;
      case 'subtract':
        sql = 'UPDATE inventory SET quantity = GREATEST(0, quantity - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        params = [quantity, req.params.id];
        break;
      case 'set':
        sql = 'UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        params = [quantity, req.params.id];
        break;
    }
    
    const [result] = await db.execute(sql, params);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ message: 'Quantity updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete inventory item
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const sql = 'DELETE FROM inventory WHERE id = ?';
    
    const [result] = await db.execute(sql, [req.params.id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all locations
router.get('/locations', async (req, res) => {
  try {
    const sql = 'SELECT * FROM locations WHERE status = "active" ORDER BY name';
    const [rows] = await db.execute(sql);
    res.json({ locations: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get inventory quantities for a specific item across all locations
router.get('/:id/locations', async (req, res) => {
  try {
    const sql = `
      SELECT l.id as location_id, l.name as location_name, 
             COALESCE(li.quantity, 0) as quantity,
             COALESCE(li.min_stock, 0) as min_stock,
             COALESCE(li.max_stock, 0) as max_stock
      FROM locations l
      LEFT JOIN location_inventory li ON l.id = li.location_id AND li.item_id = ?
      WHERE l.status = 'active'
      ORDER BY l.name
    `;
    const [rows] = await db.execute(sql, [req.params.id]);
    res.json({ locations: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory quantity for a specific location
router.patch('/:id/location/:location_id/quantity', async (req, res) => {
  try {
    const { quantity, operation } = req.body;
    const { id: item_id, location_id } = req.params;
    
    if (quantity === undefined || !operation) {
      res.status(400).json({ error: 'Quantity and operation are required' });
      return;
    }
    
    if (!['add', 'subtract', 'set'].includes(operation)) {
      res.status(400).json({ error: 'Operation must be add, subtract, or set' });
      return;
    }
    
    if (quantity < 0) {
      res.status(400).json({ error: 'Quantity cannot be negative' });
      return;
    }
    
    // Check if location inventory record exists
    const checkSql = 'SELECT id, quantity FROM location_inventory WHERE item_id = ? AND location_id = ?';
    const [existing] = await db.execute(checkSql, [item_id, location_id]);
    
    let sql, params;
    
    if (existing.length === 0) {
      // Create new location inventory record
      if (operation === 'set' || operation === 'add') {
        sql = 'INSERT INTO location_inventory (item_id, location_id, quantity, min_stock, max_stock) VALUES (?, ?, ?, 5, 100)';
        params = [item_id, location_id, quantity];
      } else {
        res.status(400).json({ error: 'Cannot subtract from non-existent inventory' });
        return;
      }
    } else {
      // Update existing record
      switch (operation) {
        case 'add':
          sql = 'UPDATE location_inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND location_id = ?';
          params = [quantity, item_id, location_id];
          break;
        case 'subtract':
          sql = 'UPDATE location_inventory SET quantity = GREATEST(0, quantity - ?), updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND location_id = ?';
          params = [quantity, item_id, location_id];
          break;
        case 'set':
          sql = 'UPDATE location_inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND location_id = ?';
          params = [quantity, item_id, location_id];
          break;
      }
    }
    
    const [result] = await db.execute(sql, params);
    
    if (result.affectedRows === 0 && existing.length > 0) {
      res.status(404).json({ error: 'Location inventory not found' });
      return;
    }
    
    res.json({ message: 'Location inventory updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer inventory between locations
router.post('/:id/transfer', async (req, res) => {
  try {
    const { from_location_id, to_location_id, quantity, notes } = req.body;
    const item_id = req.params.id;
    
    if (!from_location_id || !to_location_id || !quantity) {
      res.status(400).json({ error: 'From location, to location, and quantity are required' });
      return;
    }
    
    if (quantity <= 0) {
      res.status(400).json({ error: 'Quantity must be positive' });
      return;
    }
    
    if (from_location_id === to_location_id) {
      res.status(400).json({ error: 'Cannot transfer to the same location' });
      return;
    }
    
    // Start transaction
    await db.execute('START TRANSACTION');
    
    try {
      // Check source location has enough inventory
      const checkSourceSql = 'SELECT quantity FROM location_inventory WHERE item_id = ? AND location_id = ?';
      const [sourceResult] = await db.execute(checkSourceSql, [item_id, from_location_id]);
      
      if (sourceResult.length === 0 || sourceResult[0].quantity < quantity) {
        await db.execute('ROLLBACK');
        res.status(400).json({ error: 'Insufficient inventory at source location' });
        return;
      }
      
      // Subtract from source location
      const subtractSql = 'UPDATE location_inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND location_id = ?';
      await db.execute(subtractSql, [quantity, item_id, from_location_id]);
      
      // Add to destination location (create record if doesn't exist)
      const checkDestSql = 'SELECT id FROM location_inventory WHERE item_id = ? AND location_id = ?';
      const [destResult] = await db.execute(checkDestSql, [item_id, to_location_id]);
      
      if (destResult.length === 0) {
        const insertSql = 'INSERT INTO location_inventory (item_id, location_id, quantity, min_stock, max_stock) VALUES (?, ?, ?, 5, 100)';
        await db.execute(insertSql, [item_id, to_location_id, quantity]);
      } else {
        const addSql = 'UPDATE location_inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND location_id = ?';
        await db.execute(addSql, [quantity, item_id, to_location_id]);
      }
      
      // Record the transfer
      const transferSql = 'INSERT INTO inventory_transfers (item_id, from_location_id, to_location_id, quantity, notes, transferred_by) VALUES (?, ?, ?, ?, ?, ?)';
      await db.execute(transferSql, [item_id, from_location_id, to_location_id, quantity, notes || '', 1]); // Default user ID 1
      
      await db.execute('COMMIT');
      res.json({ message: 'Inventory transferred successfully' });
      
    } catch (transferError) {
      await db.execute('ROLLBACK');
      throw transferError;
    }
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;