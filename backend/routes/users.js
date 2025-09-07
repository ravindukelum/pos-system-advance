const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
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
  console.error('Failed to initialize database in users route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  return await dbInstance.executeQuery(sql, params);
};

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { search, role, status, limit = 50, offset = 0 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (role) {
      whereClause += ' AND u.role = ?';
      params.push(role);
    }
    
    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }
    
    const sql = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.status,
        u.phone,
        u.address,
        u.department,
        u.position,
        u.is_locked,
        u.locked_at,
        u.failed_login_attempts,
        u.last_login,
        u.created_at,
        u.updated_at,
        u.permissions
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    const result = await executeQuery(sql, params);
    const users = result.rows || result;
    
    // Parse permissions JSON for each user
    users.forEach(user => {
      try {
        user.permissions = user.permissions ? JSON.parse(user.permissions) : {};
      } catch (err) {
        user.permissions = {};
      }
    });
    
    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single user (admin only)
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.status,
        u.phone,
        u.address,
        u.department,
        u.position,
        u.is_locked,
        u.locked_at,
        u.failed_login_attempts,
        u.last_login,
        u.created_at,
        u.updated_at,
        u.permissions
      FROM users u
      WHERE u.id = ?
    `;
    
    const result = await executeQuery(sql, [req.params.id]);
    const users = result.rows || result;
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    try {
      user.permissions = user.permissions ? JSON.parse(user.permissions) : {};
    } catch (err) {
      user.permissions = {};
    }
    
    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new user (admin only)
router.post('/', 
  authenticateToken, 
  authorizeRoles('admin'),
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').trim().isLength({ min: 2 }).withMessage('Full name is required'),
    body('role').isIn(['admin', 'manager', 'cashier', 'employee']).withMessage('Invalid role')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        username,
        email,
        password,
        full_name,
        role,
        phone,
        address,
        department,
        position,
        permissions = {}
      } = req.body;

      // Check if username or email already exists
      const checkUserSQL = 'SELECT id FROM users WHERE username = ? OR email = ?';
      const existingUsers = await executeQuery(checkUserSQL, [username, email]);
      const existing = existingUsers.rows || existingUsers;
      
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Insert new user
      const insertSQL = `
        INSERT INTO users (
          username, email, password_hash, full_name, role, phone, address,
          department, position, permissions, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
      `;

      const values = [
        username,
        email,
        password_hash,
        full_name,
        role,
        phone || null,
        address || null,
        department || null,
        position || null,
        JSON.stringify(permissions)
      ];

      const result = await executeQuery(insertSQL, values);
      const isPostgreSQL = process.env.DATABASE_URL ? true : false;
      const userId = isPostgreSQL ? result.rows[0]?.id : result.insertId;

      res.status(201).json({
        message: 'User created successfully',
        user_id: userId
      });

    } catch (err) {
      console.error('Create user error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Update user (admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      full_name,
      email,
      role,
      status,
      phone,
      address,
      department,
      position,
      permissions
    } = req.body;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];

    if (full_name !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (role !== undefined) {
      const validRoles = ['admin', 'manager', 'cashier', 'employee'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (department !== undefined) {
      updateFields.push('department = ?');
      updateValues.push(department);
    }
    if (position !== undefined) {
      updateFields.push('position = ?');
      updateValues.push(position);
    }
    if (permissions !== undefined) {
      updateFields.push('permissions = ?');
      updateValues.push(JSON.stringify(permissions));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    const updateSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    const result = await executeQuery(updateSQL, updateValues);

    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Lock user account (admin only)
router.post('/:id/lock', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;

    // Don't allow admin to lock themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot lock your own account' });
    }

    const lockSQL = `
      UPDATE users 
      SET is_locked = TRUE, locked_at = NOW(), locked_by = ?, lock_reason = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const result = await executeQuery(lockSQL, [req.user.id, reason || 'Account locked by administrator', userId]);
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User account locked successfully' });
  } catch (err) {
    console.error('Lock user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unlock user account (admin only)
router.post('/:id/unlock', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    const unlockSQL = `
      UPDATE users 
      SET is_locked = FALSE, locked_at = NULL, locked_by = NULL, lock_reason = NULL, 
          failed_login_attempts = 0, updated_at = NOW()
      WHERE id = ?
    `;

    const result = await executeQuery(unlockSQL, [userId]);
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User account unlocked successfully' });
  } catch (err) {
    console.error('Unlock user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete user (soft delete - admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Don't allow admin to delete themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Soft delete by setting status to inactive
    const deleteSQL = 'UPDATE users SET status = "inactive", updated_at = NOW() WHERE id = ?';
    const result = await executeQuery(deleteSQL, [userId]);

    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset user password (admin only)
router.post('/:id/reset-password', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    const resetSQL = `
      UPDATE users 
      SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
      WHERE id = ?
    `;

    const result = await executeQuery(resetSQL, [password_hash, userId]);
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user statistics (admin only)
router.get('/stats/overview', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const statsSQL = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_users,
        COUNT(CASE WHEN is_locked = TRUE THEN 1 END) as locked_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_users,
        COUNT(CASE WHEN role = 'cashier' THEN 1 END) as cashier_users,
        COUNT(CASE WHEN role = 'employee' THEN 1 END) as employee_users
      FROM users
    `;

    const result = await executeQuery(statsSQL);
    const stats = (result.rows || result)[0];

    res.json({ stats });
  } catch (err) {
    console.error('Get user stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;