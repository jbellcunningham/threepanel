import { prisma } from '@/lib/prisma'
import {
  getContainerDueMeta,
  getEntryDueMeta,
  getEntryTitle,
  isAgendaRelevant,
} from '@/lib/todoDue'

export type TodoAgendaItem = {
  kind: 'container' | 'entry'
  id: string
  title: string
  containerId: string
  containerTitle: string
  dueAt: string
  status: 'overdue' | 'due_today'
  recurrenceRule: string | null
  entryData?: Record<string, unknown> | null
  sortRank: number
  dueTime: number
}

export type TodoAgenda = {
  overdue: TodoAgendaItem[]
  dueToday: TodoAgendaItem[]
}

function toAgendaItem(
  input: Omit<TodoAgendaItem, 'sortRank' | 'dueTime' | 'status'> & {
    sortRank: number
    overdue: boolean
    entryData?: Record<string, unknown> | null
  }
): TodoAgendaItem {
  const dueTime = new Date(input.dueAt).getTime()

  return {
    kind: input.kind,
    id: input.id,
    title: input.title,
    containerId: input.containerId,
    containerTitle: input.containerTitle,
    dueAt: input.dueAt,
    status: input.overdue ? 'overdue' : 'due_today',
    recurrenceRule: input.recurrenceRule,
    entryData: input.entryData ?? null,
    sortRank: input.sortRank,
    dueTime,
  }
}

export async function getTodoAgendaForUser(
  userId: string,
  now = new Date()
): Promise<TodoAgenda> {
  const containers = await prisma.trackerItem.findMany({
    where: {
      userId,
      type: 'todo',
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      done: true,
      dueAt: true,
      recurrenceRule: true,
      entries: {
        select: {
          id: true,
          dueAt: true,
          recurrenceRule: true,
          data: true,
        },
      },
    },
  })

  const overdue: TodoAgendaItem[] = []
  const dueToday: TodoAgendaItem[] = []

  for (const container of containers) {
    const containerMeta = getContainerDueMeta(container, now)

    if (isAgendaRelevant(containerMeta) && container.dueAt) {
      const item = toAgendaItem({
        kind: 'container',
        id: container.id,
        title: container.title,
        containerId: container.id,
        containerTitle: container.title,
        dueAt: container.dueAt.toISOString(),
        recurrenceRule: container.recurrenceRule,
        sortRank: containerMeta.sortRank,
        overdue: containerMeta.overdue,
      })

      if (containerMeta.overdue) {
        overdue.push(item)
      } else {
        dueToday.push(item)
      }
    }

    for (const entry of container.entries) {
      const entryMeta = getEntryDueMeta(entry, now)

      if (!isAgendaRelevant(entryMeta)) {
        continue
      }

      const dueDate = entryMeta.dueDate
      if (!dueDate) {
        continue
      }

      const item = toAgendaItem({
        kind: 'entry',
        id: entry.id,
        title: getEntryTitle(entry.data),
        containerId: container.id,
        containerTitle: container.title,
        dueAt: dueDate.toISOString(),
        recurrenceRule: entry.recurrenceRule,
        entryData:
          entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)
            ? (entry.data as Record<string, unknown>)
            : null,
        sortRank: entryMeta.sortRank,
        overdue: entryMeta.overdue,
      })

      if (entryMeta.overdue) {
        overdue.push(item)
      } else {
        dueToday.push(item)
      }
    }
  }

  const byDueTime = (a: TodoAgendaItem, b: TodoAgendaItem) => a.dueTime - b.dueTime

  overdue.sort(byDueTime)
  dueToday.sort(byDueTime)

  return { overdue, dueToday }
}
