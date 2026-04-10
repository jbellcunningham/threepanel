'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type CurrentUser = {
  id: string
  email: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const router = useRouter()

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await fetch('/api/me', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!res.ok) return

        const data = await res.json().catch(() => null)

        if (data?.user) {
          setCurrentUser(data.user)
        }
      } catch {
        // ignore
      }
    }

    loadCurrentUser()
  }, [])

  useEffect(() => {
    function handleDocumentClick() {
      setShowMenu(false)
    }

    if (!showMenu) return

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [showMenu])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      setError(data?.error || 'Login failed')
      setLoading(false)
      return
    }

    router.push('/app/containers')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          position: 'relative',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>ThreePanel</div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
            Schema-driven containers, reporting, and statistics
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu((prev) => !prev)
            }}
            style={{
              height: 40,
              width: 40,
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ☰
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 'min(220px, calc(100vw - 32px))',
                maxWidth: 'calc(100vw - 32px)',
                background: 'white',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 8,
                display: 'grid',
                gap: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              }}
            >
              <Link href="/" style={menuItemStyle}>Home</Link>

              {currentUser ? (
                <Link href="/app/containers" style={menuItemStyle}>
                  Open App
                </Link>
              ) : (
                <Link href="/login" style={{ ...menuItemStyle, background: 'rgba(0,0,0,0.08)' }}>
                  Login
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Login Form */}
      <section
        style={{
          maxWidth: 420,
          margin: '60px auto 0',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 16,
          padding: 24,
          display: 'grid',
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Login</h1>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && <div style={{ color: 'crimson' }}>{error}</div>}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  )
}

/* ---------------------------------- */
/* Styles */
/* ---------------------------------- */

const inputStyle = {
  height: 40,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.18)',
}

const buttonStyle = {
  height: 42,
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.12)',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: 700,
}

const menuItemStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.08)',
  textDecoration: 'none',
  color: 'inherit',
}
