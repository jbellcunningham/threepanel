'use client'

import { useEffect } from 'react'

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

export default function PwaInit() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort registration; app should work without SW.
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nav = navigator as BadgeNavigator
    if (typeof nav.setAppBadge !== 'function' && typeof nav.clearAppBadge !== 'function') {
      return
    }

    let cancelled = false

    async function syncAppBadge() {
      try {
        const res = await fetch('/api/notifications/overdue-count', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!res.ok) {
          return
        }

        const data = (await res.json().catch(() => null)) as { overdueCount?: unknown } | null
        const overdueCount = typeof data?.overdueCount === 'number' ? data.overdueCount : 0

        if (cancelled) {
          return
        }

        if (overdueCount > 0 && typeof nav.setAppBadge === 'function') {
          await nav.setAppBadge(overdueCount)
          return
        }

        if (typeof nav.clearAppBadge === 'function') {
          await nav.clearAppBadge()
        }
      } catch {
        // Silently ignore unsupported/permission/network issues.
      }
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        syncAppBadge()
      }
    }

    syncAppBadge()
    const intervalId = window.setInterval(syncAppBadge, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
