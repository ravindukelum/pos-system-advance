const express = require('express');
const twilio = require('twilio');
const Database = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const messageTemplates = require('../templates/whatsapp-templates');
const router = express.Router();

// Create database instance
const dbInstance = Database.getInstance();
let dbInitialized = false;

// Initialize database connection
dbInstance.initialize().then(() => {
  dbInitialized = true;
}).catch(err => {
  console.error('Failed to initialize database in notifications route:', err);
});

// Helper function to execute queries
const executeQuery = async (sql, params = []) => {
  if (!dbInitialized) {
    throw new Error('Database not initialized');
  }
  
  const isPostgreSQL = process.env.DATABASE_URL ? true : false;
  if (!isPostgreSQL && sql.includes('$')) {
    let paramIndex = 1;
    sql = sql.replace(/\$\d+/g, () => '?');
  }
  
  return await dbInstance.executeQuery(sql, params);
};

// Initialize Twilio client (will be configured when credentials are provided)
let twilioClient = null;

const initializeTwilio = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
    return true;
  }
  return false;
};

// Get shop settings for message personalization
const getShopSettings = async () => {
  try {
    const settingsSql = 'SELECT * FROM settings LIMIT 1';
    const settingsResult = await executeQuery(settingsSql);
    const settings = (settingsResult.rows || settingsResult)[0] || {};
    return {
      shop_name: settings.shop_name || 'POS Shop',
      shop_phone: settings.shop_phone || '',
      shop_address: settings.shop_address || ''
    };
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    return { shop_name: 'POS Shop', shop_phone: '', shop_address: '' };
  }
};

// Helper function to format phone numbers
const formatPhoneNumber = (phone) => {
  // Remove any non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, add it
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};





// Routes

// Send WhatsApp message
router.post('/whatsapp/send', authenticateToken, async (req, res) => {
  try {
    const { phone, message, messageType = 'custom', saleId, customerId } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    // Format phone number for WhatsApp
    const formattedPhone = formatPhoneNumber(phone);
    
    // Send message via Twilio
    const messageResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${formattedPhone}`
    });
    
    // Log message to database
    const logSql = `
      INSERT INTO message_logs (recipient_phone, message_type, message_content, status, twilio_sid, sale_id, customer_id, sent_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await executeQuery(logSql, [
      formattedPhone,
      messageType,
      message,
      'sent',
      messageResponse.sid,
      saleId || null,
      customerId || null,
      req.user.id
    ]);
    
    res.json({
      success: true,
      messageSid: messageResponse.sid,
      status: messageResponse.status
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    // Log failed message
    if (req.body.phone) {
      try {
        const logSql = `
          INSERT INTO message_logs (recipient_phone, message_type, message_content, status, error_message, sale_id, customer_id, sent_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await executeQuery(logSql, [
          formatPhoneNumber(req.body.phone),
          req.body.messageType || 'custom',
          req.body.message || '',
          'failed',
          error.message,
          req.body.saleId || null,
          req.body.customerId || null,
          req.user.id
        ]);
      } catch (logError) {
        console.error('Error logging failed message:', logError);
      }
    }
    
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

// Send templated WhatsApp message
router.post('/whatsapp/send-template', authenticateToken, async (req, res) => {
  try {
    const { phone, templateName, templateData, saleId, customerId } = req.body;
    
    if (!phone || !templateName) {
      return res.status(400).json({ error: 'Phone number and template name are required' });
    }
    
    if (!messageTemplates[templateName]) {
      return res.status(400).json({ error: 'Invalid template name' });
    }
    
    // Get shop settings for template personalization
    const shopSettings = await getShopSettings();
    const enhancedTemplateData = {
      ...templateData,
      shopName: shopSettings.shop_name,
      shopAddress: shopSettings.shop_address,
      shopPhone: shopSettings.shop_phone
    };
    
    // Generate message from template
     const message = messageTemplates[templateName](enhancedTemplateData);
     const formattedPhone = formatPhoneNumber(phone);
     
     // Send message via Twilio
     const messageResponse = await client.messages.create({
       body: message,
       from: process.env.TWILIO_WHATSAPP_FROM,
       to: `whatsapp:${formattedPhone}`
     });
     
     // Log message to database
     const logSql = `
       INSERT INTO message_logs (recipient_phone, message_type, template_name, message_content, status, twilio_sid, sale_id, customer_id, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     `;
     
     await executeQuery(logSql, [
       formattedPhone,
       'template',
       templateName,
       message,
       'sent',
       messageResponse.sid,
       saleId || null,
       customerId || null,
       req.user.id
     ]);
     
     res.json({
       success: true,
       messageSid: messageResponse.sid,
       status: messageResponse.status,
       template: templateName
     });
  } catch (error) {
     console.error('Error sending templated WhatsApp message:', error);
     
     // Log failed message
     if (req.body.phone) {
       try {
         const logSql = `
           INSERT INTO message_logs (recipient_phone, message_type, template_name, message_content, status, error_message, sale_id, customer_id, sent_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         `;
         
         await executeQuery(logSql, [
           formatPhoneNumber(req.body.phone),
           'template',
           req.body.templateName || '',
           '',
           'failed',
           error.message,
           req.body.saleId || null,
           req.body.customerId || null,
           req.user.id
         ]);
       } catch (logError) {
         console.error('Error logging failed message:', logError);
       }
     }
     
     res.status(500).json({ error: 'Failed to send templated message', details: error.message });
  }
});

// Send order confirmation WhatsApp
router.post('/whatsapp/order-confirmation', authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.body;
    
    if (!saleId) {
      return res.status(400).json({ error: 'Sale ID is required' });
    }
    
    // Get sale details with location information
    const saleSql = `
      SELECT s.*, c.name as customer_name, c.phone as customer_phone,
             l.name as location_name, l.address as location_address
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE s.id = ?
    `;
    
    const saleResult = await executeQuery(saleSql, [saleId]);
    const sale = (saleResult.rows || saleResult)[0];
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    if (!sale.customer_phone) {
      return res.status(400).json({ error: 'Customer phone number not available' });
    }
    
    // Get sale items
    const itemsSql = `
      SELECT si.*, i.item_name
      FROM sales_items si
      LEFT JOIN inventory i ON si.item_id = i.id
      WHERE si.sale_id = ?
    `;
    
    const itemsResult = await executeQuery(itemsSql, [saleId]);
    const items = (itemsResult.rows || itemsResult).map(item => ({
      name: item.item_name || 'Unknown Item',
      quantity: item.quantity,
      price: parseFloat(item.line_total).toFixed(2)
    }));
    
    // Get shop settings
    const shopSettings = await getShopSettings();
    
    const templateData = {
      customerName: sale.customer_name || 'Valued Customer',
      orderNumber: sale.invoice,
      items: items,
      total: parseFloat(sale.total_amount).toFixed(2),
      shopName: shopSettings.shop_name,
      shopAddress: sale.location_address || shopSettings.shop_address || 'Main Store'
    };
    
    // Generate and send message
     const message = messageTemplates.orderConfirmation(templateData);
     const formattedPhone = formatPhoneNumber(sale.customer_phone);
     
     const messageResponse = await client.messages.create({
       body: message,
       from: process.env.TWILIO_WHATSAPP_FROM,
       to: `whatsapp:${formattedPhone}`
     });
     
     // Log message to database
     const logSql = `
       INSERT INTO message_logs (recipient_phone, message_type, template_name, message_content, status, twilio_sid, sale_id, customer_id, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     `;
     
     await executeQuery(logSql, [
       formattedPhone,
       'template',
       'orderConfirmation',
       message,
       'sent',
       messageResponse.sid,
       saleId,
       sale.customer_id,
       req.user.id
     ]);
     
     res.json({
       success: true,
       messageSid: messageResponse.sid,
       status: messageResponse.status
     });
  } catch (error) {
     console.error('Error sending order confirmation:', error);
     
     // Log failed message
     try {
       const logSql = `
         INSERT INTO message_logs (recipient_phone, message_type, template_name, message_content, status, error_message, sale_id, customer_id, sent_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       `;
       
       await executeQuery(logSql, [
         req.body.phone || '',
         'template',
         'orderConfirmation',
         '',
         'failed',
         error.message,
         saleId,
         null,
         req.user.id
       ]);
     } catch (logError) {
       console.error('Error logging failed message:', logError);
     }
     
     res.status(500).json({ error: 'Failed to send order confirmation', details: error.message });
  }
});

// Get message templates
router.get('/templates', authenticateToken, (req, res) => {
  const templates = Object.keys(messageTemplates).map(key => ({
    name: key,
    description: getTemplateDescription(key)
  }));
  
  res.json({ templates });
});

// Get message logs
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, templateName } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = 'SELECT * FROM message_logs WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (templateName) {
      sql += ' AND template_name = ?';
      params.push(templateName);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await executeQuery(sql, params);
    const logs = result.rows || result;
    
    res.json({
      success: true,
      logs: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching message logs:', error);
    res.status(500).json({ error: 'Failed to fetch message logs' });
  }
});

// Test Twilio configuration
router.get('/test-config', authenticateToken, (req, res) => {
  const hasCredentials = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const hasWhatsAppNumber = !!process.env.TWILIO_WHATSAPP_NUMBER;
  
  res.json({
    configured: hasCredentials,
    hasWhatsAppNumber: hasWhatsAppNumber,
    sandboxNumber: hasWhatsAppNumber ? null : 'whatsapp:+14155238886',
    message: hasCredentials ? 
      'Twilio is configured and ready to use' : 
      'Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables'
  });
});

function getTemplateDescription(templateName) {
  const descriptions = {
    orderConfirmation: 'Sent when a new order is placed',
    paymentReminder: 'Sent to remind customers about pending payments',
    orderReady: 'Sent when an order is ready for pickup',
    lowStock: 'Sent to staff when inventory is low'
  };
  
  return descriptions[templateName] || 'Custom template';
}

module.exports = router;