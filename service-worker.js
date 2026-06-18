/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'routelog-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
  '/src/firebase.ts',
  '/src/types.ts',
  '/src/useRouteLogState.ts'
];

// Offline Queue for digital signatures and delivery logs
let offlineQueue = [];

// Install Event - Caching Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching critical offline app shell assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Caching skipped for some resources during initial install:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Cleaning old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache storage:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first fallback to cache for offline availability
self.addEventListener('fetch', (event) => {
  // Only intercept HTTP/S GET requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful, put a clone in the cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache if network request fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If HTML request failed, return main page index.html from cache
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});

// Sync Event for background queue synchronization
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-deliveries') {
    console.log('[Service Worker] Background Sync triggered: sync-queued-deliveries');
    event.waitUntil(syncDeliveriesQueue());
  }
});

// Handling client messages (e.g., adding to queue, syncing status)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'QUEUE_DELIVERY_CONFIRMATION') {
    console.log('[Service Worker] Received offline delivery confirmation payload to queue:', data.payload);
    offlineQueue.push(data.payload);
    
    // Broadcast back queued notification
    broadcastToClients({
      type: 'DELIVERY_QUEUED_SUCCESS',
      queueLength: offlineQueue.length,
      payload: data.payload
    });
  } else if (data.type === 'TRIGGER_SYNC') {
    console.log('[Service Worker] Manual sync trigger received.');
    event.waitUntil(syncDeliveriesQueue());
  }
});

// Synchronize deliveries queue
async function syncDeliveriesQueue() {
  if (offlineQueue.length === 0) {
    console.log('[Service Worker] No deliveries in the offline queue to sync.');
    return;
  }

  console.log(`[Service Worker] Syncing ${offlineQueue.length} queued driver signatures & photos to Firestore...`);
  
  // We will broadcast the sync trigger back to clients, since they have the Firestore initialized context!
  // This ensures consistent Firestore writes without duplicating SDK initialization.
  broadcastToClients({
    type: 'SYNC_PENDING_QUEUE',
    queue: [...offlineQueue]
  });

  // Reset local worker queue since it has been dispatched to client sync handlers
  offlineQueue = [];
}

// Helper to broadcast messages to all active client tabs
async function broadcastToClients(message) {
  const clientsList = await self.clients.matchAll();
  for (const client of clientsList) {
    client.postMessage(message);
  }
}
