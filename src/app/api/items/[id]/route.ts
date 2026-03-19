import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type UpdateItemBody = {
  title?: string
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
    },
    select: {
      id: true,
      type: true,
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

  return NextResponse.json({
    ok: true,
    deletedId: item.id,
    deletedType: item.type,
  })
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)

  const body = (await req.json().catch(() => null)) as UpdateItemBody | null
  const title = body?.title?.trim()

  if (!title) {
    return NextResponse.json({ ok: false, error: 'Title is required' }, { status: 400 })
  }

  const item = await prisma.trackerItem.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      type: true,
    },
  })

  if (!item) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.trackerItem.update({
    where: {
      id: item.id,
    },
    select: {
      id: true,
      title: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
    data: {
      title,
    },
  })

  return NextResponse.json({
    ok: true,
    item: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}
