/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/admin/users/[id]/route.ts
 *
 * PURPOSE:
 * - Deletes an existing user
 *
 * ARCHITECTURE ROLE:
 * - Admin-only API endpoint
 * - Foundation for user deletion from admin UI
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/* =========================================================
   2) Types
   ========================================================= */

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type UpdateUserBody = {
  email?: string
  password?: string
}

/* =========================================================
   3) Helpers
   ========================================================= */

async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  if (user.role !== 'ADMIN') {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      )
    }
  }

  return {
    ok: true as const,
    user
  }
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdmin()

  if (!auth.ok) {
    return auth.response
  }

  const adminUser = auth.user
  const { id } = await context.params

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true
    }
  })

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: 'User not found' },
      { status: 404 }
    )
  }

  if (existing.id === adminUser.id) {
    return NextResponse.json(
      { ok: false, error: 'You cannot delete your own account' },
      { status: 400 }
    )
  }

  await prisma.user.delete({
    where: { id: existing.id }
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireAdmin()

  if (!auth.ok) {
    return auth.response
  }

  const { id } = await context.params

  let body: UpdateUserBody

  try {
    body = (await req.json()) as UpdateUserBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email && !password) {
    return NextResponse.json(
      { ok: false, error: 'Provide email and/or password to update' },
      { status: 400 }
    )
  }

  if (password && password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true }
  })

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: 'User not found' },
      { status: 404 }
    )
  }

  if (email && email !== existing.email) {
    const emailInUse = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })

    if (emailInUse) {
      return NextResponse.json(
        { ok: false, error: 'Email already registered' },
        { status: 409 }
      )
    }
  }

  const data: { email?: string; passwordHash?: string } = {}

  if (email) {
    data.email = email
  }

  if (password) {
    data.passwordHash = await bcrypt.hash(password, 12)
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    }
  })
}
