'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_VISIBLE_TYPES: string[] = []

const STORAGE_KEY = 'threepanel_settings_v1'

type StoredSettings = {
  appTitle?: string
  visibleSidebarTypes?: string[]
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [title, setTitle] = useState('ThreePanel')
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [visibleSidebarTypes, setVisibleSidebarTypes] = useState<string[]>([])

  useEffect(() => {
    async function syncFromStorageAndTypes() {
      let nextTitle = 'ThreePanel'
      let savedVisibleTypes: string[] = []

      const raw = localStorage.getItem(STORAGE_KEY)

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredSettings

          nextTitle =
            typeof parsed.appTitle === 'string' && parsed.appTitle.trim()
              ? parsed.appTitle
              : 'ThreePanel'

          savedVisibleTypes = Array.isArray(parsed.visibleSidebarTypes)
            ? parsed.visibleSidebarTypes
                .map((value) => String(value).trim().toLowerCase())
                .filter(Boolean)
            : []
        } catch {
          nextTitle = 'ThreePanel'
          savedVisibleTypes = []
        }
      }

      setTitle(nextTitle)

      try {
        const res = await fetch('/api/container-types', {
          credentials: 'include',
          cache: 'no-store',
        })

        const rawResponse = await res.text()

        let data: any = null
        try {
          data = rawResponse ? JSON.parse(rawResponse) : null
        } catch {
          data = null
        }

        if (res.ok && data?.ok && Array.isArray(data.types)) {
          const nextAvailableTypes = data.types
            .map((value: unknown) => String(value).trim().toLowerCase())
            .filter(Boolean)

          setAvailableTypes(nextAvailableTypes)

          const filteredVisibleTypes = savedVisibleTypes.filter((value) =>
            nextAvailableTypes.includes(value)
          )

          setVisibleSidebarTypes(
            filteredVisibleTypes.length > 0 ? filteredVisibleTypes : nextAvailableTypes
          )

          return
        }
      } catch {
        // fallback below
      }

      setAvailableTypes([])
      setVisibleSidebarTypes(savedVisibleTypes)
    }

    syncFromStorageAndTypes()
    window.addEventListener('threepanel-settings-changed', syncFromStorageAndTypes)

    return () =>
      window.removeEventListener('threepanel-settings-changed', syncFromStorageAndTypes)
  }, [])


  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    router.push('/login')
  }

  function getContainerTypeLinkTitle(type: string) {
    if (type === 'tracker') return 'Tracker'
    if (type === 'todo') return 'To-Do'
    if (type === 'journal') return 'Journal'

    return type
  }

  const panels = [
    { href: '/app/containers', title: 'All Containers' },
    ...visibleSidebarTypes.map((type) => ({
      href: `/app/containers?type=${encodeURIComponent(type)}`,
      title: getContainerTypeLinkTitle(type),
    })),
    { href: '/app/reporting', title: 'Reporting' },
    { href: '/app/settings', title: 'Settings' },
  ]

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
          {panels.map((p) => (
            <Link
              key={p.href}
              href={p.href}
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
