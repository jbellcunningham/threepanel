import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type UnsubscribeBody = {
  endpoint?: string
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: UnsubscribeBody
  try {
    body = (await req.json()) as UnsubscribeBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: 'Endpoint is required' }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      userId: user.id,
      endpoint,
    },
  })

  return NextResponse.json({ ok: true })
}
