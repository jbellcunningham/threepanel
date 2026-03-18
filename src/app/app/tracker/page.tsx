'use client'

/**
 * FILE: /app/app/tracker/page.tsx
 *
 * PURPOSE:
 * - Lists all trackers for the logged-in user
 * - Allows creation of new trackers
 * - Provides quick actions:
 *   - pencil -> open tracker entries page
 *   - sprocket -> open tracker settings page
 *
 * ARCHITECTURE ROLE:
 * - Client UI layer for tracker list
 * - Consumes GET/POST /api/tracker
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

/* =========================================================
   2) Types
   ========================================================= */

type TrackerItem = {
  id: string
  title: string
  type: string
  createdAt: string
  summary?: Record<string, unknown>
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

export default function TrackerPage() {
  const router = useRouter()

  /* -----------------------------
     State
     ----------------------------- */

  const [items, setItems] = useState<TrackerItem[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* -----------------------------
     Derived values
     ----------------------------- */

  const canAdd = useMemo(() => title.trim().length > 0, [title])

  /* =========================================================
     5) Data loaders
     ========================================================= */

  async function load() {
    setError(null)
    setLoading(true)

    const res = await fetch('/api/tracker', { credentials: 'include' })
    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to load trackers')
      setLoading(false)
      return
    }

    setItems(data.items ?? [])
    setLoading(false)
  }

  /* =========================================================
     6) Event handlers
     ========================================================= */

  async function addTodoContainer() {
    const t = title.trim()
    if (!t) return

    setError(null)

    const res = await fetch('/api/tracker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t, type: 'todo' }),
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to create todo container')
      return
    }

    setTitle('')
    await load()
  }


  async function add() {
    const t = title.trim()
    if (!t) return

    setError(null)

    const res = await fetch('/api/tracker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t }),
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to create tracker')
      return
    }

    setTitle('')
    await load()
  }

  function openTracker(id: string) {
    router.push(`/app/tracker/${id}`)
  }

  function openTrackerSettings(id: string) {
    router.push(`/app/tracker/${id}/settings`)
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    load()
  }, [])

  /* =========================================================
     8) Render
     ========================================================= */

  return (
    <main style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Tracker</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Track projects, interests, health metrics, or anything else with custom fields.
      </p>

      {/* Add tracker */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New tracker title (e.g., Weight, Blood Pressure, Exercise)"
          style={{ flex: 1, padding: '10px 12px' }}
        />
        <button
          onClick={add}
          disabled={!canAdd}
          style={{ padding: '0 14px', height: 40 }}
        >
          Add
        </button>
	<button
	  onClick={addTodoContainer}
	  disabled={!canAdd}
	  style={{ padding: '0 14px', height: 40 }}
	>
	  Add Todo Container
	</button>
      </div>

      {error && <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div>}

      {/* Tracker list */}
      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No trackers yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((it) => (
              <div
                key={it.id}
                role="button"
                tabIndex={0}
                onClick={() => openTracker(it.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openTracker(it.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.12)',
                  cursor: 'pointer',
                }}
              >
                {/* Left side: tracker info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{it.title}</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    <em>Summary stats will appear here (configurable per tracker)</em>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Created: {formatDate(it.createdAt)}
                  </div>
                </div>

                {/* Right side: actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    title="Open tracker entries"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTracker(it.id)
                    }}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    title="Tracker settings"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTrackerSettings(it.id)
                    }}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
