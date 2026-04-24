import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type DbTableListItem = {
  name: string
  estimatedRowCount: number | null
}

type DbColumn = {
  name: string
  dataType: string
  isNullable: boolean
}

function isSafeTableName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const table = request.nextUrl.searchParams.get('table')?.trim() ?? ''

    if (!table) {
      const tables = await prisma.$queryRaw<
        Array<{ name: string; estimatedRowCount: number | null }>
      >`
        SELECT
          t.tablename AS name,
          COALESCE(s.n_live_tup::bigint, 0)::int AS "estimatedRowCount"
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s
          ON s.schemaname = t.schemaname
         AND s.relname = t.tablename
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename ASC
      `

      const items: DbTableListItem[] = tables.map((tableRow: { name: string; estimatedRowCount: number | null }) => ({
        name: tableRow.name,
        estimatedRowCount:
          typeof tableRow.estimatedRowCount === 'number' ? tableRow.estimatedRowCount : null,
      }))

      return NextResponse.json({
        ok: true,
        mode: 'tables',
        tables: items,
      })
    }

    if (!isSafeTableName(table)) {
      return NextResponse.json({ ok: false, error: 'Invalid table name' }, { status: 400 })
    }

    const tableExists = await prisma.$queryRaw<Array<{ exists: string }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ${table}
      )::text AS exists
    `

    if (!tableExists.length || tableExists[0].exists !== 'true') {
      return NextResponse.json({ ok: false, error: 'Table not found' }, { status: 404 })
    }

    const columns = await prisma.$queryRaw<
      Array<{ name: string; dataType: string; isNullable: string }>
    >`
      SELECT
        column_name AS name,
        data_type AS "dataType",
        is_nullable AS "isNullable"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
      ORDER BY ordinal_position ASC
    `

    const normalizedColumns: DbColumn[] = columns.map((column: { name: string; dataType: string; isNullable: 'YES' | 'NO' | string; columnDefault: string | null }) => ({
      name: column.name,
      dataType: column.dataType,
      isNullable: column.isNullable === 'YES',
    }))

    const hasCreatedAt = normalizedColumns.some((column: any) => column.name === 'createdAt')
    const hasId = normalizedColumns.some((column: any) => column.name === 'id')

    const orderByClause = hasCreatedAt
      ? ` ORDER BY ${quoteIdentifier('createdAt')} DESC`
      : hasId
      ? ` ORDER BY ${quoteIdentifier('id')} DESC`
      : ''

    const rowCountResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`
    )

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${quoteIdentifier(table)}${orderByClause} LIMIT 50`
    )

    return NextResponse.json({
      ok: true,
      mode: 'table',
      table,
      rowCount: rowCountResult[0]?.count ?? 0,
      columns: normalizedColumns,
      rows,
    })
  } catch (error) {
    console.error('GET /api/admin/db error:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to load database inspector data' },
      { status: 500 }
    )
  }
}
