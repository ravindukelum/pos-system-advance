const express = require('express');
const Database = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
};

// PDF Generation function
const generatePDFReport = async (data, title, startDate, endDate, reportType) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      
      // Header
      doc.fontSize(20).text(title, { align: 'center' });
      doc.fontSize(12).text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);
      
      if (!data || data.length === 0) {
        doc.text('No data available for the selected period.');
        doc.end();
        return;
      }
      
      // Table headers
      const headers = Object.keys(data[0]);
      const startX = 50;
      const startY = doc.y;
      const columnWidth = (doc.page.width - 100) / headers.length;
      
      // Draw headers
      doc.fontSize(10).fillColor('black');
      headers.forEach((header, index) => {
        doc.text(header.replace(/_/g, ' ').toUpperCase(), 
          startX + (index * columnWidth), startY, 
          { width: columnWidth, align: 'left' }
        );
      });
      
      doc.moveDown(0.5);
      
      // Draw data rows
      data.slice(0, 50).forEach((row, rowIndex) => { // Limit to 50 rows for PDF
        const rowY = doc.y;
        
        headers.forEach((header, colIndex) => {
          let value = row[header];
          if (typeof value === 'number') {
            value = value.toFixed(2);
          }
          if (value === null || value === undefined) {
            value = 'N/A';
          }
          
          doc.text(String(value), 
            startX + (colIndex * columnWidth), rowY,
            { width: columnWidth, align: 'left' }
          );
        });
        
        doc.moveDown(0.3);
        
        // Add page break if needed
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }
      });
      
      // Footer
      doc.fontSize(8).text(
        `Report generated by QOrder POS System - Page ${doc.bufferedPageRange().count}`,
        50, doc.page.height - 50,
        { align: 'center' }
      );
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Enhanced Export functionality with PDF support
router.get('/export/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date, format = 'csv' } = req.query;
    
    let data = [];
    let filename = '';
    let reportTitle = '';
    
    switch (type) {
      case 'sales':
        const salesResult = await executeQuery(`
          SELECT 
            s.id,
            s.date,
            s.total_amount,
            s.payment_method,
            c.name as customer_name,
            s.tax_amount,
            s.discount_amount
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE s.date BETWEEN ? AND ?
          ORDER BY s.date DESC
        `, [start_date, end_date]);
        data = salesResult.rows || salesResult;
        filename = `sales_report_${start_date}_to_${end_date}`;
        reportTitle = 'Sales Report';
        break;
        
      case 'products':
        const productsResult = await executeQuery(`
          SELECT 
            i.item_name,
            i.sku,
            i.category,
            i.quantity,
            i.unit_price,
            i.buy_price,
            COALESCE(SUM(si.quantity), 0) as total_sold,
            COALESCE(SUM(si.line_total), 0) as total_revenue
          FROM inventory i
          LEFT JOIN sales_items si ON i.id = si.item_id
          LEFT JOIN sales s ON si.sale_id = s.id AND s.date BETWEEN ? AND ?
          GROUP BY i.id
          ORDER BY total_sold DESC
        `, [start_date, end_date]);
        data = productsResult.rows || productsResult;
        filename = `products_report_${start_date}_to_${end_date}`;
        reportTitle = 'Products Performance Report';
        break;
        
      case 'customers':
        const customersResult = await executeQuery(`
          SELECT 
            c.name,
            c.customer_code,
            c.phone,
            c.email,
            COUNT(s.id) as total_orders,
            SUM(s.total_amount) as total_spent,
            AVG(s.total_amount) as average_order,
            MAX(s.date) as last_purchase
          FROM customers c
          LEFT JOIN sales s ON c.id = s.customer_id AND s.date BETWEEN ? AND ?
          GROUP BY c.id
          ORDER BY total_spent DESC
        `, [start_date, end_date]);
        data = customersResult.rows || customersResult;
        filename = `customers_report_${start_date}_to_${end_date}`;
        reportTitle = 'Customer Analytics Report';
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }
    
    if (format === 'csv') {
      // Generate CSV
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else if (format === 'pdf') {
      // Generate PDF
      const pdfBuffer = await generatePDFReport(data, reportTitle, start_date, end_date, type);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.json({ data, filename });
    }
    
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PDF Export endpoint
router.get('/exportPDF/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;
    
    // Reuse the export logic but force PDF format
    req.query.format = 'pdf';
    return router.handle(req, res);
  } catch (err) {
    console.error('PDF Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Enhanced analytics endpoint
router.get('/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    // Get comprehensive analytics
    const summarySQL = `
      SELECT 
        COUNT(DISTINCT s.id) as total_transactions,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as average_transaction,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        SUM(s.tax_amount) as total_tax,
        SUM(s.discount_amount) as total_discounts
      FROM sales s
      ${dateFilter}
    `;
    
    const result = await executeQuery(summarySQL, params);
    const summary = (result.rows || result)[0];
    
    // Calculate growth rate (compare with previous period)
    let growthRate = 0;
    if (start_date && end_date) {
      const daysDiff = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
      const prevStartDate = new Date(start_date);
      prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
      const prevEndDate = new Date(start_date);
      
      const prevPeriodSQL = `
        SELECT SUM(s.total_amount) as prev_revenue
        FROM sales s
        WHERE s.date BETWEEN ? AND ?
      `;
      
      const prevResult = await executeQuery(prevPeriodSQL, [prevStartDate.toISOString().split('T')[0], prevEndDate.toISOString().split('T')[0]]);
      const prevRevenue = (prevResult.rows || prevResult)[0]?.prev_revenue || 0;
      
      if (prevRevenue > 0) {
        growthRate = ((summary.total_revenue - prevRevenue) / prevRevenue) * 100;
      }
    }
    
    // Calculate retention rate (simplified)
    const retentionSQL = `
      SELECT 
        COUNT(DISTINCT CASE WHEN order_count > 1 THEN customer_id END) as returning_customers,
        COUNT(DISTINCT customer_id) as total_customers
      FROM (
        SELECT customer_id, COUNT(*) as order_count
        FROM sales s
        ${dateFilter}
        GROUP BY customer_id
      ) customer_orders
    `;
    
    const retentionResult = await executeQuery(retentionSQL, params);
    const retentionData = (retentionResult.rows || retentionResult)[0];
    const retentionRate = retentionData.total_customers > 0 ? 
      (retentionData.returning_customers / retentionData.total_customers) * 100 : 0;
    
    // Calculate profit margin
    const profitSQL = `
      SELECT 
        SUM(si.line_total) as total_revenue,
        SUM(si.quantity * i.buy_price) as total_cost
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN inventory i ON si.item_id = i.id
      ${dateFilter}
    `;
    
    const profitResult = await executeQuery(profitSQL, params);
    const profitData = (profitResult.rows || profitResult)[0];
    const profitMargin = profitData.total_revenue > 0 ? 
      ((profitData.total_revenue - profitData.total_cost) / profitData.total_revenue) * 100 : 0;
    
    res.json({
      summary: {
        ...summary,
        growth_rate: growthRate,
        retention_rate: retentionRate,
        profit_margin: profitMargin
      }
    });
    
  } catch (err) {
    console.error('Analytics summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Categories analytics
router.get('/analytics/categories', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    // First get the total revenue for percentage calculation
    const totalRevenueSQL = `
      SELECT COALESCE(SUM(si.line_total), 0) as total_revenue
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      ${dateFilter}
    `;
    
    const totalResult = await executeQuery(totalRevenueSQL, params);
    const totalRevenue = (totalResult.rows || totalResult)[0].total_revenue || 1; // Avoid division by zero
    
    // Now get categories data
    const categoriesSQL = `
      SELECT 
        i.category as name,
        SUM(si.line_total) as revenue,
        COUNT(si.id) as items_sold
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN inventory i ON si.item_id = i.id
      ${dateFilter}
      GROUP BY i.category
      ORDER BY SUM(si.line_total) DESC
    `;
    
    const result = await executeQuery(categoriesSQL, params);
    const categoriesData = result.rows || result;
    
    // Calculate percentage for each category
    const categories = categoriesData.map(category => ({
      ...category,
      percentage: totalRevenue > 0 ? (parseFloat(category.revenue) / parseFloat(totalRevenue) * 100) : 0
    }));
    
    res.json({ categories });
    
  } catch (err) {
    console.error('Categories analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;