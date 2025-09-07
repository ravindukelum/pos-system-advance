import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  PencilIcon, 
  TrashIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XMarkIcon,
  CheckIcon,
  EyeIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import { inventoryAPI, barcodesAPI } from '../services/api';
import AdvancedBarcodeScanner from '../components/AdvancedBarcodeScanner';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('item_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showSearchBarcodeScanner, setShowSearchBarcodeScanner] = useState(false);
  
  const [formData, setFormData] = useState({
    item_name: '',
    sku: '',
    category: '',
    buy_price: '',
    sell_price: '',
    quantity: '',
    min_stock: '',
    description: '',
    supplier: '',
    barcode: '',
    warranty_days: ''
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await inventoryAPI.getAll();
      setInventory(response.data.inventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        buy_price: parseFloat(formData.buy_price),
        sell_price: parseFloat(formData.sell_price),
        quantity: parseInt(formData.quantity),
        min_stock: parseInt(formData.min_stock || 0),
        warranty_days: parseInt(formData.warranty_days || 0)
      };

      if (editingItem) {
        await inventoryAPI.update(editingItem.id, submitData);
        alert('Item updated successfully!');
      } else {
        await inventoryAPI.create(submitData);
        alert('Item created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchInventory();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Error saving item: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      sku: item.sku,
      category: item.category || '',
      buy_price: item.buy_price.toString(),
      sell_price: item.sell_price.toString(),
      quantity: item.quantity.toString(),
      min_stock: (item.min_stock || 0).toString(),
      description: item.description || '',
      supplier: item.supplier || '',
      barcode: item.barcode || '',
      warranty_days: (item.warranty_days || 0).toString()
    });
    setShowModal(true);
  };

  const handleView = (item) => {
    setViewingItem(item);
    setShowViewModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await inventoryAPI.delete(id);
        fetchInventory();
        alert('Item deleted successfully!');
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) {
      alert('Please select items to delete');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} selected items?`)) {
      try {
        await Promise.all(selectedItems.map(id => inventoryAPI.delete(id)));
        setSelectedItems([]);
        fetchInventory();
        alert('Selected items deleted successfully!');
      } catch (error) {
        console.error('Error deleting items:', error);
        alert('Error deleting items: ' + error.message);
      }
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredInventory.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredInventory.map(item => item.id));
    }
  };

  const resetForm = () => {
    setFormData({
      item_name: '',
      sku: '',
      category: '',
      buy_price: '',
      sell_price: '',
      quantity: '',
      min_stock: '',
      description: '',
      supplier: '',
      barcode: '',
      warranty_days: ''
    });
    setEditingItem(null);
    setShowModal(false);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getUniqueCategories = () => {
    const categories = inventory.map(item => item.category).filter(Boolean);
    return [...new Set(categories)];
  };

  const filteredInventory = inventory
    .filter(item => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (item.supplier && item.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      const matchesStock = stockFilter === 'all' || 
                          (stockFilter === 'low' && item.quantity <= (item.min_stock || 5)) ||
                          (stockFilter === 'out' && item.quantity === 0) ||
                          (stockFilter === 'in' && item.quantity > 0);
      
      return matchesSearch && matchesCategory && matchesStock;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getLowStockItems = () => {
    return inventory.filter(item => item.quantity <= (item.min_stock || 5) && item.quantity > 0);
  };

  const getOutOfStockItems = () => {
    return inventory.filter(item => item.quantity === 0);
  };

  const getTotalValue = () => {
    return inventory.reduce((total, item) => total + (item.quantity * item.buy_price), 0);
  };

  const getStockStatusBadge = (item) => {
    if (item.quantity === 0) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Out of Stock</span>;
    } else if (item.quantity <= (item.min_stock || 5)) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Low Stock</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">In Stock</span>;
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? 
      <ArrowUpIcon className="h-4 w-4 inline ml-1" /> : 
      <ArrowDownIcon className="h-4 w-4 inline ml-1" />;
  };

  const handleBarcodeSearch = async (barcode) => {
    try {
      // First try to lookup the barcode in the backend
      const response = await barcodesAPI.lookup(barcode);
      const item = response.data.item;
      
      if (item) {
        // Product found - set search term to highlight it
        setSearchTerm(item.barcode);
        setShowSearchBarcodeScanner(false);
        alert(`Product found: ${item.name}`);
      } else {
        // Product not found - redirect to add product screen
        setShowSearchBarcodeScanner(false);
        setFormData({
          ...formData,
          barcode: barcode
        });
        setShowModal(true);
        alert('Product not found. Opening add product form with scanned barcode.');
      }
    } catch (error) {
      // If lookup fails, assume product doesn't exist
      setShowSearchBarcodeScanner(false);
      setFormData({
        ...formData,
        barcode: barcode
      });
      setShowModal(true);
      alert('Product not found. Opening add product form with scanned barcode.');
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {selectedItems.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
            >
              <TrashIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Delete Selected ({selectedItems.length})</span>
              <span className="sm:hidden">Delete ({selectedItems.length})</span>
            </button>
          )}

      {/* Barcode Scanner Modal */}
       <AdvancedBarcodeScanner
         isOpen={showBarcodeScanner}
         onScan={(code) => {
           setFormData({...formData, barcode: code});
           setShowBarcodeScanner(false);
         }}
         onClose={() => setShowBarcodeScanner(false)}
       />

      {/* Search Barcode Scanner Modal */}
       <AdvancedBarcodeScanner
         isOpen={showSearchBarcodeScanner}
         onScan={handleBarcodeSearch}
         onClose={() => setShowSearchBarcodeScanner(false)}
       />
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventory.length}</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <div className="w-6 h-6 bg-blue-600 dark:bg-blue-400 rounded"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{getLowStockItems().length}</p>
            </div>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{getOutOfStockItems().length}</p>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <XMarkIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">RS {getTotalValue().toFixed(2)}</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <div className="w-6 h-6 bg-green-600 dark:bg-green-400 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(getLowStockItems().length > 0 || getOutOfStockItems().length > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 dark:text-yellow-300 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Stock Alerts</h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                {getOutOfStockItems().length > 0 && (
                  <p>{getOutOfStockItems().length} items are out of stock</p>
                )}
                {getLowStockItems().length > 0 && (
                  <p>{getLowStockItems().length} items are running low</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, SKU, category, supplier, or scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowSearchBarcodeScanner(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors"
            title="Scan Barcode to Search"
          >
            <QrCodeIcon className="h-5 w-5" />
            Scan
          </button>
        </div>
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-w-0 sm:min-w-[150px]"
        >
          <option value="all">All Categories</option>
          {getUniqueCategories().map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-w-0 sm:min-w-[150px]"
        >
          <option value="all">All Stock Levels</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* Inventory Table - Desktop */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-800"
                />
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('item_name')}
              >
                Item Name {getSortIcon('item_name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('sku')}
              >
                SKU {getSortIcon('sku')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('category')}
              >
                Category {getSortIcon('category')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('quantity')}
              >
                Stock {getSortIcon('quantity')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('buy_price')}
              >
                Buy Price {getSortIcon('buy_price')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('sell_price')}
              >
                Sell Price {getSortIcon('sell_price')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredInventory.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => handleSelectItem(item.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-800"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                    {item.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={item.description}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {item.sku}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {item.category || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{item.quantity}</div>
                  {item.min_stock && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">Min: {item.min_stock}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  RS {parseFloat(item.buy_price).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  RS {parseFloat(item.sell_price).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStockStatusBadge(item)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleView(item)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    title="View Details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                    title="Edit Item"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete Item"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredInventory.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No items found matching your criteria.
          </div>
        )}
        </div>
      </div>

      {/* Inventory Cards - Mobile & Tablet */}
      <div className="lg:hidden space-y-4">
        {/* Select All for Mobile */}
         <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 p-4">
           <label className="flex items-center gap-3">
             <input
               type="checkbox"
               checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
               onChange={handleSelectAll}
               className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
             />
             <span className="text-sm font-medium text-gray-900 dark:text-white">
               Select All ({selectedItems.length} selected)
             </span>
           </label>
         </div>

         {filteredInventory.length === 0 ? (
           <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 p-8 text-center">
             <p className="text-gray-500 dark:text-gray-400">No items found matching your criteria.</p>
           </div>
         ) : (
           filteredInventory.map((item) => (
             <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-700 p-4 hover:shadow-md transition-shadow">
               <div className="flex items-start justify-between mb-3">
                 <div className="flex items-center gap-3">
                   <input
                     type="checkbox"
                     checked={selectedItems.includes(item.id)}
                     onChange={() => handleSelectItem(item.id)}
                     className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 mt-1"
                   />
                   <div>
                     <div className="text-lg font-semibold text-gray-900 dark:text-white">
                       {item.item_name}
                     </div>
                     <div className="text-sm text-gray-500 dark:text-gray-400">
                       {item.category}
                     </div>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <button
                     onClick={() => handleView(item)}
                     className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                     title="View Item"
                   >
                     <EyeIcon className="h-5 w-5" />
                   </button>
                   <button
                     onClick={() => handleEdit(item)}
                     className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                     title="Edit Item"
                   >
                     <PencilIcon className="h-5 w-5" />
                   </button>
                   <button
                     onClick={() => handleDelete(item.id)}
                     className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                     title="Delete Item"
                   >
                     <TrashIcon className="h-5 w-5" />
                   </button>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                 <div>
                   <div className="text-sm text-gray-600 dark:text-gray-400">Price</div>
                   <div className="text-lg font-semibold text-gray-900 dark:text-white">
                     RS {parseFloat(item.sell_price).toFixed(2)}
                   </div>
                 </div>
                 <div>
                   <div className="text-sm text-gray-600 dark:text-gray-400">Stock</div>
                   <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
                     {item.quantity}
                   </div>
                 </div>
                 <div className="col-span-2 sm:col-span-1">
                   <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</div>
                   {getStockStatusBadge(item)}
                 </div>
               </div>
             </div>
           ))
         )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-700 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.item_name}
                    onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Buy Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.buy_price}
                    onChange={(e) => setFormData({...formData, buy_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sell Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.sell_price}
                    onChange={(e) => setFormData({...formData, sell_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minimum Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({...formData, min_stock: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Warranty (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.warranty_days}
                    onChange={(e) => setFormData({...formData, warranty_days: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter warranty period in days"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter barcode or scan using camera"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBarcodeScanner(true)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                      title="Scan Barcode"
                    >
                      <QrCodeIcon className="h-5 w-5" />
                      Scan
                    </button>
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                  >
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-700 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Item Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.item_name}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.sku}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.category || '-'}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.supplier || '-'}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Buy Price</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">RS {parseFloat(viewingItem.buy_price).toFixed(2)}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sell Price</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">RS {parseFloat(viewingItem.sell_price).toFixed(2)}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Stock</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.quantity}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Minimum Stock</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.min_stock || '-'}</p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Warranty</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {viewingItem.warranty_days ? `${viewingItem.warranty_days} days` : 'No warranty'}
                    </p>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <div className="mt-1">{getStockStatusBadge(viewingItem)}</div>
                  </div>
                
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profit Margin</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      RS {((viewingItem.sell_price || 0) - (viewingItem.buy_price || 0)).toFixed(2)} 
                      ({((((viewingItem.sell_price || 0) - (viewingItem.buy_price || 0)) / (viewingItem.buy_price || 1)) * 100).toFixed(1)}%)
                    </p>
                  </div>
                
                  {viewingItem.barcode && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Barcode</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.barcode}</p>
                    </div>
                  )}
                
                  {viewingItem.description && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{viewingItem.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      handleEdit(viewingItem);
                    }}
                    className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                  >
                    Edit Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;