/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/admin/users/create/route.ts
 *
 * PURPOSE:
 * - Creates a new user from the admin interface
 *
 * ARCHITECTURE ROLE:
 * - Admin-only API endpoint
 * - Foundation for tester/admin account provisioning
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

type CreateAdminUserBody = {
  email?: string
  password?: string
  role?: 'USER' | 'TESTER' | 'ADMIN'
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

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizePassword(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeRole(value: unknown): 'USER' | 'TESTER' | 'ADMIN' {
  if (value === 'ADMIN' || value === 'TESTER') {
    return value
  }

  return 'USER'
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function POST(req: Request) {
  const auth = await requireAdmin()

  if (!auth.ok) {
    return auth.response
  }

  let body: CreateAdminUserBody

  try {
    body = (await req.json()) as CreateAdminUserBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const email = normalizeEmail(body.email)
  const password = normalizePassword(body.password)
  const role = normalizeRole(body.role)

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Email and password are required' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({
    where: { email }
  })

  if (existing) {
    return NextResponse.json(
      { ok: false, error: 'Email already registered' },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role
    },
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
