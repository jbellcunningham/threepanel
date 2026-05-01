/**
 * File structure:
 * 1) Imports
 * 2) Types
 * 3) Helpers
 * 4) Handlers (PATCH / DELETE)
 *
 * Purpose:
 * - PATCH: update a TrackerEntry's `data` (and optional legacy fields title/content)
 * - DELETE: remove a TrackerEntry (only if it belongs to current user)
 *
 * Notes:
 * - All responses are JSON: { ok: boolean, ... }
 * - Ownership is verified: user must own the parent TrackerItem.
 * - The tracker's schema is used to validate required fields (if present).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/* ============================
   2) Types
   ============================ */

type TrackerFieldType = 'text' | 'number' | 'boolean' | 'date' | 'dropdown'

type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
  options?: string[]
}

type TrackerSchema = {
  version?: number
  fields: TrackerField[]
}

type PatchEntryBody = {
  // data contains the schema-driven values (fieldId -> value)
  data?: Record<string, unknown>
  // legacy optional fields (kept for compatibility)
  title?: string | null
  content?: string | null
}

/* ============================
   3) Helpers
   ============================ */

/**
 * Very small set of validators used for required-field validation.
 * Keep these tiny and deterministic.
 */
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

/**
 * Validate `data` object against the tracker's schema.
 * Returns `null` when valid, otherwise an error string.
 */
function validateAgainstSchema(schema: TrackerSchema | null, data: Record<string, unknown>) {
  if (!schema || !Array.isArray(schema.fields)) return null

  for (const field of schema.fields) {
    if (!field.required) continue

    const value = data[field.id]

    if (field.type === 'text' || field.type === 'dropdown' || field.type === 'date') {
      if (!isNonEmptyString(value)) return `Field "${field.label}" is required.`
    } else if (field.type === 'number') {
      if (!isFiniteNumber(value)) return `Field "${field.label}" must be a number.`
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') return `Field "${field.label}" must be true/false.`
    }
  }

  return null
}

/**
 * Helper to parse JSON body safely.
 */
async function parseJson<T = any>(req: Request): Promise<T | { error: string }> {
  try {
    const json = await req.json()
    return json as T
  } catch (err) {
    return { error: 'Invalid JSON body' }
  }
}

/* ============================
   4) Handlers
   ============================ */

/**
 * PATCH /api/tracker/:id/entries/:entryId
 *
 * Body:
 * {
 *   data?: { <fieldId>: value, ... },
 *   title?: string | null,
 *   content?: string | null
 * }
 *
 * - Validates auth and ownership.
 * - Validates required schema fields (if schema exists).
 * - Updates the TrackerEntry.data, and optionally title/content.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; entryId: string }> | { id: string; entryId: string } }
) {
  // auth
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // params
  const { id, entryId } = await Promise.resolve(ctx.params)

  // load entry + parent tracker (to verify ownership and to read schema)
  const existing = await prisma.trackerEntry.findUnique({
    where: { id: entryId },
    include: { tracker: { select: { id: true, userId: true, schema: true } } },
  })

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 })
  }

  if (existing.tracker.id !== id) {
    return NextResponse.json({ ok: false, error: 'Entry does not belong to tracker' }, { status: 400 })
  }

  if (existing.tracker.userId !== user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 })
  }

  // parse body
  const bodyOrErr = await parseJson<PatchEntryBody>(req)
  if ('error' in (bodyOrErr as any)) {
    return NextResponse.json({ ok: false, error: (bodyOrErr as any).error }, { status: 400 })
  }
  const body = (bodyOrErr as PatchEntryBody) ?? {}

  const data = (body.data ?? existing.data ?? {}) as Record<string, unknown>

  // validate against schema if present
  const schema = (existing.tracker.schema ?? null) as TrackerSchema | null
  const validationError = validateAgainstSchema(schema, data)
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 })
  }

  // prepare update payload
  const updatePayload: any = {
    data,
    dueAt: parseEntryDueAt(data.due_at ?? data.dueAt),
  }

  // allow updating legacy title/content if provided (optional)
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    updatePayload.title = body.title ?? null
  }
  if (Object.prototype.hasOwnProperty.call(body, 'content')) {
    updatePayload.content = body.content ?? null
  }

  // perform update
  const updated = await prisma.trackerEntry.update({
    where: { id: entryId },
    data: updatePayload,
    select: { id: true, createdAt: true, updatedAt: true, data: true, dueAt: true },
  })

  return NextResponse.json({ ok: true, entry: updated })
}

/**
 * DELETE /api/tracker/:id/entries/:entryId
 *
 * - Validates auth and ownership.
 * - Deletes the entry.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; entryId: string }> | { id: string; entryId: string } }
) {
  // auth
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // params
  const { id, entryId } = await Promise.resolve(ctx.params)

  // load entry + parent tracker for ownership
  const existing = await prisma.trackerEntry.findUnique({
    where: { id: entryId },
    include: { tracker: { select: { id: true, userId: true } } },
  })

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 })
  }

  if (existing.tracker.id !== id) {
    return NextResponse.json({ ok: false, error: 'Entry does not belong to tracker' }, { status: 400 })
  }

  if (existing.tracker.userId !== user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 })
  }

  await prisma.trackerEntry.delete({ where: { id: entryId } })

  return NextResponse.json({ ok: true })
}
