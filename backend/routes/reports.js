const express = require('express');
const Database = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Create database instance
const dbInstance = new Database();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in reports route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  return await dbInstance.executeQuery(sql, params);
};

// Sales Analytics
router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    
    let dateFilter = '';
    let groupByClause = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    switch (group_by) {
      case 'day':
        groupByClause = 'GROUP BY s.date';
        break;
      case 'week':
        groupByClause = 'GROUP BY YEAR(s.date), WEEK(s.date)';
        break;
      case 'month':
        groupByClause = 'GROUP BY YEAR(s.date), MONTH(s.date)';
        break;
      default:
        groupByClause = 'GROUP BY s.date';
    }
    
    const salesAnalyticsSQL = `
      SELECT 
        s.date,
        COUNT(*) as total_transactions,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as average_transaction,
        SUM(s.tax_amount) as total_tax,
        SUM(s.discount_amount) as total_discounts,
        COUNT(CASE WHEN s.status = 'paid' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN s.status = 'partial' THEN 1 END) as partial_transactions,
        COUNT(CASE WHEN s.status = 'unpaid' THEN 1 END) as unpaid_transactions
      FROM sales s
      ${dateFilter}
      ${groupByClause}
      ORDER BY s.date DESC
    `;
    
    const result = await executeQuery(salesAnalyticsSQL, params);
    const analytics = result.rows || result;
    
    res.json({ sales_analytics: analytics });
  } catch (err) {
    console.error('Sales analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Product Performance Report
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, limit = 50 } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    params.push(parseInt(limit));
    
    const productPerformanceSQL = `
      SELECT 
        i.id,
        i.item_name,
        i.sku,
        i.category,
        SUM(si.quantity) as total_sold,
        SUM(si.line_total) as total_revenue,
        AVG(si.unit_price) as average_price,
        COUNT(DISTINCT s.id) as transaction_count,
        (SUM(si.line_total) - (SUM(si.quantity) * i.buy_price)) as profit,
        ((SUM(si.line_total) - (SUM(si.quantity) * i.buy_price)) / SUM(si.line_total) * 100) as profit_margin
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN inventory i ON si.item_id = i.id
      ${dateFilter}
      GROUP BY i.id, i.item_name, i.sku, i.category, i.buy_price
      ORDER BY total_revenue DESC
      LIMIT ?
    `;
    
    const result = await executeQuery(productPerformanceSQL, params);
    const products = result.rows || result;
    
    res.json({ product_performance: products });
  } catch (err) {
    console.error('Product performance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Customer Analytics
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, limit = 50 } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    params.push(parseInt(limit));
    
    const customerAnalyticsSQL = `
      SELECT 
        c.id,
        c.name,
        c.customer_code,
        COUNT(s.id) as total_orders,
        SUM(s.total_amount) as total_spent,
        AVG(s.total_amount) as average_order,
        MAX(s.date) as last_purchase,
        MIN(s.date) as first_purchase,
        c.loyalty_points
      FROM customers c
      JOIN sales s ON c.id = s.customer_id
      ${dateFilter}
      GROUP BY c.id, c.name, c.customer_code, c.loyalty_points
      ORDER BY total_spent DESC
      LIMIT ?
    `;
    
    const result = await executeQuery(customerAnalyticsSQL, params);
    const customers = result.rows || result;
    
    res.json({ customer_analytics: customers });
  } catch (err) {
    console.error('Customer analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Inventory Report
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const { status = 'all', category } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status !== 'all') {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }
    
    if (category) {
      whereClause += ' AND i.category = ?';
      params.push(category);
    }
    
    const inventoryReportSQL = `
      SELECT 
        i.*,
        COALESCE(sales_data.total_sold, 0) as total_sold,
        COALESCE(sales_data.total_revenue, 0) as total_revenue,
        (i.quantity * i.buy_price) as inventory_value,
        CASE 
          WHEN i.quantity <= i.min_stock THEN 'low_stock'
          WHEN i.quantity >= i.max_stock THEN 'overstock'
          ELSE 'normal'
        END as stock_status
      FROM inventory i
      LEFT JOIN (
        SELECT 
          si.item_id,
          SUM(si.quantity) as total_sold,
          SUM(si.line_total) as total_revenue
        FROM sales_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY si.item_id
      ) sales_data ON i.id = sales_data.item_id
      ${whereClause}
      ORDER BY i.item_name
    `;
    
    const result = await executeQuery(inventoryReportSQL, params);
    const inventory = result.rows || result;
    
    // Calculate summary statistics
    const summarySQL = `
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(quantity * buy_price) as total_value,
        COUNT(CASE WHEN quantity <= min_stock THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_items,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_items
      FROM inventory
      ${whereClause}
    `;
    
    const summaryResult = await executeQuery(summarySQL, params);
    const summary = (summaryResult.rows || summaryResult)[0];
    
    res.json({ 
      inventory_report: inventory,
      summary
    });
  } catch (err) {
    console.error('Inventory report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Financial Summary
router.get('/financial', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    // Revenue and Profit Analysis
    const financialSQL = `
      SELECT 
        SUM(s.total_amount) as total_revenue,
        SUM(s.paid_amount) as total_collected,
        SUM(s.total_amount - s.paid_amount) as outstanding_amount,
        SUM(s.tax_amount) as total_tax_collected,
        SUM(s.discount_amount) as total_discounts_given,
        COUNT(*) as total_transactions,
        AVG(s.total_amount) as average_transaction_value
      FROM sales s
      ${dateFilter}
    `;
    
    const financialResult = await executeQuery(financialSQL, params);
    const financial = (financialResult.rows || financialResult)[0];
    
    // Cost of Goods Sold (COGS) calculation
    const cogsSQL = `
      SELECT 
        SUM(si.quantity * i.buy_price) as total_cogs
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN inventory i ON si.item_id = i.id
      ${dateFilter}
    `;
    
    const cogsResult = await executeQuery(cogsSQL, params);
    const cogs = (cogsResult.rows || cogsResult)[0];
    
    // Calculate profit
    const gross_profit = parseFloat(financial.total_revenue || 0) - parseFloat(cogs.total_cogs || 0);
    const profit_margin = financial.total_revenue > 0 ? (gross_profit / financial.total_revenue * 100) : 0;
    
    // Payment method breakdown
    const paymentMethodSQL = `
      SELECT 
        p.payment_method,
        COUNT(*) as transaction_count,
        SUM(p.amount) as total_amount
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      ${dateFilter}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `;
    
    const paymentResult = await executeQuery(paymentMethodSQL, params);
    const payment_methods = paymentResult.rows || paymentResult;
    
    res.json({ 
      financial_summary: {
        ...financial,
        total_cogs: parseFloat(cogs.total_cogs || 0),
        gross_profit,
        profit_margin: parseFloat(profit_margin.toFixed(2))
      },
      payment_methods
    });
  } catch (err) {
    console.error('Financial report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Tax Report
router.get('/tax', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date, tax_rate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (tax_rate) {
      dateFilter += dateFilter ? ' AND' : 'WHERE';
      dateFilter += ' s.tax_amount / s.subtotal * 100 = ?';
      params.push(parseFloat(tax_rate));
    }
    
    const taxReportSQL = `
      SELECT 
        s.date,
        s.invoice,
        s.customer_name,
        s.subtotal,
        s.tax_amount,
        (s.tax_amount / s.subtotal * 100) as tax_rate,
        s.total_amount
      FROM sales s
      ${dateFilter}
      ORDER BY s.date DESC
    `;
    
    const result = await executeQuery(taxReportSQL, params);
    const tax_transactions = result.rows || result;
    
    // Tax summary
    const taxSummarySQL = `
      SELECT 
        SUM(s.tax_amount) as total_tax_collected,
        AVG(s.tax_amount / s.subtotal * 100) as average_tax_rate,
        COUNT(*) as taxable_transactions
      FROM sales s
      ${dateFilter}
    `;
    
    const summaryResult = await executeQuery(taxSummarySQL, params);
    const summary = (summaryResult.rows || summaryResult)[0];
    
    res.json({ 
      tax_summary: summary,
      tax_transactions
    });
  } catch (err) {
    console.error('Tax report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export data (CSV format)
router.get('/export/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;
    
    let sql = '';
    let filename = '';
    const params = [];
    
    let dateFilter = '';
    if (start_date && end_date) {
      dateFilter = 'WHERE date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    switch (type) {
      case 'sales':
        sql = `
          SELECT 
            invoice, date, customer_name, customer_phone,
            subtotal, tax_amount, discount_amount, total_amount,
            paid_amount, status, created_at
          FROM sales
          ${dateFilter}
          ORDER BY date DESC
        `;
        filename = 'sales_export.csv';
        break;
        
      case 'inventory':
        sql = `
          SELECT 
            item_name, sku, category, brand, supplier,
            buy_price, sell_price, quantity, min_stock,
            status, created_at
          FROM inventory
          ORDER BY item_name
        `;
        filename = 'inventory_export.csv';
        break;
        
      case 'customers':
        sql = `
          SELECT 
            customer_code, name, email, phone, address,
            loyalty_points, total_spent, discount_percentage,
            status, created_at
          FROM customers
          ORDER BY name
        `;
        filename = 'customers_export.csv';
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }
    
    const result = await executeQuery(sql, params);
    const data = result.rows || result;
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }
    
    // Convert to CSV
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'string' && value.includes(',')) {
          value = `\"${value}\"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
    
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;