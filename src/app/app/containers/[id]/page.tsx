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
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  done?: boolean
  doneAt?: string | null
  statusUpdatedAt?: string | null
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
type TodoQuickFilter = 'all' | 'overdue' | 'due_today' | 'open' | 'done'
type TodoSortMode = 'priority' | 'due_soonest' | 'newest' | 'oldest'

type ContainerTypesResponse = {
  ok: true
  types: string[]
}

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

function parseTodoDueDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T23:59:59.999Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function formatOverdueAge(from: Date, to = new Date()) {
  const diffMs = Math.max(0, to.getTime() - from.getTime())
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.floor(diffMs / dayMs)

  if (days <= 0) {
    return 'Overdue today'
  }

  if (days === 1) {
    return '1 day overdue'
  }

  return `${days} days overdue`
}

function getTodoDueMeta(entry: TrackerEntry, now = new Date()) {
  const dueDate = parseTodoDueDate(entry.data?.due_at ?? entry.data?.dueAt)
  const done = Boolean(entry.data?.done)

  if (!dueDate) {
    return {
      hasDueDate: false,
      done,
      overdue: false,
      dueDate: null as Date | null,
      statusLabel: done ? 'Done' : 'Open',
      detail: done ? 'Completed (no due date)' : 'No due date',
      sortRank: done ? 4 : 3,
    }
  }

  if (done) {
    return {
      hasDueDate: true,
      done: true,
      overdue: false,
      dueDate,
      statusLabel: 'Done',
      detail: `Due ${formatDate(dueDate.toISOString())}`,
      sortRank: 4,
    }
  }

  if (dueDate.getTime() < now.getTime()) {
    return {
      hasDueDate: true,
      done: false,
      overdue: true,
      dueDate,
      statusLabel: 'Overdue',
      detail: formatOverdueAge(dueDate, now),
      sortRank: 1,
    }
  }

  const isToday = dueDate.toDateString() === now.toDateString()

  return {
    hasDueDate: true,
    done: false,
    overdue: false,
    dueDate,
    statusLabel: isToday ? 'Due today' : 'Open',
    detail: `Due ${formatDate(dueDate.toISOString())}`,
    sortRank: isToday ? 2 : 3,
  }
}

/* =========================================================
   4) Component
   ========================================================= */

export default function ContainerDetailPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  const [showEntries, setShowEntries] = useState(false)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedChartFieldId, setSelectedChartFieldId] = useState<string>('')
  const [showMenu, setShowMenu] = useState(false)
  const [availableContainerTypes, setAvailableContainerTypes] = useState<string[]>([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [todoQuickFilter, setTodoQuickFilter] = useState<TodoQuickFilter>('all')
  const [todoSortMode, setTodoSortMode] = useState<TodoSortMode>('priority')
  const [expandedMetaEntryIds, setExpandedMetaEntryIds] = useState<Record<string, boolean>>({})
  const hasFieldStats = stats ? Object.keys(stats.fields).length > 0 : false

  // Edit mode state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const entryFormRef = useRef<HTMLElement | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  /* -----------------------------
     Derived values
     ----------------------------- */

  const schema = getEffectiveSchema(item)
  const isEditing = editingEntryId !== null
  const isTodoLikeContainer =
    item?.type?.toLowerCase?.() === 'todo' ||
    Boolean(schema?.fields?.some((field) => field.id === 'done'))

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

  const sortedEntries = useMemo(() => {
    if (!isTodoLikeContainer) {
      return entries
    }

    return [...entries].sort((a, b) => {
      const now = new Date()
      const metaA = getTodoDueMeta(a, now)
      const metaB = getTodoDueMeta(b, now)

      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()

      if (todoSortMode === 'newest') {
        return bTime - aTime
      }

      if (todoSortMode === 'oldest') {
        return aTime - bTime
      }

      if (todoSortMode === 'due_soonest') {
        const aDue = metaA.dueDate?.getTime() ?? Number.POSITIVE_INFINITY
        const bDue = metaB.dueDate?.getTime() ?? Number.POSITIVE_INFINITY

        if (aDue !== bDue) {
          return aDue - bDue
        }

        if (metaA.done !== metaB.done) {
          return metaA.done ? 1 : -1
        }

        return bTime - aTime
      }

      if (metaA.sortRank !== metaB.sortRank) {
        return metaA.sortRank - metaB.sortRank
      }

      return bTime - aTime
    })
  }, [entries, isTodoLikeContainer, todoSortMode])

  const filteredEntries = useMemo(() => {
    if (!isTodoLikeContainer || todoQuickFilter === 'all') {
      return sortedEntries
    }

    return sortedEntries.filter((entry) => {
      const meta = getTodoDueMeta(entry)

      if (todoQuickFilter === 'overdue') {
        return meta.overdue
      }

      if (todoQuickFilter === 'due_today') {
        return meta.statusLabel === 'Due today'
      }

      if (todoQuickFilter === 'open') {
        return !meta.done
      }

      if (todoQuickFilter === 'done') {
        return meta.done
      }

      return true
    })
  }, [sortedEntries, isTodoLikeContainer, todoQuickFilter])

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

    if (data.item?.type?.toLowerCase?.() === 'todo') {
      setShowEntries(true)
      setShowEntryForm(false)
    } else {
      setShowEntryForm(true)
    }

    setLoading(false)
  }

  async function loadContainerTypes() {
    try {
      const res = await fetch('/api/container-types', {
        credentials: 'include',
        cache: 'no-store',
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

    if (item?.type?.toLowerCase?.() === 'todo') {
      setShowEntryForm(false)
      setShowEntries(true)
    }

    setSaving(false)
  }

  /**
   * Starts editing an existing entry by loading its data into the form.
   */

  function startEdit(entry: TrackerEntry) {
    setError(null)
    setEditingEntryId(entry.id)
    setFormData(buildFormDataFromEntry(schema, entry))
    setShowEntryForm(true)
  }

  /**
   * Cancels edit mode and resets form to a fresh entry state.
   */

  function cancelEdit() {
    setEditingEntryId(null)
    setFormData(buildEmptyFormData(schema))
    setError(null)

    if (item?.type?.toLowerCase?.() === 'todo') {
      setShowEntryForm(false)
    }
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

  async function toggleContainerDone() {
    if (!containerId || item?.type?.toLowerCase?.() !== 'todo') return

    const nextDone = !Boolean(item?.done)
    const now = new Date().toISOString()

    const res = await fetch(`/api/tracker/${containerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to update container')
      return
    }

    await load()
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })

    router.push('/login')
  }

  function applyTypeFilter(nextType: string) {
    setShowMenu(false)

    if (!nextType) {
      router.push('/app/containers')
      return
    }

    router.push(`/app/containers?type=${encodeURIComponent(nextType)}`)
  }

  async function toggleTodoEntryDone(entry: TrackerEntry, nextDone: boolean) {
    if (!containerId || !isTodoLikeContainer) return

    setError(null)

    const now = new Date().toISOString()

    const res = await fetch(`/api/tracker/${containerId}/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        data: {
          ...(entry.data ?? {}),
          done: nextDone,
          doneAt: nextDone ? now : null,
          statusUpdatedAt: now,
        },
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
      setError(data?.error || raw || 'Failed to update subtask')
      return
    }

    await load()
    await loadStats()
  }

  async function pushTodoEntryDueDate(entry: TrackerEntry, mode: '1_day' | '1_week' | '1_month' | 'custom') {
    if (!containerId || !isTodoLikeContainer) return

    setError(null)

    const base = new Date()
    let nextDue = new Date(base)

    if (mode === '1_week') {
      nextDue.setDate(base.getDate() + 7)
    } else if (mode === '1_month') {
      nextDue.setMonth(base.getMonth() + 1)
    } else if (mode === 'custom') {
      const suggested = toIsoDate(nextDue)
      const value = window.prompt('Set due date (YYYY-MM-DD)', suggested)
      if (value === null) return
      const parsed = parseTodoDueDate(value)
      if (!parsed) {
        setError('Invalid custom due date. Use YYYY-MM-DD.')
        return
      }
      nextDue = parsed
    } else {
      nextDue.setDate(base.getDate() + 1)
    }

    const res = await fetch(`/api/tracker/${containerId}/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        data: {
          ...(entry.data ?? {}),
          due_at: toIsoDate(nextDue),
        },
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
      setError(data?.error || raw || 'Failed to push due date')
      return
    }

    await load()
    await loadStats()
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

  function toggleEntryMeta(entryId: string) {
    setExpandedMetaEntryIds((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }))
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    if (!containerId) return

    load()
    loadStats()
    loadContainerTypes()
    loadOverdueCount()
  }, [containerId])

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

  useEffect(() => {
    if (!isEditing || !showEntryForm) {
      return
    }

    entryFormRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    const focusTimer = window.setTimeout(() => {
      firstFieldRef.current?.focus()
    }, 220)

    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [isEditing, showEntryForm])

  useEffect(() => {
    const filterFromUrl = (searchParams.get('subtaskFilter') || '').trim().toLowerCase()
    if (
      filterFromUrl === 'all' ||
      filterFromUrl === 'overdue' ||
      filterFromUrl === 'due_today' ||
      filterFromUrl === 'open' ||
      filterFromUrl === 'done'
    ) {
      setTodoQuickFilter(filterFromUrl)
    }
  }, [searchParams])

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Link href="/app/containers" style={{ textDecoration: 'none' }}>
            ← Back to Containers
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ marginTop: 8, marginBottom: 6 }}>
              {item ? item.title : 'Container'}
            </h1>

            {item?.type?.toLowerCase?.() === 'todo' && (
              <button
                type="button"
                title={item.done ? 'Mark container open' : 'Mark container done'}
                onClick={toggleContainerDone}
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                {item.done ? '↩️' : '✔️'}
              </button>
            )}
          </div>

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

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexShrink: 0,
            position: 'relative',
            alignItems: 'center',
            marginLeft: 'auto',            
          }}
        >

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
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                All
              </button>

              {availableContainerTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => applyTypeFilter(type)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: item?.type === type ? 'rgba(0,0,0,0.08)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {getContainerTypeDisplay(type).label}
                </button>
              ))}

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
                  router.push(`/app/reporting/${containerId}`)
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
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowEntryForm((prev) => !prev)
                if (item?.type?.toLowerCase?.() === 'todo') {
                  setEditingEntryId(null)
                  setFormData(buildEmptyFormData(schema))
                }
              }}
              title={showEntryForm ? 'Hide new entry form' : 'Show new entry form'}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                background: showEntryForm ? 'rgba(0,0,0,0.06)' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showEntryForm ? '− Add' : '+ Add'}
            </button>

            <button
              type="button"
              onClick={() => setShowEntries((prev) => !prev)}
              title={showEntries ? 'Hide previous entries' : 'Show previous entries'}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                background: showEntries ? 'rgba(0,0,0,0.06)' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showEntries ? '▾ Entries' : '▸ Entries'}
            </button>

            <button
              type="button"
              onClick={() => setShowStats((prev) => !prev)}
              title={showStats ? 'Hide statistics' : 'Show statistics'}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                background: showStats ? 'rgba(0,0,0,0.06)' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showStats ? '▾ Stats' : '▸ Stats'}
            </button>

            <button
              type="button"
              title="Container settings"
              onClick={() => router.push(`/app/containers/${containerId}/settings`)}
              style={{
                height: 32,
                width: 32,
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ⚙️
            </button>
          </div>

          {/* Entry Form */}
          {showEntryForm && (
            <section
              ref={entryFormRef}
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
                {schema.fields.map((field, index) => {
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
                            ref={index === 0 ? firstFieldRef : null}
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => setFieldValue(field, e.target.checked)}
                          />
                          <span style={{ fontSize: 13 }}>Yes / No</span>
                        </label>
                      ) : field.type === 'dropdown' ? (
                        <>
                          <input
                            ref={index === 0 ? firstFieldRef : null}
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
                            if (index === 0) {
                              firstFieldRef.current = el
                            }
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
                          ref={index === 0 ? firstFieldRef : null}
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
          )}

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


          {/* Existing Entries */}
          <section style={{ marginTop: 18 }}>
            {showEntries ? (
              <>
                <h2 style={{ fontSize: 16, marginBottom: 8 }}>Previous Entries</h2>

                {isTodoLikeContainer && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                    }}
                  >
                    {([
                      ['all', 'All'],
                      ['overdue', 'Overdue'],
                      ['due_today', 'Due Today'],
                      ['open', 'Open'],
                      ['done', 'Done'],
                    ] as Array<[TodoQuickFilter, string]>).map(([value, label]) => {
                      const active = todoQuickFilter === value

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTodoQuickFilter(value)}
                          style={{
                            height: 30,
                            padding: '0 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(0,0,0,0.12)',
                            background: active ? 'rgba(0,0,0,0.08)' : 'transparent',
                            fontWeight: active ? 700 : 500,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <select
                      value={todoSortMode}
                      onChange={(e) => setTodoSortMode(e.target.value as TodoSortMode)}
                      style={{
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 999,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: 'transparent',
                        fontSize: 12,
                      }}
                    >
                      <option value="priority">Sort: Priority</option>
                      <option value="due_soonest">Sort: Due Date (soonest)</option>
                      <option value="newest">Sort: Newest</option>
                      <option value="oldest">Sort: Oldest</option>
                    </select>
                  </div>
                )}
                {filteredEntries.length === 0 ? (
                  <div style={{ opacity: 0.75 }}>No entries yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                {filteredEntries.map((entry) => {
                  const entryDone = Boolean(entry.data?.done)
                  const dueMeta = getTodoDueMeta(entry)
                  const isMetaExpanded = Boolean(expandedMetaEntryIds[entry.id])

                  return (
                    <div
                      key={entry.id}
                      style={{
                        border: '1px solid rgba(0,0,0,0.12)',
                        borderRadius: 12,
                        padding: 12,
                        opacity: isTodoLikeContainer && entryDone ? 0.72 : 1,
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
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <button
                            type="button"
                            title="Edit entry"
                            onClick={() => startEdit(entry)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontWeight: 700,
                              textDecoration:
                                isTodoLikeContainer && entryDone ? 'line-through' : 'none',
                              opacity:
                                isTodoLikeContainer && entryDone ? 0.75 : 1,
                              minWidth: 0,
                            }}
                          >
                            {formatEntrySummary(schema, entry, 'cards')}
                          </button>
                          {isTodoLikeContainer && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  height: 20,
                                  padding: '0 8px',
                                  borderRadius: 999,
                                  border: '1px solid rgba(0,0,0,0.12)',
                                  background: dueMeta.overdue
                                    ? 'rgba(220,38,38,0.12)'
                                    : dueMeta.statusLabel === 'Due today'
                                    ? 'rgba(245,158,11,0.15)'
                                    : 'rgba(0,0,0,0.04)',
                                  color: dueMeta.overdue ? '#b91c1c' : 'inherit',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  width: 'fit-content',
                                }}
                              >
                                {dueMeta.statusLabel.toUpperCase()}
                              </span>
                              {!entryDone && (
                                <details style={{ position: 'relative' }}>
                                  <summary
                                    style={{
                                      listStyle: 'none',
                                      height: 24,
                                      padding: '0 8px',
                                      borderRadius: 999,
                                      border: '1px solid rgba(0,0,0,0.12)',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    Push <span aria-hidden>▾</span>
                                  </summary>
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 28,
                                      left: 0,
                                      zIndex: 5,
                                      width: 140,
                                      borderRadius: 10,
                                      border: '1px solid rgba(0,0,0,0.12)',
                                      background: 'white',
                                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                      padding: 6,
                                      display: 'grid',
                                      gap: 4,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => pushTodoEntryDueDate(entry, '1_day')}
                                      style={{
                                        textAlign: 'left',
                                        borderRadius: 8,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      1 day (default)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => pushTodoEntryDueDate(entry, '1_week')}
                                      style={{
                                        textAlign: 'left',
                                        borderRadius: 8,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        fontSize: 12,
                                      }}
                                    >
                                      1 week
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => pushTodoEntryDueDate(entry, '1_month')}
                                      style={{
                                        textAlign: 'left',
                                        borderRadius: 8,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        fontSize: 12,
                                      }}
                                    >
                                      1 month
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => pushTodoEntryDueDate(entry, 'custom')}
                                      style={{
                                        textAlign: 'left',
                                        borderRadius: 8,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: '8px 10px',
                                        fontSize: 12,
                                      }}
                                    >
                                      custom
                                    </button>
                                  </div>
                                </details>
                              )}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexShrink: 0,
                            alignItems: 'flex-start',
                          }}
                        >
                          {isTodoLikeContainer && (
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                alignItems: 'center',
                              }}
                            >
                              <button
                                type="button"
                                title={entryDone ? 'Undo' : 'Mark as done'}
                                onClick={() => toggleTodoEntryDone(entry, !entryDone)}
                                style={{
                                  height: 32,
                                  width: 32,
                                  borderRadius: 8,
                                  border: '1px solid rgba(0,0,0,0.12)',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 16,
                                  lineHeight: '16px',
                                }}
                              >
                                {entryDone ? '↩️' : '✔️'}
                              </button>
                            </div>
                          )}

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

                      {isTodoLikeContainer && dueMeta.hasDueDate && dueMeta.dueDate && (
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.78,
                            color: dueMeta.overdue ? '#b91c1c' : 'inherit',
                            marginTop: 6,
                          }}
                        >
                          Due: {formatDate(dueMeta.dueDate.toISOString())}
                          {dueMeta.overdue ? ` (${dueMeta.detail.toLowerCase()})` : ''}
                        </div>
                      )}
                      <button
                        type="button"
                        title={isMetaExpanded ? 'Hide details' : 'Show details'}
                        onClick={() => toggleEntryMeta(entry.id)}
                        style={{
                          marginTop: 4,
                          height: 22,
                          width: 22,
                          borderRadius: 999,
                          border: '1px solid rgba(0,0,0,0.12)',
                          background: 'transparent',
                          fontSize: 12,
                          lineHeight: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isMetaExpanded ? '▾' : '▸'}
                      </button>
                      {isMetaExpanded && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Created: {formatDate(entry.createdAt)}
                          </div>
                          {entry.updatedAt && (
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Updated: {formatDate(entry.updatedAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
              </>
            ) : (
              <div style={{ opacity: 0.75, fontSize: 13 }}>Entries hidden.</div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
