/**
 * FILE: /src/lib/reportingTable.ts
 *
 * PURPOSE:
 * - Converts schema-driven entry JSON into a flat reporting table
 * - Used by:
 *   - reporting detail UI
 *   - future exports (CSV / JSON / XLSX)
 *
 * DESIGN:
 * - Schema order controls report column order
 * - System columns come first
 * - Missing values become empty strings
 */

/* =========================================================
   1) Types
   ========================================================= */

export type ReportingField = {
  id: string
  label: string
  type: string
}

export type ReportingSchema = {
  version?: number
  fields?: ReportingField[]
} | null | undefined

export type ReportingEntry = {
  id: string
  createdAt: string
  updatedAt: string
  data?: Record<string, unknown> | null
}

export type ReportingColumn = {
  key: string
  label: string
}

export type ReportingRow = Record<string, string>

/* =========================================================
   2) Helpers
   ========================================================= */

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/* =========================================================
   3) Main builder
   ========================================================= */

export function buildReportingTable(
  schema: ReportingSchema,
  entries: ReportingEntry[]
): {
  columns: ReportingColumn[]
  rows: ReportingRow[]
} {
  const schemaFields = schema?.fields ?? []

  const columns: ReportingColumn[] = [
    { key: 'entryId', label: 'Entry ID' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'updatedAt', label: 'Updated At' },
    ...schemaFields.map((field) => ({
      key: field.id,
      label: field.label,
    })),
  ]

  const rows: ReportingRow[] = entries.map((entry) => {
    const row: ReportingRow = {
      entryId: entry.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }

    for (const field of schemaFields) {
      const rawValue = entry.data?.[field.id]
      row[field.id] = formatCellValue(rawValue)
    }

    return row
  })

  return {
    columns,
    rows,
  }
}
