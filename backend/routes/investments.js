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
  console.error('Failed to initialize database in investments route:', err);
});

// Get all investments
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT i.*, p.name as partner_name, p.type as partner_type 
      FROM investments i 
      LEFT JOIN partners p ON i.partner_id = p.id 
      ORDER BY i.created_at DESC
    `;
    const [rows] = await db.execute(sql);
    res.json({ investments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get investment by ID
router.get('/:id', async (req, res) => {
  try {
    const sql = `
      SELECT i.*, p.name as partner_name, p.type as partner_type 
      FROM investments i 
      LEFT JOIN partners p ON i.partner_id = p.id 
      WHERE i.id = ?
    `;
    const [rows] = await db.execute(sql, [req.params.id]);
    const investment = rows[0];
    
    if (!investment) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }
    res.json({ investment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get investments by partner
router.get('/partner/:partnerId', async (req, res) => {
  try {
    const sql = `
      SELECT i.*, p.name as partner_name, p.type as partner_type 
      FROM investments i 
      LEFT JOIN partners p ON i.partner_id = p.id 
      WHERE i.partner_id = ? 
      ORDER BY i.created_at DESC
    `;
    const [rows] = await db.execute(sql, [req.params.partnerId]);
    res.json({ investments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new investment/withdrawal
router.post('/', async (req, res) => {
  const { partner_id, type, amount, notes } = req.body;
  
  if (!partner_id || !type || !amount) {
    res.status(400).json({ error: 'Partner ID, type, and amount are required' });
    return;
  }
  
  if (!['invest', 'withdraw'].includes(type)) {
    res.status(400).json({ error: 'Type must be either invest or withdraw' });
    return;
  }
  
  if (amount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' });
    return;
  }
  
  try {
    // First, get partner name
    const getPartnerSql = 'SELECT name FROM partners WHERE id = ?';
    const [partnerRows] = await db.execute(getPartnerSql, [partner_id]);
    const partner = partnerRows[0];
    
    if (!partner) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }
    
    const sql = 'INSERT INTO investments (partner_id, partner_name, type, amount, notes) VALUES (?, ?, ?, ?, ?)';
    
    const [result] = await db.execute(sql, [partner_id, partner.name, type, amount, notes || null]);
    const id = result.insertId;
    
    res.status(201).json({
      message: 'Investment record created successfully',
      investment: { id, partner_id, partner_name: partner.name, type, amount, notes }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update investment
router.put('/:id', async (req, res) => {
  const { partner_id, type, amount, notes } = req.body;
  
  if (!partner_id || !type || !amount) {
    res.status(400).json({ error: 'Partner ID, type, and amount are required' });
    return;
  }
  
  if (!['invest', 'withdraw'].includes(type)) {
    res.status(400).json({ error: 'Type must be either invest or withdraw' });
    return;
  }
  
  if (amount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' });
    return;
  }
  
  try {
    // Get partner name
    const getPartnerSql = 'SELECT name FROM partners WHERE id = ?';
    const [partnerRows] = await db.execute(getPartnerSql, [partner_id]);
    const partner = partnerRows[0];
    
    if (!partner) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }
    
    const sql = 'UPDATE investments SET partner_id = ?, partner_name = ?, type = ?, amount = ?, notes = ? WHERE id = ?';
    
    const [result] = await db.execute(sql, [partner_id, partner.name, type, amount, notes || null, req.params.id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }
    res.json({ message: 'Investment updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete investment
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const sql = 'DELETE FROM investments WHERE id = ?';
    
    const [result] = await db.execute(sql, [req.params.id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }
    res.json({ message: 'Investment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;