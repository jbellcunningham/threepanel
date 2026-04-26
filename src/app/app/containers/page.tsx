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
import { getContainerTypeDisplay } from '@/lib/containerTypeDisplay'

/* =========================================================
   2) Types
   ========================================================= */

type ContainerSummary = {
  entryCount?: number
  openSubtaskCount?: number
  lastEntryAt?: string | null
}

type TrackerFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'dropdown'
type ListDisplayMode = 'none' | 'latest' | 'summary' | 'average'

type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
  options?: string[]
  showInCards?: boolean
  showInList?: boolean
  listDisplay?: ListDisplayMode
}

type TrackerSchema = {
  version?: number
  fields: TrackerField[]
}

type ContainerItem = {
  id: string
  title: string
  type: string
  done: boolean
  createdAt: string
  schema?: TrackerSchema | null
  latestEntry?: {
    id: string
    createdAt: string
    data?: Record<string, unknown> | null
  } | null
  listPreview?: Array<{
    fieldId: string
    label: string
    mode: 'latest' | 'summary' | 'average'
    value: string | number
  }>
  summary?: ContainerSummary
}

type BuiltInTemplateType = 'tracker' | 'todo' | 'journal'
type CreateMode = 'template' | 'custom'
type ContainerTypesResponse = {
  ok: true
  types: string[]
}

type FilterButton = {
  key: string
  label: string
  type: string
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

function isBuiltInTemplateType(value: string): value is BuiltInTemplateType {
  return value === 'tracker' || value === 'todo' || value === 'journal'
}

function getContainerSummaryText(item: ContainerItem) {
  const entryCount = typeof item.summary?.entryCount === 'number' ? item.summary.entryCount : 0
  const openSubtaskCount =
    typeof item.summary?.openSubtaskCount === 'number' ? item.summary.openSubtaskCount : 0
  const lastEntryAt =
    typeof item.summary?.lastEntryAt === 'string' ? item.summary.lastEntryAt : null

  if (item.type === 'todo') {
    return `${openSubtaskCount} open subtasks`
  }

  if (item.type === 'tracker') {
    if (lastEntryAt) {
      return `${entryCount} entries • Last entry: ${formatDate(lastEntryAt)}`
    }

    return `${entryCount} entries`
  }

  if (item.type === 'journal') {
    if (lastEntryAt) {
      return `Last entry: ${formatDate(lastEntryAt)}`
    }

    return 'No journal entries yet'
  }

  return `${entryCount} entries`
}

function formatContainerListPreview(item: ContainerItem) {
  if (!item.listPreview?.length) {
    return null
  }

  const parts = item.listPreview.map((preview) => {
    if (preview.mode === 'average') {
      return `${preview.label} Avg: ${String(preview.value)}`
    }

    if (preview.mode === 'summary') {
      return `${preview.label}: ${String(preview.value)}`
    }

    return `${preview.label}: ${String(preview.value)}`
  })

  return parts.length > 0 ? parts.join(' • ') : null
}

function getFilterButtons(types: string[]): FilterButton[] {
  return [
    { key: 'all', label: 'All', type: '' },
    ...types.map((type) => ({
      key: type,
      label: getContainerTypeDisplay(type).label,
      type
    }))
  ]
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
  const [availableContainerTypes, setAvailableContainerTypes] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [createMode, setCreateMode] = useState<CreateMode>('template')
  const [templateType, setTemplateType] = useState('tracker')
  const [customType, setCustomType] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [overdueCount, setOverdueCount] = useState(0)

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

  const templateTypeOptions = useMemo(() => {
    const builtInTypes: string[] = ['tracker', 'todo', 'journal']
    const customTypes = availableContainerTypes.filter((type) => !isBuiltInTemplateType(type))

    return [...builtInTypes, ...customTypes]
  }, [availableContainerTypes])

  const filterButtons = useMemo(
    () => getFilterButtons(availableContainerTypes),
    [availableContainerTypes]
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

async function loadContainerTypes() {
  try {
    const res = await fetch('/api/container-types', {
      credentials: 'include',
      cache: 'no-store'
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
    await loadContainerTypes()
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

    const normalizedTemplateType = templateType.trim().toLowerCase()

    const payload =
      createMode === 'template'
        ? isBuiltInTemplateType(normalizedTemplateType)
          ? {
              title: t,
              templateType: normalizedTemplateType
            }
          : {
              title: t,
              customType: normalizedTemplateType
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
    setShowCreate(false)
    setCreating(false)
  }

  function openContainer(id: string) {
    router.push(`/app/containers/${id}`)
  }

  function openContainerSettings(id: string) {
    router.push(`/app/containers/${id}/settings`)
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })

    router.push('/login')
  }

  async function toggleTodoContainerDone(id: string, nextDone: boolean) {
    setError(null)

    const now = new Date().toISOString()

    const res = await fetch(`/api/tracker/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        done: nextDone,
        doneAt: nextDone ? now : null,
        statusUpdatedAt: now
      })
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok) {
      setError(data?.error || raw || 'Failed to update todo container')
      return
    }

    await load()
  }

  async function deleteContainer(id: string, title: string) {
    const confirmed = confirm(`Delete container "${title}" and all of its entries?`)
    if (!confirmed) return

    setError(null)

    const res = await fetch(`/api/tracker/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to delete container')
      return
    }

    await load()
  }

  function applyTypeFilter(nextType: string) {
    setShowMenu(false)

    if (!nextType) {
      router.push('/app/containers')
      return
    }

    router.push(`/app/containers?type=${encodeURIComponent(nextType)}`)
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    load()
    loadOverdueCount()
  }, [])

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
     8) Render
     ========================================================= */

  return (
    <main style={{ maxWidth: 900 }}>

      <section
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>{pageTitle}</h1>
          <p style={{ opacity: 0.75, marginTop: 0, marginBottom: 0 }}>{pageDescription}</p>
        </div>

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
            title={showCreate ? 'Hide' : 'Create Container'}
            onClick={() => {
              setShowCreate((prev) => {
                const next = !prev

                if (next) {
                  if (typeFilter) {
                    setCreateMode('template')
                    setTemplateType(typeFilter)
                  }
                }

                return next
              })
            }}
            style={{
              height: 36,
              width: 36,
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: '20px',
            }}
          >
            {showCreate ? '−' : '+'}
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
                  background: typeFilter === '' ? 'rgba(0,0,0,0.08)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                All
              </button>

              {filterButtons
                .filter((button) => button.type)
                .map((button) => {
                  const isActive = typeFilter === button.type

                  return (
                    <button
                      key={button.key}
                      type="button"
                      onClick={() => applyTypeFilter(button.type)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: isActive ? 'rgba(0,0,0,0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {button.label}
                    </button>
                  )
                })}

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
                  router.push('/app/reporting')
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
      </section>

      {showCreate && (
      <section
        id="create-container-section"
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
            onChange={(e) => setTemplateType(e.target.value)}
            style={{ padding: '10px 12px' }}
          >
            {templateTypeOptions.map((type) => (
              <option key={type} value={type}>
                {getContainerTypeDisplay(type).label}
              </option>
            ))}
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
      )}

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
                  <div
                    style={{
                      fontWeight: 700,
                      textDecoration: it.type === 'todo' && it.done ? 'line-through' : 'none'
                    }}
                  >
                    {it.title}
                  </div>

                  {(() => {
                    const display = getContainerTypeDisplay(it.type)

                    return (
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                        {display.icon} {display.label}
                      </div>
                    )
                  })()}

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    <em>{getContainerSummaryText(it)}</em>
                  </div>

                  {formatContainerListPreview(it) && (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      {formatContainerListPreview(it)}
                    </div>
                  )}

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Created: {formatDate(it.createdAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
   
                  {it.type === 'todo' ? (
                    <button
                      type="button"
                      title={it.done ? 'Mark container open' : 'Mark container done'}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTodoContainerDone(it.id, !it.done)
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
                      {it.done ? '↩️' : '✔️'}
                    </button>
                  ) : null}
   
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

                  <button
                    type="button"
                    title="Delete container"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteContainer(it.id, it.title)
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
