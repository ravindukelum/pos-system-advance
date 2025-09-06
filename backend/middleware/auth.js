const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Create database instance
const dbInstance = new Database();
let db;

// Initialize database connection
const initDB = async () => {
  if (!db) {
    await dbInstance.initialize();
    db = dbInstance.getDb();
  }
  return db;
};

// Generate JWT token
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Hash password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    await initDB();
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    
    // Check if user still exists and is active
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const getUserSQL = 'SELECT id, username, email, full_name, role, status, permissions FROM users WHERE id = ? AND status = ?';
    const userResult = await dbInstance.executeQuery(getUserSQL, [decoded.userId, 'active']);
    const users = isPostgreSQL ? userResult.rows : userResult;
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Authorization middleware (check roles)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Permission-based authorization
const authorizePermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check user permissions
    const userPermissions = req.user.permissions ? JSON.parse(req.user.permissions) : {};
    const hasPermission = permissions.some(permission => userPermissions[permission] === true);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    await initDB();
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = verifyToken(token);
        
        const isPostgreSQL = process.env.DATABASE_URL ? true : false;
        const getUserSQL = 'SELECT id, username, email, full_name, role, status, permissions FROM users WHERE id = ? AND status = ?';
        const userResult = await dbInstance.executeQuery(getUserSQL, [decoded.userId, 'active']);
        const users = isPostgreSQL ? userResult.rows : userResult;
        
        if (users.length > 0) {
          req.user = users[0];
        }
      } catch (error) {
        // Token invalid, but continue without user
        console.log('Optional auth: Invalid token');
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

// Store session in database (for JWT blacklisting)
const storeSession = async (userId, tokenHash, expiresAt) => {
  try {
    await initDB();
    
    const insertSessionSQL = 'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)';
    await dbInstance.executeQuery(insertSessionSQL, [userId, tokenHash, expiresAt]);
  } catch (error) {
    console.error('Error storing session:', error);
  }
};

// Remove session from database (logout)
const removeSession = async (tokenHash) => {
  try {
    await initDB();
    
    const deleteSessionSQL = 'DELETE FROM user_sessions WHERE token_hash = ?';
    await dbInstance.executeQuery(deleteSessionSQL, [tokenHash]);
  } catch (error) {
    console.error('Error removing session:', error);
  }
};

// Clean expired sessions
const cleanExpiredSessions = async () => {
  try {
    await initDB();
    
    const deleteExpiredSQL = 'DELETE FROM user_sessions WHERE expires_at < NOW()';
    await dbInstance.executeQuery(deleteExpiredSQL);
  } catch (error) {
    console.error('Error cleaning expired sessions:', error);
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  authenticateToken,
  authorizeRoles,
  authorizePermissions,
  optionalAuth,
  storeSession,
  removeSession,
  cleanExpiredSessions,
  JWT_SECRET,
  JWT_EXPIRES_IN
};