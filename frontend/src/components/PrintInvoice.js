import React, { useState, useEffect } from 'react';
import { settingsAPI, salesAPI } from '../services/api';
import './PrintInvoice.css';

const PrintInvoice = ({ sale, onClose }) => {
  const [settings, setSettings] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch settings
        const settingsResponse = await settingsAPI.getSettings();
        setSettings(settingsResponse.data);
        
        // Fetch detailed sale information with items
        const saleResponse = await salesAPI.getById(sale.id);
        setSaleDetails(saleResponse.data.sale);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Use default settings if API fails
        setSettings({
          shopName: 'SMALL POS SYSTEM',
          shopPhone: '',
          shopEmail: '',
          shopAddress: '',
          currency: 'RS',
          warrantyPeriod: 30,
          warrantyTerms: 'Standard warranty terms apply.',
          receiptFooter: 'Thank you for your business!'
        });
        setSaleDetails(sale);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sale]);
  const handlePreview = () => {
    setIsPreviewMode(true);
  };

  const handlePrint = (e) => {
    // Prevent any default behavior that might close the modal
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      console.log('Print button clicked - replacing current page with invoice');
      
      // Create the invoice HTML content
      const invoiceContent = generateInvoiceHTML();
      
      // Store current page content
      const originalContent = document.documentElement.outerHTML;
      
      // Replace current page with invoice
      document.open();
      document.write(invoiceContent);
      document.close();
      
      // Auto-print after a short delay
      setTimeout(() => {
        window.print();
        
        // Restore original content after print dialog
        setTimeout(() => {
          document.open();
          document.write(originalContent);
          document.close();
          
          // Re-initialize React if needed
          window.location.reload();
        }, 1000);
      }, 500);
      
      console.log('Invoice displayed in current tab successfully');
    } catch (error) {
      console.error('Print error:', error);
      alert('Unable to display invoice. Please try again.');
      // Reload page if error occurs
      window.location.reload();
    }
  };

  const generateInvoiceHTML = () => {
    const subtotal = getSubtotal();
    const tax = calculateTax();
    const discount = parseFloat(sale.discount_amount || 0);
    const total = parseFloat(sale.total_amount);
    const paid = parseFloat(sale.paid_amount || 0);
    const balance = total - paid;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${sale.invoice}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.4;
            color: #000;
            background: white;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            font-size: 12pt;
          }
          
          .receipt {
            width: 100%;
            background: white;
            padding: 20px;
            border: 1px solid #ddd;
            position: relative;
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
          }
          
          .watermark {
             position: absolute;
             top: 50%;
             left: 50%;
             transform: translate(-50%, -50%) rotate(45deg);
             font-size: 120px;
             color: rgba(0, 0, 0, 0.05);
             font-weight: bold;
             z-index: 1;
             pointer-events: none;
             white-space: nowrap;
           }
          
          .content {
            position: relative;
            z-index: 2;
            background: transparent;
          }
          
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          
          .mb-2 { margin-bottom: 8px; }
          .mb-4 { margin-bottom: 16px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .my-2 { margin: 8px 0; }
          .my-3 { margin: 12px 0; }
          
          .text-xl { font-size: 20px; }
          .text-lg { font-size: 14pt; font-weight: bold; }
          .text-sm { font-size: 11pt; }
          .text-xs { font-size: 10pt; }
          
          .font-bold { font-weight: bold; }
          .font-mono { font-family: monospace; }
          
          .dashed-line {
            border-bottom: 1px dashed #666;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 11pt;
          }
          
          th, td {
            padding: 8px 4px;
            text-align: left;
            border-bottom: 1px solid #ddd;
            vertical-align: top;
          }
          
          th {
            font-weight: bold;
            background: #f5f5f5;
            font-size: 11pt;
            text-align: center;
          }
          
          td {
            font-size: 11pt;
          }
          
          .text-right { text-align: right; }
          
          .flex {
            display: flex;
          }
          
          .justify-between {
            justify-content: space-between;
          }
          
          .logo {
            max-height: 64px;
            max-width: 128px;
            object-fit: contain;
            margin: 0 auto;
            display: block;
          }
          
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            
            .receipt {
              border: none;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
           <div class="watermark">
             GRAY MOBILE
           </div>
          
          <div class="content">
            <!-- Header -->
            <div class="text-center mb-4">
              <h1 class="text-xl font-bold mb-2">INVOICE</h1>
              ${settings?.shopLogoUrl ? 
                `<div class="mb-2">
                  <img src="${settings.shopLogoUrl}" alt="Shop Logo" class="logo" />
                </div>` : ''
              }
              <h2 class="text-lg font-bold">${settings?.shopName || 'SMALL POS SYSTEM'}</h2>
              ${settings?.shopPhone ? `<p class="text-xs">Phone: ${settings.shopPhone}</p>` : ''}
              ${settings?.shopEmail ? `<p class="text-xs">Email: ${settings.shopEmail}</p>` : ''}
              ${settings?.shopAddress ? `<p class="text-xs">${settings.shopAddress}</p>` : ''}
              ${(settings?.shopCity || settings?.shopState) ? 
                `<p class="text-xs">
                  ${settings.shopCity || ''}${settings.shopCity && settings.shopState ? ', ' : ''}${settings.shopState || ''}
                </p>` : ''
              }
              <p class="text-sm mt-1">Point of Sale Receipt</p>
              <div class="dashed-line my-2"></div>
            </div>

            <!-- Invoice Details -->
            <div class="mb-4 text-sm">
              <div class="flex justify-between">
                <span>Invoice:</span>
                <span class="font-mono">${sale.invoice}</span>
              </div>
              <div class="flex justify-between">
                <span>Date:</span>
                <span>${formatDate(sale.date)}</span>
              </div>
              <div class="flex justify-between">
                <span>Customer:</span>
                <span>${sale.customer_name || 'Walk-in Customer'}</span>
              </div>
              ${sale.customer_phone ? 
                `<div class="flex justify-between">
                  <span>Phone:</span>
                  <span>${sale.customer_phone}</span>
                </div>` : ''
              }
            </div>

            <!-- Items Table -->
            <table>
              <thead>
                <tr>
                  <th class="text-left">Item</th>
                  <th class="text-center">Qty</th>
                  <th class="text-right">Price</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(saleDetails?.items || []).map(item => `
                  <tr>
                    <td>${item.item_name}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">${settings?.currency || 'RS'} ${parseFloat(item.unit_price).toFixed(2)}</td>
                    <td class="text-right">${settings?.currency || 'RS'} ${parseFloat(item.line_total).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="dashed-line my-3"></div>

            <!-- Summary -->
            <div class="text-sm">
              <div class="flex justify-between">
                <span>Items: ${(saleDetails?.items || []).length}</span>
                <span></span>
              </div>
              
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${settings?.currency || 'RS'} ${subtotal.toFixed(2)}</span>
              </div>
              
              ${tax > 0 ? `
                <div class="flex justify-between">
                  <span>Tax:</span>
                  <span>${settings?.currency || 'RS'} ${tax.toFixed(2)}</span>
                </div>
              ` : ''}
              
              ${discount > 0 ? `
                <div class="flex justify-between">
                  <span>Discount:</span>
                  <span>-${settings?.currency || 'RS'} ${discount.toFixed(2)}</span>
                </div>
              ` : ''}
              
              <div class="flex justify-between font-bold">
                <span>Total:</span>
                <span>${settings?.currency || 'RS'} ${total.toFixed(2)}</span>
              </div>
              
              <div class="flex justify-between">
                <span>Paid:</span>
                <span>${settings?.currency || 'RS'} ${paid.toFixed(2)}</span>
              </div>
              
              <div class="flex justify-between font-bold">
                <span>Balance:</span>
                <span>${settings?.currency || 'RS'} ${balance.toFixed(2)}</span>
              </div>
            </div>

            <div class="dashed-line my-3"></div>

            <!-- Footer -->
            <div class="text-center text-xs">
              <p>${settings?.receiptFooter || 'Thank you for your business!'}</p>
              <p>Status: ${sale.status.toUpperCase()}</p>
              ${settings?.warrantyPeriod ? `
                <div class="mt-2">
                  <p>Warranty: ${settings.warrantyPeriod} days</p>
                  ${settings.warrantyTerms ? `<p class="text-xs mt-1">${settings.warrantyTerms}</p>` : ''}
                </div>
              ` : ''}
              <p class="mt-2">Powered by ${settings?.shopName || 'Small POS System'}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getSubtotal = () => {
    if (saleDetails?.items && saleDetails.items.length > 0) {
      return saleDetails.items.reduce((sum, item) => sum + parseFloat(item.line_total), 0);
    }
    return parseFloat(sale.subtotal || sale.total_amount) - (sale.discount_amount || 0);
  };

  const calculateTax = () => {
    if (saleDetails?.tax_amount !== undefined) {
      return parseFloat(saleDetails.tax_amount);
    }
    const subtotal = getSubtotal();
    return subtotal * ((sale.tax_rate || 0) / 100);
  };

  return (
    <>

      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-lg w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4 no-print">
            <h2 className="text-xl font-bold text-gray-900">
              {isPreviewMode ? 'Invoice Preview' : 'Print Invoice'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Print Preview */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading settings...</span>
            </div>
          ) : (
          <div className="print-area">
            <div className="receipt border border-gray-200 rounded w-full">
              {/* Watermark */}
              <div className="watermark text-watermark">
                GRAY MOBILE
              </div>
              
              <div className="content">
                {/* Header */}
                <div className="text-center mb-4">
                  <h1 className="text-xl font-bold mb-2">INVOICE</h1>
                {settings?.shopLogoUrl && (
                  <div className="mb-2">
                    <img 
                      src={settings.shopLogoUrl} 
                      alt="Shop Logo" 
                      className="mx-auto max-h-16 max-w-32 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <h2 className="text-lg font-bold">{settings?.shopName || 'SMALL POS SYSTEM'}</h2>
                {settings?.shopPhone && (
                  <p className="text-xs">Phone: {settings.shopPhone}</p>
                )}
                {settings?.shopEmail && (
                  <p className="text-xs">Email: {settings.shopEmail}</p>
                )}
                {settings?.shopAddress && (
                  <p className="text-xs">{settings.shopAddress}</p>
                )}
                {(settings?.shopCity || settings?.shopState) && (
                  <p className="text-xs">
                    {settings.shopCity}{settings.shopCity && settings.shopState ? ', ' : ''}{settings.shopState}
                  </p>
                )}
                <p className="text-sm mt-1">Point of Sale Receipt</p>
                <div className="dashed-line border-b border-dashed border-gray-400 my-2"></div>
              </div>

              {/* Invoice Details */}
              <div className="mb-4 text-sm">
                <div className="flex justify-between">
                  <span>Invoice:</span>
                  <span className="font-mono">{sale.invoice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatDate(sale.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{sale.customer_name || 'Walk-in Customer'}</span>
                </div>
                {sale.customer_phone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span>{sale.customer_phone}</span>
                  </div>
                )}
              </div>

              <div className="dashed-line border-b border-dashed border-gray-400 my-2"></div>

              {/* Items */}
              <div className="mb-4">
                <div className="text-sm font-bold mb-2">ITEMS:</div>

                {saleDetails?.items && saleDetails.items.length > 0 ? (
                  <div className="text-xs">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 text-xs">Item</th>
                          <th className="text-center py-1 text-xs">Qty</th>
                          <th className="text-right py-1 text-xs">Price</th>
                          <th className="text-right py-1 text-xs">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleDetails.items.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-1 text-xs">{item.item_name}</td>
                            <td className="text-center py-1 text-xs">{item.quantity}</td>
                            <td className="text-right py-1 text-xs">{settings?.currency || 'RS'} {parseFloat(item.unit_price).toFixed(2)}</td>
                            <td className="text-right py-1 text-xs">{settings?.currency || 'RS'} {parseFloat(item.line_total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-xs text-gray-600 mt-1">({saleDetails.items.length} item(s))</div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No items found</div>
                )}
              </div>

              <div className="dashed-line border-b border-dashed border-gray-400 my-2"></div>

              {/* Totals */}
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{settings?.currency || 'RS'} {getSubtotal().toFixed(2)}</span>
                </div>
                
                {sale.tax_rate > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({sale.tax_rate}%):</span>
                    <span>{settings?.currency || 'RS'} {calculateTax().toFixed(2)}</span>
                  </div>
                )}
                
                {sale.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-{settings?.currency || 'RS'} {parseFloat(sale.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="dashed-line border-b border-dashed border-gray-400 my-1"></div>
                
                <div className="total-line flex justify-between font-bold text-base">
                  <span>TOTAL:</span>
                  <span>{settings?.currency || 'RS'} {parseFloat(sale.total_amount).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Paid:</span>
                  <span>{settings?.currency || 'RS'} {parseFloat(sale.paid_amount).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between font-bold">
                  <span>Balance:</span>
                  <span className={parseFloat(sale.total_amount) - parseFloat(sale.paid_amount) > 0 ? 'text-red-600' : 'text-green-600'}>
                    {settings?.currency || 'RS'} {(parseFloat(sale.total_amount) - parseFloat(sale.paid_amount)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="dashed-line border-b border-dashed border-gray-400 my-3"></div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-600">
                <p>{settings?.receiptFooter || 'Thank you for your business!'}</p>
                <p>Status: {sale.status.toUpperCase()}</p>
                {settings?.warrantyPeriod && (
                  <div className="mt-2">
                    <p>Warranty: {settings.warrantyPeriod} days</p>
                    {settings.warrantyTerms && (
                      <p className="text-xs mt-1">{settings.warrantyTerms}</p>
                    )}
                  </div>
                )}
                <p className="mt-2">Powered by {settings?.shopName || 'Small POS System'}</p>
              </div>
              </div>
            </div>
          </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 no-print">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            {isPreviewMode ? (
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Now
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PrintInvoice;