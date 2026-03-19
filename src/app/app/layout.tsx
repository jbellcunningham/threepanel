'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const PANELS = [
  { slug: 'todos', title: 'To-Do' },
  { slug: 'todos-unified', title: 'To-Do (Unified)' },
  { slug: 'tracker', title: 'Tracker' },
  { slug: 'journal', title: 'Journal' },
  { slug: 'settings', title: 'Settings' },
] as const

const STORAGE_KEY = 'threepanel_settings_v1'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [title, setTitle] = useState('ThreePanel')

useEffect(() => {
  function syncFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setTitle('ThreePanel')
      return
    }
    try {
      const parsed = JSON.parse(raw)
      setTitle(typeof parsed.appTitle === 'string' && parsed.appTitle.trim() ? parsed.appTitle : 'ThreePanel')
    } catch {
      setTitle('ThreePanel')
    }
  }

  syncFromStorage()
  window.addEventListener('threepanel-settings-changed', syncFromStorage)
  return () => window.removeEventListener('threepanel-settings-changed', syncFromStorage)
}, [])

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          borderRight: '1px solid rgba(0,0,0,0.12)',
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PANELS.map((p) => (
            <Link
              key={p.slug}
              href={`/app/${p.slug}`}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                border: '1px solid rgba(0,0,0,0.10)',
              }}
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={logout}
            style={{ width: '100%', height: 36 }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 20 }}>
        {children}
      </main>
    </div>
  )
}
