'use client'

import { useState } from 'react'

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const normalized = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export default function NotificationsPage() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function subscribe() {
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('Push notifications are not supported on this device/browser.')
        setBusy(false)
        return
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        setError('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY configuration.')
        setBusy(false)
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        setError('Notification permission was not granted.')
        setBusy(false)
        return
      }

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        })
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      const raw = await response.text()
      const data = raw ? JSON.parse(raw) : null

      if (!response.ok || !data?.ok) {
        setError(data?.error || raw || 'Failed to save push subscription.')
        setBusy(false)
        return
      }

      setMessage('Push notifications enabled for this device.')
    } catch {
      setError('Failed to enable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      if (!('serviceWorker' in navigator)) {
        setError('Service workers are not supported.')
        setBusy(false)
        return
      }

      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()

      if (!subscription) {
        setMessage('No active push subscription found on this device.')
        setBusy(false)
        return
      }

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      })

      await subscription.unsubscribe()
      setMessage('Push notifications disabled for this device.')
    } catch {
      setError('Failed to disable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setMessage(null)
    setError(null)

    const response = await fetch('/api/push/test', {
      method: 'POST',
      credentials: 'include',
    })

    const raw = await response.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!response.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to send test notification.')
      setBusy(false)
      return
    }

    setMessage('Test notification sent.')
    setBusy(false)
  }

  return (
    <main style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0, marginBottom: 6 }}>Notifications</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Enable push notifications for overdue reminders and app alerts.
      </p>

      <section
        style={{
          marginTop: 16,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          padding: 16,
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={subscribe} disabled={busy} style={{ height: 36, padding: '0 12px' }}>
            Enable Push
          </button>
          <button type="button" onClick={unsubscribe} disabled={busy} style={{ height: 36, padding: '0 12px' }}>
            Disable Push
          </button>
          <button type="button" onClick={sendTest} disabled={busy} style={{ height: 36, padding: '0 12px' }}>
            Send Test Notification
          </button>
        </div>

        {message && <div style={{ color: 'green', fontSize: 13 }}>{message}</div>}
        {error && <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div>}
      </section>
    </main>
  )
}
