import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type FeedbackStatus = 'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX'

type UpdateFeedbackBody = {
  id?: string
  status?: FeedbackStatus
  adminNotes?: string
}

const ALLOWED_STATUS = new Set(['NEW', 'TRIAGED', 'IN_PROGRESS', 'DONE', 'WONT_FIX'])

async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (user.role !== 'ADMIN') {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, user }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return auth.response
  }

  const items = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    take: 200,
  })

  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      id: item.id,
      userId: item.userId,
      username: item.user.email,
      summary: item.summary,
      message: item.message,
      type: item.type,
      status: item.status,
      pagePath: item.pagePath,
      adminNotes: item.adminNotes,
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  })
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return auth.response
  }

  let body: UpdateFeedbackBody

  try {
    body = (await req.json()) as UpdateFeedbackBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.trim() : ''

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Feedback id is required' }, { status: 400 })
  }

  const updateData: {
    status?: FeedbackStatus
    adminNotes?: string | null
    resolvedAt?: Date | null
  } = {}

  if (status) {
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ ok: false, error: 'Invalid feedback status' }, { status: 400 })
    }
    updateData.status = status as FeedbackStatus
    updateData.resolvedAt = status === 'DONE' ? new Date() : null
  }

  if (typeof body.adminNotes === 'string') {
    updateData.adminNotes = adminNotes || null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, error: 'No update fields provided' }, { status: 400 })
  }

  try {
    const item = await prisma.feedback.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: item.id,
        userId: item.userId,
        username: item.user.email,
        summary: item.summary,
        message: item.message,
        type: item.type,
        status: item.status,
        pagePath: item.pagePath,
        adminNotes: item.adminNotes,
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Feedback item not found' }, { status: 404 })
  }
}
