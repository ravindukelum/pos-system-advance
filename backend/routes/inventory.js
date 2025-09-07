const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Database = require('../database/db');
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

// Get all inventory items
router.get('/', async (req, res) => {
  try {
    const sql = 'SELECT * FROM inventory ORDER BY created_at DESC';
    const [rows] = await db.execute(sql);
    res.json({ inventory: rows });
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
    
    const finalQuantity = quantity || 0;
    const finalMinStock = min_stock || 0;
    const sql = 'INSERT INTO inventory (item_name, sku, category, supplier, buy_price, sell_price, quantity, min_stock, description, barcode, warranty_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    
    const [result] = await db.execute(sql, [item_name, sku, category, supplier, buy_price, sell_price, finalQuantity, finalMinStock, description, barcode, warranty_days || 0]);
    
    res.status(201).json({
      message: 'Item created successfully',
      item: { 
        id: result.insertId, 
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
router.delete('/:id', async (req, res) => {
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

module.exports = router;