/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/admin/users/[id]/role/route.ts
 *
 * PURPOSE:
 * - Updates the role of an existing user
 *
 * ARCHITECTURE ROLE:
 * - Admin-only API endpoint
 * - Foundation for user role management UI
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

type UpdateUserRoleBody = {
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

function normalizeRole(value: unknown): 'USER' | 'TESTER' | 'ADMIN' | null {
  if (value === 'USER' || value === 'TESTER' || value === 'ADMIN') {
    return value
  }

  return null
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireAdmin()

  if (!auth.ok) {
    return auth.response
  }

  const adminUser = auth.user
  const { id } = await context.params

  let body: UpdateUserRoleBody

  try {
    body = (await req.json()) as UpdateUserRoleBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const role = normalizeRole(body.role)

  if (!role) {
    return NextResponse.json(
      { ok: false, error: 'Valid role is required' },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true
    }
  })

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: 'User not found' },
      { status: 404 }
    )
  }

  if (existing.id === adminUser.id && role !== 'ADMIN') {
    return NextResponse.json(
      { ok: false, error: 'You cannot remove your own admin role' },
      { status: 400 }
    )
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { role },
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
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    }
  })
}
