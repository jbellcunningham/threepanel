import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type PushSubscriptionBody = {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: PushSubscriptionBody
  try {
    body = (await req.json()) as PushSubscriptionBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : ''

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: 'Subscription endpoint and keys are required' }, { status: 400 })
  }

  const userAgent = req.headers.get('user-agent')

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent,
      enabled: true,
    },
    update: {
      userId: user.id,
      p256dh,
      auth,
      userAgent,
      enabled: true,
    },
  })

  return NextResponse.json({ ok: true })
}
