// Offline functionality utilities
class OfflineManager {
  constructor() {
    this.dbName = 'posOfflineDB';
    this.dbVersion = 1;
    this.db = null;
    this.isOnline = navigator.onLine;
    
    this.initDB();
    this.setupEventListeners();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('offlineData')) {
          const store = db.createObjectStore('offlineData', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('cachedData')) {
          const cacheStore = db.createObjectStore('cachedData', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineData();
      this.showNotification('Back online! Syncing data...', 'success');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showNotification('You are offline. Data will be saved locally.', 'warning');
    });
  }

  async saveOfflineData(type, endpoint, method, payload) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['offlineData'], 'readwrite');
    const store = transaction.objectStore('offlineData');
    
    const data = {
      type,
      endpoint,
      method,
      payload,
      timestamp: new Date().toISOString(),
      synced: false
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async cacheData(key, data) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['cachedData'], 'readwrite');
    const store = transaction.objectStore('cachedData');
    
    const cacheEntry = {
      key,
      data,
      timestamp: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(cacheEntry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedData(key) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['cachedData'], 'readonly');
    const store = transaction.objectStore('cachedData');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isDataFresh(result.timestamp, 5 * 60 * 1000)) { // 5 minutes
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  isDataFresh(timestamp, maxAge) {
    const now = new Date().getTime();
    const dataTime = new Date(timestamp).getTime();
    return (now - dataTime) < maxAge;
  }

  async syncOfflineData() {
    if (!this.isOnline || !this.db) return;
    
    const transaction = this.db.transaction(['offlineData'], 'readwrite');
    const store = transaction.objectStore('offlineData');
    const index = store.index('timestamp');
    
    const request = index.openCursor();
    const syncPromises = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && !cursor.value.synced) {
        const data = cursor.value;
        
        const syncPromise = this.syncSingleItem(data)
          .then((success) => {
            if (success) {
              // Mark as synced
              const updateData = { ...data, synced: true };
              cursor.update(updateData);
            }
          });
        
        syncPromises.push(syncPromise);
        cursor.continue();
      } else if (syncPromises.length > 0) {
        Promise.all(syncPromises).then(() => {
          this.showNotification('Offline data synced successfully!', 'success');
        });
      }
    };
  }

  async syncSingleItem(data) {
    try {
      const response = await fetch(`/api/${data.endpoint}`, {
        method: data.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data.payload)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Sync failed for item:', data, error);
      return false;
    }
  }

  showNotification(message, type = 'info') {
    // Create or update notification
    const notification = document.getElementById('offline-notification') || this.createNotificationElement();
    
    notification.textContent = message;
    notification.className = `offline-notification ${type}`;
    notification.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  createNotificationElement() {
    const notification = document.createElement('div');
    notification.id = 'offline-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      max-width: 300px;
      display: none;
    `;
    
    document.body.appendChild(notification);
    return notification;
  }

  // API wrapper that handles offline functionality
  async apiCall(endpoint, method = 'GET', data = null) {
    if (this.isOnline) {
      try {
        const response = await fetch(`/api/${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: data ? JSON.stringify(data) : null
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Cache GET requests
          if (method === 'GET') {
            this.cacheData(endpoint, result);
          }
          
          return result;
        }
      } catch (error) {
        console.error('API call failed:', error);
      }
    }
    
    // Handle offline scenario
    if (method === 'GET') {
      const cachedData = await this.getCachedData(endpoint);
      if (cachedData) {
        return cachedData;
      }
    } else {
      // Save for later sync
      await this.saveOfflineData('api_call', endpoint, method, data);
      this.showNotification('Data saved offline. Will sync when online.', 'info');
      return { success: true, offline: true };
    }
    
    throw new Error('No data available offline');
  }
}

// Global offline manager instance
window.offlineManager = new OfflineManager();

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

export default window.offlineManager;