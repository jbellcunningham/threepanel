import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type CreateTodoBody = {
  title?: string
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const todos = await prisma.todoItem.findMany({
    where: { userId: user.id },
    orderBy: [{ listPosition: 'asc' }, { done: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      done: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, todos })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as CreateTodoBody
  const title = (body.title || '').trim()

  if (!title) {
    return NextResponse.json({ ok: false, error: 'Title is required' }, { status: 400 })
  }

	const lastTodo = await prisma.todoItem.findFirst({
	  where: {
	    userId: user.id,
	  },
	  orderBy: {
	    listPosition: 'desc',
	  },
	  select: {
	    listPosition: true,
	  },
	})

  const nextPosition = lastTodo ? lastTodo.listPosition + 1 : 1

  const todo = await prisma.todoItem.create({
    data: {
      userId: user.id,
      title,
      done: false,
      listPosition: nextPosition,
    },
    select: {
      id: true,
      title: true,
      done: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, todo }, { status: 201 })
}
