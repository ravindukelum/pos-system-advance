import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken } = response.data;
          
          localStorage.setItem('token', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  refreshToken: (data) => api.post('/auth/refresh', data),
  getProfile: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  getUsers: () => api.get('/auth/users'),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// Partners API
export const partnersAPI = {
  getAll: () => api.get('/partners'),
  getById: (id) => api.get(`/partners/${id}`),
  create: (data) => api.post('/partners', data),
  update: (id, data) => api.put(`/partners/${id}`, data),
  delete: (id) => api.delete(`/partners/${id}`),
};

// Investments API
export const investmentsAPI = {
  getAll: () => api.get('/investments'),
  getById: (id) => api.get(`/investments/${id}`),
  getByPartner: (partnerId) => api.get(`/investments/partner/${partnerId}`),
  create: (data) => api.post('/investments', data),
  update: (id, data) => api.put(`/investments/${id}`, data),
  delete: (id) => api.delete(`/investments/${id}`),
};

// Inventory API
export const inventoryAPI = {
  getAll: (locationId = null) => {
    const url = locationId ? `/inventory?location_id=${locationId}` : '/inventory';
    return api.get(url);
  },
  getById: (id) => api.get(`/inventory/${id}`),
  getBySku: (sku) => api.get(`/inventory/sku/${sku}`),
  search: (query) => api.get(`/inventory/search?q=${encodeURIComponent(query)}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  updateQuantity: (id, data) => api.patch(`/inventory/${id}/quantity`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
  // Location-based inventory endpoints
  getLocations: () => api.get('/locations'),
  getItemLocations: (itemId) => api.get(`/inventory/${itemId}/locations`),
  updateLocationQuantity: (itemId, locationId, data) => api.patch(`/inventory/${itemId}/location/${locationId}/quantity`, data),
  transferBetweenLocations: (data) => api.post('/inventory/transfer', data),
};

// Sales API
export const salesAPI = {
  getAll: () => api.get('/sales'),
  getById: (id) => api.get(`/sales/${id}`),
  getByInvoice: (invoice) => api.get(`/sales/invoice/${invoice}`),
  getByStatus: (status) => api.get(`/sales/status/${status}`),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  updateStatus: (id, data) => api.patch(`/sales/${id}/status`, data),
  updatePayment: (id, data) => api.patch(`/sales/${id}/payment`, data),
  delete: (id) => api.delete(`/sales/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  getOverview: () => api.get('/dashboard/overview'),
  getRecentActivities: (limit = 10) => api.get(`/dashboard/recent-activities?limit=${limit}`),
  getSalesAnalytics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/dashboard/sales-analytics?${queryString}`);
  },
  getLocationSales: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/dashboard/location-sales?${queryString}`);
  },
  getTopSellingItems: (limit = 10) => api.get(`/dashboard/top-selling-items?limit=${limit}`),
  getLowStockAlerts: (threshold = 5) => api.get(`/dashboard/low-stock-alerts?threshold=${threshold}`),
};

// Customers API
export const customersAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/customers?${queryString}`);
  },
  getById: (id) => api.get(`/customers/${id}`),
  getByCode: (code) => api.get(`/customers/code/${code}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  updateLoyalty: (id, data) => api.patch(`/customers/${id}/loyalty`, data),
  getAnalytics: (id) => api.get(`/customers/${id}/analytics`),
  delete: (id) => api.delete(`/customers/${id}`),
};

// Barcodes API
export const barcodesAPI = {
  generateQR: (itemId) => api.post(`/barcodes/qr/${itemId}`),
  generateBarcode: (itemId) => api.post(`/barcodes/barcode/${itemId}`),
  lookup: (code) => api.get(`/barcodes/lookup/${encodeURIComponent(code)}`),
  generateSaleQR: (saleId) => api.post(`/barcodes/sale-qr/${saleId}`),
  bulkGenerate: () => api.post('/barcodes/bulk-generate'),
};

// Settings API
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
};

// WhatsApp API
export const whatsappAPI = {
  // Send a text message
  sendMessage: (data) => {
    // Use phone number as provided without automatic formatting
    const phone = data.to || data.phone;
    
    // Map frontend fields to backend expected fields
    const payload = {
      phone: phone,
      message: data.message,
      messageType: data.type || 'custom'
    };
    
    return api.post('/notifications/whatsapp/send', payload);
  },
  
  // Send a template message
  sendTemplate: (data) => api.post('/notifications/whatsapp/send-template', data),
  
  // Get message status
  getMessageStatus: (messageId) => api.get(`/notifications/whatsapp/message-status/${messageId}`),
  
  // Get message history
  getMessageHistory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/notifications/whatsapp/messages?${queryString}`);
  },
  
  // Get webhook events
  getWebhookEvents: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/notifications/whatsapp/webhook-events?${queryString}`);
  },
  
  // Get WhatsApp configuration status
  getStatus: () => api.get('/notifications/test-config'),
  
  // Send bulk messages
  sendBulkMessages: (data) => {
    // Format phone numbers with Sri Lankan country code if needed
    const formattedRecipients = data.recipients.map(phone => {
      if (phone && !phone.startsWith('+')) {
        // Remove leading zero and add +94 for Sri Lankan numbers
        return phone.startsWith('0') ? '+94' + phone.substring(1) : '+94' + phone;
      }
      return phone;
    });
    
    const payload = {
      ...data,
      recipients: formattedRecipients
    };
    
    return api.post('/notifications/whatsapp/send-bulk', payload);
  },
  
  // Get message templates
  getTemplates: () => api.get('/notifications/whatsapp/templates'),
  
  // Create message template
  createTemplate: (data) => api.post('/notifications/whatsapp/templates', data),
  
  // Update message template
  updateTemplate: (id, data) => api.put(`/notifications/whatsapp/templates/${id}`, data),
  
  // Delete message template
  deleteTemplate: (id) => api.delete(`/notifications/whatsapp/templates/${id}`),
};

// Payments API
export const paymentsAPI = {
  process: (data) => api.post('/payments/process', data),
  processMultiple: (data) => api.post('/payments/process-multiple', data),
  createRefund: (data) => api.post('/payments/refund', data),
  getTransactions: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/payments/transactions?${queryString}`);
  },
  getPaymentMethods: () => api.get('/payments/methods'),
  updatePaymentMethods: (data) => api.put('/payments/methods', data),
  getAnalytics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/payments/analytics?${queryString}`);
  },
};

// Locations API
export const locationsAPI = {
  getAll: () => api.get('/locations'),
  getById: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  delete: (id) => api.delete(`/locations/${id}`),
  getInventory: (id) => api.get(`/locations/${id}/inventory`),
  getSales: (id, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/locations/${id}/sales?${queryString}`);
  },
  transferInventory: (fromId, toId, data) => api.post(`/locations/${fromId}/transfer/${toId}`, data),
};

// Reports API
export const reportsAPI = {
  getSalesReport: (params = {}) => {
    return api.get('/reports/sales', { params });
  },
  getProductReport: (params = {}) => {
    return api.get('/reports/products', { params });
  },
  getCustomerReport: (params = {}) => {
    return api.get('/reports/customers', { params });
  },
  getFinancialReport: (params = {}) => {
    return api.get('/reports/financial', { params });
  },
  getTaxReport: (params = {}) => {
    return api.get('/reports/tax', { params });
  },
  getInventoryReport: (params = {}) => {
    return api.get('/reports/inventory', { params });
  },
  exportCSV: (reportType, params = {}) => {
    return api.get(`/reports/export/${reportType}`, {
      params: { ...params, format: 'csv' },
      responseType: 'blob'
    });
  },
  exportPDF: (reportType, params = {}) => {
    return api.get(`/reports/export/${reportType}`, {
      params: { ...params, format: 'pdf' },
      responseType: 'blob'
    });
  },
  getAnalyticsSummary: (params = {}) => {
    return api.get('/reports/analytics/summary', { params });
  },
  getCategoriesAnalytics: (params = {}) => {
    return api.get('/reports/analytics/categories', { params });
  },
};

// Users API
export const usersAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/users?${queryString}`);
  },
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  lock: (id, reason) => api.post(`/users/${id}/lock`, { reason }),
  unlock: (id) => api.post(`/users/${id}/unlock`),
  resetPassword: (id, password) => api.post(`/users/${id}/reset-password`, { new_password: password }),
  getStats: () => api.get('/users/stats/overview'),
};

export default api;