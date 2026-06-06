// ─── Версия кэша — менять при каждом деплое ──────────────────────────────────
// Vite добавляет хэш к имени бандла (main-BxYz1234.js), поэтому статические
// ассеты кэшируем динамически в fetch-обработчике, а не в ASSETS.
// Здесь перечислены только файлы с предсказуемыми именами.
const CACHE_NAME = 'worktracker-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─── Install: кэшируем предсказуемые файлы ───────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

// ─── Activate: удаляем старые кэши, захватываем клиентов ─────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase и внешние API — всегда через сеть, никогда не кэшировать
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('telegram.org') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Иконки — cache-first, не критичны для offline
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // JS/CSS бандлы Vite (/assets/*.js, /assets/*.css) —
  // stale-while-revalidate: отдаём кэш мгновенно, обновляем фоном.
  // Vite добавляет хэш к имени файла, поэтому старый кэш не мешает новому.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);

        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));

        // Отдаём кэш немедленно если есть, иначе ждём сеть
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Навигационные запросы (переходы по страницам) — network-first,
  // fallback на /index.html из кэша для SPA-роутинга
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Всё остальное — cache-first с фоновым обновлением
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        new Response('Offline', { status: 503, statusText: 'Offline' })
      );
      return cached || fetchPromise;
    })
  );
});

// ─── Push уведомления ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'WorkTracker PRO', body: 'Новое уведомление', url: '/' };

  try {
    data = { ...data, ...event.data?.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'worktracker',
      renotify: true,
      data: { url: data.url }
    })
  );
});

// ─── Клик по уведомлению ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});
