const CACHE_NAME = "musicvantage-v1";
const AUDIO_CACHE = "offline-audio-v1";
const AUDIO_CACHE_FALLBACK = "offline-audio-fallback-v1";
const PRECACHE_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            // Ignore individual cache failures (e.g. dev server routes)
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME && n !== AUDIO_CACHE && n !== AUDIO_CACHE_FALLBACK).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Serve offline audio from dedicated cache
  if (url.pathname.startsWith("/offline-audio/")) {
    event.respondWith(
      (async () => {
        // Try main cache first
        const mainCache = await caches.open(AUDIO_CACHE);
        let cached = await mainCache.match(event.request);
        if (cached) return cached;

        // Try fallback cache
        const fallbackCache = await caches.open(AUDIO_CACHE_FALLBACK);
        cached = await fallbackCache.match(event.request);
        if (cached) return cached;

        // Try network
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const clone = response.clone();
            await mainCache.put(event.request, clone);
          }
          return response;
        } catch {
          return new Response(null, { status: 404 });
        }
      })()
    );
    return;
  }

  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")).then((r) => r || new Response(null, { status: 503 })))
  );
});

// ====== PUSH NOTIFICATIONS ======

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    // Notify all open clients (foreground)
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "PUSH_NOTIFICATION", payload: data });
      });
    });

    const options = {
      title: data.title || "MusicStream",
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      timestamp: data.timestamp || Date.now(),
      data: data.data || {},
      vibrate: [200, 100, 200],
      tag: `musicstream-${data.data?.type || "notification"}-${data.data?.notificationId || Date.now()}`,
      requireInteraction: true,
      actions: data.data?.type === "new_message"
        ? [{ action: "open-chat", title: "Apri Chat" }]
        : data.data?.type === "friend_request"
        ? [{ action: "open-friends", title: "Vedi Richiesta" }]
        : [],
    };

    event.waitUntil(self.registration.showNotification(options.title, options));
  } catch {
    event.waitUntil(
      self.registration.showNotification("MusicStream", {
        body: event.data.text(),
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  const action = event.action;

  let url = "/";

  if (action === "open-chat" && data?.conversationId) {
    url = `/chat/${data.conversationId}`;
  } else if (action === "open-friends") {
    url = "/friends";
  } else if (data?.type === "friend_request") {
    url = "/friends";
  } else if (data?.type === "new_message" && data?.conversationId) {
    url = `/chat/${data.conversationId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "NAVIGATE", url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
