/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/journal/route.ts
 *
 * PURPOSE:
 * - Lists all journal containers for the logged-in user
 * - Creates new journal containers
 *
 * ARCHITECTURE ROLE:
 * - API layer for unified Journal collection operations
 * - Consumes TrackerItem with type = 'journal'
 * - Stores default journal schema on creation
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

type CreateJournalBody = {
  title?: string
}

type JournalSchemaField = {
  key: string
  label: string
  type: string
}

type JournalSchema = {
  fields: JournalSchemaField[]
}

/* =========================================================
   3) Helpers
   ========================================================= */

function getSafeJournalTitle(body: CreateJournalBody) {
  if (typeof body.title === 'string' && body.title.trim()) {
    return body.title.trim()
  }

  return 'Untitled Journal'
}

function getDefaultJournalSchema(): JournalSchema {
  return {
    fields: [
      {
        key: 'recordedDate',
        label: 'Recorded Date',
        type: 'date'
      },
      {
        key: 'location',
        label: 'Location',
        type: 'text'
      },
      {
        key: 'textEntry',
        label: 'Text Entry',
        type: 'textarea'
      }
    ]
  }
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function GET() {
  try {
    // (a) Auth
    const user = await getCurrentUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // (b) Load journal containers
    const items = await prisma.trackerItem.findMany({
      where: {
        userId: user.id,
        type: 'journal'
      },
      include: {
        entries: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/journal error:', error)

    return NextResponse.json(
      { error: 'Failed to load journal items' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    // (a) Auth
    const user = await getCurrentUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // (b) Body
    const body = (await req.json().catch(() => ({}))) as CreateJournalBody
    const title = getSafeJournalTitle(body)
    const schema = getDefaultJournalSchema()

    // (c) Create journal container
    const item = await prisma.trackerItem.create({
      data: {
        userId: user.id,
        title,
        type: 'journal',
        schema
      },
      include: {
        entries: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('POST /api/journal error:', error)

    return NextResponse.json(
      { error: 'Failed to create journal item' },
      { status: 500 }
    )
  }
}
