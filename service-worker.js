self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) data = event.data.json();
  const title = data.title || "New Notification";
  const options = {
    body: data.body || "",
    icon: "/images/notification.png",
    badge: "/images/notification.png"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes('/admin-panel') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/admin-panel');
      }
    })
  );
});