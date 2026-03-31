/**
 * FILE: /src/app/api/reporting/containers/route.ts
 *
 * PURPOSE:
 * - Returns containers readable by the current user for reporting
 * - Read-only endpoint
 *
 * ACCESS RULES:
 * - ADMIN can read all containers
 * - REPORTING can read containers granted through ContainerAccess
 * - regular users can read their own containers through the shared access helper
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getReadableContainerIds } from '@/lib/containerAccess'

/* =========================================================
   2) Handler
   ========================================================= */

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'ADMIN') {
      const items = await prisma.trackerItem.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          type: true,
          done: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      })

      return NextResponse.json({ ok: true, items })
    }

    const readableIds = await getReadableContainerIds(user.id)

    if (readableIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] })
    }

    const items = await prisma.trackerItem.findMany({
      where: {
        id: { in: readableIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        type: true,
        done: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    })

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('GET /api/reporting/containers error:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to load reporting containers' },
      { status: 500 }
    )
  }
}
