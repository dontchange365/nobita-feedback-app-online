// admin-service-worker.js
// This file is now located in /admin-panel/

self.addEventListener('push', function(event) {
  console.log('[Admin SW] Push Received.');

  const data = event.data ? event.data.json() : {};
  const title = data.title || "🔔 New Notification!";
  const options = {
    body: data.body || "You have a new update.",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: {
      url: data.url || "/admin-panel" // Changed default URL to /admin-panel
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Admin SW] Notification click Received.');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if admin panel is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/admin-panel') && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open it
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/admin-panel');
      }
    })
  );
});