import { prisma } from '@/lib/prisma'

type OverdueCountsByUser = Record<string, number>
export type OverdueNotificationTarget = {
  overdueCount: number
  targetContainerId: string | null
}

export type OverdueNotificationTargetsByUser = Record<string, OverdueNotificationTarget>

function parseDueDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T23:59:59.999Z`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isDone(value: unknown): boolean {
  return value === true
}

function getEntryDueDate(entry: { dueAt: Date | null; data: unknown }): Date | null {
  if (entry.dueAt) {
    return entry.dueAt
  }

  if (!entry.data || typeof entry.data !== 'object') {
    return null
  }

  const obj = entry.data as Record<string, unknown>
  return parseDueDate(obj.due_at ?? obj.dueAt)
}

function isOverdueOpenTodoData(entry: { dueAt: Date | null; data: unknown }, now: Date): boolean {
  if (!entry.data || typeof entry.data !== 'object') {
    return false
  }

  const obj = entry.data as Record<string, unknown>
  if (isDone(obj.done)) {
    return false
  }

  const dueDate = getEntryDueDate(entry)
  if (!dueDate) {
    return false
  }

  return dueDate.getTime() < now.getTime()
}

function getOverdueDueTime(entry: { dueAt: Date | null; data: unknown }, now: Date): number | null {
  if (!entry.data || typeof entry.data !== 'object') {
    return null
  }

  const obj = entry.data as Record<string, unknown>
  if (isDone(obj.done)) {
    return null
  }

  const dueDate = getEntryDueDate(entry)
  if (!dueDate) {
    return null
  }

  const dueTime = dueDate.getTime()
  if (dueTime >= now.getTime()) {
    return null
  }

  return dueTime
}

export async function getOverdueTodoCountsByUser(now = new Date()): Promise<OverdueCountsByUser> {
  const todoContainers = await prisma.trackerItem.findMany({
    where: {
      type: 'todo',
    },
    select: {
      userId: true,
      done: true,
      dueAt: true,
      entries: {
        select: {
          dueAt: true,
          data: true,
        },
      },
    },
  })

  const counts: OverdueCountsByUser = {}

  for (const container of todoContainers) {
    const containerOverdueCount =
      !container.done && container.dueAt && container.dueAt.getTime() < now.getTime() ? 1 : 0

    const overdueCount = container.entries.reduce((acc, entry) => {
      return acc + (isOverdueOpenTodoData(entry, now) ? 1 : 0)
    }, containerOverdueCount)

    if (overdueCount > 0) {
      counts[container.userId] = (counts[container.userId] ?? 0) + overdueCount
    }
  }

  return counts
}

export async function getOverdueTodoCountForUser(userId: string, now = new Date()): Promise<number> {
  const counts = await getOverdueTodoCountsByUser(now)
  return counts[userId] ?? 0
}

export async function getOverdueTodoNotificationTargetsByUser(
  now = new Date()
): Promise<OverdueNotificationTargetsByUser> {
  const todoContainers = await prisma.trackerItem.findMany({
    where: {
      type: 'todo',
    },
    select: {
      id: true,
      userId: true,
      done: true,
      dueAt: true,
      entries: {
        select: {
          dueAt: true,
          data: true,
        },
      },
    },
  })

  const targets: OverdueNotificationTargetsByUser = {}
  const nearestDueByUser: Record<string, number> = {}

  for (const container of todoContainers) {
    let containerOverdueCount =
      !container.done && container.dueAt && container.dueAt.getTime() < now.getTime() ? 1 : 0
    let nearestOverdueDueTime: number | null = null

    if (containerOverdueCount > 0 && container.dueAt) {
      nearestOverdueDueTime = container.dueAt.getTime()
    }

    for (const entry of container.entries) {
      const dueTime = getOverdueDueTime(entry, now)
      if (dueTime === null) {
        continue
      }

      containerOverdueCount += 1

      if (nearestOverdueDueTime === null || dueTime < nearestOverdueDueTime) {
        nearestOverdueDueTime = dueTime
      }
    }

    if (containerOverdueCount <= 0 || nearestOverdueDueTime === null) {
      continue
    }

    const existing = targets[container.userId]
    if (!existing) {
      targets[container.userId] = {
        overdueCount: containerOverdueCount,
        targetContainerId: container.id,
      }
      nearestDueByUser[container.userId] = nearestOverdueDueTime
      continue
    }

    existing.overdueCount += containerOverdueCount
    const existingNearest = nearestDueByUser[container.userId]
    if (existingNearest === undefined || nearestOverdueDueTime < existingNearest) {
      existing.targetContainerId = container.id
      nearestDueByUser[container.userId] = nearestOverdueDueTime
    }
  }

  return targets
}
