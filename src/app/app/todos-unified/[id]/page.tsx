'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/* =========================================================
   1) Types
   ========================================================= */

type TodoContainer = {
  id: string
  title: string
  type: string
  createdAt: string
  schema: unknown
}

type TodoEntry = {
  id: string
  createdAt: string
  updatedAt: string
  data: Record<string, unknown> | null
}

type TodoContainerResponse =
  | {
      ok: true
      item: TodoContainer
      entries: TodoEntry[]
    }
  | {
      ok: false
      error: string
    }

type RouteParams = Promise<{
  id: string
}>

/* =========================================================
   2) Helpers
   ========================================================= */

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function getEntryTitle(entry: TodoEntry): string {
  const value = entry.data?.title

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  return 'Untitled To-Do Entry'
}

function getEntryDone(entry: TodoEntry): boolean {
  return entry.data?.done === true
}

/* =========================================================
   3) Component
   ========================================================= */

export default function UnifiedTodoDetailPage({
  params,
}: {
  params: RouteParams
}) {
  const [todoId, setTodoId] = useState('')
  const [item, setItem] = useState<TodoContainer | null>(null)
  const [entries, setEntries] = useState<TodoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* =========================================================
     4) Data loaders
     ========================================================= */

  async function load(id: string) {
    setError(null)
    setLoading(true)

    const res = await fetch(`/api/todo-items/${id}`, {
      credentials: 'include',
    })

    const raw = await res.text()

    let data: TodoContainerResponse | null = null
    try {
      data = raw ? (JSON.parse(raw) as TodoContainerResponse) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError((data && 'error' in data && data.error) || raw || 'Failed to load todo container')
      setLoading(false)
      return
    }

    setItem(data.item)
    setEntries(data.entries)
    setLoading(false)
  }

  /* =========================================================
     5) Effects
     ========================================================= */

  useEffect(() => {
    ;(async () => {
      const resolved = await params
      setTodoId(resolved.id)
      await load(resolved.id)
    })()
  }, [params])

  /* =========================================================
     6) Render
     ========================================================= */

  if (!todoId) {
    return (
      <main style={{ maxWidth: 900 }}>
        <div>Loading…</div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900 }}>
      <div>
        <Link href="/app/todos-unified" style={{ textDecoration: 'none' }}>
          ← Back to Unified To-Do
        </Link>
        <h1 style={{ marginTop: 8, marginBottom: 6 }}>
          {item ? item.title : 'Unified To-Do'}
        </h1>
        {item && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Created: {formatDate(item.createdAt)}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          {error}
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Entries</h2>

        {loading ? (
          <div>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No to-do entries yet.</div>
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {getEntryTitle(entry)}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {getEntryDone(entry) ? '✅' : '⬜'}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Created: {formatDate(entry.createdAt)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Updated: {formatDate(entry.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
