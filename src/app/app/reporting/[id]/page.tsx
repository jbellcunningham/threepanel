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
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { getContainerTypeDisplay } from '@/lib/containerTypeDisplay'
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

type ContainerTypesResponse = {
  ok: true
  types: string[]
}

type CurrentUser = {
  id: string
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

function toDateInputValue(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ''
  }
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
  const router = useRouter()
  const containerId = useMemo(() => getContainerIdFromPathname(pathname), [pathname])

  const [item, setItem] = useState<ReportingContainerItem | null>(null)
  const [entries, setEntries] = useState<ReportingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [availableContainerTypes, setAvailableContainerTypes] = useState<string[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const entryDate = toDateInputValue(entry.createdAt)

      if (fromDate && entryDate < fromDate) {
        return false
      }

      if (toDate && entryDate > toDate) {
        return false
      }

      return true
    })
  }, [entries, fromDate, toDate])

  const reportingTable = useMemo(() => {
    return buildReportingTable(item?.schema, filteredEntries)
  }, [item, filteredEntries])

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

  async function loadCurrentUser() {
    try {
      const res = await fetch('/api/me', {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        setCurrentUser(null)
        return
      }

      const data = await res.json().catch(() => null)

      if (!data?.user) {
        setCurrentUser(null)
        return
      }

      setCurrentUser(data.user)
    } catch {
      setCurrentUser(null)
    }
  }

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

    const nextItem = data.item ?? null
    const nextEntries = data.entries ?? []

    setItem(nextItem)
    setEntries(nextEntries)

    // initialize date filters (optional but helpful)
    if (nextEntries.length > 0) {
      const sortedDates = [...nextEntries]
        .map((entry: ReportingEntry) => toDateInputValue(entry.createdAt))
        .filter(Boolean)
        .sort()

      if (sortedDates.length > 0) {
        // leave filters empty by default (show all)
        // but this block ensures no invalid state
        if (fromDate && fromDate < sortedDates[0]) {
          setFromDate('')
        }

        if (toDate && toDate > sortedDates[sortedDates.length - 1]) {
          setToDate('')
        }
      }
    }

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

  /* =========================================================
     6) Effects
     ========================================================= */

  useEffect(() => {
    load()
    loadContainerTypes()
    loadCurrentUser()
    loadOverdueCount()
  }, [containerId])

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
        <Link
          href={
            currentUser && item && currentUser.id === item.userId
              ? `/app/containers/${containerId}`
              : '/app/reporting'
          }
          style={{ textDecoration: 'none' }}
        >
          ← Back
        </Link>

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
            position: 'relative',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>
            {item ? item.title : 'Reporting Container'}
          </h1>

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
              onClick={exportCsv}
              disabled={!item || reportingTable.rows.length === 0}
              style={{ height: 36, padding: '0 12px' }}
            >
              Export CSV
            </button>

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
                      background: item?.type === type ? 'rgba(0,0,0,0.08)' : 'transparent',
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
                    router.push(`/app/reporting/${containerId}`)
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

          <section
            style={{
              marginTop: 18,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Filters</h2>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.18)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.18)',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                }}
                style={{ height: 36, padding: '0 12px' }}
              >
                Clear Filters
              </button>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Showing {filteredEntries.length} of {entries.length} entries
              </div>
            </div>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Report Table</h2>

            {filteredEntries.length === 0 ? (
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
