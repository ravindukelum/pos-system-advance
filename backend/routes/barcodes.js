const express = require('express');
const QRCode = require('qrcode');
const Database = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create database instance
const dbInstance = Database.getInstance();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in barcodes route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  return await dbInstance.executeQuery(sql, params);
};

// Generate barcode number
const generateBarcode = () => {
  // Generate a 13-digit EAN-13 barcode
  const prefix = '200'; // Internal use prefix
  const company = '1234'; // Company identifier
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  
  // Calculate check digit
  const digits = (prefix + company + random).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return prefix + company + random + checkDigit;
};

// Generate QR code for item
router.post('/qr/:itemId', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.itemId;
    
    // Get item details
    const getItemSQL = 'SELECT * FROM inventory WHERE id = ?';
    const itemResult = await executeQuery(getItemSQL, [itemId]);
    const items = itemResult.rows || itemResult;
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = items[0];
    
    // Create QR code data
    const qrData = {
      type: 'inventory_item',
      id: item.id,
      sku: item.sku,
      name: item.item_name,
      price: item.sell_price,
      barcode: item.barcode
    };
    
    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Update item with QR code
    const updateSQL = 'UPDATE inventory SET qr_code = ?, updated_at = NOW() WHERE id = ?';
    await executeQuery(updateSQL, [qrCodeDataURL, itemId]);
    
    res.json({
      message: 'QR code generated successfully',
      qr_code: qrCodeDataURL,
      data: qrData
    });
    
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate barcode for item
router.post('/barcode/:itemId', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.itemId;
    
    // Get item details
    const getItemSQL = 'SELECT * FROM inventory WHERE id = ?';
    const itemResult = await executeQuery(getItemSQL, [itemId]);
    const items = itemResult.rows || itemResult;
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = items[0];
    
    // Generate new barcode if not exists
    let barcode = item.barcode;
    if (!barcode) {
      barcode = generateBarcode();
      
      // Update item with barcode
      const updateSQL = 'UPDATE inventory SET barcode = ?, updated_at = NOW() WHERE id = ?';
      await executeQuery(updateSQL, [barcode, itemId]);
    }
    
    res.json({
      message: 'Barcode generated successfully',
      barcode: barcode,
      item: {
        id: item.id,
        sku: item.sku,
        name: item.item_name,
        price: item.sell_price
      }
    });
    
  } catch (error) {
    console.error('Generate barcode error:', error);
    res.status(500).json({ error: 'Failed to generate barcode' });
  }
});

// Lookup item by barcode/QR code
router.get('/lookup/:code', authenticateToken, async (req, res) => {
  try {
    const code = req.params.code;
    
    // First try barcode lookup
    let getItemSQL = 'SELECT * FROM inventory WHERE barcode = ? AND status = ?';
    let itemResult = await executeQuery(getItemSQL, [code, 'active']);
    let items = itemResult.rows || itemResult;
    
    if (items.length === 0) {
      // Try SKU lookup
      getItemSQL = 'SELECT * FROM inventory WHERE sku = ? AND status = ?';
      itemResult = await executeQuery(getItemSQL, [code, 'active']);
      items = itemResult.rows || itemResult;
    }
    
    if (items.length === 0) {
      // Try QR code data lookup (if it's JSON)
      try {
        const qrData = JSON.parse(code);
        if (qrData.type === 'inventory_item' && qrData.id) {
          getItemSQL = 'SELECT * FROM inventory WHERE id = ? AND status = ?';
          itemResult = await executeQuery(getItemSQL, [qrData.id, 'active']);
          items = itemResult.rows || itemResult;
        }
      } catch (e) {
        // Not JSON, continue
      }
    }
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = items[0];
    
    res.json({
      item: {
        id: item.id,
        sku: item.sku,
        barcode: item.barcode,
        name: item.item_name,
        sell_price: item.sell_price,
        buy_price: item.buy_price,
        quantity: item.quantity,
        category: item.category,
        brand: item.brand,
        unit: item.unit,
        tax_rate: item.tax_rate,
        description: item.description
      }
    });
    
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup item' });
  }
});

// Generate QR code for sale/invoice
router.post('/sale-qr/:saleId', authenticateToken, async (req, res) => {
  try {
    const saleId = req.params.saleId;
    
    // Get sale details
    const getSaleSQL = 'SELECT * FROM sales WHERE id = ?';
    const saleResult = await executeQuery(getSaleSQL, [saleId]);
    const sales = saleResult.rows || saleResult;
    
    if (sales.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const sale = sales[0];
    
    // Create QR code data for sale
    const qrData = {
      type: 'sale_receipt',
      invoice: sale.invoice,
      date: sale.date,
      total: sale.total_amount,
      customer: sale.customer_name,
      status: sale.status
    };
    
    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    res.json({
      message: 'Sale QR code generated successfully',
      qr_code: qrCodeDataURL,
      data: qrData
    });
    
  } catch (error) {
    console.error('Generate sale QR code error:', error);
    res.status(500).json({ error: 'Failed to generate sale QR code' });
  }
});

// Bulk generate barcodes for items without barcodes
router.post('/bulk-generate', authenticateToken, async (req, res) => {
  try {
    // Get items without barcodes
    const getItemsSQL = 'SELECT id FROM inventory WHERE (barcode IS NULL OR barcode = \'\') AND status = ?';
    const itemsResult = await executeQuery(getItemsSQL, ['active']);
    const items = itemsResult.rows || itemsResult;
    
    const generated = [];
    
    for (const item of items) {
      const barcode = generateBarcode();
      
      // Update item with barcode
      const updateSQL = 'UPDATE inventory SET barcode = ?, updated_at = NOW() WHERE id = ?';
      await executeQuery(updateSQL, [barcode, item.id]);
      
      generated.push({
        item_id: item.id,
        barcode: barcode
      });
    }
    
    res.json({
      message: `Generated barcodes for ${generated.length} items`,
      generated: generated
    });
    
  } catch (error) {
    console.error('Bulk generate barcodes error:', error);
    res.status(500).json({ error: 'Failed to generate barcodes' });
  }
});

module.exports = router;