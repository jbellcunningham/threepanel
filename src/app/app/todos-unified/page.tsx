'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/* =========================================================
   1) Types
   ========================================================= */

type TodoContainer = {
  id: string
  title: string
  type: string
  done: boolean
  createdAt: string
  schema: unknown
}

type TodoContainersResponse =
  | {
      ok: true
      items: TodoContainer[]
    }
  | {
      ok: false
      error: string
    }

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

/* =========================================================
   3) Component
   ========================================================= */

export default function UnifiedTodosPage() {
  const router = useRouter()
  const [items, setItems] = useState<TodoContainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  /* =========================================================
     4) Data loaders
     ========================================================= */

  async function load() {
    setError(null)
    setLoading(true)

    const res = await fetch('/api/todo-items', { credentials: 'include' })
    const raw = await res.text()

    let data: TodoContainersResponse | null = null
    try {
      data = raw ? (JSON.parse(raw) as TodoContainersResponse) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError((data && 'error' in data && data.error) || raw || 'Failed to load todo containers')
      setLoading(false)
      return
    }

    setItems(data.items)
    setLoading(false)
  }

async function addTodoContainer() {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) return

  setError(null)

  const res = await fetch('/api/tracker', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: trimmedTitle, type: 'todo' }),
  })

  const raw = await res.text()

  let data: { ok?: boolean; error?: string } | null = null
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

async function deleteTodoContainer(itemId: string) {
  const confirmed = window.confirm('Delete this to-do container?')
  if (!confirmed) return

  setError(null)

  const res = await fetch(`/api/items/${itemId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  const raw = await res.text()

  let data: { ok?: boolean; error?: string } | null = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!res.ok || !data?.ok) {
    setError(data?.error || raw || 'Failed to delete todo container')
    return
  }

  await load()
}

async function renameTodoContainer(item: TodoContainer) {
  const nextTitle = window.prompt('Rename to-do container', item.title)?.trim()

  if (!nextTitle || nextTitle === item.title) {
    return
  }

  setError(null)

  const res = await fetch(`/api/items/${item.id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: nextTitle,
    }),
  })

  const raw = await res.text()

  let data: { ok?: boolean; error?: string } | null = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!res.ok || !data?.ok) {
    setError(data?.error || raw || 'Failed to rename todo container')
    return
  }

  await load()
}

async function toggleTodoContainerDone(item: TodoContainer) {
  setError(null)

  const res = await fetch(`/api/items/${item.id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      done: !item.done,
    }),
  })

  const raw = await res.text()

  let data: { ok?: boolean; error?: string } | null = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!res.ok || !data?.ok) {
    setError(data?.error || raw || 'Failed to update todo container')
    return
  }

  await load()
}

  /* =========================================================
     5) Effects
     ========================================================= */

  useEffect(() => {
    load()
  }, [])

  /* =========================================================
     6) Render
     ========================================================= */

  return (
    <main style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Unified To-Do</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        This page lists To-Do containers stored in the unified TrackerItem table.
      </p>

	<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
	  <input
	    value={title}
	    onChange={(e) => setTitle(e.target.value)}
	    placeholder="Todos"
	    style={{ flex: 1, padding: '10px 12px' }}
	  />
	  <button
	    onClick={addTodoContainer}
	    disabled={title.trim().length === 0}
	    style={{ padding: '0 14px', height: 40 }}
	  >
	    Add
	  </button>
	</div>

      {error && <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div>}

      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No unified todo containers yet.</div>
		) : (
		  <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.12)',
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/app/todos-unified/${item.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      router.push(`/app/todos-unified/${item.id}`)
                    }
                  }}
                  style={{
                    minWidth: 0,
                    flex: 1,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      textDecoration: item.done ? 'line-through' : 'none',
                      opacity: item.done ? 0.7 : 1,
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                    Type: {item.type}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Created: {formatDate(item.createdAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    title={item.done ? 'Mark container open' : 'Mark container done'}
                    onClick={() => toggleTodoContainerDone(item)}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {item.done ? '↩️' : '✔️'}
                  </button>

                  <button
                    type="button"
                    title="Open to-do container"
                    onClick={() => router.push(`/app/todos-unified/${item.id}`)}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    📂
                  </button>

                  <button
                    type="button"
                    title="Rename to-do container"
                    onClick={() => renameTodoContainer(item)}
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
                    title="Delete to-do container"
                    onClick={() => deleteTodoContainer(item.id)}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    🗑️
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
