import { prisma } from '@/lib/prisma'

type OverdueCountsByUser = Record<string, number>

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

function isOverdueOpenTodoData(data: unknown, now: Date): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }

  const obj = data as Record<string, unknown>
  if (isDone(obj.done)) {
    return false
  }

  const dueDate = parseDueDate(obj.due_at ?? obj.dueAt)
  if (!dueDate) {
    return false
  }

  return dueDate.getTime() < now.getTime()
}

export async function getOverdueTodoCountsByUser(now = new Date()): Promise<OverdueCountsByUser> {
  const todoContainers = await prisma.trackerItem.findMany({
    where: {
      type: 'todo',
    },
    select: {
      userId: true,
      entries: {
        select: {
          data: true,
        },
      },
    },
  })

  const counts: OverdueCountsByUser = {}

  for (const container of todoContainers) {
    const overdueCount = container.entries.reduce((acc, entry) => {
      return acc + (isOverdueOpenTodoData(entry.data, now) ? 1 : 0)
    }, 0)

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
