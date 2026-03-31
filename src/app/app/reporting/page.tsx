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
  const [items, setItems] = useState<ReportingContainerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* =========================================================
     5) Data loader
     ========================================================= */

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

  /* =========================================================
     6) Effects
     ========================================================= */

  useEffect(() => {
    load()
  }, [])

  /* =========================================================
     7) Render
     ========================================================= */

  return (
    <main style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Reporting</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Read-only access to reportable containers.
      </p>

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
                      Type: {item.type}
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
