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
