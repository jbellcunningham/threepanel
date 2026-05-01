/**
 * File structure:
 * 1) Imports
 * 2) Types
 * 3) Helpers
 * 4) Handlers (POST)
 */

/* 1) Imports: framework + app services */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/* 2) Types: schema + request shapes used in this route */
type TrackerFieldType = 'text' | 'number' | 'boolean'

type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
}

type TrackerSchema = {
  version?: number
  fields: TrackerField[]
  // optional future knobs:
  // primaryLabelFieldId?: string
}

type CreateEntryBody = {
  data?: Record<string, unknown>
}

/* 3) Helpers: small pure functions for validation/coercion */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function parseEntryDueAt(value: unknown): Date | null {
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

function validateAgainstSchema(schema: TrackerSchema | null, data: Record<string, unknown>) {
  if (!schema || !Array.isArray(schema.fields)) return null // no validation errors

  for (const field of schema.fields) {
    if (!field.required) continue

    const value = data[field.id]

    if (field.type === 'text') {
      if (!isNonEmptyString(value)) return `Field "${field.label}" is required.`
    }

    if (field.type === 'number') {
      if (!isFiniteNumber(value)) return `Field "${field.label}" must be a number.`
    }

    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') return `Field "${field.label}" must be true/false.`
    }
  }

  return null
}

/* 4) Handlers: the actual API logic */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  // (a) Auth
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // (b) Params
  const { id } = await Promise.resolve(ctx.params)

  // (c) Load tracker and its schema (schema drives validation)
  const tracker = await prisma.trackerItem.findFirst({
    where: { id, userId: user.id },
    select: { id: true, schema: true },
  })

  if (!tracker) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  // (d) Parse request body
  let body: CreateEntryBody
  try {
    body = (await req.json()) as CreateEntryBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const data = (body.data ?? {}) as Record<string, unknown>

  // (e) Validate required fields according to schema
  const schema = (tracker.schema ?? null) as TrackerSchema | null
  const validationError = validateAgainstSchema(schema, data)
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 })
  }

  // (f) Create entry (store only JSON data)
  const dueAt = parseEntryDueAt(data.due_at ?? data.dueAt)
  const entry = await prisma.trackerEntry.create({
    data: {
      trackerId: tracker.id,
      data,
      dueAt,
    },
    select: { id: true, createdAt: true, updatedAt: true, data: true, dueAt: true },
  })

  return NextResponse.json({ ok: true, entry })
}
