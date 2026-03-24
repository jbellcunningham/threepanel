/**
 * FILE: /opt/threepanel/app/threepanel/src/app/app/journal/[id]/page.tsx
 *
 * PURPOSE:
 * - Displays one journal container
 * - Lists its entries
 * - Renders the journal entry form from container schema
 * - Supports date defaults and dropdown suggestions
 *
 * ARCHITECTURE ROLE:
 * - Client UI layer for unified Journal detail
 * - Consumes GET /api/journal
 * - Consumes POST /api/journal/[id]/entries
 */

'use client'

/* =========================================================
   1) Imports
   ========================================================= */

import Link from 'next/link'
import { useEffect, useState } from 'react'

/* =========================================================
   2) Types
   ========================================================= */

type JournalFieldType = 'text' | 'date' | 'textarea' | 'dropdown'

type JournalSchemaField = {
  key: string
  label: string
  type: JournalFieldType
}

type JournalSchema = {
  fields?: JournalSchemaField[]
}

type JournalEntry = {
  id: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type JournalItem = {
  id: string
  title: string
  done: boolean
  type: string
  schema?: JournalSchema | null
  createdAt: string
  updatedAt: string
  entries: JournalEntry[]
}

type JournalDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

/* =========================================================
   3) Helpers
   ========================================================= */

async function readJsonSafe(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function getDefaultJournalFields(): JournalSchemaField[] {
  return [
    {
      key: 'recordedDate',
      label: 'Recorded Date',
      type: 'date'
    },
    {
      key: 'location',
      label: 'Location',
      type: 'text'
    },
    {
      key: 'textEntry',
      label: 'Text Entry',
      type: 'textarea'
    }
  ]
}

function getSchemaFields(schema?: JournalSchema | null) {
  if (!schema || !Array.isArray(schema.fields) || schema.fields.length === 0) {
    return getDefaultJournalFields()
  }

  return schema.fields
}

function getDisplayValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function buildEmptyFormData(schema?: JournalSchema | null) {
  const result: Record<string, string> = {}
  const fields = getSchemaFields(schema)
  const today = new Date().toISOString().slice(0, 10)

  fields.forEach((field) => {
    if (field.type === 'date') {
      result[field.key] = today
      return
    }

    result[field.key] = ''
  })

  return result
}

function getGeneratedDropdownOptions(fieldKey: string, entries: JournalEntry[]) {
  const seen = new Set<string>()

  entries.forEach((entry) => {
    const raw = entry.data?.[fieldKey]

    if (typeof raw !== 'string') {
      return
    }

    const value = raw.trim()

    if (!value) {
      return
    }

    seen.add(value)
  })

  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

function getEntryTitle(data: Record<string, unknown>) {
  if (typeof data.textEntry === 'string' && data.textEntry.trim()) {
    return data.textEntry.trim()
  }

  if (typeof data.location === 'string' && data.location.trim()) {
    return data.location.trim()
  }

  return 'Journal entry'
}

/* =========================================================
   4) Component
   ========================================================= */

export default function JournalDetailPage({ params }: JournalDetailPageProps) {
  /* -----------------------------
     State
     ----------------------------- */

  const [itemId, setItemId] = useState('')
  const [item, setItem] = useState<JournalItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingEntry, setCreatingEntry] = useState(false)
  const [entryFormData, setEntryFormData] = useState<Record<string, string>>({})

  /* =========================================================
     5) Data loaders
     ========================================================= */

  async function loadJournalItem(id: string) {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/journal', {
        cache: 'no-store'
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        setError(data?.error || 'Failed to load journal item')
        setItem(null)
        return
      }

      const items = Array.isArray(data) ? data : []
      const selectedItem = items.find((entry) => entry.id === id) || null

      if (!selectedItem) {
        setError('Journal item not found')
        setItem(null)
        return
      }

      setItem(selectedItem)
      setEntryFormData(buildEmptyFormData(selectedItem.schema))
    } catch (err) {
      console.error('loadJournalItem error:', err)
      setError('Failed to load journal item')
      setItem(null)
    } finally {
      setLoading(false)
    }
  }

  /* =========================================================
     6) Event handlers
     ========================================================= */

  function handleFieldChange(fieldKey: string, value: string) {
    setEntryFormData((current) => ({
      ...current,
      [fieldKey]: value
    }))
  }

  async function handleCreateEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!itemId || !item) {
      return
    }

    const fields = getSchemaFields(item.schema)
    const hasAnyValue = fields.some((field) => {
      const value = entryFormData[field.key]
      return typeof value === 'string' && value.trim()
    })

    if (!hasAnyValue) {
      return
    }

    try {
      setCreatingEntry(true)
      setError('')

      const payload: Record<string, string> = {}

      fields.forEach((field) => {
        payload[field.key] = (entryFormData[field.key] || '').trim()
      })

      const res = await fetch(`/api/journal/${itemId}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        setError(data?.error || 'Failed to create journal entry')
        return
      }

      setEntryFormData(buildEmptyFormData(item.schema))
      await loadJournalItem(itemId)
    } catch (err) {
      console.error('handleCreateEntry error:', err)
      setError('Failed to create journal entry')
    } finally {
      setCreatingEntry(false)
    }
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    async function resolveParams() {
      const resolvedParams = await params
      setItemId(resolvedParams.id)
    }

    resolveParams()
  }, [params])

  useEffect(() => {
    if (!itemId) {
      return
    }

    loadJournalItem(itemId)
  }, [itemId])

  /* =========================================================
     8) Render
     ========================================================= */

  const fields = getSchemaFields(item?.schema)

  return (
    <div
      style={{
        padding: '16px'
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <Link href='/app/journal'>← Back to Journal</Link>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error && !item ? (
        <div>{error}</div>
      ) : !item ? (
        <div>Journal item not found.</div>
      ) : (
        <div>
          <h1 style={{ marginTop: 0 }}>{item.title}</h1>

          <div
            style={{
              marginBottom: '16px',
              fontSize: '14px',
              opacity: 0.7
            }}
          >
            Entries: {item.entries.length}
          </div>

          <form
            onSubmit={handleCreateEntry}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            {fields.map((field) => {
              const value = entryFormData[field.key] || ''

              if (field.type === 'textarea') {
                return (
                  <textarea
                    key={field.key}
                    value={value}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.label}
                    rows={6}
                    style={{
                      padding: '10px',
                      fontSize: '16px',
                      resize: 'vertical'
                    }}
                  />
                )
              }

              if (field.type === 'dropdown') {
                return (
                  <div
                    key={field.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <input
                      list={`journal-datalist-${field.key}`}
                      value={value}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.label}
                      style={{
                        padding: '10px',
                        fontSize: '16px'
                      }}
                    />
                    <datalist id={`journal-datalist-${field.key}`}>
                      {getGeneratedDropdownOptions(field.key, item.entries).map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                )
              }

              return (
                <input
                  key={field.key}
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={value}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.label}
                  style={{
                    padding: '10px',
                    fontSize: '16px'
                  }}
                />
              )
            })}

            <div>
              <button
                type='submit'
                disabled={creatingEntry}
                style={{
                  padding: '10px 14px',
                  fontSize: '16px',
                  cursor: creatingEntry ? 'default' : 'pointer'
                }}
              >
                {creatingEntry ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </form>

          {error ? (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px',
                border: '1px solid #cc0000'
              }}
            >
              {error}
            </div>
          ) : null}

          {item.entries.length === 0 ? (
            <div>No journal entries yet.</div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              {item.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: '8px'
                    }}
                  >
                    {getEntryTitle(entry.data)}
                  </div>

                  {fields.map((field) => {
                    const value = getDisplayValue(entry.data[field.key])

                    if (!value) {
                      return null
                    }

                    return (
                      <div
                        key={field.key}
                        style={{
                          marginBottom: '6px'
                        }}
                      >
                        <strong>{field.label}:</strong>{' '}
                        <span
                          style={{
                            whiteSpace: field.type === 'textarea' ? 'pre-wrap' : 'normal'
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    )
                  })}

                  <div
                    style={{
                      fontSize: '12px',
                      opacity: 0.7,
                      marginTop: '8px'
                    }}
                  >
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
