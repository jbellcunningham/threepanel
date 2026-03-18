import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token } }).catch(() => {})
    return null
  }

  return session.user
}
