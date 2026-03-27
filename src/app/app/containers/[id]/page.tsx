'use client'

/**
 * FILE: /app/app/tracker/[id]/page.tsx
 *
 * PURPOSE:
 * - Show one container
 * - Load its schema + entries
 * - Render entry inputs dynamically from the schema
 * - Save entry values as JSON
 * - Render entry list from JSON data
 * - Edit and delete existing entries
 *
 * ARCHITECTURE ROLE:
 * - Client-side UI for one container
 * - Consumes GET /api/tracker/[id]
 * - Sends POST /api/tracker/[id]/entries
 * - Sends PATCH /api/tracker/[id]/entries/[entryId]
 * - Sends DELETE /api/tracker/[id]/entries/[entryId]
 *
 * CODE ORDER:
 * 1) Imports
 * 2) Types
 * 3) Helpers
 * 4) Component
 * 5) Data loaders
 * 6) Event handlers
 * 7) Effects
 * 8) Render
 */

/* =========================================================
   1) Imports
   ========================================================= */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { getContainerTypeDisplay } from '@/lib/containerTypeDisplay'
import TrackerLineChart from '@/components/charts/TrackerLineChart'

/* =========================================================
   2) Types
   ========================================================= */

type TrackerFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'dropdown'

type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
  options?: string[]
  showInCards?: boolean
  showInList?: boolean
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

type TrackerEntry = {
  id: string
  createdAt: string
  updatedAt?: string
  data?: Record<string, unknown> | null
}

type NumberFieldStats = {
  label: string;
  type: "number";
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
};

type DropdownFieldStats = {
  label: string;
  type: "dropdown";
  count: number;
  topValues: Array<{
    value: string;
    count: number;
  }>;
};

type BooleanFieldStats = {
  label: string;
  type: "boolean";
  count: number;
  trueCount: number;
  falseCount: number;
};

type TrackerFieldStats =
  | NumberFieldStats
  | DropdownFieldStats
  | BooleanFieldStats;

type TrackerStats = {
  trackerId: string;
  trackerTitle: string;
  entryCount: number;
  lastEntryAt: string | null;
  fields: Record<string, TrackerFieldStats>;
  timeSeries: TrackerTimeSeries;
};

type TimeSeriesPoint = {
  date: string;
  value: number;
};

type TrackerTimeSeries = Record<string, TimeSeriesPoint[]>;

/* =========================================================
   3) Helpers
   ========================================================= */

/**
 * Formats dates for human-readable display.
 */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * Extracts the container id from the current route pathname.
 */
function getContainerIdFromPathname(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function getEffectiveSchema(item: TrackerItem | null | undefined): TrackerSchema | null {
  if (item?.schema?.fields?.length) {
    return item.schema
  }

  if (item?.type === 'todo') {
    return {
      version: 1,
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'done', label: 'Done', type: 'boolean', required: true },
        { id: 'due_at', label: 'Due Date', type: 'date' },
        { id: 'notes', label: 'Notes', type: 'text' }
      ]
    }
  }

  if (item?.type === 'journal') {
    return {
      version: 1,
      fields: [
        { id: 'recordedDate', label: 'Recorded Date', type: 'date', required: true },
        { id: 'location', label: 'Location', type: 'dropdown' },
        { id: 'textEntry', label: 'Text Entry', type: 'textarea', required: true }
      ]
    }
  }

  return item?.schema ?? null
}


/**
 * Creates a fresh entry form object from the tracker schema.
 * Date fields default to today.
 */
function buildEmptyFormData(schema: TrackerSchema | null | undefined) {
  const result: Record<string, unknown> = {}

  if (!schema?.fields?.length) return result

  const today = new Date().toISOString().slice(0, 10)

  for (const field of schema.fields) {
    if (field.type === 'boolean') {
      result[field.id] = false
    } else if (field.type === 'date') {
      result[field.id] = today
    } else {
      result[field.id] = ''
    }
  }

  return result
}

/**
 * Builds a short summary string for each entry card using the
 * tracker schema order. This keeps the list compact and schema-driven.
 */
function getDisplayFields(
  schema: TrackerSchema | null | undefined,
  mode: 'cards' | 'list'
) {
  if (!schema?.fields?.length) {
    return []
  }

  const explicitlySelected =
    mode === 'cards'
      ? schema.fields.filter((field) => field.showInCards)
      : schema.fields.filter((field) => field.showInList)

  if (explicitlySelected.length > 0) {
    return explicitlySelected
  }

  const firstRequiredField = schema.fields.find((field) => field.required)
  if (firstRequiredField) {
    return [firstRequiredField]
  }

  return [schema.fields[0]]
}

function formatEntrySummary(
  schema: TrackerSchema | null | undefined,
  entry: TrackerEntry,
  mode: 'cards' | 'list' = 'cards'
) {
  const data = entry.data ?? {}

  if (!schema?.fields?.length) {
    return '(empty entry)'
  }

  const fieldsToUse = getDisplayFields(schema, mode)
  const parts: string[] = []

  for (const field of fieldsToUse) {
    const value = data[field.id]

    if (value === undefined || value === null || value === '') {
      continue
    }

    parts.push(`${field.label}: ${String(value)}`)
  }

  if (parts.length === 0) {
    return '(empty entry)'
  }

  return parts.join(' • ')
}

function getJournalEntryText(entry: TrackerEntry) {
  const value = entry.data?.textEntry

  return typeof value === 'string' ? value.trim() : ''
}

function shouldRenderJournalBody(
  schema: TrackerSchema | null | undefined
) {
  const fieldsToUse = getDisplayFields(schema, 'cards')

  return fieldsToUse.some((field) => field.id === 'textEntry')
}


/**
 * Collects prior unique values for a dropdown field from this tracker's entries.
 */
function getGeneratedDropdownOptions(fieldId: string, entries: TrackerEntry[]) {
  const seen = new Set<string>()

  for (const entry of entries) {
    const raw = entry.data?.[fieldId]

    if (typeof raw !== 'string') continue

    const value = raw.trim()
    if (!value) continue

    seen.add(value)
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

/**
 * Rebuilds a form object from an existing entry using the schema.
 * This ensures edit mode starts with a full, valid set of fields.
 */
function buildFormDataFromEntry(
  schema: TrackerSchema | null | undefined,
  entry: TrackerEntry | null
) {
  const base = buildEmptyFormData(schema)
  const data = entry?.data ?? {}

  return {
    ...base,
    ...data,
  }
}


/**
  * Adds stats to listing
  */
function formatStatsValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return String(value);
}

function formatStatsDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  return formatDate(value)
}

function formatChartDateLabel(value: string, showTime: boolean): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${Number(month)}/${Number(day)}/${year}`
  }

  const date = new Date(value)

  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()

  if (!showTime) {
    return `${month}/${day}/${year}`
  }

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  return `${month}/${day}/${year} ${hours}:${minutes}`
}

/* =========================================================
   4) Component
   ========================================================= */

export default function ContainerDetailPage() {
  const pathname = usePathname()
  const router = useRouter()
  const containerId = useMemo(() => getContainerIdFromPathname(pathname), [pathname])
  
  /* -----------------------------
     State
     ----------------------------- */

  const [item, setItem] = useState<TrackerItem | null>(null)
  const [entries, setEntries] = useState<TrackerEntry[]>([])
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [showStats, setShowStats] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedChartFieldId, setSelectedChartFieldId] = useState<string>('')
  const hasFieldStats = stats ? Object.keys(stats.fields).length > 0 : false

  // Edit mode state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  /* -----------------------------
     Derived values
     ----------------------------- */

  const schema = getEffectiveSchema(item)
  const isEditing = editingEntryId !== null

  const numericStatFields = useMemo(() => {
    if (!stats) return []

    return Object.entries(stats.fields).filter(
      ([, field]) => field.type === 'number'
    )
  }, [stats])

  const canSave = useMemo(() => {
    if (saving) return false
    if (!schema?.fields?.length) return false

    for (const field of schema.fields) {
      if (!field.required) continue

      const value = formData[field.id]

      if (
        field.type === 'text' ||
        field.type === 'textarea' ||
        field.type === 'date' ||
        field.type === 'dropdown'
      ) {
        if (typeof value !== 'string' || value.trim().length === 0) return false
      }

      if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
      }

      if (field.type === 'boolean') {
        if (typeof value !== 'boolean') return false
      }
    }

    return true
  }, [formData, saving, schema])

  /* =========================================================
     5) Data loaders
     ========================================================= */

  /**
   * Loads the tracker item and its entries from the API.
   */

  async function load() {
    if (!containerId) return

    setError(null)
    setLoading(true)

    const res = await fetch(`/api/tracker/${containerId}`, {
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

    setItem(data.item)
    setEntries(data.entries ?? [])
    setFormData(buildEmptyFormData(data.item?.schema ?? null))
    setEditingEntryId(null)
    setLoading(false)
  }

async function loadStats() {
  try {
    setStatsLoading(true);
    setStatsError(null);

    const response = await fetch(`/api/tracker/${containerId}/stats`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const raw = await response.text()

      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      setStats(null)
      setStatsError(data?.error || raw || 'Failed to load statistics')
      return
    }

    const data: TrackerStats = await response.json()
    setStats(data)

  } catch (error) {
    console.error('Failed to load stats:', error)
    setStats(null)
    setStatsError('Failed to load statistics')
  } finally {
    setStatsLoading(false);
  }
}


  /* =========================================================
     6) Event handlers
     ========================================================= */

  /**
   * Updates one field inside the dynamic entry form.
   */
  function setFieldValue(field: TrackerField, rawValue: string | boolean) {
    setFormData((prev) => {
      let nextValue: unknown = rawValue

      if (field.type === 'number') {
        nextValue = rawValue === '' ? '' : Number(rawValue)
      }

      if (
        field.type === 'text' ||
        field.type === 'textarea' ||
        field.type === 'date' ||
        field.type === 'dropdown'
      ) {
        nextValue = String(rawValue)
      }

      if (field.type === 'boolean') {
        nextValue = Boolean(rawValue)
      }

      return {
        ...prev,
        [field.id]: nextValue,
      }
    })
  }

  /**
   * Creates a new entry for the current tracker using the JSON form data.
   */
  async function addEntry() {
    if (!containerId) return
    if (!canSave) return

    setSaving(true)
    setError(null)

    const res = await fetch(`/api/tracker/${containerId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        data: formData,
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
      setError(data?.error || raw || 'Failed to save entry')
      setSaving(false)
      return
    }

    await load()
    await loadStats()
    setSaving(false)
  }

  /**
   * Starts editing an existing entry by loading its data into the form.
   */
  function startEdit(entry: TrackerEntry) {
    setError(null)
    setEditingEntryId(entry.id)
    setFormData(buildFormDataFromEntry(schema, entry))
  }

  /**
   * Cancels edit mode and resets form to a fresh entry state.
   */
  function cancelEdit() {
    setEditingEntryId(null)
    setFormData(buildEmptyFormData(schema))
    setError(null)
  }

  /**
   * Saves changes to an existing entry.
   */
  async function saveEdit() {
    if (!containerId || !editingEntryId || !canSave) return

    setSaving(true)
    setError(null)

    const res = await fetch(`/api/tracker/${containerId}/entries/${editingEntryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        data: formData,
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
      setError(data?.error || raw || 'Failed to update entry')
      setSaving(false)
      return
    }

    await load()
    await loadStats()
    setSaving(false)
  }

  /**
   * Deletes one entry after confirmation.
   */
  async function deleteEntry(entryId: string) {
    if (!containerId) return

    const confirmed = confirm('Delete this entry?')
    if (!confirmed) return

    setError(null)

    const res = await fetch(`/api/tracker/${containerId}/entries/${entryId}`, {
      method: 'DELETE',
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
      setError(data?.error || raw || 'Failed to delete entry')
      return
    }

    await load()
    await loadStats()
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    if (!containerId) return;

    load();
    loadStats();
  }, [containerId]);

  useEffect(() => {
    if (numericStatFields.length === 0) {
      setSelectedChartFieldId('')
      return
    }

    if (selectedChartFieldId === '__all__') {
      return
    }

    const hasValidSelection = numericStatFields.some(
      ([fieldId]) => fieldId === selectedChartFieldId
    )

    if (!hasValidSelection) {
      setSelectedChartFieldId(numericStatFields[0][0])
    }
  }, [numericStatFields, selectedChartFieldId])

  /* =========================================================
     8) Render
     ========================================================= */

  if (!containerId) {
    return (
      <main style={{ maxWidth: 900 }}>
        <h1 style={{ marginTop: 0 }}>Container</h1>
        <div style={{ color: 'crimson' }}>Missing container id in route.</div>
        <div style={{ marginTop: 10 }}>
          <Link href="/app/containers">← Back to Containers</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Link href="/app/containers" style={{ textDecoration: 'none' }}>
            ← Back to Containers
          </Link>
          <h1 style={{ marginTop: 8, marginBottom: 6 }}>
            {item ? item.title : 'Container'}
          </h1>
          {item && (
            <>
              {(() => {
                const display = getContainerTypeDisplay(item.type)

                return (
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>
                    Type: {display.icon} {display.label}
                  </div>
                )
              })()}
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Created: {formatDate(item.createdAt)}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading…</div>
      ) : (
        <>

          {/* Container Statistics / Settings Actions */}
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10
            }}
          >
            <button
              type="button"
              onClick={() => setShowStats((prev) => !prev)}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.12)',
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              {showStats ? 'Hide Statistics' : 'Show Statistics'}
            </button>

            <button
              type="button"
              title="Container settings"
              onClick={() => router.push(`/app/containers/${containerId}/settings`)}
              style={{
                height: 36,
                width: 36,
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.12)',
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              ⚙️
            </button>
          </div>

          {showStats && (
          <section
            style={{
              marginTop: 18,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 10 }}>
              Container Statistics
            </h2>

            {statsLoading && (
              <div style={{ fontSize: 14, opacity: 0.75 }}>
                Loading statistics...
              </div>
            )}

            {statsError && (
              <div style={{ fontSize: 14, color: 'crimson' }}>
                {statsError}
              </div>
            )}

            {!statsLoading && !statsError && stats && (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                }}
              >
                {stats.entryCount === 0 && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      fontSize: 13,
                      opacity: 0.7,
                    }}
                  >
                    No entries yet. Add your first entry to see statistics.
                  </div>
                )}
                <div
                  style={{
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Total Entries</div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                    {formatStatsValue(stats.entryCount)}
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Fields With Statistics
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                    {formatStatsValue(Object.keys(stats.fields).length)}
                  </div>
                </div>
                <div
                  style={{
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Last Entry</div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                    {formatStatsDate(stats.lastEntryAt)}
                  </div>
                </div>
               <div
                 style={{
                   gridColumn: '1 / -1',
                   fontSize: 13,
                   fontWeight: 700,
                   opacity: 0.75,
                   marginTop: 4,
                 }}
               >
                 Field Statistics
               </div>
               {!hasFieldStats && (
                 <div
                   style={{
                     gridColumn: '1 / -1',
                     fontSize: 13,
                     opacity: 0.7,
                   }}
                 >
                   No field statistics available yet.
                 </div>
               )}
               {numericStatFields.length > 0 && (
                 <div
                   style={{
                     gridColumn: '1 / -1',
                     display: 'grid',
                     gap: 6,
                   }}
                 >
                   <label style={{ fontSize: 13, fontWeight: 600 }}>
                     Chart Field
                   </label>
                   <select
                     value={selectedChartFieldId}
                     onChange={(e) => setSelectedChartFieldId(e.target.value)}
                     style={{
                       height: 36,
                       padding: '0 10px',
                       borderRadius: 8,
                       border: '1px solid rgba(0,0,0,0.18)',
                       maxWidth: 280,
                       background: 'white',
                     }}
                   >
                     <option value="__all__">Show all</option>
                     {numericStatFields.map(([fieldId, field]) => (
                       <option key={fieldId} value={fieldId}>
                         {field.label}
                       </option>
                     ))}
                   </select>
                 </div>
               )}               
               {/* Numeric field statistics */}
                {Object.entries(stats.fields).map(([fieldId, field]) => {
                  if (field.type !== 'number') {
                    return null
                  }

                  if (
                    selectedChartFieldId &&
                    selectedChartFieldId !== '__all__' &&
                    fieldId !== selectedChartFieldId
                  ) {
                    return null
                  }

                  const dateCounts: Record<string, number> = {}

                  if (stats.timeSeries[fieldId]) {
                    stats.timeSeries[fieldId].forEach((p) => {
                      const key = new Date(p.date).toISOString().slice(0, 10)
                      dateCounts[key] = (dateCounts[key] || 0) + 1
                    })
                  }

                  return (
                   <div
                     key={fieldId}
                     style={{
                       border: '1px solid rgba(0,0,0,0.12)',
                       borderRadius: 10,
                       padding: 12,
                     }}
                   >
                     <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                       {field.label}
                     </div>

                     <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                       <div>Count: {formatStatsValue(field.count)}</div>
                       <div>Average: {formatStatsValue(field.avg)}</div>
                       <div>Min: {formatStatsValue(field.min)}</div>
                       <div>Max: {formatStatsValue(field.max)}</div>
                       <div>Latest: {formatStatsValue(field.latest)}</div>
                     </div>
                        {stats.timeSeries[fieldId] && stats.timeSeries[fieldId].length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                              Recorded Trend
                            </div>

                            <TrackerLineChart data={stats.timeSeries[fieldId]} />
                          </div>
                        )}
                   </div>
                 )
               })}
               {/* Dropdown field statistics */}
               {Object.entries(stats.fields).map(([fieldId, field]) => {
                 if (field.type !== 'dropdown') {
                   return null
                 }

                 return (
                   <div
                     key={fieldId}
                     style={{
                       border: '1px solid rgba(0,0,0,0.12)',
                       borderRadius: 10,
                       padding: 12,
                     }}
                   >
                     <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                       {field.label}
                     </div>

                     <div style={{ fontSize: 13, marginBottom: 8 }}>
                       Total Values: {formatStatsValue(field.count)}
                     </div>

                     {field.topValues.length === 0 ? (
                       <div style={{ fontSize: 13, opacity: 0.7 }}>No values yet.</div>
                     ) : (
                       <div style={{ display: 'grid', gap: 6 }}>
                         {field.topValues.map((item) => (
                           <div
                             key={item.value}
                             style={{
                               display: 'flex',
                               justifyContent: 'space-between',
                               gap: 12,
                               fontSize: 13,
                             }}
                           >
                             <span>{item.value}</span>
                             <span style={{ opacity: 0.7 }}>{item.count}</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 )
               })}
               {/* Boolean field statistics */}
               {Object.entries(stats.fields).map(([fieldId, field]) => {
                 if (field.type !== 'boolean') {
                   return null
                 }

                 return (
                   <div
                     key={fieldId}
                     style={{
                       border: '1px solid rgba(0,0,0,0.12)',
                       borderRadius: 10,
                       padding: 12,
                     }}
                   >
                     <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                       {field.label}
                     </div>

                     <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                       <div>Total Values: {formatStatsValue(field.count)}</div>
                       <div>True: {formatStatsValue(field.trueCount)}</div>
                       <div>False: {formatStatsValue(field.falseCount)}</div>
                     </div>
                   </div>
                 )
               })}
              </div>
            )}
          </section>
          )}

          {/* Entry Form */}
          <section
            style={{
              marginTop: 18,
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0 }}>
              {isEditing ? 'Edit entry' : 'New entry'}
            </h2>

            {!schema?.fields?.length ? (
              <div style={{ opacity: 0.75 }}>This container has no schema yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {schema.fields.map((field) => {
                  const value = formData[field.id]

                  return (
                    <div key={field.id} style={{ display: 'grid', gap: 6 }}>
                      <label style={{ fontWeight: 600, fontSize: 13 }}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </label>

                      {field.type === 'boolean' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => setFieldValue(field, e.target.checked)}
                          />
                          <span style={{ fontSize: 13 }}>Yes / No</span>
                        </label>
                      ) : field.type === 'dropdown' ? (
                        <>
                          <input
                            list={`datalist-${field.id}`}
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => setFieldValue(field, e.target.value)}
                            style={{
                              height: 36,
                              padding: '0 10px',
                              borderRadius: 8,
                              border: '1px solid rgba(0,0,0,0.18)',
                            }}
                          />
                          <datalist id={`datalist-${field.id}`}>
                            {getGeneratedDropdownOptions(field.id, entries).map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          ref={(el) => {
                            if (el) {
                              el.style.height = 'auto'
                              el.style.height = `${el.scrollHeight}px`
                            }
                          }}
                          value={typeof value === 'string' ? value : ''}
                          onChange={(e) => {
                            const el = e.target as HTMLTextAreaElement
                            setFieldValue(field, el.value)

                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }}
                          rows={1}
                          style={{
                            padding: '10px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.18)',
                            resize: 'none',
                            font: 'inherit',
                            overflow: 'hidden'
                          }}
                        />
                      ) : (
                        <input
                          type={
                            field.type === 'number'
                              ? 'number'
                              : field.type === 'date'
                              ? 'date'
                              : 'text'
                          }
                          value={
                            typeof value === 'string' || typeof value === 'number'
                              ? String(value)
                              : ''
                          }
                          onChange={(e) => setFieldValue(field, e.target.value)}
                          style={{
                            height: 36,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.18)',
                          }}
                        />
                      )}
                    </div>
                  )
                })}

                <div style={{ display: 'flex', gap: 10 }}>
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        disabled={!canSave}
                        style={{ height: 38, padding: '0 14px' }}
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{ height: 38, padding: '0 14px' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={addEntry}
                        disabled={!canSave}
                        style={{ height: 38, padding: '0 14px' }}
                      >
                        {saving ? 'Saving…' : 'Add entry'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(buildEmptyFormData(schema))}
                        style={{ height: 38, padding: '0 14px' }}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Existing Entries */}
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Entries</h2>

            {entries.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No entries yet.</div>
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
                        {formatEntrySummary(schema, entry, 'cards')}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          title="Edit entry"
                          onClick={() => startEdit(entry)}
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
                          title="Delete entry"
                          onClick={() => deleteEntry(entry.id)}
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

                    {item?.type === 'journal' &&
                    shouldRenderJournalBody(schema) &&
                    getJournalEntryText(entry) ? (
                      <div
                        style={{
                          marginTop: 8,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5
                        }}
                      >
                        {getJournalEntryText(entry)}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Created: {formatDate(entry.createdAt)}
                    </div>
                    {entry.updatedAt && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Updated: {formatDate(entry.updatedAt)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
