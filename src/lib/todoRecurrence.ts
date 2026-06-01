export type RecurrenceRule = 'daily' | 'weekly' | 'monthly'

export function parseRecurrenceRule(value: unknown): RecurrenceRule | null {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value
  }

  return null
}

export function advanceDueDate(from: Date, rule: RecurrenceRule): Date {
  const next = new Date(from)

  if (rule === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1)
    return next
  }

  if (rule === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

export function toIsoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function nextDueAfterComplete(
  currentDue: Date | null,
  rule: RecurrenceRule,
  now = new Date()
): Date {
  const base = currentDue ?? now
  return advanceDueDate(base, rule)
}

export function parseTodoDueDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T23:59:59.999Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
