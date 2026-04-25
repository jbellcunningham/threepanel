'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type FeedbackStatus = 'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX'
type FeedbackType = 'BUG' | 'IMPROVEMENT' | 'QUESTION' | 'OTHER'

type FeedbackItem = {
  id: string
  userId: string
  username: string
  summary: string | null
  message: string
  type: FeedbackType
  status: FeedbackStatus
  pagePath: string | null
  adminNotes: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function AdminFeedbackPage() {
  const router = useRouter()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | FeedbackStatus>('ALL')

  const filteredItems = useMemo(() => {
    if (statusFilter === 'ALL') {
      return items
    }
    return items.filter((item) => item.status === statusFilter)
  }, [items, statusFilter])

  async function load() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/admin/feedback', {
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

    if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
      setItems([])
      setError(data?.error || raw || 'Failed to load feedback')
      setLoading(false)
      return
    }

    setItems(data.items as FeedbackItem[])
    setLoading(false)
  }

  async function updateFeedback(
    id: string,
    payload: { status?: FeedbackStatus; adminNotes?: string }
  ) {
    setSavingId(id)
    setError(null)

    const res = await fetch('/api/admin/feedback', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        ...payload,
      }),
    })

    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok || !data?.item) {
      setError(data?.error || raw || 'Failed to update feedback')
      setSavingId(null)
      return
    }

    const nextItem = data.item as FeedbackItem
    setItems((prev) => prev.map((item) => (item.id === nextItem.id ? nextItem : item)))
    setSavingId(null)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main style={{ maxWidth: 980 }}>
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Feedback Tracker</h1>
          <p style={{ opacity: 0.75, marginTop: 0 }}>
            Admin workflow for triage, progress, and resolution of submitted feedback.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.push('/app/settings')} style={{ height: 36, padding: '0 12px' }}>
            Admin Settings
          </button>
          <button type="button" onClick={load} style={{ height: 36, padding: '0 12px' }}>
            Refresh
          </button>
        </div>
      </section>

      <section style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>Status filter</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | FeedbackStatus)}
          style={{ padding: '8px 10px' }}
        >
          <option value="ALL">All</option>
          <option value="NEW">NEW</option>
          <option value="TRIAGED">TRIAGED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="DONE">DONE</option>
          <option value="WONT_FIX">WONT_FIX</option>
        </select>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Showing {filteredItems.length} of {items.length}
        </span>
      </section>

      {error && <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div>}

      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div>Loading feedback…</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No feedback items found.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredItems.map((item) => (
              <article
                key={item.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {item.summary?.trim() || '(No summary)'}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                      From: {item.username} • Type: {item.type} • Status: {item.status}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                      Submitted: {formatDate(item.createdAt)} • Updated: {formatDate(item.updatedAt)}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                      Resolved: {formatDate(item.resolvedAt)} • Page: {item.pagePath || '—'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: 13,
                    lineHeight: 1.45,
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 8,
                    padding: 10,
                    background: 'rgba(0,0,0,0.02)',
                  }}
                >
                  {item.message}
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Admin notes</label>
                  <textarea
                    value={item.adminNotes || ''}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((existing) =>
                          existing.id === item.id
                            ? { ...existing, adminNotes: e.target.value }
                            : existing
                        )
                      )
                    }
                    rows={3}
                    style={{ padding: '8px 10px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={item.status}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((existing) =>
                          existing.id === item.id
                            ? { ...existing, status: e.target.value as FeedbackStatus }
                            : existing
                        )
                      )
                    }
                    disabled={savingId === item.id}
                    style={{ padding: '8px 10px' }}
                  >
                    <option value="NEW">NEW</option>
                    <option value="TRIAGED">TRIAGED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="DONE">DONE</option>
                    <option value="WONT_FIX">WONT_FIX</option>
                  </select>
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() =>
                      updateFeedback(item.id, {
                        status: item.status,
                        adminNotes: item.adminNotes || '',
                      })
                    }
                    style={{ height: 34, padding: '0 12px' }}
                  >
                    {savingId === item.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
