import { parseTodoDueDate } from '@/lib/todoRecurrence'

export type TodoDueStatus = 'overdue' | 'due_today' | 'open' | 'done' | 'no_due'

export type TodoDueMeta = {
  hasDueDate: boolean
  done: boolean
  overdue: boolean
  dueToday: boolean
  dueDate: Date | null
  statusLabel: string
  detail: string
  sortRank: number
}

function formatOverdueAge(from: Date, to = new Date()) {
  const diffMs = Math.max(0, to.getTime() - from.getTime())
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.floor(diffMs / dayMs)

  if (days <= 0) {
    return 'Overdue today'
  }

  if (days === 1) {
    return '1 day overdue'
  }

  return `${days} days overdue`
}

export function getEntryDueDate(entry: { dueAt: Date | null; data: unknown }): Date | null {
  if (entry.dueAt) {
    return entry.dueAt
  }

  if (!entry.data || typeof entry.data !== 'object') {
    return null
  }

  const obj = entry.data as Record<string, unknown>
  return parseTodoDueDate(obj.due_at ?? obj.dueAt)
}

export function isEntryDone(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }

  return (data as Record<string, unknown>).done === true
}

export function getEntryTitle(data: unknown, fallback = 'Sub-item') {
  if (!data || typeof data !== 'object') {
    return fallback
  }

  const obj = data as Record<string, unknown>
  const title = obj.title

  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }

  return fallback
}

export function buildDueMeta(
  done: boolean,
  dueDate: Date | null,
  now = new Date()
): TodoDueMeta {
  if (!dueDate) {
    return {
      hasDueDate: false,
      done,
      overdue: false,
      dueToday: false,
      dueDate: null,
      statusLabel: done ? 'Done' : 'Open',
      detail: done ? 'Completed (no due date)' : 'No due date',
      sortRank: done ? 4 : 3,
    }
  }

  if (done) {
    return {
      hasDueDate: true,
      done: true,
      overdue: false,
      dueToday: false,
      dueDate,
      statusLabel: 'Done',
      detail: `Due ${dueDate.toLocaleString()}`,
      sortRank: 4,
    }
  }

  const overdue = dueDate.getTime() < now.getTime()
  const dueToday = !overdue && dueDate.toDateString() === now.toDateString()

  if (overdue) {
    return {
      hasDueDate: true,
      done: false,
      overdue: true,
      dueToday: false,
      dueDate,
      statusLabel: 'Overdue',
      detail: formatOverdueAge(dueDate, now),
      sortRank: 1,
    }
  }

  if (dueToday) {
    return {
      hasDueDate: true,
      done: false,
      overdue: false,
      dueToday: true,
      dueDate,
      statusLabel: 'Due today',
      detail: `Due ${dueDate.toLocaleString()}`,
      sortRank: 2,
    }
  }

  return {
    hasDueDate: true,
    done: false,
    overdue: false,
    dueToday: false,
    dueDate,
    statusLabel: 'Open',
    detail: `Due ${dueDate.toLocaleString()}`,
    sortRank: 3,
  }
}

export function getContainerDueMeta(
  item: { done: boolean; dueAt: Date | null },
  now = new Date()
): TodoDueMeta {
  return buildDueMeta(item.done, item.dueAt, now)
}

export function getEntryDueMeta(
  entry: { dueAt: Date | null; data: unknown },
  now = new Date()
): TodoDueMeta {
  return buildDueMeta(isEntryDone(entry.data), getEntryDueDate(entry), now)
}

export function isAgendaRelevant(meta: TodoDueMeta): boolean {
  if (meta.done || !meta.hasDueDate || !meta.dueDate) {
    return false
  }

  return meta.overdue || meta.dueToday
}
