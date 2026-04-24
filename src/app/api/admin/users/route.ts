/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/admin/users/route.ts
 *
 * PURPOSE:
 * - Lists all users for admin management
 *
 * ARCHITECTURE ROLE:
 * - Admin-only API endpoint
 * - Foundation for user management UI
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/* =========================================================
   2) Types
   ========================================================= */

type UserListItem = {
  id: string
  email: string
  role: 'USER' | 'TESTER' | 'ADMIN'
  createdAt: string
  updatedAt: string
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

export async function GET() {
  const auth = await requireAdmin()

  if (!auth.ok) {
    return auth.response
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })

  const items: UserListItem[] = users.map((user: { id: string; email: string; role: string; createdAt: Date; updatedAt: Date }) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  }))

  return NextResponse.json({
    ok: true,
    users: items
  })
}
