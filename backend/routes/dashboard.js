const express = require('express');
const Database = require('../database/db');
const router = express.Router();

// Create database instance
const dbInstance = Database.getInstance();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in dashboard route:', err);
});

// Get dashboard overview statistics
router.get('/overview', async (req, res) => {
  try {
    const stats = {};
    
    // Get total partners count
    const partnersCountSql = 'SELECT COUNT(*) as count FROM partners';
    const [partnersResult] = await db.execute(partnersCountSql);
    stats.totalPartners = partnersResult[0].count;
    
    // Get investors and suppliers count
    const partnerTypesSql = 'SELECT type, COUNT(*) as count FROM partners GROUP BY type';
    const [partnerTypes] = await db.execute(partnerTypesSql);
    
    stats.investors = 0;
    stats.suppliers = 0;
    partnerTypes.forEach(type => {
      if (type.type === 'investor') stats.investors = type.count;
      if (type.type === 'supplier') stats.suppliers = type.count;
    });
    
    // Get total investments
    const investmentsSql = `
      SELECT 
        SUM(CASE WHEN type = 'invest' THEN amount ELSE 0 END) as total_investments,
        SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as total_withdrawals,
        COUNT(*) as total_transactions
      FROM investments
      `;
    const [investmentsResult] = await db.execute(investmentsSql);
    
    stats.totalInvestments = investmentsResult[0].total_investments || 0;
    stats.totalWithdrawals = investmentsResult[0].total_withdrawals || 0;
    stats.netInvestments = stats.totalInvestments - stats.totalWithdrawals;
    stats.totalInvestmentTransactions = investmentsResult[0].total_transactions;
    
    // Get inventory statistics
    const inventorySql = `
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(quantity * buy_price) as total_buy_value,
        SUM(quantity * sell_price) as total_sell_value,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items,
        COUNT(CASE WHEN quantity <= 5 THEN 1 END) as low_stock_items
      FROM inventory
    `;
    const [inventoryResult] = await db.execute(inventorySql);
    
    stats.totalInventoryItems = inventoryResult[0].total_items;
    stats.totalInventoryQuantity = inventoryResult[0].total_quantity || 0;
    stats.totalInventoryBuyValue = inventoryResult[0].total_buy_value || 0;
    stats.totalInventorySellValue = inventoryResult[0].total_sell_value || 0;
    stats.outOfStockItems = inventoryResult[0].out_of_stock_items;
    stats.lowStockItems = inventoryResult[0].low_stock_items;
          
    // Get sales statistics
    const salesSql = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END) as unpaid_revenue,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_sales,
        COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_sales
      FROM sales
    `;
    const [salesResult] = await db.execute(salesSql);
    
    stats.totalSales = salesResult[0].total_sales;
    stats.totalRevenue = salesResult[0].total_revenue || 0;
    stats.paidRevenue = salesResult[0].paid_revenue || 0;
    stats.unpaidRevenue = salesResult[0].unpaid_revenue || 0;
    stats.paidSales = salesResult[0].paid_sales;
    stats.unpaidSales = salesResult[0].unpaid_sales;
    
    // Get today's sales (using MySQL date function)
    const todaySalesSql = `
      SELECT 
        COUNT(*) as today_sales,
        SUM(total_amount) as today_revenue
      FROM sales 
      WHERE DATE(created_at) = CURDATE()
    `;
    const [todayResult] = await db.execute(todaySalesSql);
    
    stats.todaySales = todayResult[0].today_sales;
    stats.todayRevenue = todayResult[0].today_revenue || 0;
    
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent activities
router.get('/recent-activities', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    
    const activities = [];
    
    // Get recent sales
    const recentSalesSql = `
      SELECT 
        'sale' as type,
        invoice as reference,
        customer_name as item_name,
        total_amount as amount,
        status,
        created_at
      FROM sales 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    const [sales] = await db.execute(recentSalesSql, [limit]);
    activities.push(...sales);
    
    // Get recent investments
    const recentInvestmentsSql = `
      SELECT 
        'investment' as type,
        partner_name,
        type as investment_type,
        amount,
        created_at
      FROM investments 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    const [investments] = await db.execute(recentInvestmentsSql, [limit]);
    activities.push(...investments);
    
    // Sort all activities by created_at and limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const limitedActivities = activities.slice(0, limit);
    
    res.json({ activities: limitedActivities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sales analytics by date range
router.get('/sales-analytics', async (req, res) => {
  try {
    const { start_date, end_date, group_by } = req.query;
    
    let groupByClause;
    switch (group_by) {
      case 'day':
        groupByClause = "DATE(created_at)";
        break;
      case 'month':
        groupByClause = "DATE_FORMAT(created_at, '%Y-%m')";
        break;
      case 'year':
        groupByClause = "YEAR(created_at)";
        break;
      default:
        groupByClause = "DATE(created_at)";
    }
    
    let whereClause = '';
    let params = [];
    
    if (start_date && end_date) {
      whereClause = 'WHERE DATE(created_at) BETWEEN ? AND ?';
      params = [start_date, end_date];
    } else if (start_date) {
      whereClause = 'WHERE DATE(created_at) >= ?';
      params = [start_date];
    } else if (end_date) {
      whereClause = 'WHERE DATE(created_at) <= ?';
      params = [end_date];
    }
    
    const sql = `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END) as unpaid_revenue
      FROM sales 
      ${whereClause}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
    `;
    
    const [results] = await db.execute(sql, params);
    res.json({ analytics: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top selling items
router.get('/top-selling-items', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    
    const sql = `
       SELECT 
         si.item_name,
         i.sku,
         SUM(si.quantity) as total_quantity_sold,
         SUM(si.line_total) as total_revenue,
         COUNT(s.id) as total_transactions,
         AVG(si.unit_price) as avg_selling_price
       FROM sales s
       LEFT JOIN sales_items si ON s.id = si.sale_id
       LEFT JOIN inventory i ON si.item_id = i.id
       GROUP BY si.item_id, si.item_name
       ORDER BY total_quantity_sold DESC
       LIMIT ?
     `;
    
    const [results] = await db.execute(sql, [limit]);
    res.json({ topItems: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get low stock alerts
router.get('/low-stock-alerts', async (req, res) => {
  try {
    const threshold = req.query.threshold || 5;
    
    const sql = `
      SELECT 
        id,
        item_name,
        sku,
        quantity,
        sell_price,
        buy_price
      FROM inventory 
      WHERE quantity <= ?
      ORDER BY quantity ASC
    `;
    
    const [results] = await db.execute(sql, [threshold]);
    res.json({ lowStockItems: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get location-based sales analytics
router.get('/location-sales', async (req, res) => {
  try {
    const { start_date, end_date, group_by } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (start_date && end_date) {
      whereClause = 'WHERE DATE(s.created_at) BETWEEN ? AND ?';
      params = [start_date, end_date];
    } else if (start_date) {
      whereClause = 'WHERE DATE(s.created_at) >= ?';
      params = [start_date];
    } else if (end_date) {
      whereClause = 'WHERE DATE(s.created_at) <= ?';
      params = [end_date];
    }
    
    // Get sales by location with location details
    const locationSalesSql = `
      SELECT 
        COALESCE(l.name, 'Unknown Location') as location_name,
        COALESCE(l.id, 0) as location_id,
        COUNT(s.id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        SUM(CASE WHEN s.status = 'paid' THEN s.total_amount ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN s.status = 'unpaid' THEN s.total_amount ELSE 0 END) as unpaid_revenue,
        AVG(s.total_amount) as avg_sale_amount,
        COUNT(CASE WHEN s.status = 'paid' THEN 1 END) as paid_sales,
        COUNT(CASE WHEN s.status = 'unpaid' THEN 1 END) as unpaid_sales
      FROM sales s
      LEFT JOIN locations l ON s.location_id = l.id
      ${whereClause}
      GROUP BY l.id, l.name
      ORDER BY total_revenue DESC
    `;
    
    const [locationResults] = await db.execute(locationSalesSql, params);
    
    // Get top selling items by location
    const topItemsByLocationSql = `
      SELECT 
        COALESCE(l.name, 'Unknown Location') as location_name,
        COALESCE(l.id, 0) as location_id,
        si.item_name,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.line_total) as total_revenue
      FROM sales s
      LEFT JOIN locations l ON s.location_id = l.id
      LEFT JOIN sales_items si ON s.id = si.sale_id
      ${whereClause}
      GROUP BY l.id, l.name, si.item_id, si.item_name
      ORDER BY l.id, total_quantity_sold DESC
    `;
    
    const [topItemsResults] = await db.execute(topItemsByLocationSql, params);
    
    // Group top items by location
    const topItemsByLocation = {};
    topItemsResults.forEach(item => {
      const locationKey = item.location_id || 0;
      if (!topItemsByLocation[locationKey]) {
        topItemsByLocation[locationKey] = {
          location_name: item.location_name,
          location_id: item.location_id,
          items: []
        };
      }
      topItemsByLocation[locationKey].items.push({
        item_name: item.item_name,
        total_quantity_sold: item.total_quantity_sold,
        total_revenue: item.total_revenue
      });
    });
    
    // Limit to top 5 items per location
    Object.keys(topItemsByLocation).forEach(locationKey => {
      topItemsByLocation[locationKey].items = topItemsByLocation[locationKey].items.slice(0, 5);
    });
    
    res.json({ 
      locationSales: locationResults,
      topItemsByLocation: Object.values(topItemsByLocation)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;