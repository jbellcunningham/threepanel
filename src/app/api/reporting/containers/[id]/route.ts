/**
 * FILE: /src/app/api/reporting/containers/[id]/route.ts
 *
 * PURPOSE:
 * - Returns one readable container and its entries for reporting
 * - Read-only endpoint with access checks
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { canReadContainer } from '@/lib/containerAccess'

/* =========================================================
   2) Types
   ========================================================= */

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

/* =========================================================
   3) Handler
   ========================================================= */

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const isAdmin = user.role === 'ADMIN'
    const isReadable = isAdmin ? true : await canReadContainer(user.id, id)

    if (!isReadable) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const item = await prisma.trackerItem.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        done: true,
        dueAt: true,
        createdAt: true,
        updatedAt: true,
        schema: true,
        userId: true,
      },
    })

    if (!item) {
      return NextResponse.json({ ok: false, error: 'Container not found' }, { status: 404 })
    }

    const entries = await prisma.trackerEntry.findMany({
      where: {
        trackerId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        data: true,
        dueAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
      entries: entries.map((entry: { id: string; trackerId: string; data: unknown; createdAt: Date; updatedAt: Date }) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET /api/reporting/containers/[id] error:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to load reporting container' },
      { status: 500 }
    )
  }
}
