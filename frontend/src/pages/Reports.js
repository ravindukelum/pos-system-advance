import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UsersIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const { hasPermission } = useAuth();

  const tabs = [
    { id: 'sales', name: 'Sales Report', icon: ShoppingCartIcon },
    { id: 'products', name: 'Product Report', icon: CubeIcon },
    { id: 'customers', name: 'Customer Report', icon: UsersIcon },
    { id: 'inventory', name: 'Inventory Report', icon: CubeIcon },
    { id: 'financial', name: 'Financial Report', icon: CurrencyDollarIcon },
    { id: 'tax', name: 'Tax Report', icon: DocumentArrowDownIcon },
  ];

  useEffect(() => {
    fetchReportData();
  }, [activeTab, dateRange]);

  const fetchReportData = async () => {
    if (!hasPermission('reports.view')) return;
    
    setLoading(true);
    try {
      let response;
      let summaryResponse;
      let categoriesResponse;
      
      // Fetch main report data
      switch (activeTab) {
        case 'sales':
          response = await reportsAPI.getSalesReport(dateRange);
          break;
        case 'products':
          response = await reportsAPI.getProductReport(dateRange);
          break;
        case 'customers':
          response = await reportsAPI.getCustomerReport(dateRange);
          break;
        case 'financial':
          response = await reportsAPI.getFinancialReport(dateRange);
          break;
        case 'tax':
          response = await reportsAPI.getTaxReport(dateRange);
          break;
        case 'inventory':
          response = await reportsAPI.getInventoryReport(dateRange);
          break;
        default:
          response = await reportsAPI.getSalesReport(dateRange);
      }
      
      // Fetch enhanced analytics for sales reports
      if (activeTab === 'sales') {
        try {
          summaryResponse = await reportsAPI.getAnalyticsSummary(dateRange);
          categoriesResponse = await reportsAPI.getCategoriesAnalytics(dateRange);
        } catch (analyticsError) {
          console.warn('Analytics data not available:', analyticsError);
        }
      }
      
      // Combine all data
      const combinedData = {
        ...response.data,
        summary: summaryResponse?.data?.summary || response.data?.summary || {},
        categories: categoriesResponse?.data?.categories || response.data?.categories || []
      };
      
      setReportData(combinedData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.exportCSV(activeTab, dateRange);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTab}_report_${dateRange.start_date}_to_${dateRange.end_date}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      alert('CSV export completed successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.exportPDF(activeTab, dateRange);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTab}_report_${dateRange.start_date}_to_${dateRange.end_date}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      alert('PDF export completed successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getDateRangePresets = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastQuarter = new Date(today);
    lastQuarter.setMonth(lastQuarter.getMonth() - 3);
    
    return [
      { label: 'Today', start: today.toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
      { label: 'Yesterday', start: yesterday.toISOString().split('T')[0], end: yesterday.toISOString().split('T')[0] },
      { label: 'Last 7 Days', start: lastWeek.toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
      { label: 'Last 30 Days', start: lastMonth.toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
      { label: 'Last Quarter', start: lastQuarter.toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
    ];
  };

  const renderSalesReport = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${Number(reportData?.summary?.total_revenue || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShoppingCartIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sales</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {reportData?.summary?.total_sales || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Sale</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${Number(reportData?.summary?.average_sale || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Profit</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${Number(reportData?.summary?.total_profit || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Growth Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {reportData?.summary?.growth_rate ? `+${Number(reportData.summary.growth_rate || 0).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <ChartBarIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer Retention</p>
              <p className="text-2xl font-bold text-blue-600">
                {reportData?.summary?.retention_rate ? `${Number(reportData.summary.retention_rate || 0).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <UsersIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Profit Margin</p>
              <p className="text-2xl font-bold text-purple-600">
                {reportData?.summary?.profit_margin ? `${Number(reportData.summary.profit_margin || 0).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Daily Sales Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sales Trend Analysis</h3>
          <div className="flex space-x-2">
            <button className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded-full">7D</button>
            <button className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">30D</button>
            <button className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">90D</button>
          </div>
        </div>
        <div className="h-80">
          {reportData?.daily_sales?.length > 0 ? (
            <div className="w-full h-full">
              {/* Enhanced Chart with trend line */}
              <div className="relative h-full">
                <div className="absolute inset-0 flex items-end justify-between px-4">
                  {reportData.daily_sales.slice(-14).map((day, index) => {
                    const maxRevenue = Math.max(...reportData.daily_sales.map(d => d.revenue || 0));
                    const height = ((day.revenue || 0) / maxRevenue) * 100;
                    return (
                      <div key={index} className="flex flex-col items-center group relative">
                        <div className="absolute -top-8 bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          ${Number(day.revenue || 0).toFixed(2)}
                        </div>
                        <div 
                          className="bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-sm w-8 transition-all duration-300 hover:from-primary-500 hover:to-primary-300"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        ></div>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 transform -rotate-45">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No sales data available for the selected period</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Top Products with Performance Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Top Performing Products</h3>
          <div className="space-y-4">
            {reportData?.top_products?.slice(0, 5).map((product, index) => {
              const maxRevenue = Math.max(...(reportData.top_products?.map(p => p.total_revenue || 0) || [1]));
              const percentage = ((product.total_revenue || 0) / maxRevenue) * 100;
              return (
                <div key={index} className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {product.item_name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ${Number(product.total_revenue || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{product.total_quantity} units</span>
                    <span>#{index + 1}</span>
                  </div>
                </div>
              );
            }) || (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <CubeIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No product data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Sales by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Sales by Category</h3>
          <div className="space-y-4">
            {reportData?.categories?.map((category, index) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
              const color = colors[index % colors.length];
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${color}`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.name || 'Uncategorized'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      ${Number(category.revenue || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {Number(category.percentage || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            }) || (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p>No category data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProductReport = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Product Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Units Sold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Profit Margin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {reportData?.products?.map((product, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {product.item_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {product.current_stock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {product.units_sold || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${Number(product.revenue || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {Number(product.profit_margin || 0).toFixed(2)}%
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No product data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCustomerReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {reportData?.summary?.total_customers || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Customers</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {reportData?.summary?.new_customers || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">New Customers</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${Number(reportData?.summary?.average_customer_value || 0).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Customer Value</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Top Customers</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Loyalty Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {reportData?.top_customers?.map((customer, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {customer.total_orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${Number(customer.total_spent || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {customer.loyalty_points}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No customer data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInventoryReport = () => (
    <div className="space-y-6">
      {/* Inventory Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {reportData?.summary?.total_items || 0}
              </p>
            </div>
            <CubeIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock Items</p>
              <p className="text-2xl font-bold text-red-600">
                {reportData?.summary?.low_stock_items || 0}
              </p>
            </div>
            <CubeIcon className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-green-600">
                ${reportData?.summary?.total_value || 0}
              </p>
            </div>
            <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">
                {reportData?.summary?.out_of_stock || 0}
              </p>
            </div>
            <CubeIcon className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Inventory Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Min Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {reportData?.inventory?.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.current_stock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.min_stock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${item.unit_price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${Number((item.current_stock || 0) * (item.unit_price || 0)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.current_stock === 0 ? 'bg-red-100 text-red-800' :
                      item.current_stock <= item.min_stock ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.current_stock === 0 ? 'Out of Stock' :
                       item.current_stock <= item.min_stock ? 'Low Stock' :
                       'In Stock'}
                    </span>
                  </td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (!hasPermission('reports.view')) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            You don't have permission to view reports.
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'sales':
        return renderSalesReport();
      case 'products':
        return renderProductReport();
      case 'customers':
        return renderCustomerReport();
      case 'inventory':
        return renderInventoryReport();
      case 'financial':
      case 'tax':
        return (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab} report will be available soon.
            </p>
          </div>
        );
      default:
        return renderSalesReport();
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Export Options */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Business Analytics Dashboard
        </h1>
        <div className="flex flex-wrap items-center space-x-2">
          <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            <select 
              className="text-sm border-none bg-transparent focus:outline-none text-gray-700 dark:text-gray-300"
              onChange={(e) => {
                const preset = getDateRangePresets().find(p => p.label === e.target.value);
                if (preset) {
                  setDateRange({ start_date: preset.start, end_date: preset.end });
                }
              }}
            >
              <option value="">Quick Select</option>
              {getDateRangePresets().map(preset => (
                <option key={preset.label} value={preset.label}>{preset.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            <span className="text-sm">CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            <span className="text-sm">PDF</span>
          </button>
        </div>
      </div>

      {/* Enhanced Date Range Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchReportData}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <ChartBarIcon className="h-4 w-4" />
                <span>Update Report</span>
              </button>
            </div>
          </div>
          
          {/* Real-time indicators */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Live Data</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default Reports;