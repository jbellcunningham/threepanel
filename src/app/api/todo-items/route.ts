import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type TodoContainerListItem = {
  id: string
  title: string
  type: string
  done: boolean
  createdAt: string
  schema: unknown
}

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.trackerItem.findMany({
    where: {
      userId: user.id,
      type: 'todo',
    },
    orderBy: {
      createdAt: 'desc',
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

  const normalizedItems: TodoContainerListItem[] = items.map((item: any) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    done: item.done,
    createdAt: item.createdAt.toISOString(),
    schema: item.schema ?? null,
  }))

  return NextResponse.json({
    ok: true,
    items: normalizedItems,
  })
}
