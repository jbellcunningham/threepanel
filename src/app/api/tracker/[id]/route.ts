/**
 * File structure:
 * 1) Imports
 * 2) Types
 * 3) Helpers
 * 4) Handlers (GET, PATCH, DELETE)
 */

/* =========================================================
   1) Imports: framework + app services
   ========================================================= */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/* =========================================================
   2) Types: response/request shapes used by this route
   ========================================================= */

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
  listDisplay?: ListDisplayMode
}

type TrackerSchema = {
  version?: number
  fields: TrackerField[]
}

type RouteCtx = {
  params: Promise<{ id: string }> | { id: string }
}

type UpdateTrackerBody = {
  title?: string
  schema?: TrackerSchema
  dueAt?: string | null
  done?: boolean
  doneAt?: string | null
  statusUpdatedAt?: string | null
}

/* =========================================================
   3) Helpers: small pure functions
   ========================================================= */

async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  return { user, response: undefined }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidFieldType(v: unknown): v is TrackerFieldType {
  return (
    v === 'text' ||
    v === 'textarea' ||
    v === 'number' ||
    v === 'boolean' ||
    v === 'date' ||
    v === 'dropdown'
  )
}

function isValidListDisplayMode(v: unknown): v is ListDisplayMode {
  return v === 'none' || v === 'summary' || v === 'average'
}

function validateSchema(schema: unknown): schema is TrackerSchema {
  if (!schema || typeof schema !== 'object') return false

  const s = schema as TrackerSchema

  if (!Array.isArray(s.fields)) return false

  for (const field of s.fields) {
    if (!field || typeof field !== 'object') return false
    if (!isNonEmptyString(field.id)) return false
    if (!isNonEmptyString(field.label)) return false
    if (!isValidFieldType(field.type)) return false

    if (
      field.required !== undefined &&
      typeof field.required !== 'boolean'
    ) {
      return false
    }

    if (
      field.showInCards !== undefined &&
      typeof field.showInCards !== 'boolean'
    ) {
      return false
    }

    if (
      field.showInList !== undefined &&
      typeof field.showInList !== 'boolean'
    ) {
      return false
    }

    if (
      field.listDisplay !== undefined &&
      !isValidListDisplayMode(field.listDisplay)
    ) {
      return false
    }

    if (field.type === 'dropdown') {
      if (field.options !== undefined && !Array.isArray(field.options)) {
        return false
      }

      if (field.options !== undefined) {
        for (const option of field.options) {
          if (!isNonEmptyString(option)) return false
        }
      }
    }
  }

  return true
}

function normalizeSchema(schema: TrackerSchema): TrackerSchema {
  return {
    version: schema.version ?? 1,
    fields: schema.fields.map((field: any) => ({
      id: field.id.trim(),
      label: field.label.trim(),
      type: field.type,
      required: Boolean(field.required),
      showInCards: Boolean(field.showInCards),
      listDisplay:
        field.listDisplay ??
        (field.showInList ? 'summary' : 'none'),
      options:
        field.type === 'dropdown'
          ? (field.options ?? []).map((o: any) => o.trim()).filter(Boolean)
          : undefined,
    })),
  }
}

/* =========================================================
   4) Handlers: API logic
   ========================================================= */

export async function GET(_req: Request, ctx: RouteCtx) {
  // (a) Auth
  const auth = await requireUser()
  if (auth.response) return auth.response
  const user = auth.user

  // (b) Params
  const { id } = await Promise.resolve(ctx.params)

  // (c) Load tracker item
  const item = await prisma.trackerItem.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      type: true,
      done: true,
      dueAt: true,
      doneAt: true,
      statusUpdatedAt: true,
      createdAt: true,
      schema: true,
    },
  })

  if (!item) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  // (d) Load entries
  const entries = await prisma.trackerEntry.findMany({
    where: { trackerId: item.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      data: true,
      dueAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    item: {
      ...item,
      schema: (item.schema ?? null) as TrackerSchema | null,
    },
    entries,
  })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  // (a) Auth
  const auth = await requireUser()
  if (auth.response) return auth.response
  const user = auth.user

  // (b) Params
  const { id } = await Promise.resolve(ctx.params)

  // (c) Ensure tracker exists and belongs to user
  const existing = await prisma.trackerItem.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  // (d) Parse body
  let body: UpdateTrackerBody
  try {
    body = (await req.json()) as UpdateTrackerBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const updateData: {
    title?: string
    schema?: TrackerSchema
    dueAt?: Date | null
    done?: boolean
    doneAt?: Date | null
    statusUpdatedAt?: Date | null
  } = {}

  // (e) Validate optional title
  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) {
      return NextResponse.json({ ok: false, error: 'Title is required' }, { status: 400 })
    }

    updateData.title = body.title.trim()
  }

  // (f) Validate optional schema
  if (body.schema !== undefined) {
    if (!validateSchema(body.schema)) {
      return NextResponse.json({ ok: false, error: 'Invalid schema' }, { status: 400 })
    }

    updateData.schema = normalizeSchema(body.schema)
  }

  // (g) Validate optional dueAt
  if (body.dueAt !== undefined) {
    if (body.dueAt !== null && Number.isNaN(Date.parse(body.dueAt))) {
      return NextResponse.json({ ok: false, error: 'Invalid dueAt value' }, { status: 400 })
    }

    updateData.dueAt = body.dueAt ? new Date(body.dueAt) : null
  }

  // (h) Validate optional done fields
  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'Invalid done value' }, { status: 400 })
    }

    updateData.done = body.done
  }

  if (body.doneAt !== undefined) {
    if (body.doneAt !== null && Number.isNaN(Date.parse(body.doneAt))) {
      return NextResponse.json({ ok: false, error: 'Invalid doneAt value' }, { status: 400 })
    }

    updateData.doneAt = body.doneAt ? new Date(body.doneAt) : null
  }

  if (body.statusUpdatedAt !== undefined) {
    if (
      body.statusUpdatedAt !== null &&
      Number.isNaN(Date.parse(body.statusUpdatedAt))
    ) {
      return NextResponse.json(
        { ok: false, error: 'Invalid statusUpdatedAt value' },
        { status: 400 }
      )
    }

    updateData.statusUpdatedAt = body.statusUpdatedAt
      ? new Date(body.statusUpdatedAt)
      : null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
  }

  // (i) Update tracker
  const item = await prisma.trackerItem.update({
    where: { id: existing.id },
    data: updateData,
    select: {
      id: true,
      title: true,
      type: true,
      done: true,
      dueAt: true,
      doneAt: true,
      statusUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
      schema: true,
    },
  })

  return NextResponse.json({
    ok: true,
    item,
  })
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  // (a) Auth
  const auth = await requireUser()
  if (auth.response) return auth.response
  const user = auth.user

  // (b) Params
  const { id } = await Promise.resolve(ctx.params)

  // (c) Ensure tracker exists and belongs to user
  const existing = await prisma.trackerItem.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  // (d) Delete tracker
  await prisma.trackerItem.delete({
    where: { id: existing.id },
  })

  return NextResponse.json({ ok: true })
}
