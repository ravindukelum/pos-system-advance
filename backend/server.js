const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('./database/db');
const { cleanExpiredSessions } = require('./middleware/auth');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database
const database = Database.getInstance();
database.initialize().then(() => {
  console.log('Database initialized successfully');
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Middleware
// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'POS System API Server is running!' });
});

// Import routes
const authRoutes = require('./routes/auth');
const partnerRoutes = require('./routes/partners');
const investmentRoutes = require('./routes/investments');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const customersRoutes = require('./routes/customers');
const barcodesRoutes = require('./routes/barcodes');
const paymentsRoutes = require('./routes/payments');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const locationsRoutes = require('./routes/locations');
const integrationsRoutes = require('./routes/integrations');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/barcodes', barcodesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/integrations', integrationsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Clean expired sessions every hour
  setInterval(() => {
    cleanExpiredSessions();
  }, 60 * 60 * 1000); // 1 hour
});

module.exports = app;