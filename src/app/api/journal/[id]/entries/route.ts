/**
 * FILE: /opt/threepanel/app/threepanel/src/app/api/journal/[id]/entries/route.ts
 *
 * PURPOSE:
 * - Creates journal entries for a single journal container
 *
 * ARCHITECTURE ROLE:
 * - API layer for unified Journal entry creation
 * - Consumes TrackerItem with type = 'journal'
 * - Writes schema-driven TrackerEntry JSON records
 * - Falls back to default journal schema for older containers
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

type JournalFieldType = 'text' | 'date' | 'textarea' | 'dropdown'

type JournalField = {
  key: string
  label: string
  type: JournalFieldType
}

type JournalSchema = {
  fields?: JournalField[]
}

type CreateJournalEntryBody = Record<string, unknown>

/* =========================================================
   3) Helpers
   ========================================================= */

function getSafeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

function getSchemaFields(schema: unknown): JournalField[] {
  if (!schema || typeof schema !== 'object') {
    return getDefaultJournalSchema().fields || []
  }

  const record = schema as JournalSchema

  if (!Array.isArray(record.fields) || record.fields.length === 0) {
    return getDefaultJournalSchema().fields || []
  }

  return record.fields.filter(
    (field): field is JournalField =>
      !!field &&
      typeof field.key === 'string' &&
      typeof field.label === 'string' &&
      typeof field.type === 'string'
  )
}

function buildEntryDataFromSchema(
  schema: unknown,
  body: CreateJournalEntryBody
): Record<string, string> {
  const fields = getSchemaFields(schema)
  const data: Record<string, string> = {}

  fields.forEach((field) => {
    data[field.key] = getSafeString(body[field.key])
  })

  return data
}

/* =========================================================
   4) Handlers
   ========================================================= */

export async function POST(req: Request, context: RouteContext) {
  try {
    // (a) Auth
    const user = await getCurrentUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // (b) Params
    const { id } = await context.params

    // (c) Load journal container
    const item = await prisma.trackerItem.findFirst({
      where: {
        id,
        userId: user.id,
        type: 'journal'
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Journal item not found' }, { status: 404 })
    }

    // (d) Body
    const body = (await req.json().catch(() => ({}))) as CreateJournalEntryBody
    const entryData = buildEntryDataFromSchema(item.schema, body)

    const hasAnyValue = Object.values(entryData).some((value: any) => value.trim().length > 0)

    if (!hasAnyValue) {
      return NextResponse.json(
        { error: 'Journal entry must contain at least one value' },
        { status: 400 }
      )
    }

    // (e) Create entry
    const entry = await prisma.trackerEntry.create({
      data: {
        tracker: {
          connect: {
            id: item.id
          }
        },
        data: entryData
      }
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('POST /api/journal/[id]/entries error:', error)

    return NextResponse.json(
      { error: 'Failed to create journal entry' },
      { status: 500 }
    )
  }
}
