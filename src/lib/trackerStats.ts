/**
 * FILE: /src/lib/trackerStats.ts
 *
 * PURPOSE:
 * - Defines the canonical statistics shape for trackers
 * - Shared between:
 *   - list preview
 *   - stats UI (charts, summaries)
 *   - future cached stats on TrackerItem
 *
 * DESIGN:
 * - Entries remain source of truth
 * - Statistics are derived
 * - Can be recalculated fully at any time
 */

/* =========================================================
   1) Core Types
   ========================================================= */

export type TimeSeriesPoint = {
  date: string
  value: number
}

export type FieldStatistics = {
  /* Common */
  count?: number

  /* Numeric */
  latest?: number | null
  sum?: number | null
  avg?: number | null
  min?: number | null
  max?: number | null

  /* Boolean */
  trueCount?: number
  falseCount?: number

  /* Dropdown */
  topValues?: Array<{
    value: string
    count: number
  }>

  /* Time series (numeric only for now) */
  timeSeries?: TimeSeriesPoint[]
}

export type TrackerStatistics = {
  updatedAt: string
  entryCount: number

  fields: Record<string, FieldStatistics>
}

