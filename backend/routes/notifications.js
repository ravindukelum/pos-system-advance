const express = require('express');
const axios = require('axios');
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

// WhatsApp Business Cloud API configuration
let whatsappConfig = null;

const initializeWhatsApp = () => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  
  if (accessToken && phoneNumberId) {
    whatsappConfig = {
      accessToken,
      phoneNumberId,
      apiUrl: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`
    };
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
    
    // Initialize WhatsApp if not already done
    if (!whatsappConfig && !initializeWhatsApp()) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }

    // Send message via WhatsApp Business Cloud API
    const messageData = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: {
        body: message
      }
    };

    const messageResponse = await axios.post(whatsappConfig.apiUrl, messageData, {
      headers: {
        'Authorization': `Bearer ${whatsappConfig.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Log message to database
    const logSql = `
      INSERT INTO message_logs (recipient_phone, message_type, message_content, status, whatsapp_message_id, sale_id, customer_id, sent_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await executeQuery(logSql, [
      formattedPhone,
      messageType,
      message,
      'sent',
      messageResponse.data.messages[0].id,
      saleId || null,
      customerId || null,
      req.user.id
    ]);
    
    res.json({
      success: true,
      messageId: messageResponse.data.messages[0].id,
      status: 'sent'
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    // Extract detailed error information
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.response) {
      // WhatsApp API returned an error response
      console.error('WhatsApp API Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
      
      errorMessage = error.response.data?.error?.message || 
                    error.response.data?.message || 
                    `WhatsApp API Error: ${error.response.status}`;
      statusCode = error.response.status;
    }
    
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
          errorMessage,
          req.body.saleId || null,
          req.body.customerId || null,
          req.user.id
        ]);
      } catch (logError) {
        console.error('Error logging failed message:', logError);
      }
    }
    
    res.status(statusCode).json({ 
      error: 'Failed to send message', 
      details: errorMessage,
      whatsappError: error.response?.data
    });
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
     
     // Initialize WhatsApp if not already done
     if (!whatsappConfig && !initializeWhatsApp()) {
       return res.status(500).json({ error: 'WhatsApp API not configured' });
     }

     // Send message via WhatsApp Business Cloud API
     const messageData = {
       messaging_product: 'whatsapp',
       to: formattedPhone,
       type: 'text',
       text: {
         body: message
       }
     };

     const messageResponse = await axios.post(whatsappConfig.apiUrl, messageData, {
       headers: {
         'Authorization': `Bearer ${whatsappConfig.accessToken}`,
         'Content-Type': 'application/json'
       }
     });
     
     // Log message to database
     const logSql = `
       INSERT INTO message_logs (recipient_phone, message_type, template_name, message_content, status, whatsapp_message_id, sale_id, customer_id, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     `;
     
     await executeQuery(logSql, [
       formattedPhone,
       'template',
       templateName,
       message,
       'sent',
       messageResponse.data.messages[0].id,
       saleId || null,
       customerId || null,
       req.user.id
     ]);
     
     res.json({
       success: true,
       messageId: messageResponse.data.messages[0].id,
       status: 'sent',
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
     
     // Initialize WhatsApp if not already done
     if (!whatsappConfig && !initializeWhatsApp()) {
       return res.status(500).json({ error: 'WhatsApp API not configured' });
     }

     // Send message via WhatsApp Business Cloud API
     const messageData = {
       messaging_product: 'whatsapp',
       to: formattedPhone,
       type: 'text',
       text: {
         body: message
       }
     };

     const messageResponse = await axios.post(whatsappConfig.apiUrl, messageData, {
       headers: {
         'Authorization': `Bearer ${whatsappConfig.accessToken}`,
         'Content-Type': 'application/json'
       }
     });
     
     // Log message to database
     const logSql = `
       INSERT INTO message_logs (recipient_phone, message_type, template_name, message_content, status, whatsapp_message_id, sale_id, customer_id, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     `;
     
     await executeQuery(logSql, [
       formattedPhone,
       'template',
       'orderConfirmation',
       message,
       'sent',
       messageResponse.data.messages[0].id,
       saleId,
       sale.customer_id,
       req.user.id
     ]);
     
     res.json({
       success: true,
       messageId: messageResponse.data.messages[0].id,
       status: 'sent'
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

// Get WhatsApp message templates (alias for frontend compatibility)
router.get('/whatsapp/templates', authenticateToken, (req, res) => {
  const templates = Object.keys(messageTemplates).map((key, index) => ({
    id: index + 1,
    name: key,
    content: getTemplateDescription(key),
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

// Get WhatsApp message history (alias for frontend compatibility)
router.get('/whatsapp/messages', authenticateToken, async (req, res) => {
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
      messages: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// WhatsApp webhook endpoint for receiving events
router.get('/whatsapp/webhook', (req, res) => {
  // Webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log('✅ WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      console.log('❌ WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// WhatsApp webhook endpoint for receiving events
router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // Check if this is a WhatsApp status update
    if (body.object === 'whatsapp_business_account') {
      body.entry.forEach(async (entry) => {
        const changes = entry.changes;
        
        changes.forEach(async (change) => {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Handle message status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                await handleMessageStatus(status);
              }
            }
            
            // Handle incoming messages (if needed)
            if (value.messages) {
              for (const message of value.messages) {
                await handleIncomingMessage(message);
              }
            }
          }
        });
      });
    }
    
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Handle message status updates
const handleMessageStatus = async (status) => {
  try {
    const messageId = status.id;
    const newStatus = status.status; // delivered, read, failed, etc.
    const timestamp = status.timestamp;
    
    // Update message status in database
    const updateSql = `
      UPDATE message_logs 
      SET status = ?, updated_at = FROM_UNIXTIME(?)
      WHERE whatsapp_message_id = ?
    `;
    
    await executeQuery(updateSql, [newStatus, timestamp, messageId]);
    console.log(`📱 Updated message ${messageId} status to: ${newStatus}`);
  } catch (error) {
    console.error('Error updating message status:', error);
  }
};

// Handle incoming messages (optional - for future use)
const handleIncomingMessage = async (message) => {
  try {
    console.log('📨 Received incoming message:', message);
    // You can implement auto-replies or message logging here
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
};

// Test WhatsApp Business Cloud API configuration
router.get('/test-config', authenticateToken, (req, res) => {
  const hasAccessToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
  const hasPhoneNumberId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  const hasBusinessAccountId = !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const hasWebhookToken = !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const configured = hasAccessToken && hasPhoneNumberId;
  
  res.json({
    configured: configured,
    status: configured ? 'Connected' : 'Disconnected',
    hasAccessToken: hasAccessToken,
    hasPhoneNumberId: hasPhoneNumberId,
    hasBusinessAccountId: hasBusinessAccountId,
    hasWebhookToken: hasWebhookToken,
    webhookUrl: `${req.protocol}://${req.get('host')}/api/notifications/whatsapp/webhook`,
    message: configured ? 
      'WhatsApp Business Cloud API is configured and ready to use' : 
      'Please configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables'
  });
});

function getTemplateDescription(templateName) {
  const sampleData = {
    orderConfirmation: {
      customerName: 'John Doe',
      invoice: 'INV-001',
      totalAmount: '25.50',
      items: [{ name: 'Coffee', quantity: 2, total: '10.00' }],
      shopName: 'Your Shop',
      shopAddress: 'Main Street'
    },
    paymentReminder: {
      customerName: 'John Doe',
      invoice: 'INV-001',
      totalAmount: '25.50',
      dueAmount: '15.00',
      shopName: 'Your Shop'
    },
    lowStockAlert: {
      itemName: 'Coffee Beans',
      currentStock: 5,
      minStock: 20,
      shopName: 'Your Shop'
    },
    welcomeMessage: {
      customerName: 'John Doe',
      shopName: 'Your Shop',
      loyaltyPoints: 100
    },
    promotional: {
      customerName: 'John Doe',
      offerTitle: '20% Off Weekend Sale',
      offerDetails: 'Get 20% off on all items this weekend!',
      validUntil: '2024-01-31',
      shopName: 'Your Shop'
    },
    custom: {
      customerName: 'John Doe',
      message: 'Thank you for your business!',
      shopName: 'Your Shop'
    },
    orderReady: {
      invoice: 'INV-001',
      customerName: 'John Doe',
      shopName: 'Your Shop',
      shopAddress: 'Main Street'
    },
    birthdayWish: {
      customerName: 'John Doe',
      shopName: 'Your Shop',
      specialOffer: '20% off on your birthday!'
    }
  };
  
  if (messageTemplates[templateName] && sampleData[templateName]) {
    return messageTemplates[templateName](sampleData[templateName]);
  }
  
  return 'Custom template';
}

module.exports = router;