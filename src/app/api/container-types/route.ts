/**
 * FILE: /src/app/api/container-types/route.ts
 *
 * PURPOSE:
 * - Returns distinct container types for the current user
 * - Used by:
 *   - sidebar settings
 *   - left navigation
 *
 * DESIGN:
 * - Includes built-in and custom types
 * - Sorted with built-ins first, then custom types
 */

/* =========================================================
   1) Imports
   ========================================================= */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/* =========================================================
   2) Helpers
   ========================================================= */

function sortContainerTypes(types: string[]) {
  const builtInOrder = ['tracker', 'todo', 'journal']

  return [...types].sort((a, b) => {
    const aIndex = builtInOrder.indexOf(a)
    const bIndex = builtInOrder.indexOf(b)

    const aIsBuiltIn = aIndex !== -1
    const bIsBuiltIn = bIndex !== -1

    if (aIsBuiltIn && bIsBuiltIn) {
      return aIndex - bIndex
    }

    if (aIsBuiltIn) {
      return -1
    }

    if (bIsBuiltIn) {
      return 1
    }

    return a.localeCompare(b)
  })
}

/* =========================================================
   3) Handler
   ========================================================= */

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.trackerItem.findMany({
      where: {
        userId: user.id,
      },
      select: {
        type: true,
      },
      distinct: ['type'],
    })

    const types = sortContainerTypes(
      items
        .map((item: { type: string }) => item.type.trim().toLowerCase())
        .filter(Boolean)
    )

    return NextResponse.json({
      ok: true,
      types,
    })
  } catch (error) {
    console.error('GET /api/container-types error:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to load container types' },
      { status: 500 }
    )
  }
}
