import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { sendPushToUser } from '@/lib/webPush'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendPushToUser(user.id, {
    title: 'ThreePanel Test Notification',
    body: 'Push notifications are active on this device.',
    url: '/app/notifications',
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
