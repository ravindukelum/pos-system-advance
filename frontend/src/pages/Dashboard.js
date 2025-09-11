import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  UsersIcon,
  CurrencyDollarIcon,
  CubeIcon,
  ShoppingCartIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import LocationSalesChart from '../components/LocationSalesChart';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Redirect cashiers to Sales page
  useEffect(() => {
    if (user?.role === 'cashier') {
      navigate('/sales', { replace: true });
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    // Don't fetch dashboard data for cashiers since they'll be redirected
    if (user?.role !== 'cashier') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, activitiesRes, topItemsRes, lowStockRes] = await Promise.all([
        dashboardAPI.getOverview(),
        dashboardAPI.getRecentActivities(5),
        dashboardAPI.getTopSellingItems(5),
        dashboardAPI.getLowStockAlerts(5),
      ]);

      setStats(overviewRes.data.stats);
      setRecentActivities(activitiesRes.data.activities);
      setTopItems(topItemsRes.data.topItems);
      setLowStockItems(lowStockRes.data.lowStockItems);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Partners',
      value: stats?.totalPartners || 0,
      icon: UsersIcon,
      color: 'bg-blue-500',
      subtext: `${stats?.investors || 0} Investors, ${stats?.suppliers || 0} Suppliers`,
    },
    {
      name: 'Net Investments',
      value: `RS ${(stats?.netInvestments || 0).toLocaleString()}`,
      icon: CurrencyDollarIcon,
      color: 'bg-green-500',
      subtext: `RS ${(stats?.totalInvestments || 0).toLocaleString()} In, RS ${(stats?.totalWithdrawals || 0).toLocaleString()} Out`,
    },
    {
      name: 'Total Actual Inventory Value',
      value: `RS ${(stats?.totalInventoryBuyValue || 0).toLocaleString()}`,
      icon: CubeIcon,
      color: 'bg-purple-500',
      subtext: `${stats?.totalInventoryItems || 0} Items, ${stats?.totalInventoryQuantity || 0} Qty`,
    },
    {
      name: 'Total Sell Value',
      value: `RS ${(stats?.totalInventorySellValue || 0).toLocaleString()}`,
      icon: CubeIcon,
      color: 'bg-indigo-500',
      subtext: `Potential Revenue from Current Stock`,
    },
    {
      name: 'Total Sales',
      value: stats?.totalSales || 0,
      icon: ShoppingCartIcon,
      color: 'bg-orange-500',
      subtext: `RS ${(stats?.totalRevenue || 0).toLocaleString()} Revenue`,
    },
   ];

  const salesStatusData = [
    { name: 'Paid', value: stats?.paidSales || 0, amount: stats?.paidRevenue || 0 },
    { name: 'Unpaid', value: stats?.unpaidSales || 0, amount: stats?.unpaidRevenue || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your POS system performance
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={fetchDashboardData}
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} p-3 rounded-md`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                    <dd className="text-xs text-gray-500">
                      {stat.subtext}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Status Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={salesStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {salesStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, `${name} Sales`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Selling Items */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Selling Items</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="item_name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_quantity_sold" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activities and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {recentActivities.map((activity, index) => (
                  <li key={index}>
                    <div className="relative pb-8">
                      {index !== recentActivities.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center ring-8 ring-white">
                            {activity.type === 'sale' ? (
                              <ShoppingCartIcon className="h-5 w-5 text-white" />
                            ) : (
                              <CurrencyDollarIcon className="h-5 w-5 text-white" />
                            )}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              {activity.type === 'sale' ? (
                                <>Sale: {activity.item_name} - {activity.invoice}</>
                              ) : (
                                <>{activity.investment_type}: {activity.partner_name}</>
                              )}
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <p>RS {activity.amount}</p>
                            <time>{new Date(activity.created_at).toLocaleDateString()}</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
              Low Stock Alerts
            </h3>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-gray-500">No low stock items</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">{item.quantity} left</p>
                      <p className="text-xs text-gray-500">RS {item.sell_price}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ArrowTrendingUpIcon className="h-5 w-5 text-green-500 mr-2" />
            Today's Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats?.todaySales || 0}</p>
              <p className="text-sm text-gray-500">Sales Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">RS {(stats?.todayRevenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Revenue Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">RS {(stats?.totalInventorySellValue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Inventory Value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Location-Based Sales Analytics */}
      <LocationSalesChart />
    </div>
  );
}