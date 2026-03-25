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
  summary: Record<string, unknown>
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
  if (body.templateType === 'tracker' || body.templateType === 'todo' || body.templateType === 'journal') {
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
  if (body.templateType === 'tracker' || body.templateType === 'todo' || body.templateType === 'journal') {
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
      entries: {
        select: {
          id: true
        }
      }
    }
  })

  // (c) Shape response
  const itemsWithSummary: TrackerListItem[] = items.map((it) => ({
    id: it.id,
    title: it.title,
    type: it.type,
    done: it.done,
    createdAt: it.createdAt.toISOString(),
    summary: {
      entryCount: it.entries.length
    }
  }))

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
