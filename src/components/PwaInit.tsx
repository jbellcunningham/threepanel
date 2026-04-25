'use client'

import { useEffect } from 'react'

export default function PwaInit() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort registration; app should work without SW.
    })
  }, [])

  return null
}
