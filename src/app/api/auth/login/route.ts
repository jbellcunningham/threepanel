import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

type LoginBody = {
  email?: string
  password?: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as LoginBody
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Email and password are required' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  })

  // Don't reveal whether email exists
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  // For now: return user identity (next step we’ll set a secure session cookie)
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  })
}
