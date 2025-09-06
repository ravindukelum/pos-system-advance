// Service Worker for PWA functionality
const CACHE_NAME = 'pos-system-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/dashboard',
  '/inventory',
  '/sales',
  '/customers',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Get offline data from IndexedDB
    const offlineData = await getOfflineData();
    
    // Sync each piece of data
    for (const data of offlineData) {
      await syncDataToServer(data);
    }
    
    // Clear synced data
    await clearSyncedData();
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function getOfflineData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('posOfflineDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function syncDataToServer(data) {
  try {
    const response = await fetch('/api/' + data.endpoint, {
      method: data.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data.payload)
    });
    
    if (response.ok) {
      console.log('Data synced successfully:', data.id);
      return true;
    }
  } catch (error) {
    console.error('Sync failed for:', data.id, error);
    return false;
  }
}