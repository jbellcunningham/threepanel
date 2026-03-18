import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const done = body?.done

    if (typeof done !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'Invalid done value' },
        { status: 400 }
      )
    }

    const existing = await prisma.todoItem.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Todo not found' },
        { status: 404 }
      )
    }

    const todo = await prisma.todoItem.update({
      where: { id },
      data: { done },
    })

    return NextResponse.json({
      ok: true,
      todo,
    })
  } catch (error) {
    console.error('PATCH /api/todos/[id] error:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}
