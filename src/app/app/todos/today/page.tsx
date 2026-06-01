'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type TodoAgendaItem = {
  kind: 'container' | 'entry'
  id: string
  title: string
  containerId: string
  containerTitle: string
  dueAt: string
  status: 'overdue' | 'due_today'
  recurrenceRule: string | null
  entryData?: Record<string, unknown> | null
}

type AgendaResponse = {
  ok: boolean
  overdue: TodoAgendaItem[]
  dueToday: TodoAgendaItem[]
  totalCount: number
  error?: string
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function recurrenceLabel(rule: string | null) {
  if (!rule) return null
  if (rule === 'daily') return 'Daily'
  if (rule === 'weekly') return 'Weekly'
  if (rule === 'monthly') return 'Monthly'
  return rule
}

function AgendaSection({
  title,
  items,
  onComplete,
  onOpen,
}: {
  title: string
  items: TodoAgendaItem[]
  onComplete: (item: TodoAgendaItem) => void
  onOpen: (item: TodoAgendaItem) => void
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => {
          const repeat = recurrenceLabel(item.recurrenceRule)

          return (
            <div
              key={`${item.kind}-${item.id}`}
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{item.title}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  {item.kind === 'container' ? 'Container' : 'Sub-item'} ·{' '}
                  <span style={{ opacity: 0.9 }}>{item.containerTitle}</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    color: item.status === 'overdue' ? '#b91c1c' : 'inherit',
                    fontWeight: 600,
                  }}
                >
                  Due {formatDate(item.dueAt)}
                  {repeat ? ` · Repeats ${repeat.toLowerCase()}` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  title="Mark done"
                  onClick={() => onComplete(item)}
                  style={{
                    height: 32,
                    width: 32,
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  ✔️
                </button>
                <button
                  type="button"
                  title="Open"
                  onClick={() => onOpen(item)}
                  style={{
                    height: 32,
                    width: 32,
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function TodoTodayPage() {
  const router = useRouter()
  const [overdue, setOverdue] = useState<TodoAgendaItem[]>([])
  const [dueToday, setDueToday] = useState<TodoAgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/todos/agenda', {
      credentials: 'include',
      cache: 'no-store',
    })

    const raw = await res.text()
    let data: AgendaResponse | null = null

    try {
      data = raw ? (JSON.parse(raw) as AgendaResponse) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setError(data?.error || raw || 'Failed to load agenda')
      setLoading(false)
      return
    }

    setOverdue(data.overdue ?? [])
    setDueToday(data.dueToday ?? [])
    setLoading(false)
  }

  async function completeItem(item: TodoAgendaItem) {
    setError(null)
    const now = new Date().toISOString()

    if (item.kind === 'container') {
      const res = await fetch(`/api/tracker/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          done: true,
          doneAt: now,
          statusUpdatedAt: now,
        }),
      })

      if (!res.ok) {
        setError('Failed to update container')
        return
      }
    } else {
      const res = await fetch(`/api/tracker/${item.containerId}/entries/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data: {
            ...(item.entryData ?? {}),
            done: true,
            doneAt: now,
            statusUpdatedAt: now,
          },
        }),
      })

      if (!res.ok) {
        setError('Failed to update sub-item')
        return
      }
    }

    await load()
  }

  function openItem(item: TodoAgendaItem) {
    const filter = item.status === 'overdue' ? 'overdue' : 'due_today'
    router.push(`/app/containers/${item.containerId}?subtaskFilter=${filter}`)
  }

  useEffect(() => {
    load()
  }, [])

  const totalCount = overdue.length + dueToday.length

  return (
    <main style={{ maxWidth: 900 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Today</h1>
          <p style={{ margin: 0, opacity: 0.75, fontSize: 14 }}>
            All open todo containers and sub-items due today or overdue.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 10,
            }}
          >
            <Link
              href="/app/containers"
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 500,
                color: 'inherit',
              }}
            >
              All containers
            </Link>
            <span
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(0,0,0,0.08)',
              }}
            >
              Today agenda
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href="/app/containers?type=todo"
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            All todo containers
          </Link>
          <Link
            href="/app/todos-unified"
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            Manage lists
          </Link>
        </div>
      </div>

      {error && <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div>}

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading…</div>
      ) : totalCount === 0 ? (
        <div style={{ marginTop: 16, opacity: 0.75 }}>Nothing due today. You&apos;re caught up.</div>
      ) : (
        <>
          <AgendaSection
            title={`Overdue (${overdue.length})`}
            items={overdue}
            onComplete={completeItem}
            onOpen={openItem}
          />
          <AgendaSection
            title={`Due today (${dueToday.length})`}
            items={dueToday}
            onComplete={completeItem}
            onOpen={openItem}
          />
        </>
      )}
    </main>
  )
}
