self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {
      title: "New notification",
      body: "You have a new update.",
      url: "/",
    };
  }

  const title = payload.title || "SSMP Alert";
  const options = {
    body: payload.body || "Open the app to view details.",
    tag: payload.tag,
    requireInteraction: payload.requireInteraction ?? true,
    renotify: payload.renotify ?? true,
    vibrate: payload.vibrate || [250, 120, 250],
    badge: payload.badge || "/favicon.ico",
    icon: payload.icon || "/favicon.ico",
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    })
  );
});
