'use client'

/**
 * FILE: /app/app/containers/page.tsx
 *
 * PURPOSE:
 * - Lists all containers for the logged-in user
 * - Allows creation of new containers
 * - Supports built-in templates and custom types
 * - Supports filtering by container type via query param
 * - Provides quick actions:
 *   - pencil -> open container entries page
 *   - sprocket -> open container settings page
 *
 * ARCHITECTURE ROLE:
 * - Client UI layer for unified container list
 * - Consumes GET/POST /api/tracker
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/* =========================================================
   2) Types
   ========================================================= */

type ContainerItem = {
  id: string
  title: string
  type: string
  createdAt: string
  summary?: Record<string, unknown>
}

type BuiltInTemplateType = 'tracker' | 'todo' | 'journal'
type CreateMode = 'template' | 'custom'

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

function getContainerListTitle(typeFilter: string) {
  if (!typeFilter) {
    return 'All Containers'
  }

  if (typeFilter === 'tracker') {
    return 'Tracker Containers'
  }

  if (typeFilter === 'todo') {
    return 'Todo Containers'
  }

  if (typeFilter === 'journal') {
    return 'Journal Containers'
  }

  return `${typeFilter} Containers`
}

function getContainerListDescription(typeFilter: string) {
  if (!typeFilter) {
    return 'Create and manage containers from built-in templates or start a new custom type.'
  }

  return `Viewing containers filtered by type: ${typeFilter}`
}

/* =========================================================
   4) Component
   ========================================================= */

export default function ContainersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  /* -----------------------------
     State
     ----------------------------- */

  const [items, setItems] = useState<ContainerItem[]>([])
  const [title, setTitle] = useState('')
  const [createMode, setCreateMode] = useState<CreateMode>('template')
  const [templateType, setTemplateType] = useState<BuiltInTemplateType>('tracker')
  const [customType, setCustomType] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* -----------------------------
     Derived values
     ----------------------------- */

  const typeFilter = (searchParams.get('type') || '').trim().toLowerCase()

  const filteredItems = useMemo(() => {
    if (!typeFilter) {
      return items
    }

    return items.filter((item) => item.type.toLowerCase() === typeFilter)
  }, [items, typeFilter])

  const pageTitle = useMemo(() => getContainerListTitle(typeFilter), [typeFilter])
  const pageDescription = useMemo(
    () => getContainerListDescription(typeFilter),
    [typeFilter]
  )

  const canAdd = useMemo(() => {
    if (!title.trim()) {
      return false
    }

    if (createMode === 'custom' && !customType.trim()) {
      return false
    }

    return !creating
  }, [title, createMode, customType, creating])

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
      setError(data?.error || raw || 'Failed to load containers')
      setLoading(false)
      return
    }

    setItems(data.items ?? [])
    setLoading(false)
  }

  /* =========================================================
     6) Event handlers
     ========================================================= */

  async function addContainer() {
    const t = title.trim()
    if (!t) return

    if (createMode === 'custom' && !customType.trim()) {
      return
    }

    setCreating(true)
    setError(null)

    const payload =
      createMode === 'template'
        ? {
            title: t,
            templateType
          }
        : {
            title: t,
            customType: customType.trim()
          }

    const res = await fetch('/api/tracker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to create container')
      setCreating(false)
      return
    }

    setTitle('')
    setCustomType('')
    setTemplateType('tracker')
    setCreateMode('template')

    await load()
    setCreating(false)
  }

  function openContainer(id: string) {
    router.push(`/app/containers/${id}`)
  }

  function openContainerSettings(id: string) {
    router.push(`/app/containers/${id}/settings`)
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
      <h1 style={{ marginTop: 0 }}>{pageTitle}</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>{pageDescription}</p>

      <section
        style={{
          marginTop: 16,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          padding: 12,
          display: 'grid',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCreateMode('template')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              background: createMode === 'template' ? 'rgba(0,0,0,0.08)' : 'transparent',
              cursor: 'pointer'
            }}
          >
            Use Template
          </button>

          <button
            type="button"
            onClick={() => setCreateMode('custom')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              background: createMode === 'custom' ? 'rgba(0,0,0,0.08)' : 'transparent',
              cursor: 'pointer'
            }}
          >
            New Custom Type
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Container title"
          style={{ padding: '10px 12px' }}
        />

        {createMode === 'template' ? (
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as BuiltInTemplateType)}
            style={{ padding: '10px 12px' }}
          >
            <option value="tracker">Tracker</option>
            <option value="todo">Todo</option>
            <option value="journal">Journal</option>
          </select>
        ) : (
          <input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="Custom type name (e.g. habits, inventory, field-notes)"
            style={{ padding: '10px 12px' }}
          />
        )}

        <div>
          <button
            onClick={addContainer}
            disabled={!canAdd}
            style={{ padding: '0 14px', height: 40 }}
          >
            {creating ? 'Creating…' : 'Create Container'}
          </button>
        </div>
      </section>

      {error && <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div>}

      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div>Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            {typeFilter
              ? `No containers found for type: ${typeFilter}.`
              : 'No containers yet.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredItems.map((it) => (
              <div
                key={it.id}
                role="button"
                tabIndex={0}
                onClick={() => openContainer(it.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openContainer(it.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.12)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{it.title}</div>

                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                    Type: {it.type}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    <em>Summary stats will appear here (configurable per container)</em>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Created: {formatDate(it.createdAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    title="Open container entries"
                    onClick={(e) => {
                      e.stopPropagation()
                      openContainer(it.id)
                    }}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    title="Container settings"
                    onClick={(e) => {
                      e.stopPropagation()
                      openContainerSettings(it.id)
                    }}
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: 'transparent',
                      cursor: 'pointer'
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
