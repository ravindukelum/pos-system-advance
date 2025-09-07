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
  console.error('Failed to initialize database in sales route:', err);
});

// Generate invoice number
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = String(date.getTime()).slice(-6);
  return `INV-${year}${month}${day}-${time}`;
}

// Get all sales with items
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT 
        s.*,
        COUNT(si.id) as item_count,
        GROUP_CONCAT(CONCAT(si.item_name, ' (x', si.quantity, ')')) as items_summary
      FROM sales s 
      LEFT JOIN sales_items si ON s.id = si.sale_id 
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;
    const [rows] = await db.execute(sql);
    res.json({ sales: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sales by status
router.get('/status/:status', async (req, res) => {
  const { status } = req.params;
  
  if (!['paid', 'unpaid', 'partial'].includes(status)) {
    res.status(400).json({ error: 'Status must be paid, unpaid, or partial' });
    return;
  }
  
  try {
    const sql = `
      SELECT 
        s.*,
        COUNT(si.id) as item_count,
        GROUP_CONCAT(CONCAT(si.item_name, ' (x', si.quantity, ')')) as items_summary
      FROM sales s 
      LEFT JOIN sales_items si ON s.id = si.sale_id 
      WHERE s.status = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;
    const [rows] = await db.execute(sql, [status]);
    res.json({ sales: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sale by ID with all items
router.get('/:id', async (req, res) => {
  try {
    const saleSql = 'SELECT * FROM sales WHERE id = ?';
    const itemsSql = `
      SELECT si.*, i.warranty_days 
      FROM sales_items si 
      LEFT JOIN inventory i ON si.item_id = i.id 
      WHERE si.sale_id = ? 
      ORDER BY si.created_at
    `;
    
    const [saleRows] = await db.execute(saleSql, [req.params.id]);
    const sale = saleRows[0];
    
    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }
    
    const [items] = await db.execute(itemsSql, [req.params.id]);
    
    res.json({ 
      sale: {
        ...sale,
        items: items
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sale by invoice with all items
router.get('/invoice/:invoice', async (req, res) => {
  try {
    const saleSql = 'SELECT * FROM sales WHERE invoice = ?';
    
    const [saleRows] = await db.execute(saleSql, [req.params.invoice]);
    const sale = saleRows[0];
    
    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }
    
    const itemsSql = 'SELECT * FROM sales_items WHERE sale_id = ? ORDER BY created_at';
    const [items] = await db.execute(itemsSql, [sale.id]);
    
    res.json({ 
      sale: {
        ...sale,
        items: items
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new sale with multiple items
router.post('/', async (req, res) => {
  const { 
    items, 
    customer_name, 
    customer_phone, 
    tax_rate = 0, 
    discount_amount = 0, 
    paid_amount = 0, 
    date 
  } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Items array is required and must not be empty' });
    return;
  }
  
  // Validate each item
  for (const item of items) {
    if (!item.item_id || !item.quantity || item.quantity <= 0) {
      res.status(400).json({ error: 'Each item must have item_id and positive quantity' });
      return;
    }
  }
  
  try {
    await db.beginTransaction();
    
    const invoice = generateInvoiceNumber();
    const saleDate = date || new Date().toISOString().split('T')[0];
    
    let subtotal = 0;
    let processedItems = [];
    
    // Process each item
    for (const item of items) {
      const getItemSql = 'SELECT * FROM inventory WHERE id = ?';
      const [inventoryRows] = await db.execute(getItemSql, [item.item_id]);
      const inventoryItem = inventoryRows[0];
      
      if (!inventoryItem) {
        await db.rollback();
        res.status(404).json({ error: `Item not found: ${item.item_id}` });
        return;
      }
      
      if (inventoryItem.quantity < item.quantity) {
        await db.rollback();
        res.status(400).json({ 
          error: `Insufficient stock for ${inventoryItem.item_name}`, 
          available: inventoryItem.quantity, 
          requested: item.quantity 
        });
        return;
      }
      
      const lineTotal = inventoryItem.sell_price * item.quantity;
      subtotal += lineTotal;
      
      processedItems.push({
        item_id: item.item_id,
        item_name: inventoryItem.item_name,
        sku: inventoryItem.sku,
        quantity: item.quantity,
        unit_price: inventoryItem.sell_price,
        line_total: lineTotal
      });
    }
    
    const taxAmount = subtotal * (tax_rate / 100);
    const totalAmount = subtotal + taxAmount - discount_amount;
    
    // Determine status
    let status = 'unpaid';
    if (paid_amount >= totalAmount) {
      status = 'paid';
    } else if (paid_amount > 0) {
      status = 'partial';
    }
    
    // Insert sale header
    const insertSaleSql = `
      INSERT INTO sales (
        invoice, date, customer_name, customer_phone, 
        subtotal, tax_amount, discount_amount, total_amount, 
        paid_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [saleResult] = await db.execute(insertSaleSql, [
      invoice, saleDate, customer_name, customer_phone,
      subtotal, taxAmount, discount_amount, totalAmount,
      paid_amount, status
    ]);
    
    const saleId = saleResult.insertId;
    
    // Insert sale items and update inventory
    for (const saleItem of processedItems) {
      const insertItemSql = `
        INSERT INTO sales_items (
          sale_id, item_id, item_name, sku, 
          quantity, unit_price, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await db.execute(insertItemSql, [
        saleId, saleItem.item_id,
        saleItem.item_name, saleItem.sku, saleItem.quantity,
        saleItem.unit_price, saleItem.line_total
      ]);
      
      // Update inventory
      const updateInventorySql = 'UPDATE inventory SET quantity = quantity - ? WHERE id = ?';
      await db.execute(updateInventorySql, [saleItem.quantity, saleItem.item_id]);
    }
    
    await db.commit();
    
    res.status(201).json({
      message: 'Sale created successfully',
      sale: {
        id: saleId,
        invoice,
        date: saleDate,
        customer_name,
        customer_phone,
        subtotal,
        tax_amount: taxAmount,
        discount_amount,
        total_amount: totalAmount,
        paid_amount,
        status,
        items: processedItems
      }
    });
  } catch (err) {
    await db.rollback();
    res.status(500).json({ error: err.message });
  }
});

// Update sale status and payment
router.patch('/:id/payment', async (req, res) => {
  const { paid_amount } = req.body;
  
  if (paid_amount === undefined || paid_amount < 0) {
    res.status(400).json({ error: 'Valid paid_amount is required' });
    return;
  }
  
  try {
    // Get current sale
    const getSaleSql = 'SELECT * FROM sales WHERE id = ?';
    const [saleRows] = await db.execute(getSaleSql, [req.params.id]);
    const sale = saleRows[0];
    
    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }
    
    // Determine new status
    let status = 'unpaid';
    if (paid_amount >= sale.total_amount) {
      status = 'paid';
    } else if (paid_amount > 0) {
      status = 'partial';
    }
    
    const updateSql = 'UPDATE sales SET paid_amount = ?, status = ? WHERE id = ?';
    
    await db.execute(updateSql, [paid_amount, status, req.params.id]);
    
    res.json({ 
      message: 'Payment updated successfully',
      paid_amount,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete sale (with all items)
router.delete('/:id', async (req, res) => {
  try {
    await db.beginTransaction();
    
    // Get sale items first to restore inventory
    const getItemsSql = 'SELECT * FROM sales_items WHERE sale_id = ?';
    const [items] = await db.execute(getItemsSql, [req.params.id]);
    
    // Delete related payment records first
    const deletePaymentsSql = 'DELETE FROM payments WHERE sale_id = ?';
    await db.execute(deletePaymentsSql, [req.params.id]);
    
    // Delete sale (cascade will delete items)
    const deleteSql = 'DELETE FROM sales WHERE id = ?';
    const [result] = await db.execute(deleteSql, [req.params.id]);
    
    if (result.affectedRows === 0) {
      await db.rollback();
      res.status(404).json({ error: 'Sale not found' });
      return;
    }
    
    // Restore inventory for each item
    for (const item of items) {
      const restoreInventorySql = 'UPDATE inventory SET quantity = quantity + ? WHERE id = ?';
      await db.execute(restoreInventorySql, [item.quantity, item.item_id]);
    }
    
    await db.commit();
    
    res.json({ message: 'Sale deleted successfully' });
  } catch (err) {
    await db.rollback();
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;