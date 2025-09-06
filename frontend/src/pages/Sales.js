import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  TrashIcon, 
  ShoppingCartIcon,
  PrinterIcon,
  XMarkIcon,
  MinusIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { salesAPI, inventoryAPI, settingsAPI } from '../services/api';
import PrintInvoice from '../components/PrintInvoice';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  
  // Cart state for new invoice
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: ''
  });
  const [invoiceSettings, setInvoiceSettings] = useState({
    taxRate: 0,
    discountAmount: 0,
    paidAmount: 0
  });
  
  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => {
    fetchSales();
    fetchInventory();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await salesAPI.getAll();
      setSales(response.data.sales);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await inventoryAPI.getAll();
      setInventory(response.data.inventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const addToCart = (item) => {
    const currentCart = cart || [];
    const existingItem = currentCart.find(cartItem => cartItem.item_id === item.id);
    
    if (existingItem) {
      if (existingItem.quantity < item.quantity) {
        setCart(currentCart.map(cartItem =>
          cartItem.item_id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
      } else {
        alert('Cannot add more items than available in stock');
      }
    } else {
      if (item.quantity > 0) {
        setCart([...currentCart, {
          item_id: item.id,
          item_name: item.item_name,
          unit_price: parseFloat(item.sell_price),
          quantity: 1,
          max_quantity: item.quantity
        }]);
      } else {
        alert('Item is out of stock');
      }
    }
  };

  const updateCartQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const currentCart = cart || [];
    const item = currentCart.find(cartItem => cartItem.item_id === itemId);
    if (newQuantity > item.max_quantity) {
      alert('Cannot exceed available stock');
      return;
    }

    setCart(currentCart.map(cartItem =>
      cartItem.item_id === itemId
        ? { ...cartItem, quantity: newQuantity }
        : cartItem
    ));
  };

  const removeFromCart = (itemId) => {
    const currentCart = cart || [];
    setCart(currentCart.filter(cartItem => cartItem.item_id !== itemId));
  };

  const calculateTotals = () => {
    const currentCart = cart || [];
    const subtotal = currentCart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const taxAmount = (subtotal * invoiceSettings.taxRate) / 100;
    const total = subtotal + taxAmount - invoiceSettings.discountAmount;
    
    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const handleCreateSale = async () => {
    const currentCart = cart || [];
    if (currentCart.length === 0) {
      alert('Please add items to cart');
      return;
    }

    try {
      const totals = calculateTotals();
      const saleData = {
        items: currentCart,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        tax_rate: invoiceSettings.taxRate,
        discount_amount: invoiceSettings.discountAmount,
        paid_amount: invoiceSettings.paidAmount
      };

      await salesAPI.create(saleData);
      
      // Reset form
      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
      setInvoiceSettings({ taxRate: 0, discountAmount: 0, paidAmount: 0 });
      setShowModal(false);
      
      fetchSales();
      fetchInventory();
      alert('Sale created successfully!');
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error creating sale: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdatePayment = async () => {
    try {
      await salesAPI.updatePayment(selectedSale.id, { paid_amount: paymentAmount });
      setShowPaymentModal(false);
      setSelectedSale(null);
      setPaymentAmount(0);
      fetchSales();
      alert('Payment updated successfully!');
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('Error updating payment: ' + (error.response?.data?.error || error.message));
    }
  };

  const openPaymentModal = (sale) => {
    setSelectedSale(sale);
    setPaymentAmount(parseFloat(sale.paid_amount));
    setShowPaymentModal(true);
  };

  const openPrintModal = (sale) => {
    setSelectedSale(sale);
    setShowPrintModal(true);
  };

  const handleDirectPrint = (sale) => {
    // Use the PrintInvoice component for printing
    setSelectedSale(sale);
    setShowPrintModal(true);
  };

  const filteredSales = (sales || []).filter(sale => {
    const matchesSearch = sale.invoice.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (sale.customer_name && sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (sale.items_summary && sale.items_summary.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredInventory = (inventory || []).filter(item => 
    item.item_name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(itemSearchTerm.toLowerCase())
  );

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 w-full sm:w-auto justify-center transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="hidden xs:inline">New Sale</span>
          <span className="xs:hidden">New</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by invoice, customer, or items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
          
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center sm:justify-start lg:justify-center">
            Total Sales: <span className="font-medium ml-1 text-gray-900 dark:text-white">{filteredSales.length}</span>
          </div>
        </div>
      </div>

      {/* Sales Table - Desktop */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
               {filteredSales.length === 0 ? (
                 <tr>
                   <td colSpan="8" className="text-center py-8 text-gray-500 dark:text-gray-400">
                     No sales found matching your criteria.
                   </td>
                 </tr>
               ) : (
                 filteredSales.map((sale) => (
                   <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                       {sale.invoice}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                       {new Date(sale.created_at).toLocaleDateString()}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                       <div>
                         <div className="font-medium text-gray-900 dark:text-white">{sale.customer_name || 'Walk-in Customer'}</div>
                         {sale.customer_phone && (
                           <div className="text-xs text-gray-400 dark:text-gray-500">{sale.customer_phone}</div>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                       <div className="max-w-xs truncate" title={sale.items_summary}>
                         {sale.items_summary}
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                       RS {parseFloat(sale.total_amount).toFixed(2)}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                       RS {parseFloat(sale.paid_amount).toFixed(2)}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                         sale.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                         sale.status === 'unpaid' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                         'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                       }`}>
                         {sale.status}
                       </span>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                       <button
                         onClick={() => handleDirectPrint(sale)}
                         className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                         title="Print Invoice"
                       >
                         <PrinterIcon className="h-5 w-5" />
                       </button>
                       <button
                         onClick={() => openPaymentModal(sale)}
                         className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                         title="Update Payment"
                       >
                         <CurrencyDollarIcon className="h-5 w-5" />
                       </button>
                       <button
                         onClick={() => console.log('Delete sale:', sale.id)}
                         className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                         title="Delete Sale"
                       >
                         <TrashIcon className="h-5 w-5" />
                       </button>
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
          </table>
        </div>
      </div>

      {/* Sales Cards - Mobile & Tablet */}
      <div className="lg:hidden space-y-4">
        {filteredSales.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No sales found matching your criteria.</p>
          </div>
        ) : (
          filteredSales.map((sale) => (
            <div key={sale.id} className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {sale.invoice}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    sale.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    sale.status === 'unpaid' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}>
                    {sale.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(sale.created_at).toLocaleDateString()}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Customer</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {sale.customer_name || 'Walk-in Customer'}
                  </div>
                  {sale.customer_phone && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{sale.customer_phone}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Items</div>
                  <div className="text-sm text-gray-900 dark:text-white truncate" title={sale.items_summary}>
                    {sale.items_summary}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    RS {parseFloat(sale.total_amount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Paid Amount</div>
                  <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    RS {parseFloat(sale.paid_amount).toFixed(2)}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleDirectPrint(sale)}
                  className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Print Invoice"
                >
                  <PrinterIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => openPaymentModal(sale)}
                  className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Update Payment"
                >
                  <CurrencyDollarIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => console.log('Delete sale:', sale.id)}
                  className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete Sale"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Sale Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-700 w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Create New Sale</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6">
              {/* Left Column - Inventory */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Available Items</h3>
                
                {/* Item Search */}
                <div className="relative mb-4">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>

                {/* Items List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredInventory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Stock: {item.quantity}</div>
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">RS {item.sell_price}</div>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        disabled={item.quantity === 0}
                        className="bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Cart & Invoice */}
              <div className="flex flex-col h-full max-h-[calc(100vh-200px)] overflow-hidden">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <ShoppingCartIcon className="h-5 w-5" />
                  Cart ({(cart || []).length} items)
                </h3>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {/* Customer Information */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Customer Information</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name (Optional)"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number (Optional)"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Cart Items */}
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {(cart || []).map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              const currentCart = cart || [];
                              setCart(currentCart.map(cartItem => 
                                cartItem.item_id === item.item_id 
                                  ? { ...cartItem, unit_price: newPrice }
                                  : cartItem
                              ));
                            }}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            step="0.01"
                            min="0"
                          /> RS each
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(item.item_id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                        >
                          <MinusIcon className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center text-gray-900 dark:text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.item_id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.item_id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-2"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">RS {(item.unit_price * item.quantity).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                  
                  {(cart || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Cart is empty. Add items from the left panel.
                    </div>
                  )}
                </div>

                {/* Invoice Settings */}
                {(cart || []).length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Invoice Settings</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tax Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={invoiceSettings.taxRate}
                          onChange={(e) => setInvoiceSettings({...invoiceSettings, taxRate: parseFloat(e.target.value) || 0})}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Discount (RS)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={invoiceSettings.discountAmount}
                          onChange={(e) => setInvoiceSettings({...invoiceSettings, discountAmount: parseFloat(e.target.value) || 0})}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Paid Amount (RS)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={invoiceSettings.paidAmount}
                          onChange={(e) => setInvoiceSettings({...invoiceSettings, paidAmount: parseFloat(e.target.value) || 0})}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Totals */}
                {(cart || []).length > 0 && (
                  <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>Subtotal:</span>
                        <span>RS {totals.subtotal}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>Tax ({invoiceSettings.taxRate}%):</span>
                        <span>RS {totals.taxAmount}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>Discount:</span>
                        <span>-RS {invoiceSettings.discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-gray-600 pt-1 text-gray-900 dark:text-white">
                        <span>Total:</span>
                        <span>RS {totals.total}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>Paid:</span>
                        <span>RS {invoiceSettings.paidAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-700 dark:text-gray-300">Balance:</span>
                        <span className={parseFloat(totals.total) - invoiceSettings.paidAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                          RS {(parseFloat(totals.total) - invoiceSettings.paidAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSale}
                    disabled={(cart || []).length === 0}
                    className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    Create Sale
                  </button>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-700 p-4 sm:p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Update Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice: {selectedSale.invoice}
                </label>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total Amount: RS {parseFloat(selectedSale.total_amount).toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Current Paid: RS {parseFloat(selectedSale.paid_amount).toFixed(2)}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Paid Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePayment}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Update Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && selectedSale && (
        <PrintInvoice 
          sale={selectedSale} 
          onClose={() => setShowPrintModal(false)} 
        />
      )}
    </div>
  );
};

export default Sales;