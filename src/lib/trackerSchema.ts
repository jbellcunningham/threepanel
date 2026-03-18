/**
 * FILE: src/lib/trackerSchema.ts
 *
 * PURPOSE:
 * Defines the JSON shapes used by the schema-driven Tracker system.
 *
 * ARCHITECTURE ROLE:
 * Shared “contract” between:
 *  - Tracker Settings UI (writes TrackerItem.schema)
 *  - Tracker Entry UI (renders form from schema; writes TrackerEntry.data)
 *  - API routes (validates incoming schema/data)
 *
 * Keeping this in one place prevents schema drift across files.
 */

/////////////////////////////
// Type Definitions
/////////////////////////////

/**
 * What kinds of fields a tracker can define.
 * We keep this small at first; we can add more later without breaking old schemas.
 */
export type TrackerFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'select'

/**
 * A single field definition inside a tracker schema.
 * `id` is the stable key used in entry.data (do not reuse once created).
 */
export type TrackerFieldV1 = {
  id: string
  label: string
  type: TrackerFieldType
  required?: boolean
  options?: string[] // only used when type === 'select'
}

/**
 * The full schema stored on TrackerItem.schema.
 */
export type TrackerSchemaV1 = {
  version: 1
  fields: TrackerFieldV1[]
}

/**
 * The entry payload stored on TrackerEntry.data.
 * Keys are TrackerFieldV1.id values.
 */
export type TrackerEntryDataV1 = Record<string, unknown>

/////////////////////////////
// Helper Functions
/////////////////////////////

/**
 * Returns a minimal default schema when a tracker has no custom schema yet.
 * This lets the UI render something sane immediately.
 */
export function defaultTrackerSchema(): TrackerSchemaV1 {
  return {
    version: 1,
    fields: [
      { id: 'notes', label: 'Notes', type: 'text' },
    ],
  }
}
