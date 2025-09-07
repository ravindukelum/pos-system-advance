# Barcode and QR Code Support Documentation

## Overview
This POS system supports comprehensive barcode and QR code scanning capabilities using the QuaggaJS library (@ericblade/quagga2) for barcode detection and a custom QR code implementation.

## Supported Barcode Formats

### 1D Barcodes (Linear Barcodes)
The system supports the following 1D barcode formats through QuaggaJS:

- **EAN-13** - European Article Number (13 digits)
- **EAN-8** - European Article Number (8 digits)
- **UPC-A** - Universal Product Code (12 digits)
- **UPC-E** - Universal Product Code (8 digits)
- **Code 128** - High-density linear barcode
- **Code 39** - Alphanumeric barcode
- **Code 39 VIN** - Vehicle Identification Number variant
- **Code 93** - Compact alphanumeric barcode
- **Codabar** - Numeric barcode with start/stop characters
- **Interleaved 2 of 5 (I2of5)** - Numeric-only barcode
- **Standard 2 of 5** - Numeric barcode

### 2D Codes
- **QR Codes** - Quick Response codes for inventory items and sales receipts

## Scanner Features

### Camera Access
- **Multi-camera support** - Automatically detects and allows selection between available cameras
- **Back camera preference** - Prioritizes rear-facing cameras on mobile devices
- **Environment facing mode** - Optimized for scanning physical items

### Scanning Capabilities
- **Real-time detection** - Live camera feed with automatic barcode recognition
- **Visual feedback** - Detection boxes and scan lines overlay
- **Manual input fallback** - Text input option when camera scanning fails
- **Multiple format support** - Simultaneous detection of various barcode types

### Performance Optimizations
- **Multi-worker processing** - Uses 2 web workers for improved performance
- **Configurable frequency** - 10 FPS scanning rate for optimal battery usage
- **Patch-based detection** - Medium patch size with half-sampling for efficiency

## QR Code Implementation

### Generated QR Codes
The system generates QR codes for:

1. **Inventory Items**
   ```json
   {
     "type": "inventory_item",
     "id": "item_id",
     "sku": "item_sku",
     "name": "item_name",
     "price": "sell_price",
     "barcode": "item_barcode"
   }
   ```

2. **Sales Receipts**
   ```json
   {
     "type": "sale_receipt",
     "invoice": "invoice_number",
     "date": "sale_date",
     "total": "total_amount",
     "customer": "customer_name",
     "status": "sale_status"
   }
   ```

### QR Code Specifications
- **Size**: 200x200 pixels for items, 150x150 pixels for sales
- **Margin**: 2 pixels for items, 1 pixel for sales
- **Colors**: Black on white background
- **Format**: Data URL (base64 encoded)

## Barcode Generation

### EAN-13 Format
The system generates internal EAN-13 barcodes with:
- **Prefix**: 200 (internal use)
- **Company ID**: 1234
- **Random digits**: 5-digit random number
- **Check digit**: Automatically calculated

### Example Generated Barcode
`2001234567890` (where 0 is the calculated check digit)

## Browser Compatibility

### Required APIs
- **MediaDevices API** - For camera access
- **WebWorkers** - For background processing
- **Canvas API** - For image processing
- **TypedArrays** - For data manipulation
- **Blob URLs** - For data handling

### Supported Platforms
- ✅ **Desktop**: Chrome, Firefox, Safari, Edge
- ✅ **Android**: Chrome, Firefox, Edge
- ✅ **iOS**: Safari (iOS 15.1+), Chrome, Firefox

### Limitations
- Camera access requires HTTPS in production
- Some older browsers may not support all features
- iOS versions below 15.1 have limited camera API support

## Usage Examples

### Scanning in Sales
1. Click the barcode scan button in the sales interface
2. Allow camera permissions when prompted
3. Point camera at barcode/QR code
4. Item will be automatically added when detected
5. Manual input available as fallback

### Scanning in Inventory
1. Use the scan button when adding/editing items
2. Scan existing barcodes to populate item data
3. Generate new barcodes for items without codes
4. QR codes can be generated for easy mobile access

## Troubleshooting

### Common Issues
- **Camera not working**: Check browser permissions and HTTPS
- **Poor detection**: Ensure good lighting and steady hands
- **Blurry images**: Some devices may lack autofocus
- **Multiple cameras**: Select the appropriate camera from dropdown

### Performance Tips
- Use rear-facing camera for better results
- Ensure adequate lighting
- Hold device steady during scanning
- Clean camera lens for optimal clarity
- Use manual input for damaged or unclear codes

## Technical Implementation

### Libraries Used
- **@ericblade/quagga2**: Advanced barcode scanning
- **qrcode**: QR code generation
- **Custom implementation**: Camera management and UI

### Configuration
```javascript
const scannerConfig = {
  inputStream: {
    constraints: {
      width: { min: 640 },
      height: { min: 480 },
      facingMode: 'environment'
    }
  },
  decoder: {
    readers: [
      "code_128_reader", "ean_reader", "ean_8_reader",
      "code_39_reader", "codabar_reader", "upc_reader",
      "upc_e_reader", "i2of5_reader", "2of5_reader",
      "code_93_reader"
    ]
  },
  numOfWorkers: 2,
  frequency: 10
};
```

This comprehensive barcode support ensures reliable scanning across various formats and devices, making the POS system versatile for different retail environments.