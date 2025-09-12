# WhatsApp Webhook Setup Guide

This guide explains how to configure the WhatsApp webhook in Facebook Developer Console to receive message status updates and enable two-way communication.

## What You Need

### 1. Webhook URL
Your webhook endpoint is now available at:
```
https://yourdomain.com/api/notifications/whatsapp/webhook
```

For local development:
```
http://localhost:5000/api/notifications/whatsapp/webhook
```

### 2. Verify Token
Use the value from your `.env` file:
```
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
```

## Setup Steps

### Step 1: Access Facebook Developer Console
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app
3. Navigate to **WhatsApp > Configuration**

### Step 2: Configure Webhook
1. In the **Webhook** section, click **Edit**
2. Enter your **Callback URL**:
   - Production: `https://yourdomain.com/api/notifications/whatsapp/webhook`
   - Development: Use ngrok or similar service for local testing
3. Enter your **Verify Token** (from your .env file)
4. Click **Verify and Save**

### Step 3: Subscribe to Webhook Fields
Make sure to subscribe to these webhook fields:
- ✅ **messages** - For message status updates and incoming messages
- ✅ **message_deliveries** - For delivery confirmations
- ✅ **message_reads** - For read receipts

### Step 4: Test the Webhook
1. Send a test message using your application
2. Check your server logs for webhook events
3. Verify message status updates in your database

## For Local Development

### Using ngrok (Recommended)
1. Install ngrok: `npm install -g ngrok`
2. Start your backend server: `npm start`
3. In another terminal: `ngrok http 5000`
4. Use the ngrok HTTPS URL in Facebook webhook configuration

### Example ngrok setup:
```bash
# Terminal 1 - Start your backend
cd backend
npm start

# Terminal 2 - Start ngrok
ngrok http 5000
```

Then use the ngrok URL like:
```
https://abc123.ngrok.io/api/notifications/whatsapp/webhook
```

## Environment Variables

Make sure these are set in your `.env` file:
```env
# Required for webhook
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secure_random_string

# Required for API
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

## What the Webhook Does

### Message Status Updates
The webhook automatically updates message statuses in your database:
- **sent** → **delivered** → **read**
- **failed** (if delivery fails)

### Incoming Messages
The webhook can receive and log incoming messages (currently just logged, but can be extended for auto-replies)

## Testing

### Test Webhook Configuration
```bash
# Check if webhook is properly configured
curl http://localhost:5000/api/notifications/test-config
```

### Test Webhook Verification
```bash
# Simulate Facebook's verification request
curl "http://localhost:5000/api/notifications/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_webhook_verify_token&hub.challenge=test_challenge"
```

## Troubleshooting

### Common Issues

1. **Webhook verification fails**
   - Check that `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches exactly
   - Ensure your server is accessible from the internet
   - Check server logs for error messages

2. **No webhook events received**
   - Verify webhook fields are subscribed
   - Check that your webhook URL is correct
   - Ensure your server is running and accessible

3. **SSL/HTTPS required**
   - Facebook requires HTTPS for production webhooks
   - Use ngrok for local development
   - Ensure your production server has valid SSL certificate

### Debug Webhook Events
Check your server logs for webhook activity:
```bash
# In your backend directory
tail -f logs/app.log
# or check console output
```

## Security Notes

1. **Verify Token Security**
   - Use a strong, random verify token
   - Never commit tokens to version control
   - Rotate tokens periodically

2. **Webhook Validation**
   - The webhook validates the verify token
   - Only processes valid WhatsApp webhook events
   - Logs all webhook attempts for monitoring

## Next Steps

After setting up the webhook:
1. Test message sending and status updates
2. Monitor webhook events in your logs
3. Implement auto-replies if needed
4. Set up monitoring and alerts for webhook failures

## Support

For issues:
1. Check server logs for detailed error messages
2. Test webhook configuration with the test endpoint
3. Verify all environment variables are set correctly
4. Consult [WhatsApp Business API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)