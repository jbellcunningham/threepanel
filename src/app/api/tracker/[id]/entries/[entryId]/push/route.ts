import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type PushBody = {
  mode?: '1_day' | '1_week' | '1_month' | 'custom'
  dueAt?: string | null
}

function parseDueDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

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

function getExistingData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; entryId: string }> | { id: string; entryId: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id, entryId } = await Promise.resolve(ctx.params)

  let body: PushBody
  try {
    body = (await req.json()) as PushBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await prisma.trackerEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      dueAt: true,
      data: true,
      tracker: { select: { id: true, userId: true } },
    },
  })

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 })
  }

  if (existing.tracker.id !== id) {
    return NextResponse.json(
      { ok: false, error: 'Entry does not belong to tracker' },
      { status: 400 }
    )
  }

  if (existing.tracker.userId !== user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 })
  }

  const existingData = getExistingData(existing.data)
  const currentDue =
    existing.dueAt ?? parseDueDate(existingData.due_at ?? existingData.dueAt)
  const base = currentDue ?? new Date()
  let nextDue = new Date(base)

  if (body.mode === '1_week') {
    nextDue.setDate(base.getDate() + 7)
  } else if (body.mode === '1_month') {
    nextDue.setMonth(base.getMonth() + 1)
  } else if (body.mode === 'custom') {
    const parsed = parseDueDate(body.dueAt)
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: 'Invalid custom due date. Use YYYY-MM-DD.' },
        { status: 400 }
      )
    }
    nextDue = parsed
  } else {
    nextDue.setDate(base.getDate() + 1)
  }

  const dueIso = toIsoDate(nextDue)
  const nextData = {
    ...existingData,
    due_at: dueIso,
  }

  const updated = await prisma.trackerEntry.update({
    where: { id: entryId },
    data: {
      dueAt: new Date(`${dueIso}T23:59:59.999Z`),
      data: nextData,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      data: true,
      dueAt: true,
      recurrenceRule: true,
    },
  })

  return NextResponse.json({ ok: true, entry: updated })
}
