import { prisma } from '@/lib/prisma'

type WebPushPayload = {
  title: string
  body: string
  url?: string
}

type SubscriptionWithKeys = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

async function getWebPushClient() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const contactEmail = process.env.VAPID_SUBJECT_EMAIL || 'admin@example.com'

  if (!publicKey || !privateKey) {
    return null
  }

  const webPushModule = await import('web-push').catch(() => null)
  if (!webPushModule?.default) {
    return null
  }

  const webPush = webPushModule.default
  webPush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey)
  return webPush
}

export async function sendPushToUser(userId: string, payload: WebPushPayload) {
  const webPush = await getWebPushClient()
  if (!webPush) {
    return { ok: false as const, error: 'Web push is not configured on server' }
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId,
      enabled: true,
    },
  })

  if (subscriptions.length === 0) {
    return { ok: false as const, error: 'No active push subscriptions found' }
  }

  const body = JSON.stringify(payload)

  for (const subscription of subscriptions) {
    const target: SubscriptionWithKeys = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    try {
      await webPush.sendNotification(target, body)
    } catch {
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { enabled: false },
      }).catch(() => {})
    }
  }

  return { ok: true as const }
}
