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
import { buildReportingTable } from '@/lib/reportingTable'

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

function formatCellValue(value: string) {
  return value || '—'
}

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function buildCsvContent(
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string>>
) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(',')

  const lines = rows.map((row) =>
    columns
      .map((column) => escapeCsvValue(row[column.key] ?? ''))
      .join(',')
  )

  return [header, ...lines].join('\n')
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

  const reportingTable = useMemo(() => {
    return buildReportingTable(item?.schema, entries)
  }, [item, entries])

  function exportCsv() {
    if (!item) {
      return
    }

    const csv = buildCsvContent(reportingTable.columns, reportingTable.rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const safeTitle = item.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'

    const datePart = new Date().toISOString().slice(0, 10)

    const link = document.createElement('a')
    link.href = url
    link.download = `${safeTitle}-${datePart}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

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

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>
            {item ? item.title : 'Reporting Container'}
          </h1>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!item || reportingTable.rows.length === 0}
            style={{ height: 36, padding: '0 12px' }}
          >
            Export CSV
          </button>
        </div>

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
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Report Table</h2>

            {entries.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No entries found.</div>
            ) : (
              <div
                style={{
                  overflowX: 'auto',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 12,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {reportingTable.columns.map((column) => (
                        <th
                          key={column.key}
                          style={{
                            textAlign: 'left',
                            padding: '10px',
                            borderBottom: '1px solid rgba(0,0,0,0.10)',
                            background: 'rgba(0,0,0,0.03)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportingTable.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {reportingTable.columns.map((column) => (
                          <td
                            key={column.key}
                            style={{
                              padding: '10px',
                              borderBottom: '1px solid rgba(0,0,0,0.06)',
                              verticalAlign: 'top',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {formatCellValue(row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
