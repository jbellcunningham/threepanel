import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type CreateFeedbackBody = {
  summary?: string
  message?: string
  type?: 'BUG' | 'IMPROVEMENT' | 'QUESTION' | 'OTHER'
  pagePath?: string
}

const ALLOWED_TYPES = new Set(['BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER'])

export async function POST(req: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateFeedbackBody

  try {
    body = (await req.json()) as CreateFeedbackBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const pagePath = typeof body.pagePath === 'string' ? body.pagePath.trim().slice(0, 300) : ''
  const typeRaw = typeof body.type === 'string' ? body.type.trim().toUpperCase() : 'OTHER'
  const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : 'OTHER'

  if (!message) {
    return NextResponse.json({ ok: false, error: 'Feedback message is required' }, { status: 400 })
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: user.id,
      summary: summary || null,
      message,
      type: type as 'BUG' | 'IMPROVEMENT' | 'QUESTION' | 'OTHER',
      pagePath: pagePath || null,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    feedback: {
      ...feedback,
      createdAt: feedback.createdAt.toISOString(),
    },
  })
}
