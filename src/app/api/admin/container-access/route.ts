/**
 * FILE: /src/app/api/admin/container-access/route.ts
 *
 * PURPOSE:
 * - Admin API for viewing and managing container read access
 * - Supports:
 *   - listing users, containers, and current access grants
 *   - granting read access
 *   - revoking read access
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

type CreateAccessBody = {
  userId?: string
  trackerItemId?: string
  accessType?: string
}

type DeleteAccessBody = {
  userId?: string
  trackerItemId?: string
  accessType?: string
}

/* =========================================================
   3) Helpers
   ========================================================= */

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (user.role !== 'ADMIN') {
    return {
      user: null,
      response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user, response: undefined }
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function GET() {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const [users, containers, access] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
      },
    }),
    prisma.trackerItem.findMany({
      orderBy: [
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        type: true,
        userId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
    prisma.containerAccess.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        trackerItemId: true,
        accessType: true,
        createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    users,
    containers: containers.map((container) => ({
      id: container.id,
      title: container.title,
      type: container.type,
      userId: container.userId,
      ownerEmail: container.user.email,
      createdAt: container.createdAt.toISOString(),
    })),
    access: access.map((grant) => ({
      id: grant.id,
      userId: grant.userId,
      trackerItemId: grant.trackerItemId,
      accessType: grant.accessType,
      createdAt: grant.createdAt.toISOString(),
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  let body: CreateAccessBody

  try {
    body = (await request.json()) as CreateAccessBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = body.userId?.trim()
  const trackerItemId = body.trackerItemId?.trim()
  const accessType = body.accessType?.trim() || 'read'

  if (!isNonEmptyString(userId) || !isNonEmptyString(trackerItemId)) {
    return NextResponse.json(
      { ok: false, error: 'userId and trackerItemId are required' },
      { status: 400 }
    )
  }

  const [user, container] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    }),
    prisma.trackerItem.findUnique({
      where: { id: trackerItemId },
      select: { id: true },
    }),
  ])

  if (!user) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
  }

  if (!container) {
    return NextResponse.json({ ok: false, error: 'Container not found' }, { status: 404 })
  }

  const grant = await prisma.containerAccess.upsert({
    where: {
      userId_trackerItemId_accessType: {
        userId,
        trackerItemId,
        accessType,
      },
    },
    update: {},
    create: {
      userId,
      trackerItemId,
      accessType,
    },
    select: {
      id: true,
      userId: true,
      trackerItemId: true,
      accessType: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    grant: {
      ...grant,
      createdAt: grant.createdAt.toISOString(),
    },
  })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  let body: DeleteAccessBody

  try {
    body = (await request.json()) as DeleteAccessBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = body.userId?.trim()
  const trackerItemId = body.trackerItemId?.trim()
  const accessType = body.accessType?.trim() || 'read'

  if (!isNonEmptyString(userId) || !isNonEmptyString(trackerItemId)) {
    return NextResponse.json(
      { ok: false, error: 'userId and trackerItemId are required' },
      { status: 400 }
    )
  }

  await prisma.containerAccess.deleteMany({
    where: {
      userId,
      trackerItemId,
      accessType,
    },
  })

  return NextResponse.json({ ok: true })
}
