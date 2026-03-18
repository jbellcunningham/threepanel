'use client'

import { useEffect, useMemo, useState } from 'react'

/* =========================================================
   1) Types
   ========================================================= */

type MeResponse =
  | { ok: true; user: { id: string; email: string } | null }
  | { ok: false; error: string }

type Todo = {
  id: string
  title: string
  done: boolean
  dueAt?: string | null
  listPosition: number
  createdAt: string
  updatedAt: string
}

type TodosResponse =
  | { ok: true; todos: Todo[] }
  | { ok: false; error: string }

/* =========================================================
   2) Helpers
   ========================================================= */

function formatDueDate(value?: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString()
}

/* =========================================================
   3) Component
   ========================================================= */

export default function TodosPage() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthed = useMemo(() => {
    return !!(me && 'ok' in me && me.ok && me.user)
  }, [me])

  /* =========================================================
     4) Data loaders
     ========================================================= */

  async function loadMe() {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    const data = (await res.json()) as MeResponse
    setMe(data)
  }

  async function loadTodos() {
    setError(null)

    const res = await fetch('/api/todos', { credentials: 'include' })
    const data = (await res.json()) as TodosResponse

    if (!data.ok) {
      setError(data.error || 'Failed to load todos')
      return
    }

    setTodos(data.todos)
  }

  /* =========================================================
     5) Event handlers
     ========================================================= */

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: trimmedTitle }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data?.error || 'Failed to create todo')
        return
      }

      setTitle('')
      await loadTodos()
    } finally {
      setLoading(false)
    }
  }

  async function toggleTodo(todo: Todo) {
    setError(null)

    const res = await fetch(`/api/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ done: !todo.done }),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      setError(data?.error || 'Failed to update todo')
      return
    }

    await loadTodos()
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })

    setTodos([])
    await loadMe()
  }

  /* =========================================================
     6) Effects
     ========================================================= */

  useEffect(() => {
    ;(async () => {
      await loadMe()
    })()
  }, [])

  useEffect(() => {
    if (isAuthed) {
      loadTodos()
    }
  }, [isAuthed])

  /* =========================================================
     7) Render guards
     ========================================================= */

  if (!me) {
    return <main style={{ padding: 24 }}>Loading…</main>
  }

  if (!('ok' in me) || !me.ok) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Todos</h1>
        <p>Could not load auth status.</p>
      </main>
    )
  }

  if (!me.user) {
    return (
      <main style={{ padding: 24, maxWidth: 560 }}>
        <h1>Todos</h1>
        <p>You’re not logged in.</p>
        <p>
          Use your existing <code>/api/auth/login</code> endpoint for now.
        </p>
      </main>
    )
  }

  /* =========================================================
     8) Render
     ========================================================= */

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>To-Do</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>{me.user.email}</p>
        </div>

        <button onClick={logout} style={{ height: 36 }}>
          Logout
        </button>
      </header>

      <section style={{ marginTop: 24 }}>
        <form onSubmit={addTodo} style={{ display: 'flex', gap: 8 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a todo…"
            style={{ flex: 1, padding: '10px 12px' }}
          />
          <button type="submit" disabled={loading} style={{ width: 120 }}>
            {loading ? 'Adding…' : 'Add'}
          </button>
        </form>

        {error && (
          <p style={{ marginTop: 12, color: 'crimson' }}>
            {error}
          </p>
        )}

        <ul style={{ marginTop: 18, paddingLeft: 18 }}>
          {todos.length === 0 ? (
            <li style={{ opacity: 0.7 }}>No todos yet.</li>
          ) : (
            todos.map((todo) => (
              <li
                key={todo.id}
                style={{
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <span
                    style={{
                      textDecoration: todo.done ? 'line-through' : 'none',
                      opacity: todo.done ? 0.7 : 1,
                    }}
                  >
                    {todo.title}
                  </span>

                  {todo.dueAt && (
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      Due: {formatDueDate(todo.dueAt)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleTodo(todo)}
                  style={{ minWidth: 110, height: 32 }}
                >
                  {todo.done ? 'Mark Open' : 'Mark Done'}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  )
}
