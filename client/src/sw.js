import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache del app shell (lo llena vite-plugin-pwa en el build).
precacheAndRoute(self.__WB_MANIFEST);

// Mismo cacheo de la API de Supabase que ya se tenía con generateSW.
registerRoute(
    ({ url }) => /\.supabase\.co\/rest\/v1\//.test(url.href),
    new NetworkFirst({
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 300 })],
    })
);

// Notificaciones push reales: llegan aunque la pestaña esté cerrada.
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'ITSM Treggo', body: event.data?.text() || '' };
    }

    const title = data.title || 'ITSM Treggo';
    const options = {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { link: data.link || '/dashboard' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer click en la notificación, enfoca una pestaña existente o abre una nueva.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = event.notification.data?.link || '/dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(link) && 'focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(link);
        })
    );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
