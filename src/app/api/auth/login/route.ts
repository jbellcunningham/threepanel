import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
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
  })

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  const valid = await bcrypt.compare(password, user.passwordHash)

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  // Create session
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days
  const cookieStore = await cookies()

  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  })

  cookieStore.set('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
  })

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  })
}

