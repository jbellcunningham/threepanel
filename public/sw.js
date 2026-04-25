self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'ThreePanel',
    body: 'You have a notification.',
    url: '/app/containers',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = {
        ...payload,
        ...parsed,
      }
    }
  } catch {
    // Keep default payload when invalid JSON is sent.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
        url: payload.url || '/app/containers',
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/app/containers'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
