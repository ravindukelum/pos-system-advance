# WhatsApp Business Cloud API Migration Guide

This guide explains how to migrate from Twilio WhatsApp to WhatsApp Business Cloud API by Meta/Facebook.

## What Changed

### Dependencies
- ✅ Removed: `twilio` package
- ✅ Added: `axios` for HTTP requests

### Environment Variables
Update your `.env` file with the following new variables:

```env
# WhatsApp Business Cloud API Configuration
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
```

### Database Changes
- ✅ Updated `message_logs` table: `twilio_sid` → `whatsapp_message_id`
- ✅ Migration script created: `database/migrations/001_update_message_logs_whatsapp.sql`

## Setup Instructions

### 1. Get WhatsApp Business Cloud API Credentials

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add "WhatsApp Business Platform" product
4. Get the following credentials:
   - **Access Token**: From your app's WhatsApp > API Setup
   - **Phone Number ID**: From your WhatsApp phone number
   - **Business Account ID**: From your WhatsApp Business Account
   - **Webhook Verify Token**: Create a secure random string

### 2. Update Environment Variables

1. Copy `.env.example` to `.env` if you haven't already
2. Update the WhatsApp configuration section with your credentials
3. Remove old Twilio variables (optional)

### 3. Run Database Migration

If you have existing data, run the migration script:

```sql
-- For MySQL
ALTER TABLE message_logs CHANGE COLUMN twilio_sid whatsapp_message_id VARCHAR(100);

-- For PostgreSQL
-- ALTER TABLE message_logs RENAME COLUMN twilio_sid TO whatsapp_message_id;
```

### 4. Test the Configuration

Run the test script to verify everything is working:

```bash
node test/whatsapp-api-test.js
```

### 5. Restart Your Application

Restart your backend server to load the new configuration.

## API Differences

### Message Format
**Before (Twilio):**
```javascript
const message = await client.messages.create({
  body: 'Hello World',
  from: 'whatsapp:+14155238886',
  to: 'whatsapp:+1234567890'
});
```

**After (WhatsApp Business Cloud API):**
```javascript
const response = await axios.post(apiUrl, {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'text',
  text: { body: 'Hello World' }
}, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Response Format
**Before (Twilio):**
```javascript
{
  sid: 'SM1234567890abcdef',
  status: 'queued'
}
```

**After (WhatsApp Business Cloud API):**
```javascript
{
  messages: [{
    id: 'wamid.1234567890abcdef'
  }]
}
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all WhatsApp credentials are set in your `.env` file
   - Restart your application after updating environment variables

2. **"API connectivity failed"**
   - Verify your access token is valid and not expired
   - Check that your phone number is verified in Facebook Business Manager
   - Ensure your app has the necessary permissions

3. **"Phone number not found"**
   - Verify the phone number ID in your WhatsApp Business API setup
   - Make sure the phone number is added to your WhatsApp Business Account

### Testing

Use the test configuration endpoint:
```bash
GET /api/notifications/test-config
```

This will return the current configuration status and help identify any missing setup.

## Benefits of Migration

- ✅ **No Sandbox Limitations**: Send messages to any verified number
- ✅ **Better Rate Limits**: Higher message throughput
- ✅ **Rich Media Support**: Send images, documents, and interactive messages
- ✅ **Template Management**: Better template approval and management
- ✅ **Cost Effective**: Potentially lower costs compared to Twilio
- ✅ **Direct Integration**: No third-party service dependency

## Support

For issues with the migration:
1. Check the test script output: `node test/whatsapp-api-test.js`
2. Review application logs for detailed error messages
3. Verify WhatsApp Business API documentation: [Meta for Developers](https://developers.facebook.com/docs/whatsapp)