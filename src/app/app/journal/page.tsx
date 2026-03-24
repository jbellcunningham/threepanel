/**
 * FILE: /opt/threepanel/app/threepanel/src/app/app/journal/page.tsx
 *
 * PURPOSE:
 * - Lists all journal containers for the logged-in user
 * - Allows creation of new journal containers
 *
 * ARCHITECTURE ROLE:
 * - Client UI layer for unified Journal list
 * - Consumes GET/POST /api/journal
 */

'use client'

/* =========================================================
   1) Imports
   ========================================================= */

import Link from 'next/link'
import { useEffect, useState } from 'react'

/* =========================================================
   2) Types
   ========================================================= */

type JournalItem = {
  id: string
  title: string
  done: boolean
  type: string
  createdAt: string
  updatedAt: string
  entries: JournalEntry[]
}

type JournalEntry = {
  id: string
  data: unknown
  createdAt: string
  updatedAt: string
}

/* =========================================================
   3) Helpers
   ========================================================= */

async function readJsonSafe(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/* =========================================================
   4) Component
   ========================================================= */

export default function JournalPage() {
  /* -----------------------------
     State
     ----------------------------- */

  const [items, setItems] = useState<JournalItem[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  /* =========================================================
     5) Data loaders
     ========================================================= */

  async function loadJournalItems() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/journal', {
        cache: 'no-store'
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        setError(data?.error || 'Failed to load journal items')
        return
      }

      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('loadJournalItems error:', err)
      setError('Failed to load journal items')
    } finally {
      setLoading(false)
    }
  }

  /* =========================================================
     6) Event handlers
     ========================================================= */

  async function handleCreateJournal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!newTitle.trim()) {
      return
    }

    try {
      setCreating(true)
      setError('')

      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTitle.trim()
        })
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        setError(data?.error || 'Failed to create journal item')
        return
      }

      setNewTitle('')
      await loadJournalItems()
    } catch (err) {
      console.error('handleCreateJournal error:', err)
      setError('Failed to create journal item')
    } finally {
      setCreating(false)
    }
  }

  /* =========================================================
     7) Effects
     ========================================================= */

  useEffect(() => {
    loadJournalItems()
  }, [])

  /* =========================================================
     8) Render
     ========================================================= */

  return (
    <div
      style={{
        padding: '16px',
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: '16px' }}>Journal</h1>

      <form
        onSubmit={handleCreateJournal}
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px'
        }}
      >
        <input
          type='text'
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder='New journal title'
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '16px'
          }}
        />
        <button
          type='submit'
          disabled={creating}
          style={{
            padding: '10px 14px',
            fontSize: '16px',
            cursor: creating ? 'default' : 'pointer'
          }}
        >
          {creating ? 'Creating...' : 'Add'}
        </button>
      </form>

      {error ? (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px',
            border: '1px solid #cc0000'
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div>Loading...</div>
      ) : items.length === 0 ? (
        <div>No journal containers yet.</div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}
                  >
                    {item.title}
                  </div>

                  <div
                    style={{
                      fontSize: '14px',
                      opacity: 0.7
                    }}
                  >
                    Entries: {item.entries.length}
                  </div>
                </div>

                <Link
                  href={`/app/journal/${item.id}`}
                  title='Open journal'
                  style={{
                    textDecoration: 'none',
                    fontSize: '18px'
                  }}
                >
                  📂
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
