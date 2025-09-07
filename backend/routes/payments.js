const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Database = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create database instance
const dbInstance = new Database();
let db;

// Initialize database connection
dbInstance.initialize().then(() => {
  db = dbInstance.getDb();
}).catch(err => {
  console.error('Failed to initialize database in payments route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  return await dbInstance.executeQuery(sql, params);
};

// Get all payment methods
router.get('/methods', async (req, res) => {
  try {
    const sql = 'SELECT * FROM payment_methods WHERE enabled = ? ORDER BY name';
    const result = await executeQuery(sql, [true]);
    const methods = result.rows || result;
    
    res.json({ payment_methods: methods });
  } catch (err) {
    console.error('Get payment methods error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Process payment
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      sale_id,
      payment_method,
      amount,
      card_token, // For Stripe
      transaction_reference,
      notes
    } = req.body;

    if (!sale_id || !payment_method || !amount) {
      return res.status(400).json({ error: 'Sale ID, payment method, and amount are required' });
    }

    // Get sale details
    const getSaleSQL = 'SELECT * FROM sales WHERE id = ?';
    const saleResult = await executeQuery(getSaleSQL, [sale_id]);
    const sales = saleResult.rows || saleResult;
    
    if (sales.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const sale = sales[0];
    const remaining_amount = parseFloat(sale.total_amount) - parseFloat(sale.paid_amount);
    
    if (amount > remaining_amount) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance' });
    }

    let payment_status = 'pending';
    let stripe_payment_intent = null;
    let transaction_id = transaction_reference;

    // Process different payment methods
    switch (payment_method.toLowerCase()) {
      case 'cash':
        payment_status = 'completed';
        transaction_id = `CASH-${Date.now()}`;
        break;
        
      case 'card':
      case 'credit_card':
      case 'debit_card':
        if (process.env.STRIPE_SECRET_KEY && card_token) {
          try {
            // Create Stripe payment intent
            const paymentIntent = await stripe.paymentIntents.create({
              amount: Math.round(amount * 100), // Convert to cents
              currency: 'usd', // or your preferred currency
              payment_method: card_token,
              confirm: true,
              return_url: `${process.env.FRONTEND_URL}/sales`,
            });
            
            stripe_payment_intent = paymentIntent.id;
            transaction_id = paymentIntent.id;
            payment_status = paymentIntent.status === 'succeeded' ? 'completed' : 'processing';
          } catch (stripeError) {
            console.error('Stripe payment error:', stripeError);
            return res.status(400).json({ error: 'Payment processing failed: ' + stripeError.message });
          }
        } else {
          // Manual card payment (for demo purposes)
          payment_status = 'completed';
          transaction_id = `CARD-${Date.now()}`;
        }
        break;
        
      case 'digital':
      case 'mobile_payment':
        // For digital wallets - would integrate with specific providers
        payment_status = 'completed';
        transaction_id = transaction_reference || `DIGITAL-${Date.now()}`;
        break;
        
      case 'transfer':
      case 'bank_transfer':
        payment_status = 'pending'; // Usually requires manual verification
        transaction_id = transaction_reference || `TRANSFER-${Date.now()}`;
        break;
        
      default:
        return res.status(400).json({ error: 'Unsupported payment method' });
    }

    // Insert payment record
    const insertPaymentSQL = `
      INSERT INTO payments (
        sale_id, payment_method, amount, transaction_id, 
        payment_status, stripe_payment_intent, notes, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const paymentResult = await executeQuery(insertPaymentSQL, [
      sale_id, payment_method, amount, transaction_id,
      payment_status, stripe_payment_intent, notes, req.user.id
    ]);
    
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const paymentId = isPostgreSQL ? paymentResult.rows[0]?.id : paymentResult.insertId;

    // Update sale payment amount if payment is completed
    if (payment_status === 'completed') {
      const new_paid_amount = parseFloat(sale.paid_amount) + parseFloat(amount);
      let sale_status = 'unpaid';
      
      if (new_paid_amount >= parseFloat(sale.total_amount)) {
        sale_status = 'paid';
      } else if (new_paid_amount > 0) {
        sale_status = 'partial';
      }
      
      const updateSaleSQL = 'UPDATE sales SET paid_amount = ?, status = ?, updated_at = NOW() WHERE id = ?';
      await executeQuery(updateSaleSQL, [new_paid_amount, sale_status, sale_id]);
    }

    res.status(201).json({
      message: 'Payment processed successfully',
      payment: {
        id: paymentId,
        sale_id,
        payment_method,
        amount: parseFloat(amount),
        transaction_id,
        payment_status,
        stripe_payment_intent
      }
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Get payments for a sale
router.get('/sale/:saleId', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT p.*, u.full_name as processed_by_name
      FROM payments p
      LEFT JOIN users u ON p.processed_by = u.id
      WHERE p.sale_id = ?
      ORDER BY p.created_at DESC
    `;
    
    const result = await executeQuery(sql, [req.params.saleId]);
    const payments = result.rows || result;
    
    res.json({ payments });
  } catch (err) {
    console.error('Get sale payments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Refund payment
router.post('/refund/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const paymentId = req.params.paymentId;
    
    // Get payment details
    const getPaymentSQL = 'SELECT * FROM payments WHERE id = ?';
    const paymentResult = await executeQuery(getPaymentSQL, [paymentId]);
    const payments = paymentResult.rows || paymentResult;
    
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = payments[0];
    
    if (payment.payment_status !== 'completed') {
      return res.status(400).json({ error: 'Can only refund completed payments' });
    }
    
    const refund_amount = amount || payment.amount;
    
    if (refund_amount > payment.amount) {
      return res.status(400).json({ error: 'Refund amount cannot exceed payment amount' });
    }

    let refund_status = 'completed';
    let stripe_refund_id = null;

    // Process Stripe refund if applicable
    if (payment.stripe_payment_intent && process.env.STRIPE_SECRET_KEY) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent,
          amount: Math.round(refund_amount * 100), // Convert to cents
        });
        
        stripe_refund_id = refund.id;
        refund_status = refund.status;
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError);
        return res.status(400).json({ error: 'Refund processing failed: ' + stripeError.message });
      }
    }

    // Insert refund record
    const insertRefundSQL = `
      INSERT INTO refunds (
        payment_id, sale_id, amount, reason, refund_status, 
        stripe_refund_id, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const refundResult = await executeQuery(insertRefundSQL, [
      paymentId, payment.sale_id, refund_amount, reason, refund_status,
      stripe_refund_id, req.user.id
    ]);
    
    const isPostgreSQL = process.env.DATABASE_URL ? true : false;
    const refundId = isPostgreSQL ? refundResult.rows[0]?.id : refundResult.insertId;

    // Update sale amounts
    const getSaleSQL = 'SELECT * FROM sales WHERE id = ?';
    const saleResult = await executeQuery(getSaleSQL, [payment.sale_id]);
    const sale = (saleResult.rows || saleResult)[0];
    
    const new_paid_amount = parseFloat(sale.paid_amount) - parseFloat(refund_amount);
    let sale_status = 'unpaid';
    
    if (new_paid_amount >= parseFloat(sale.total_amount)) {
      sale_status = 'paid';
    } else if (new_paid_amount > 0) {
      sale_status = 'partial';
    }
    
    const updateSaleSQL = 'UPDATE sales SET paid_amount = ?, status = ?, updated_at = NOW() WHERE id = ?';
    await executeQuery(updateSaleSQL, [new_paid_amount, sale_status, payment.sale_id]);

    res.json({
      message: 'Refund processed successfully',
      refund: {
        id: refundId,
        payment_id: paymentId,
        amount: parseFloat(refund_amount),
        refund_status,
        stripe_refund_id
      }
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Refund processing failed' });
  }
});

// Get payment analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE p.created_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    // Payment method breakdown
    const methodBreakdownSQL = `
      SELECT 
        p.payment_method,
        COUNT(*) as transaction_count,
        SUM(p.amount) as total_amount,
        AVG(p.amount) as average_amount
      FROM payments p
      ${dateFilter}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `;
    
    const methodResult = await executeQuery(methodBreakdownSQL, params);
    const method_breakdown = methodResult.rows || methodResult;
    
    // Daily payment summary
    const dailySQL = `
      SELECT 
        DATE(p.created_at) as payment_date,
        COUNT(*) as transaction_count,
        SUM(p.amount) as total_amount
      FROM payments p
      ${dateFilter}
      GROUP BY DATE(p.created_at)
      ORDER BY payment_date DESC
      LIMIT 30
    `;
    
    const dailyResult = await executeQuery(dailySQL, params);
    const daily_summary = dailyResult.rows || dailyResult;
    
    res.json({
      method_breakdown,
      daily_summary
    });
    
  } catch (err) {
    console.error('Get payment analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all transactions (payments)
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, payment_method, status, limit = 50, offset = 0 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (start_date && end_date) {
      whereClause += ' AND DATE(p.created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (payment_method) {
      whereClause += ' AND p.payment_method = ?';
      params.push(payment_method);
    }
    
    if (status) {
      whereClause += ' AND p.payment_status = ?';
      params.push(status);
    }
    
    const sql = `
      SELECT 
        p.*,
        s.invoice,
        s.customer_name,
        s.total_amount as sale_total,
        u.full_name as processed_by_name
      FROM payments p
      LEFT JOIN sales s ON p.sale_id = s.id
      LEFT JOIN users u ON p.processed_by = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    const result = await executeQuery(sql, params);
    const transactions = result.rows || result;
    
    // Get total count
    const countSQL = `
      SELECT COUNT(*) as total_count
      FROM payments p
      LEFT JOIN sales s ON p.sale_id = s.id
      ${whereClause}
    `;
    
    const countResult = await executeQuery(countSQL, params);
    const total_count = (countResult.rows || countResult)[0].total_count;
    
    res.json({ 
      transactions,
      pagination: {
        total: parseInt(total_count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;