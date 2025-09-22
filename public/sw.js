// sw.js - Service Worker for NOBITA Feedback App
const CACHE_NAME = 'nobita-feedback-v1.2.2'; // CHANGE: Version ko badal diya

// Empty array, so no files will be pre-cached on install
const urlsToCache = [];

// Install event - Cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first strategy for API calls, Cache first for static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // API requests - Network first with fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone response for caching
          const responseClone = response.clone();
  
          // Only cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME + '-api').then(cache => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - Cache first strategy
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }

        // If not in cache, fetch from network
        return fetch(request).then(response => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: event.data.text() };
    }
  }

  const title = data.title || '🔔 New Notification!';
  const options = {
    body: data.body || 'You have a new update.',
    icon: data.icon || '/images/icon.png',
    badge: data.badge || '/images/icon.png',
    image: data.image,
    tag: data.tag || 'general',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/images/icon.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/images/icon.png'
      }
    ],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    silent: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click received');
  
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === 'close') {
    return;
  }

  // Open or focus the app
  const urlToOpen = notificationData?.url || '/';
  
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Try to find an existing window with the app
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'notification-click',
              url: urlToOpen,
              data: notificationData
            });
          return client.focus();
          }
        }
        
        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync event (for offline functionality)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'feedback-sync') {
    event.waitUntil(syncOfflineFeedbacks());
  }
});

// Sync offline feedbacks when connection is restored
async function syncOfflineFeedbacks() {
  try {
    const cache = await caches.open(CACHE_NAME + '-offline');
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('offline-feedback-')) {
        const response = await cache.match(request);
        const data = await response.json();
        try {
          // Try to submit the offline feedback
          await fetch('/api/feedback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          // If successful, remove from offline cache
          await cache.delete(request);
          console.log('[SW] Offline feedback synced successfully');
        } catch (e) {
          console.error('[SW] Failed to sync offline feedback:', e);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// Message event for communication with main thread
self.addEventListener('message', event => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
    default:
      console.log('[SW] Unknown message type:', data.type);
  }
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

// Handle errors
self.addEventListener('error', event => {
  console.error('[SW] Service worker error:', event.error);
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'content-sync') {
      event.waitUntil(syncContent());
    }
  });
}

// Sync content in background
async function syncContent() {
  try {
    // Fetch latest blogs and cache them
    const blogsResponse = await fetch('/api/blogs');
    if (blogsResponse.ok) {
      const cache = await caches.open(CACHE_NAME + '-api');
      await cache.put('/api/blogs', blogsResponse.clone());
    }

    // Fetch latest feedbacks and cache them
    const feedbacksResponse = await fetch('/api/feedbacks?page=1&limit=10');
    if (feedbacksResponse.ok) {
      const cache = await caches.open(CACHE_NAME + '-api');
      await cache.put('/api/feedbacks?page=1&limit=10', feedbacksResponse.clone());
    }
  } catch (error) {
    console.error('[SW] Content sync error:', error);
  }
}

console.log('[SW] Service worker script loaded');