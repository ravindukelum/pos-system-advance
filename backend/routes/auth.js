const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const Database = require('../database/db');
const {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  authenticateToken,
  authorizeRoles,
  storeSession,
  removeSession
} = require('../middleware/auth');

const router = express.Router();

// Create database instance
const dbInstance = new Database();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in auth route:', err);
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 login attempts per windowMs (increased for development)
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware
const validateRegistration = [
  body('username').isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-50 characters, alphanumeric and underscore only'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character'),
  body('full_name').isLength({ min: 2, max: 255 }).withMessage('Full name must be 2-255 characters'),
  body('role').optional().isIn(['admin', 'manager', 'cashier', 'employee']).withMessage('Invalid role')
];

const validateLogin = [
  body('username').isLength({ min: 1 }).withMessage('Username required'),
  body('password').isLength({ min: 1 }).withMessage('Password required')
];

const validatePasswordChange = [
  body('currentPassword').isLength({ min: 1 }).withMessage('Current password required'),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('New password must be at least 8 characters with uppercase, lowercase, number and special character')
];

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  const isPostgreSQL = process.env.DATABASE_URL ? true : false;
  return await dbInstance.executeQuery(sql, params);
};

// Register new user (admin only)
router.post('/register', authLimiter, authenticateToken, authorizeRoles('admin'), validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, full_name, role = 'cashier' } = req.body;

    // Check if user already exists
    const checkUserSQL = 'SELECT id FROM users WHERE username = ? OR email = ?';
    const existingUser = await executeQuery(checkUserSQL, [username, email]);
    const users = existingUser.rows || existingUser;

    if (users.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const insertUserSQL = `
      INSERT INTO users (username, email, password_hash, full_name, role, status) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertUserSQL, [username, email, passwordHash, full_name, role, 'active']);
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const userId = isPostgreSQL ? result.rows[0]?.id : result.insertId;

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userId,
        username,
        email,
        full_name,
        role,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Get user by username or email
    const getUserSQL = 'SELECT * FROM users WHERE (username = ? OR email = ?) AND status = ?';
    const userResult = await executeQuery(getUserSQL, [username, username, 'active']);
    const users = userResult.rows || userResult;

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update last login
    const updateLoginSQL = 'UPDATE users SET last_login = NOW() WHERE id = ?';
    await executeQuery(updateLoginSQL, [user.id]);

    // Store session (optional - for token blacklisting)
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await storeSession(user.id, tokenHash, expiresAt);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) : {}
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = verifyToken(refreshToken);
    
    // Get user
    const getUserSQL = 'SELECT * FROM users WHERE id = ? AND status = ?';
    const userResult = await executeQuery(getUserSQL, [decoded.userId, 'active']);
    const users = userResult.rows || userResult;

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];

    // Generate new access token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const accessToken = generateToken(tokenPayload);

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) : {}
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await removeSession(tokenHash);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        full_name: req.user.full_name,
        role: req.user.role,
        permissions: req.user.permissions ? (typeof req.user.permissions === 'string' ? JSON.parse(req.user.permissions) : req.user.permissions) : {}
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current user's password
    const getUserSQL = 'SELECT password_hash FROM users WHERE id = ?';
    const userResult = await executeQuery(getUserSQL, [req.user.id]);
    const users = userResult.rows || userResult;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const updatePasswordSQL = 'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?';
    await executeQuery(updatePasswordSQL, [newPasswordHash, req.user.id]);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin/manager only)
router.get('/users', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const getUsersSQL = `
      SELECT id, username, email, full_name, role, status, last_login, created_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    
    const result = await executeQuery(getUsersSQL);
    const users = result.rows || result;

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { full_name, role, status, permissions } = req.body;
    const userId = req.params.id;

    // Validate role and status
    const validRoles = ['admin', 'manager', 'cashier', 'employee'];
    const validStatuses = ['active', 'inactive', 'suspended'];

    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (full_name) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (permissions) {
      updateFields.push('permissions = ?');
      updateValues.push(JSON.stringify(permissions));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    const updateUserSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    const result = await executeQuery(updateUserSQL, updateValues);

    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deleteUserSQL = 'DELETE FROM users WHERE id = ?';
    const result = await executeQuery(deleteUserSQL, [userId]);

    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const affectedRows = isPostgreSQL ? result.rowCount : result.affectedRows;

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;