import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (token) {
    await prisma.session.deleteMany({
      where: { token },
    })
  }

  cookieStore.set('session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
  })

  return NextResponse.json({ ok: true })
}
