import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type RouteContext = {
  params: Promise<{
    id: string
  }>
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
