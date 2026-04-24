import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_req: Request, ctx: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)

  const item = await prisma.trackerItem.findFirst({
    where: {
      id,
      userId: user.id,
      type: 'todo',
    },
    select: {
      id: true,
      title: true,
      type: true,
      done: true,
      createdAt: true,
      schema: true,
    },
  })

  if (!item) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const entries = await prisma.trackerEntry.findMany({
    where: {
      trackerId: item.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      data: true,
    },
  })

  return NextResponse.json({
    ok: true,
    item: {
      ...item,
      createdAt: item.createdAt.toISOString(),
      schema: item.schema ?? null,
    },
    entries: entries.map((entry: { id: string; trackerId: string; data: unknown; createdAt: Date; updatedAt: Date }) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  })
}
export async function DELETE(_req: Request, ctx: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)

  const item = await prisma.trackerItem.findFirst({
    where: {
      id,
      userId: user.id,
      type: 'todo',
    },
    select: {
      id: true,
    },
  })

  if (!item) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  await prisma.trackerItem.delete({
    where: {
      id: item.id,
    },
  })

  return NextResponse.json({ ok: true })
}
