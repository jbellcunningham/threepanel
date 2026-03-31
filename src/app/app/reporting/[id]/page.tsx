'use client'

/**
 * FILE: /src/app/app/reporting/[id]/page.tsx
 *
 * PURPOSE:
 * - Read-only reporting detail page for one container
 * - Shows container metadata and raw entries
 *
 * ARCHITECTURE ROLE:
 * - Client UI for reporting detail
 * - Consumes GET /api/reporting/containers/[id]
 */

/* =========================================================
   1) Imports
   ========================================================= */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

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
  schema?: {
    version?: number
    fields?: Array<{
      id: string
      label: string
      type: string
    }>
  } | null
  userId: string
}

type ReportingEntry = {
  id: string
  createdAt: string
  updatedAt: string
  data?: Record<string, unknown> | null
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

function getContainerIdFromPathname(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function formatEntryData(data: Record<string, unknown> | null | undefined) {
  if (!data) {
    return '{}'
  }

  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return '{}'
  }
}

/* =========================================================
   4) Component
   ========================================================= */

export default function ReportingContainerDetailPage() {
  const pathname = usePathname()
  const containerId = useMemo(() => getContainerIdFromPathname(pathname), [pathname])

  const [item, setItem] = useState<ReportingContainerItem | null>(null)
  const [entries, setEntries] = useState<ReportingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* =========================================================
     5) Data loader
     ========================================================= */

  async function load() {
    if (!containerId) {
      return
    }

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/reporting/containers/${containerId}`, {
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
      setError(data?.error || raw || 'Failed to load reporting container')
      setLoading(false)
      return
    }

    setItem(data.item ?? null)
    setEntries(data.entries ?? [])
    setLoading(false)
  }

  /* =========================================================
     6) Effects
     ========================================================= */

  useEffect(() => {
    load()
  }, [containerId])

  /* =========================================================
     7) Render
     ========================================================= */

  if (!containerId) {
    return (
      <main style={{ maxWidth: 900 }}>
        <h1 style={{ marginTop: 0 }}>Reporting</h1>
        <div style={{ color: 'crimson' }}>Missing reporting container id in route.</div>
        <div style={{ marginTop: 10 }}>
          <Link href="/app/reporting">← Back to Reporting</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900 }}>
      <div>
        <Link href="/app/reporting" style={{ textDecoration: 'none' }}>
          ← Back to Reporting
        </Link>

        <h1 style={{ marginTop: 8, marginBottom: 6 }}>
          {item ? item.title : 'Reporting Container'}
        </h1>

        {item && (
          <>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Type: {item.type}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Created: {formatDate(item.createdAt)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Updated: {formatDate(item.updatedAt)}
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ color: 'crimson', marginTop: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading…</div>
      ) : (
        <>
          <section
            style={{
              marginTop: 18,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Schema</h2>

            {!item?.schema?.fields?.length ? (
              <div style={{ opacity: 0.75 }}>No schema fields.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {item.schema.fields.map((field) => (
                  <div
                    key={field.id}
                    style={{
                      border: '1px solid rgba(0,0,0,0.10)',
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{field.label}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {field.id} • {field.type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Entries</h2>

            {entries.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No entries found.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Created: {formatDate(entry.createdAt)}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                      Updated: {formatDate(entry.updatedAt)}
                    </div>

                    <pre
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.04)',
                        overflowX: 'auto',
                        fontSize: 12,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {formatEntryData(entry.data)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
