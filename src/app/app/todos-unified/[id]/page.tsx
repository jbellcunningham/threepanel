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
  done: boolean
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
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([])

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
    setSelectedEntryIds([])
    setLoading(false)
  }

function toggleEntrySelection(entryId: string) {
  setSelectedEntryIds((current) =>
    current.includes(entryId)
      ? current.filter((id) => id !== entryId)
      : [...current, entryId]
  )
}

function toggleSelectAll() {
  const allIds = entries.map((entry) => entry.id)
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedEntryIds.includes(id))

  setSelectedEntryIds(allSelected ? [] : allIds)
}

async function markSelectedDone() {
  if (!todoId || selectedEntryIds.length === 0) return

  setError(null)

  for (const entry of entries) {
    if (!selectedEntryIds.includes(entry.id)) {
      continue
    }

    const res = await fetch(`/api/tracker/${todoId}/entries/${entry.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          ...(entry.data ?? {}),
          done: true,
        },
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
      setError(data?.error || raw || 'Failed to update selected to-do entries')
      return
    }
  }

  await load(todoId)
}

async function markSelectedOpen() {
  if (!todoId || selectedEntryIds.length === 0) return

  setError(null)

  for (const entry of entries) {
    if (!selectedEntryIds.includes(entry.id)) {
      continue
    }

    const res = await fetch(`/api/tracker/${todoId}/entries/${entry.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          ...(entry.data ?? {}),
          done: false,
        },
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
      setError(data?.error || raw || 'Failed to update selected to-do entries')
      return
    }
  }

  await load(todoId)
}

async function deleteSelectedEntries() {
  if (!todoId || selectedEntryIds.length === 0) return

  const confirmed = window.confirm('Delete selected to-do entries?')
  if (!confirmed) return

  setError(null)

  for (const entryId of selectedEntryIds) {
    const res = await fetch(`/api/tracker/${todoId}/entries/${entryId}`, {
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
      setError(data?.error || raw || 'Failed to delete selected to-do entries')
      return
    }
  }

  await load(todoId)
}

async function addEntry() {
  const trimmedTitle = newTitle.trim()
  if (!trimmedTitle || !todoId) return

  setError(null)
  setSaving(true)

  try {
    const res = await fetch(`/api/tracker/${todoId}/entries`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          title: trimmedTitle,
          done: false,
        },
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
      setError(data?.error || raw || 'Failed to create to-do entry')
      return
    }

    setNewTitle('')
    await load(todoId)
  } finally {
    setSaving(false)
  }
}

async function toggleEntry(entry: TodoEntry) {
  if (!todoId) return

  setError(null)

  const currentDone = entry.data?.done === true

  const res = await fetch(`/api/tracker/${todoId}/entries/${entry.id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...(entry.data ?? {}),
        done: !currentDone,
      },
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
    setError(data?.error || raw || 'Failed to update to-do entry')
    return
  }

  await load(todoId)
}

async function deleteEntry(entryId: string) {
  if (!todoId) return

  const confirmed = window.confirm('Delete this to-do entry?')
  if (!confirmed) return

  setError(null)

  const res = await fetch(`/api/tracker/${todoId}/entries/${entryId}`, {
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
    setError(data?.error || raw || 'Failed to delete to-do entry')
    return
  }

  await load(todoId)
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
          ← Back to To-Do
        </Link>
        <h1 style={{ marginTop: 8, marginBottom: 6 }}>
          {item ? item.title : 'To-Do'}
        </h1>
          {item && (
            <>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Created: {formatDate(item.createdAt)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Status: {item.done ? 'Done' : 'Open'}
              </div>
            </>
          )}
      </div>

      {error && (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          {error}
        </div>
      )}

	<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
	  <input
	    value={newTitle}
	    onChange={(e) => setNewTitle(e.target.value)}
	    placeholder="New to-do entry title"
	    style={{ flex: 1, padding: '10px 12px' }}
	  />
	  <button
	    onClick={addEntry}
	    disabled={newTitle.trim().length === 0 || saving}
	    style={{ padding: '0 14px', height: 40 }}
	  >
	    {saving ? 'Adding…' : 'Add Entry'}
	  </button>
	</div>
 
     <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Entries</h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={
                  entries.length > 0 &&
                  entries.every((entry) => selectedEntryIds.includes(entry.id))
                }
                onChange={toggleSelectAll}
              />
              <span>Select all</span>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                title="Mark selected open"
                onClick={markSelectedOpen}
                disabled={selectedEntryIds.length === 0}
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                ↩️
              </button>

              <button
                type="button"
                title="Mark selected done"
                onClick={markSelectedDone}
                disabled={selectedEntryIds.length === 0}
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                ✔️
              </button>

              <button
                type="button"
                title="Delete selected entries"
                onClick={deleteSelectedEntries}
                disabled={selectedEntryIds.length === 0}
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.includes(entry.id)}
                      onChange={() => toggleEntrySelection(entry.id)}
                      style={{ marginTop: 2 }}
                    />

                    <div
                      style={{
                        fontWeight: 700,
                        textDecoration: getEntryDone(entry) ? 'line-through' : 'none',
                        opacity: getEntryDone(entry) ? 0.7 : 1,
                      }}
                    >
                      {getEntryTitle(entry)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      title={getEntryDone(entry) ? 'Mark Open' : 'Mark Done'}
                      onClick={() => toggleEntry(entry)}
                      style={{
                        height: 32,
                        width: 32,
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getEntryDone(entry) ? '↩️' : '✔️'}
                    </button>

                    <button
                      type="button"
                      title="Delete entry"
                      onClick={() => deleteEntry(entry.id)}
                      style={{
                        height: 32,
                        width: 32,
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      🗑️
                    </button>
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
