/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/tracker/route.ts
 *
 * PURPOSE:
 * - Lists all tracker-style containers for the logged-in user
 * - Creates new containers from built-in templates or custom types
 *
 * ARCHITECTURE ROLE:
 * - Unified container creation entry point
 * - Seeds default schema for built-in template types
 * - Supports future custom schema workflows
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { defaultTrackerSchema } from '@/lib/trackerSchema'
import { calculateTrackerStatistics } from '@/lib/trackerStatsCalculator'
import type { TrackerStatistics } from '@/lib/trackerStats'

/* =========================================================
   2) Types
   ========================================================= */

type BuiltInType = 'tracker' | 'todo' | 'journal'

type CreateTrackerBody = {
  title?: string
  type?: string
  templateType?: BuiltInType
  customType?: string
}

type TrackerListItem = {
  id: string
  title: string
  type: string
  done: boolean
  createdAt: string
  schema: TrackerSchema | null
  latestEntry: {
    id: string
    createdAt: string
    data: EntryDataRecord
  } | null
  listPreview: Array<{
    fieldId: string
    label: string
    mode: 'summary' | 'average'
    value: string | number
  }>
  summary: Record<string, unknown>
}

type EntryDataRecord = Record<string, unknown>

type ListEntry = {
  id: string
  createdAt: Date
  data: unknown
}

type TrackerFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'dropdown'

type ListDisplayMode = 'none' | 'summary' | 'average'

type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
  options?: string[]
  showInCards?: boolean
  showInList?: boolean
  listDisplay?: 'none' | 'latest' | 'summary' | 'average'
}

type TrackerSchema = {
  version?: number
  fields: TrackerField[]
}

/* =========================================================
   3) Helpers
   ========================================================= */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

async function safeReadJson<T>(req: Request): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = (await req.json()) as T
    return { ok: true, data }
  } catch {
    return { ok: false }
  }
}

function getDefaultSchema(type: BuiltInType): unknown {
  if (type === 'todo') {
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

  if (type === 'journal') {
    return {
      version: 1,
      fields: [
        { id: 'recordedDate', label: 'Recorded Date', type: 'date', required: true },
        { id: 'location', label: 'Location', type: 'dropdown' },
        { id: 'textEntry', label: 'Text Entry', type: 'text', required: true }
      ]
    }
  }

  return typeof defaultTrackerSchema === 'function'
    ? defaultTrackerSchema()
    : defaultTrackerSchema
}

function normalizeType(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function resolveContainerType(body: CreateTrackerBody): string | null {
  if (
    body.templateType === 'tracker' ||
    body.templateType === 'todo' ||
    body.templateType === 'journal'
  ) {
    return body.templateType
  }

  if (isNonEmptyString(body.customType)) {
    return normalizeType(body.customType)
  }

  if (body.type === 'tracker' || body.type === 'todo' || body.type === 'journal') {
    return body.type
  }

  return 'tracker'
}

function resolveSchema(body: CreateTrackerBody, resolvedType: string): unknown {
  if (
    body.templateType === 'tracker' ||
    body.templateType === 'todo' ||
    body.templateType === 'journal'
  ) {
    return getDefaultSchema(body.templateType)
  }

  if (resolvedType === 'tracker' || resolvedType === 'todo' || resolvedType === 'journal') {
    return getDefaultSchema(resolvedType)
  }

  return {
    version: 1,
    fields: []
  }
}

function getEntryDataRecord(value: unknown): EntryDataRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as EntryDataRecord
}

function getListDisplayMode(field: TrackerField): 'none' | 'latest' | 'summary' | 'average' {
  if (field.listDisplay) {
    return field.listDisplay
  }

  if (field.showInList) {
    return 'latest'
  }

  return 'none'
}

function getEffectiveSchema(type: string, schema: TrackerSchema | null | undefined): TrackerSchema | null {
  if (schema?.fields?.length) {
    return schema
  }

  if (type === 'todo') {
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

  if (type === 'journal') {
    return {
      version: 1,
      fields: [
        { id: 'recordedDate', label: 'Recorded Date', type: 'date', required: true },
        { id: 'location', label: 'Location', type: 'dropdown' },
        { id: 'textEntry', label: 'Text Entry', type: 'textarea', required: true }
      ]
    }
  }

  return schema ?? null
}

function hasExplicitListDisplayConfiguration(schema: TrackerSchema | null | undefined) {
  if (!schema?.fields?.length) {
    return false
  }

  return schema.fields.some(
    (field) => field.listDisplay !== undefined || field.showInList !== undefined
  )
}

function getListDisplayFields(schema: TrackerSchema | null | undefined) {
  if (!schema?.fields?.length) {
    return []
  }

  const explicitlySelected = schema.fields.filter((field) => getListDisplayMode(field) !== 'none')

  if (explicitlySelected.length > 0) {
    return explicitlySelected
  }

  if (hasExplicitListDisplayConfiguration(schema)) {
    return []
  }

  const firstRequiredField = schema.fields.find((field) => field.required)
  if (firstRequiredField) {
    return [firstRequiredField]
  }

  return [schema.fields[0]]
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }

  return null
}

function formatLatestValue(field: TrackerField, entries: ListEntry[]): string | number | null {
  if (entries.length === 0) {
    return null
  }

  for (const entry of entries) {
    const value = getEntryDataRecord(entry.data)[field.id]

    if (value === undefined || value === null || value === '') {
      continue
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    return String(value)
  }

  return null
}

function buildListPreview(
  type: string,
  schema: TrackerSchema | null | undefined,
  entries: ListEntry[]
): TrackerListItem['listPreview'] {
  const effectiveSchema = getEffectiveSchema(type, schema)
  const fieldsToUse = getListDisplayFields(effectiveSchema)

  const calculated: TrackerStatistics = calculateTrackerStatistics(
    effectiveSchema,
    entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      data: getEntryDataRecord(entry.data),
    }))
  )

  return fieldsToUse
    .map((field) => {
      const mode = getListDisplayMode(field)
      const fieldStats = calculated.fields[field.id]

      if (mode === 'none') {
        return null
      }

      if (mode === 'latest') {
        const value = formatLatestValue(field, entries)
        if (value === null) {
          return null
        }

        return {
          fieldId: field.id,
          label: field.label,
          mode: 'summary' as const,
          value,
        }
      }

      if (field.type !== 'number' || !fieldStats) {
        return null
      }

      if (mode === 'summary') {
        if (fieldStats.sum === null || fieldStats.sum === undefined) {
          return null
        }

        return {
          fieldId: field.id,
          label: field.label,
          mode: 'summary' as const,
          value: fieldStats.sum,
        }
      }

      if (mode === 'average') {
        if (fieldStats.avg === null || fieldStats.avg === undefined) {
          return null
        }

        return {
          fieldId: field.id,
          label: field.label,
          mode: 'average' as const,
          value: fieldStats.avg,
        }
      }

      return null
    })
    .filter((item): item is TrackerListItem['listPreview'][number] => item !== null)
}


function countOpenTodoEntries(entries: ListEntry[]) {
  let openCount = 0

  entries.forEach((entry) => {
    const data = getEntryDataRecord(entry.data)
    if (data.done !== true) {
      openCount += 1
    }
  })

  return openCount
}

function getLastEntryAt(entries: ListEntry[]) {
  if (entries.length === 0) {
    return null
  }

  return entries[0].createdAt.toISOString()
}

function buildSummary(type: string, entries: ListEntry[]) {
  const lastEntryAt = getLastEntryAt(entries)

  if (type === 'todo') {
    return {
      entryCount: entries.length,
      openSubtaskCount: countOpenTodoEntries(entries),
      lastEntryAt
    }
  }

  if (type === 'journal') {
    return {
      entryCount: entries.length,
      lastEntryAt
    }
  }

  if (type === 'tracker') {
    return {
      entryCount: entries.length,
      lastEntryAt
    }
  }

  return {
    entryCount: entries.length,
    lastEntryAt
  }
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function GET() {
  // (a) Auth
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // (b) Fetch list
  const items = await prisma.trackerItem.findMany({
    where: {
      userId: user.id
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      title: true,
      type: true,
      done: true,
      createdAt: true,
      schema: true,
      entries: {
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          createdAt: true,
          data: true
        }
      }
    }
  })

  // (c) Shape response
  const itemsWithSummary: TrackerListItem[] = items.map((it) => {
    const normalizedSchema = (it.schema ?? null) as TrackerSchema | null

    return {
      id: it.id,
      title: it.title,
      type: it.type,
      done: it.done,
      createdAt: it.createdAt.toISOString(),
      schema: normalizedSchema,
      latestEntry:
        it.entries.length > 0
          ? {
              id: it.entries[0].id,
              createdAt: it.entries[0].createdAt.toISOString(),
              data: getEntryDataRecord(it.entries[0].data)
            }
          : null,
      listPreview: buildListPreview(it.type, normalizedSchema, it.entries),
      summary: buildSummary(it.type, it.entries)
    }
  })

  return NextResponse.json({ ok: true, items: itemsWithSummary })
}

export async function POST(req: Request) {
  // (a) Auth
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // (b) Parse body
  const parsed = await safeReadJson<CreateTrackerBody>(req)

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title } = parsed.data
  const resolvedType = resolveContainerType(parsed.data)

  // (c) Validate inputs
  if (!isNonEmptyString(title)) {
    return NextResponse.json({ ok: false, error: 'Title is required' }, { status: 400 })
  }

  if (!resolvedType) {
    return NextResponse.json({ ok: false, error: 'Type is required' }, { status: 400 })
  }

  // (d) Create container
  const schema = resolveSchema(parsed.data, resolvedType)

  const item = await prisma.trackerItem.create({
    data: {
      userId: user.id,
      title: title.trim(),
      type: resolvedType,
      schema
    },
    select: {
      id: true,
      title: true,
      type: true,
      createdAt: true,
      schema: true
    }
  })

  return NextResponse.json(
    {
      ok: true,
      item: {
        ...item,
        createdAt: item.createdAt.toISOString()
      }
    },
    { status: 201 }
  )
}
