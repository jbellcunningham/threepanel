'use client'

/**
 * FILE: /src/app/app/reporting/page.tsx
 *
 * PURPOSE:
 * - Read-only reporting landing page
 * - Lists containers accessible to the current user for reporting
 *
 * ARCHITECTURE ROLE:
 * - Client UI for reporting access
 * - Consumes GET /api/reporting/containers
 */

/* =========================================================
   1) Imports
   ========================================================= */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getContainerTypeDisplay } from '@/lib/containerTypeDisplay'

/* =========================================================
   2) Types
   ========================================================= */

type ReportingContainerItem = {
  id: string
  title: string
  type: string
  done: boolean
  createdAt: string
  updatedAt: string
  userId: string
}

type ContainerTypesResponse = {
  ok: true
  types: string[]
}

/* =========================================================
   3) Helpers
   ========================================================= */

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/* =========================================================
   4) Component
   ========================================================= */

export default function ReportingPage() {
  const router = useRouter()
  const [items, setItems] = useState<ReportingContainerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [availableContainerTypes, setAvailableContainerTypes] = useState<string[]>([])
  const [overdueCount, setOverdueCount] = useState(0)

  /* =========================================================
     5) Data loader
     ========================================================= */

  async function loadContainerTypes() {
    try {
      const res = await fetch('/api/container-types', {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        setAvailableContainerTypes([])
        return
      }

      const data = (await res.json().catch(() => null)) as ContainerTypesResponse | null

      if (!data?.ok || !Array.isArray(data.types)) {
        setAvailableContainerTypes([])
        return
      }

      setAvailableContainerTypes(
        data.types
          .map((value) => String(value).trim().toLowerCase())
          .filter(Boolean)
      )
    } catch {
      setAvailableContainerTypes([])
    }
  }

  async function load() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/reporting/containers', {
      credentials: 'include',
      cache: 'no-store',
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to load reporting containers')
      setLoading(false)
      return
    }

    setItems(data.items ?? [])
    setLoading(false)
  }

  async function loadOverdueCount() {
    try {
      const res = await fetch('/api/notifications/overdue-count', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        setOverdueCount(0)
        return
      }
      const data = await res.json().catch(() => null)
      setOverdueCount(typeof data?.overdueCount === 'number' ? data.overdueCount : 0)
    } catch {
      setOverdueCount(0)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })

    router.push('/login')
  }

  function applyTypeFilter(nextType: string) {
    setShowMenu(false)

    if (!nextType) {
      router.push('/app/containers')
      return
    }

    router.push(`/app/containers?type=${encodeURIComponent(nextType)}`)
  }

  /* =========================================================
     6) Effects
     ========================================================= */

  useEffect(() => {
    load()
    loadContainerTypes()
    loadOverdueCount()
  }, [])

  useEffect(() => {
    function handleDocumentClick() {
      setShowMenu(false)
    }

    if (!showMenu) {
      return
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [showMenu])

  /* =========================================================
     7) Render
     ========================================================= */

  return (
    <main style={{ maxWidth: 900 }}>
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          position: 'relative',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Reporting</h1>
          <p style={{ opacity: 0.75, marginTop: 0 }}>
            Read-only access to reportable containers.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          <button
            type="button"
            title={showMenu ? 'Hide menu' : 'Show menu'}
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu((prev) => !prev)
            }}
            style={{
              height: 36,
              width: 36,
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: '18px',
              position: 'relative',
            }}
          >
            ☰
            {overdueCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#dc2626',
                  color: 'white',
                  fontSize: 11,
                  lineHeight: '18px',
                  textAlign: 'center',
                  padding: '0 4px',
                }}
              >
                {overdueCount > 99 ? '99+' : overdueCount}
              </span>
            )}
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 'min(220px, calc(100vw - 32px))',
                maxWidth: 'calc(100vw - 32px)',
                background: 'white',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 8,
                display: 'grid',
                gap: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                zIndex: 20,
              }}
            >
              <button
                type="button"
                onClick={() => applyTypeFilter('')}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                All
              </button>

              {availableContainerTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => applyTypeFilter(type)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {getContainerTypeDisplay(type).label}
                </button>
              ))}

              <div
                style={{
                  height: 1,
                  background: 'rgba(0,0,0,0.08)',
                  margin: '4px 0',
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/reporting')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                }}
              >
                Reporting
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/settings')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Settings
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/feedback')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Give Feedback
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/notifications')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Notifications
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div style={{ color: 'crimson', marginTop: 12 }}>
          {error}
        </div>
      )}

      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No reportable containers found.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {item.title}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                      Type: {getContainerTypeDisplay(item.type).label}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                      Created: {formatDate(item.createdAt)}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Updated: {formatDate(item.updatedAt)}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    <Link
                      href={`/app/reporting/${item.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 36,
                        padding: '0 12px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        borderRadius: 8,
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
