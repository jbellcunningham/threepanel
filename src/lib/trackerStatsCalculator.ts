/**
 * FILE: /src/lib/trackerStatsCalculator.ts
 *
 * PURPOSE:
 * - Recalculates tracker statistics from source-of-truth entries
 * - Produces the canonical TrackerStatistics shape
 * - Does not perform any DB writes
 *
 * DESIGN:
 * - Safe pure calculation layer
 * - Can be used by:
 *   - stats API
 *   - list preview rollups
 *   - future "recalculate statistics" action
 */

/* =========================================================
   1) Imports
   ========================================================= */

import type { TrackerStatistics, TimeSeriesPoint } from '@/lib/trackerStats'

/* =========================================================
   2) Types
   ========================================================= */

export type TrackerFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'dropdown'

export type TrackerField = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
  options?: string[]
  showInCards?: boolean
  showInList?: boolean
  listDisplay?: 'none' | 'latest' | 'summary' | 'average'
}

export type TrackerSchema = {
  version?: number
  fields: TrackerField[]
}

export type TrackerEntryForStats = {
  id: string
  createdAt: string | Date
  updatedAt?: string | Date
  data?: Record<string, unknown> | null
}

/* =========================================================
   3) Helpers
   ========================================================= */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getEntryDataRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return {}
  }

  return value
}

function getEntryFieldValue(entry: TrackerEntryForStats, fieldId: string): unknown {
  const data = getEntryDataRecord(entry.data)
  return data[fieldId]
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }

  return null
}

function roundNumber(value: number | null): number | null {
  if (value === null) {
    return null
  }

  return Number(value.toFixed(2))
}

function getFirstDateField(schema: TrackerSchema | null | undefined): TrackerField | null {
  if (!schema?.fields?.length) {
    return null
  }

  return schema.fields.find((field) => field.type === 'date') ?? null
}

function getTimeSeriesPointDate(
  entry: TrackerEntryForStats,
  dateFieldId: string | null
): string {
  if (dateFieldId) {
    try {
      const rawDate = getEntryFieldValue(entry, dateFieldId)

      if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        return rawDate
      }

      if (rawDate) {
        const parsed = new Date(String(rawDate))
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString()
        }
      }
    } catch {
      // fallback below
    }
  }

  return toIsoString(entry.createdAt)
}

/* =========================================================
   4) Main Calculation
   ========================================================= */

export function calculateTrackerStatistics(
  schema: TrackerSchema | null | undefined,
  entries: TrackerEntryForStats[]
): TrackerStatistics {
  const sortedEntries = [...entries].sort((a, b) => {
    return new Date(toIsoString(a.createdAt)).getTime() - new Date(toIsoString(b.createdAt)).getTime()
  })

  const dateField = getFirstDateField(schema)
  const dateFieldId = dateField ? dateField.id : null

  const statistics: TrackerStatistics = {
    updatedAt: new Date().toISOString(),
    entryCount: sortedEntries.length,
    fields: {},
  }

  for (const field of schema?.fields ?? []) {
    if (field.type === 'number') {
      const numericValues = sortedEntries
        .map((entry) => toNumber(getEntryFieldValue(entry, field.id)))
        .filter((value): value is number => value !== null)

      const latest = [...sortedEntries]
        .reverse()
        .map((entry) => toNumber(getEntryFieldValue(entry, field.id)))
        .find((value): value is number => value !== null)

      const count = numericValues.length
      const sum = numericValues.reduce((total, value) => total + value, 0)

      let timeSeries: TimeSeriesPoint[] = sortedEntries
        .map((entry) => {
          const numericValue = toNumber(getEntryFieldValue(entry, field.id))

          if (numericValue === null) {
            return null
          }

          return {
            date: getTimeSeriesPointDate(entry, dateFieldId),
            value: numericValue,
            createdAt: toIsoString(entry.createdAt),
          }
        })
        .filter(
          (
            point
          ): point is TimeSeriesPoint & {
            createdAt: string
          } => point !== null
        )

      timeSeries = timeSeries
        .sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()

          if (dateDiff !== 0) {
            return dateDiff
          }

          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })
        .map(({ date, value }) => ({
          date,
          value,
        }))

      statistics.fields[field.id] = {
        count,
        latest: latest !== undefined ? roundNumber(latest) : null,
        sum: count > 0 ? roundNumber(sum) : null,
        avg: count > 0 ? roundNumber(sum / count) : null,
        min: count > 0 ? roundNumber(Math.min(...numericValues)) : null,
        max: count > 0 ? roundNumber(Math.max(...numericValues)) : null,
        timeSeries,
      }

      continue
    }

    if (field.type === 'dropdown') {
      const values = sortedEntries
        .map((entry) => toNonEmptyString(getEntryFieldValue(entry, field.id)))
        .filter((value): value is string => value !== null)

      const valueCounts = new Map<string, number>()

      for (const value of values) {
        valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1)
      }

      const topValues = Array.from(valueCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count
          }

          return a.value.localeCompare(b.value)
        })

      statistics.fields[field.id] = {
        count: values.length,
        topValues,
      }

      continue
    }

    if (field.type === 'boolean') {
      const booleanValues = sortedEntries
        .map((entry) => toBoolean(getEntryFieldValue(entry, field.id)))
        .filter((value): value is boolean => value !== null)

      const trueCount = booleanValues.filter((value) => value === true).length
      const falseCount = booleanValues.filter((value) => value === false).length

      statistics.fields[field.id] = {
        count: booleanValues.length,
        trueCount,
        falseCount,
      }

      continue
    }

    const nonEmptyValues = sortedEntries
      .map((entry) => getEntryFieldValue(entry, field.id))
      .filter((value) => value !== undefined && value !== null && value !== '')

    statistics.fields[field.id] = {
      count: nonEmptyValues.length,
    }
  }

  return statistics
}
