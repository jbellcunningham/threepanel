'use client'

/**
 * FILE: /app/app/tracker/[id]/settings/page.tsx
 *
 * PURPOSE:
 * - Edit one tracker's schema
 * - Add/remove/reorder fields
 * - Change field label, type, required flag
 * - Save schema back to TrackerItem.schema
 *
 * ARCHITECTURE ROLE:
 * - Client-side schema editor for schema-driven tracker system
 * - Reads tracker via GET /api/tracker/[id]
 * - Saves tracker via PATCH /api/tracker/[id]
 */

/* =========================================================
   1) Imports
   ========================================================= */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

/* =========================================================
   2) Types
   ========================================================= */

type TrackerFieldType = 'text' | 'number' | 'boolean' | 'date' | 'dropdown'

type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
}

type EditableTrackerField = TrackerField & {
  uid: string
}

type TrackerSchema = {
  version?: number
  fields: TrackerField[]
}

type TrackerItem = {
  id: string
  title: string
  type: string
  createdAt: string
  schema?: TrackerSchema | null
}

/* =========================================================
   3) Helpers
   ========================================================= */

function getTrackerIdFromPathname(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 2] || ''
}

function getContainerLabel(type?: string) {
  if (!type) return 'Container'

  if (type === 'tracker') return 'Tracker'
  if (type === 'todo') return 'Todo'
  if (type === 'journal') return 'Journal'

  return type
}

function slugifyFieldId(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function makeUid() {
  return `uid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function makeDefaultField(index: number): EditableTrackerField {
  return {
    uid: makeUid(),
    id: `field_${index}`,
    label: `Field ${index}`,
    type: 'text',
    required: false,
  }
}

function toEditableFields(fields: TrackerField[]) {
  return fields.map((field) => ({
    ...field,
    uid: makeUid(),
  }))
}

function toSchemaFields(fields: EditableTrackerField[]): TrackerField[] {
  return fields.map(({ uid, ...field }) => ({
    ...field,
    id: field.id.trim(),
    label: field.label.trim(),
  }))
}

/* =========================================================
   4) Component
   ========================================================= */

export default function TrackerSettingsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const trackerId = useMemo(() => getTrackerIdFromPathname(pathname), [pathname])

  /* -----------------------------
     State
     ----------------------------- */

  const [item, setItem] = useState<TrackerItem | null>(null)
  const [title, setTitle] = useState('')
  const [fields, setFields] = useState<EditableTrackerField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  /* -----------------------------
     Derived
     ----------------------------- */

  const canSave = useMemo(() => {
    if (saving) return false
    if (!title.trim()) return false
    if (fields.length === 0) return false

    for (const field of fields) {
      if (!field.id.trim()) return false
      if (!field.label.trim()) return false
    }

    return true
  }, [title, fields, saving])

  /* =========================================================
     5) Data Loaders
     ========================================================= */

  async function load() {
    if (!trackerId) return

    setLoading(true)
    setError(null)
    setMessage(null)

    const res = await fetch(`/api/tracker/${trackerId}`, {
      credentials: 'include',
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to load tracker')
      setLoading(false)
      return
    }

    const tracker = data.item as TrackerItem
    const schema = tracker.schema ?? { version: 1, fields: [] }

    setItem(tracker)
    setTitle(tracker.title)
    setFields(toEditableFields(schema.fields ?? []))
    setLoading(false)
  }

  /* =========================================================
     6) Event Handlers
     ========================================================= */

  function updateField(uid: string, patch: Partial<EditableTrackerField>) {
    setFields((prev) =>
      prev.map((field) => (field.uid === uid ? { ...field, ...patch } : field))
    )
  }

  function addField() {
    setFields((prev) => [...prev, makeDefaultField(prev.length + 1)])
  }

  function removeField(uid: string) {
    setFields((prev) => prev.filter((field) => field.uid !== uid))
  }

  function moveFieldUp(uid: string) {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.uid === uid)
      if (index <= 0) return prev

      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveFieldDown(uid: string) {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.uid === uid)
      if (index === -1 || index >= prev.length - 1) return prev

      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  async function saveSettings() {
    if (!trackerId || !canSave) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const schema: TrackerSchema = {
      version: 1,
      fields: toSchemaFields(fields),
    }

    const res = await fetch(`/api/tracker/${trackerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: title.trim(),
        schema,
      }),
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to save settings')
      setSaving(false)
      return
    }

    setMessage('Saved.')
    setSaving(false)
    await load()
  }

  async function deleteTracker() {
    if (!trackerId) return

    const confirmed = confirm(
      'Delete this tracker and all of its entries? This cannot be undone.'
    )
    if (!confirmed) return

    const res = await fetch(`/api/tracker/${trackerId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!res.ok) {
      setError('Failed to delete tracker')
      return
    }

    router.push('/app/tracker')
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    load()
  }, [trackerId])

  /* =========================================================
     8) Render
     ========================================================= */

  if (!trackerId) {
    return (
      <main style={{ maxWidth: 900 }}>
        <h1 style={{ marginTop: 0 }}>Container Settings</h1>
        <div style={{ color: 'crimson' }}>Missing container id in route.</div>
        <div style={{ marginTop: 10 }}>
          <Link href="/app/tracker">← Back to Containers</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900 }}>
      <div>
        <Link href={`/app/tracker/${trackerId}`} style={{ textDecoration: 'none' }}>
          ← Back to Container
        </Link>
        <h1 style={{ marginTop: 8, marginBottom: 6 }}>
          {item ? `${getContainerLabel(item.type)} Settings` : 'Container Settings'}
        </h1>
        {item && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Created: {formatDate(item.createdAt)}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading…</div>
      ) : (
        <>
          {/* Tracker metadata */}
          <section
            style={{
              marginTop: 18,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Tracker</h2>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.18)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Type</label>
                <input
                  value={item?.type || ''}
                  readOnly
                  style={{
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.18)',
                    background: 'rgba(0,0,0,0.04)',
                    color: 'rgba(0,0,0,0.75)',
                  }}
                />
              </div>
            </div>
          </section>

          {/* Schema editor */}
          <section
            style={{
              marginTop: 18,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Schema Fields</h2>
              <button type="button" onClick={addField} style={{ height: 36, padding: '0 12px' }}>
                Add field
              </button>
            </div>

            {fields.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No fields yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {fields.map((field) => (
                  <div
                    key={field.uid}
                    style={{
                      border: '1px solid rgba(0,0,0,0.10)',
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 180px auto',
                        gap: 10,
                        alignItems: 'end',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 6 }}>
                        <label style={{ fontWeight: 600, fontSize: 13 }}>Label</label>
                        <input
                          value={field.label}
                          onChange={(e) => updateField(field.uid, { label: e.target.value })}
                          style={{
                            height: 36,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.18)',
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gap: 6 }}>
                        <label style={{ fontWeight: 600, fontSize: 13 }}>Field ID</label>
                        <input
                          value={field.id}
                          onChange={(e) => updateField(field.uid, { id: e.target.value })}
                          onBlur={(e) => {
                            const next = slugifyFieldId(e.target.value || field.label) || field.id
                            updateField(field.uid, { id: next })
                          }}
                          style={{
                            height: 36,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.18)',
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gap: 6 }}>
                        <label style={{ fontWeight: 600, fontSize: 13 }}>Type</label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(field.uid, {
                              type: e.target.value as TrackerFieldType,
                            })
                          }
                          style={{
                            height: 36,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.18)',
                          }}
                        >
                          <option value="text">text</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="date">date</option>
                          <option value="dropdown">dropdown</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => moveFieldUp(field.uid)}
                          style={{ height: 36, padding: '0 10px' }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFieldDown(field.uid)}
                          style={{ height: 36, padding: '0 10px' }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(field.uid)}
                          style={{ height: 36, padding: '0 12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(e) => updateField(field.uid, { required: e.target.checked })}
                      />
                      Required
                    </label>

                    {field.type === 'dropdown' && (
                      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                        Dropdown values are generated automatically from previous unique entries for
                        this field. Users can also type a new value during entry.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Save / delete actions */}
          <section style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button onClick={saveSettings} disabled={!canSave} style={{ height: 38, padding: '0 14px' }}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>

            <button
              type="button"
              onClick={deleteTracker}
              style={{
                height: 38,
                padding: '0 14px',
                border: '1px solid rgba(180,0,0,0.4)',
              }}
            >
              Delete container
            </button>
          </section>

          {error && <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div>}

          {message && <div style={{ marginTop: 12, color: 'green' }}>{message}</div>}
        </>
      )}
    </main>
  )
}
