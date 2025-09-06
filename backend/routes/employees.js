const express = require('express');
const { body, validationResult } = require('express-validator');
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
  console.error('Failed to initialize database in employees route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  return await dbInstance.executeQuery(sql, params);
};

// Get all employees (users)
router.get('/', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { status = 'active', role } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    
    const sql = `
      SELECT 
        id, username, email, full_name, role, status,
        last_login, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    const result = await executeQuery(sql, params);
    const employees = result.rows || result;
    
    res.json({ employees });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get employee performance
router.get('/:id/performance', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const employeeId = req.params.id;
    
    let dateFilter = '';
    const params = [employeeId];
    
    if (start_date && end_date) {
      dateFilter = 'AND s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    // Sales performance
    const salesPerformanceSQL = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as average_sale,
        COUNT(CASE WHEN s.status = 'paid' THEN 1 END) as completed_sales
      FROM sales s
      WHERE s.cashier_id = ?
      ${dateFilter}
    `;
    
    const salesResult = await executeQuery(salesPerformanceSQL, params);
    const sales_performance = (salesResult.rows || salesResult)[0];
    
    // Time tracking (if available)
    const timeTrackingSQL = `
      SELECT 
        SUM(TIMESTAMPDIFF(MINUTE, clock_in, clock_out)) as total_minutes_worked,
        COUNT(DISTINCT DATE(clock_in)) as days_worked
      FROM time_tracking
      WHERE user_id = ?
      ${dateFilter.replace('s.date', 'DATE(clock_in)')}
    `;
    
    const timeResult = await executeQuery(timeTrackingSQL, params);
    const time_tracking = (timeResult.rows || timeResult)[0];
    
    res.json({ 
      sales_performance,
      time_tracking
    });
  } catch (err) {
    console.error('Get employee performance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clock in/out
router.post('/clock', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body; // 'in' or 'out'
    const userId = req.user.id;
    
    if (!['in', 'out'].includes(action)) {
      return res.status(400).json({ error: 'Action must be \"in\" or \"out\"' });
    }
    
    if (action === 'in') {
      // Clock in
      // Check if already clocked in
      const checkSQL = 'SELECT * FROM time_tracking WHERE user_id = ? AND clock_out IS NULL';
      const checkResult = await executeQuery(checkSQL, [userId]);
      const existing = checkResult.rows || checkResult;
      
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Already clocked in' });
      }
      
      const insertSQL = 'INSERT INTO time_tracking (user_id, clock_in) VALUES (?, NOW())';
      const result = await executeQuery(insertSQL, [userId]);
      
      const isPostgreSQL = process.env.DATABASE_URL ? true : false;
      const recordId = isPostgreSQL ? result.rows[0]?.id : result.insertId;
      
      res.json({ 
        message: 'Clocked in successfully',
        record_id: recordId,
        clock_in: new Date()
      });
      
    } else {
      // Clock out
      const updateSQL = 'UPDATE time_tracking SET clock_out = NOW() WHERE user_id = ? AND clock_out IS NULL';
      const result = await executeQuery(updateSQL, [userId]);
      
      const isPostgreSQL = process.env.DATABASE_URL ? true : false;
      const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;
      
      if (affectedRows === 0) {
        return res.status(400).json({ error: 'Not currently clocked in' });
      }
      
      res.json({ 
        message: 'Clocked out successfully',
        clock_out: new Date()
      });
    }
    
  } catch (err) {
    console.error('Clock in/out error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get employee time tracking
router.get('/:id/timetracking', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const employeeId = req.params.id;
    
    let dateFilter = '';
    const params = [employeeId];
    
    if (start_date && end_date) {
      dateFilter = 'AND DATE(clock_in) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    const sql = `
      SELECT 
        DATE(clock_in) as work_date,
        clock_in,
        clock_out,
        CASE 
          WHEN clock_out IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, clock_in, clock_out)
          ELSE NULL
        END as minutes_worked
      FROM time_tracking
      WHERE user_id = ?
      ${dateFilter}
      ORDER BY clock_in DESC
    `;
    
    const result = await executeQuery(sql, params);
    const time_records = result.rows || result;
    
    // Calculate summary
    const summarySQL = `
      SELECT 
        COUNT(DISTINCT DATE(clock_in)) as days_worked,
        SUM(TIMESTAMPDIFF(MINUTE, clock_in, clock_out)) as total_minutes,
        AVG(TIMESTAMPDIFF(MINUTE, clock_in, clock_out)) as average_daily_minutes
      FROM time_tracking
      WHERE user_id = ? AND clock_out IS NOT NULL
      ${dateFilter}
    `;
    
    const summaryResult = await executeQuery(summarySQL, params);
    const summary = (summaryResult.rows || summaryResult)[0];
    
    res.json({ 
      time_records,
      summary: {
        ...summary,
        total_hours: summary.total_minutes ? (summary.total_minutes / 60).toFixed(2) : 0,
        average_daily_hours: summary.average_daily_minutes ? (summary.average_daily_minutes / 60).toFixed(2) : 0
      }
    });
  } catch (err) {
    console.error('Get time tracking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Calculate commission (if applicable)
router.get('/:id/commission', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date, commission_rate = 5 } = req.query;
    const employeeId = req.params.id;
    
    let dateFilter = '';
    const params = [employeeId];
    
    if (start_date && end_date) {
      dateFilter = 'AND s.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    const commissionSQL = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(s.total_amount) as total_sales_amount,
        SUM(s.total_amount) * (? / 100) as commission_earned
      FROM sales s
      WHERE s.cashier_id = ?
      ${dateFilter}
    `;
    
    params.unshift(parseFloat(commission_rate)); // Add commission rate at the beginning
    
    const result = await executeQuery(commissionSQL, params);
    const commission = (result.rows || result)[0];
    
    res.json({ 
      commission_report: {
        ...commission,
        commission_rate: parseFloat(commission_rate),
        period: { start_date, end_date }
      }
    });
  } catch (err) {
    console.error('Calculate commission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Employee attendance summary
router.get('/attendance/summary', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE DATE(t.clock_in) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    const attendanceSQL = `
      SELECT 
        u.id,
        u.full_name,
        u.role,
        COUNT(DISTINCT DATE(t.clock_in)) as days_present,
        SUM(TIMESTAMPDIFF(MINUTE, t.clock_in, t.clock_out)) as total_minutes_worked,
        AVG(TIMESTAMPDIFF(MINUTE, t.clock_in, t.clock_out)) as average_daily_minutes
      FROM users u
      LEFT JOIN time_tracking t ON u.id = t.user_id AND t.clock_out IS NOT NULL
      ${dateFilter}
      GROUP BY u.id, u.full_name, u.role
      ORDER BY u.full_name
    `;
    
    const result = await executeQuery(attendanceSQL, params);
    const attendance = (result.rows || result).map(record => ({
      ...record,
      total_hours_worked: record.total_minutes_worked ? (record.total_minutes_worked / 60).toFixed(2) : 0,
      average_daily_hours: record.average_daily_minutes ? (record.average_daily_minutes / 60).toFixed(2) : 0
    }));
    
    res.json({ attendance_summary: attendance });
  } catch (err) {
    console.error('Attendance summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;