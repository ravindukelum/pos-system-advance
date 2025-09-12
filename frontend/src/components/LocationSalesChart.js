import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { MapPinIcon, CurrencyDollarIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { dashboardAPI, settingsAPI } from '../services/api';
import { getCurrencySymbol, formatCurrency } from '../utils/currency';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const LocationSalesChart = () => {
  const [locationData, setLocationData] = useState([]);
  const [topItemsByLocation, setTopItemsByLocation] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    end_date: new Date().toISOString().split('T')[0]
  });
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    fetchLocationSalesData();
  }, [dateRange]);

  const fetchLocationSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [response, settingsRes] = await Promise.all([
        dashboardAPI.getLocationSales(dateRange),
        settingsAPI.getSettings(),
      ]);
      
      setLocationData(response.data.locationSales || []);
      setTopItemsByLocation(response.data.topItemsByLocation || []);
      setSettings(settingsRes.data.settings);
    } catch (err) {
      console.error('Error fetching location sales data:', err);
      setError('Failed to load location sales data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrencyLocal = (value) => {
    return formatCurrency(value || 0, settings?.currency || 'LKR', 0);
  };

  const getTotalRevenue = () => {
    return locationData.reduce((sum, location) => sum + (location.total_revenue || 0), 0);
  };

  const getTotalSales = () => {
    return locationData.reduce((sum, location) => sum + (location.total_sales || 0), 0);
  };

  const getTopPerformingLocation = () => {
    if (locationData.length === 0) return null;
    return locationData.reduce((top, current) => 
      (current.total_revenue || 0) > (top.total_revenue || 0) ? current : top
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>{error}</p>
          <button 
            onClick={fetchLocationSalesData}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const topLocation = getTopPerformingLocation();

  return (
    <div className="space-y-6">
      {/* Header with Date Range Controls */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <MapPinIcon className="h-5 w-5 text-indigo-500 mr-2" />
              Location-Based Sales Analytics
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sales performance across different locations
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => handleDateRangeChange('start_date', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm"
            />
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => handleDateRangeChange('end_date', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-green-500 p-3 rounded-md">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Revenue
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatCurrencyLocal(getTotalRevenue())}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-blue-500 p-3 rounded-md">
                <ShoppingCartIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Sales
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {getTotalSales()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-purple-500 p-3 rounded-md">
                <MapPinIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Top Location
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {topLocation ? topLocation.location_name : 'N/A'}
                </dd>
                <dd className="text-xs text-gray-500 dark:text-gray-400">
                  {topLocation ? formatCurrencyLocal(topLocation.total_revenue) : ''}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Location Bar Chart */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Revenue by Location</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={locationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="location_name" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                fontSize={12}
              />
              <YAxis tickFormatter={(value) => formatCurrencyLocal(value)} />
              <Tooltip 
                formatter={(value, name) => [formatCurrencyLocal(value), name]}
                labelFormatter={(label) => `Location: ${label}`}
              />
              <Bar dataKey="total_revenue" fill="#8884d8" name="Total Revenue" />
              <Bar dataKey="paid_revenue" fill="#82ca9d" name="Paid Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales Distribution Pie Chart */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Sales Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={locationData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ location_name, percent }) => `${location_name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total_sales"
              >
                {locationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, 'Sales Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Location Details Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Location Performance Details</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Paid Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg Sale
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Payment Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {locationData.map((location, index) => {
                const paymentRate = location.total_sales > 0 
                  ? ((location.paid_sales / location.total_sales) * 100).toFixed(1)
                  : '0';
                
                return (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {location.location_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {location.total_sales}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatCurrencyLocal(location.total_revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatCurrencyLocal(location.paid_revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatCurrencyLocal(location.avg_sale_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        parseFloat(paymentRate) >= 80 
                          ? 'bg-green-100 text-green-800'
                          : parseFloat(paymentRate) >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {paymentRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Items by Location */}
      {topItemsByLocation.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Top Selling Items by Location</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topItemsByLocation.map((locationData, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">{locationData.location_name}</h5>
                <div className="space-y-2">
                  {locationData.items.slice(0, 5).map((item, itemIndex) => (
                    <div key={itemIndex} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-300 truncate">{item.item_name}</span>
                      <div className="text-right">
                        <div className="text-gray-900 dark:text-white font-medium">{item.total_quantity_sold} sold</div>
                        <div className="text-gray-500 dark:text-gray-400">{formatCurrencyLocal(item.total_revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSalesChart;