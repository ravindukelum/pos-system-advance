const express = require('express');
const database = require('../database/db');
const router = express.Router();

// Create database instance
const dbInstance = new database();
let dbInitialized = false;

// Initialize database connection
dbInstance.initialize().then(() => {
  dbInitialized = true;
}).catch(err => {
  console.error('Failed to initialize database in integrations route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  if (!dbInitialized) {
    throw new Error('Database not initialized');
  }
  
  const isPostgreSQL = process.env.DATABASE_URL ? true : false;
  if (!isPostgreSQL && sql.includes('$')) {
    let paramIndex = 1;
    sql = sql.replace(/\$\d+/g, () => '?');
  }
  
  return await dbInstance.executeQuery(sql, params);
};

// QuickBooks integration endpoints
router.get('/quickbooks/sync', async (req, res) => {
  try {
    // Get sales data for accounting sync
    const salesSql = `
      SELECT s.id, s.invoice, s.date, s.total_amount, s.tax_amount,
             si.item_name, si.quantity, si.unit_price, si.line_total
      FROM sales s
      JOIN sales_items si ON s.id = si.sale_id
      WHERE s.synced_to_accounting = 0
      ORDER BY s.created_at DESC
    `;
    
    const result = await executeQuery(salesSql);
    const rows = result.rows || result;
    
    // Group sales items by sale
    const salesData = {};
    rows.forEach(row => {
      if (!salesData[row.id]) {
        salesData[row.id] = {
          id: row.id,
          invoice: row.invoice,
          date: row.date,
          total_amount: row.total_amount,
          tax_amount: row.tax_amount,
          items: []
        };
      }
      salesData[row.id].items.push({
        item_name: row.item_name,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_total: row.line_total
      });
    });
    
    res.json({
      message: 'Sales data ready for QuickBooks sync',
      sales: Object.values(salesData),
      total_sales: Object.keys(salesData).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WooCommerce integration endpoints
router.get('/woocommerce/products', async (req, res) => {
  try {
    const sql = `
      SELECT id, item_name, sku, sell_price, quantity, 
             category, description, image_url, status
      FROM inventory 
      WHERE status = 'active'
      ORDER BY item_name
    `;
    
    const result = await executeQuery(sql);
    const rows = result.rows || result;
    
    // Format for WooCommerce
    const products = rows.map(item => ({
      id: item.id,
      name: item.item_name,
      sku: item.sku,
      regular_price: item.sell_price,
      stock_quantity: item.quantity,
      categories: item.category ? [{ name: item.category }] : [],
      description: item.description || '',
      images: item.image_url ? [{ src: item.image_url }] : [],
      status: item.status === 'active' ? 'publish' : 'draft',
      manage_stock: true,
      type: 'simple'
    }));
    
    res.json({
      message: 'Products ready for WooCommerce sync',
      products: products,
      total_products: products.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shopify integration endpoints
router.get('/shopify/inventory', async (req, res) => {
  try {
    const sql = `
      SELECT id, item_name, sku, sell_price, quantity, 
             buy_price, category, brand, description
      FROM inventory 
      WHERE status = 'active'
      ORDER BY item_name
    `;
    
    const result = await executeQuery(sql);
    const rows = result.rows || result;
    
    // Format for Shopify
    const products = rows.map(item => ({
      title: item.item_name,
      vendor: item.brand || 'Default',
      product_type: item.category || 'General',
      variants: [{
        sku: item.sku,
        price: item.sell_price,
        cost: item.buy_price,
        inventory_quantity: item.quantity,
        inventory_management: 'shopify'
      }],
      body_html: item.description || '',
      status: 'active'
    }));
    
    res.json({
      message: 'Inventory ready for Shopify sync',
      products: products,
      total_products: products.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe payment webhook
router.post('/stripe/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (type === 'payment_intent.succeeded') {
      const paymentIntent = data.object;
      
      // Update payment record
      const updateSql = `
        UPDATE payments 
        SET status = 'completed', 
            stripe_payment_id = ?,
            updated_at = NOW()
        WHERE stripe_payment_intent_id = ?
      `;
      
      await executeQuery(updateSql, [paymentIntent.id, paymentIntent.id]);
      
      res.json({ received: true });
    } else {
      res.json({ received: true, ignored: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Square integration
router.get('/square/payments', async (req, res) => {
  try {
    const sql = `
      SELECT p.*, s.invoice, s.total_amount
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      WHERE p.payment_method = 'card' 
      AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY p.created_at DESC
    `;
    
    const result = await executeQuery(sql);
    const rows = result.rows || result;
    
    res.json({
      message: 'Payment data for Square integration',
      payments: rows,
      total_payments: rows.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mailchimp customer sync
router.get('/mailchimp/customers', async (req, res) => {
  try {
    const sql = `
      SELECT name, email, phone, total_spent, loyalty_points,
             DATE(created_at) as signup_date
      FROM customers 
      WHERE email IS NOT NULL AND email != ''
      AND status = 'active'
      ORDER BY created_at DESC
    `;
    
    const result = await executeQuery(sql);
    const rows = result.rows || result;
    
    // Format for Mailchimp
    const members = rows.map(customer => ({
      email_address: customer.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: customer.name.split(' ')[0] || '',
        LNAME: customer.name.split(' ').slice(1).join(' ') || '',
        PHONE: customer.phone || '',
        TOTALSPENT: customer.total_spent || 0,
        LOYALPTS: customer.loyalty_points || 0,
        SIGNUPDATE: customer.signup_date
      }
    }));
    
    res.json({
      message: 'Customer data ready for Mailchimp sync',
      members: members,
      total_members: members.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic webhook receiver
router.post('/webhook/:integration', async (req, res) => {
  const { integration } = req.params;
  const webhookData = req.body;
  
  try {
    // Log webhook for debugging
    const logSql = `
      INSERT INTO integration_logs (integration_name, webhook_data, status)
      VALUES (?, ?, 'received')
    `;
    
    await executeQuery(logSql, [integration, JSON.stringify(webhookData)]);
    
    res.json({ 
      message: `Webhook received for ${integration}`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;