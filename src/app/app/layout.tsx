'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const SETTINGS_STORAGE_KEY = 'threepanel_settings_v1'
const SHOW_ALL_STORAGE_KEY = 'threepanel_sidebar_show_all_types_v1'

type StoredSettings = {
  appTitle?: string
  visibleSidebarTypes?: string[]
  hiddenSidebarTypes?: string[]
}

function normalizeTypeList(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return values
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
}

function toDisplayLabel(value: string) {
  if (value === 'tracker') return 'Tracker'
  if (value === 'todo') return 'To-Do'
  if (value === 'journal') return 'Journal'

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [title, setTitle] = useState('ThreePanel')
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [hiddenSidebarTypes, setHiddenSidebarTypes] = useState<string[]>([])
  const [showAllContainerTypes, setShowAllContainerTypes] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    async function syncFromStorageAndTypes() {
      let nextTitle = 'ThreePanel'
      let savedHiddenTypes: string[] = []
      let savedShowAll = false
      let legacyVisibleTypes: string[] = []

      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
      const rawShowAll = localStorage.getItem(SHOW_ALL_STORAGE_KEY)

      if (rawShowAll === 'true') {
        savedShowAll = true
      }

      if (rawSettings) {
        try {
          const parsed = JSON.parse(rawSettings) as StoredSettings

          nextTitle =
            typeof parsed.appTitle === 'string' && parsed.appTitle.trim()
              ? parsed.appTitle
              : 'ThreePanel'

          savedHiddenTypes = normalizeTypeList(parsed.hiddenSidebarTypes)
          legacyVisibleTypes = normalizeTypeList(parsed.visibleSidebarTypes)
        } catch {
          nextTitle = 'ThreePanel'
          savedHiddenTypes = []
          legacyVisibleTypes = []
        }
      }

      setTitle(nextTitle)
      setShowAllContainerTypes(savedShowAll)

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
          const nextAvailableTypes = normalizeTypeList(data.types)

          setAvailableTypes(nextAvailableTypes)

          const filteredHiddenTypes = savedHiddenTypes.filter((value) =>
            nextAvailableTypes.includes(value)
          )

          setHiddenSidebarTypes(filteredHiddenTypes)
          return
        }
      } catch {
        // fallback below
      }

      setAvailableTypes([])
      setHiddenSidebarTypes(savedHiddenTypes)
    }

    syncFromStorageAndTypes()
    window.addEventListener('threepanel-settings-changed', syncFromStorageAndTypes)

    return () =>
      window.removeEventListener('threepanel-settings-changed', syncFromStorageAndTypes)
  }, [])

  useEffect(() => {
    function syncViewport() {
      setIsMobile(window.innerWidth <= 768)
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)

    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    router.push('/login')
  }

  function toggleShowAllContainerTypes() {
    const nextValue = !showAllContainerTypes
    setShowAllContainerTypes(nextValue)
    localStorage.setItem(SHOW_ALL_STORAGE_KEY, nextValue ? 'true' : 'false')
  }

  const sidebarTypes = useMemo(() => {
    if (showAllContainerTypes) {
      return availableTypes
    }

    return availableTypes.filter((type) => !hiddenSidebarTypes.includes(type))
  }, [availableTypes, hiddenSidebarTypes, showAllContainerTypes])

  const panels = [
    ...sidebarTypes.map((type) => ({
      href: `/app/containers?type=${encodeURIComponent(type)}`,
      title: toDisplayLabel(type),
    })),
    { href: '/app/reporting', title: 'Reporting' },
    { href: '/app/settings', title: 'Settings' },
  ]

    function handleNavLinkClick() {
    if (isMobile) {
      setMobileNavOpen(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100vh',
      }}
    >
      <aside
        style={{
          width: isMobile ? '100%' : 240,
          borderRight: isMobile ? 'none' : '1px solid rgba(0,0,0,0.12)',
          borderBottom: isMobile ? '1px solid rgba(0,0,0,0.12)' : 'none',
          padding: 16,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: mobileNavOpen || !isMobile ? 16 : 0,
          }}
        >
          <div style={{ fontWeight: 700 }}>{title}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={toggleShowAllContainerTypes}
              style={{
                height: 28,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.12)',
                background: showAllContainerTypes ? 'rgba(0,0,0,0.08)' : 'transparent',
                cursor: 'pointer',
                fontSize: 12,
              }}
              title={
                showAllContainerTypes
                  ? 'Showing all container types'
                  : 'Override hidden type settings and show all container types'
              }
            >
              All
            </button>

            {isMobile ? (
              <button
                type="button"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: '18px',
                }}
                title={mobileNavOpen ? 'Hide menu' : 'Show menu'}
              >
                {mobileNavOpen ? '×' : '☰'}
              </button>
            ) : null}
          </div>
        </div>

        {(!isMobile || mobileNavOpen) && (
          <>
            <nav
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'column',
                gap: 8,
              }}
            >
              {panels.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={handleNavLinkClick}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    border: '1px solid rgba(0,0,0,0.10)',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {p.title}
                </Link>
              ))}
            </nav>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  height: 36,
                }}
              >
                Logout
              </button>
            </div>
          </>
        )}
      </aside>

      <main
        style={{
          flex: 1,
          padding: 16,
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  )
}
