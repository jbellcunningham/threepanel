import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOverdueTodoCountsByUser } from '@/lib/overdueTodos'
import { sendPushToUser } from '@/lib/webPush'

const NOTIFICATION_INTERVAL_MS = 60 * 60 * 1000

function hasValidCronSecret(req: Request): boolean {
  const configured = process.env.CRON_SECRET
  if (!configured) {
    return false
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  return token === configured
}

export async function POST(req: Request) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const overdueByUser = await getOverdueTodoCountsByUser(now)
  const userIds = Object.keys(overdueByUser)

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, checkedUsers: 0, notifiedUsers: 0, skippedUsers: 0 })
  }

  const settings = await prisma.userSettings.findMany({
    where: {
      userId: {
        in: userIds,
      },
    },
    select: {
      userId: true,
      lastOverdueTodoNotificationAt: true,
    },
  })

  const lastByUser = new Map(settings.map((item) => [item.userId, item.lastOverdueTodoNotificationAt]))
  let notifiedUsers = 0
  let skippedUsers = 0

  for (const userId of userIds) {
    const overdueCount = overdueByUser[userId] ?? 0
    if (overdueCount <= 0) {
      continue
    }

    const last = lastByUser.get(userId)
    if (last && now.getTime() - last.getTime() < NOTIFICATION_INTERVAL_MS) {
      skippedUsers += 1
      continue
    }

    const pushResult = await sendPushToUser(userId, {
      title: 'Overdue To-Dos',
      body:
        overdueCount === 1
          ? 'You have 1 overdue to-do item.'
          : `You have ${overdueCount} overdue to-do items.`,
      url: '/app/notifications',
    })

    if (!pushResult.ok) {
      skippedUsers += 1
      continue
    }

    await prisma.userSettings.upsert({
      where: { userId },
      update: {
        lastOverdueTodoNotificationAt: now,
      },
      create: {
        userId,
        lastOverdueTodoNotificationAt: now,
      },
    })

    notifiedUsers += 1
  }

  return NextResponse.json({
    ok: true,
    checkedUsers: userIds.length,
    notifiedUsers,
    skippedUsers,
  })
}
