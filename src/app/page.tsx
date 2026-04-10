'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type CurrentUser = {
  id: string
  email: string
}

export default function HomePage() {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await fetch('/api/me', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!res.ok) {
          setCurrentUser(null)
          return
        }

        const data = await res.json().catch(() => null)

        if (!data?.user) {
          setCurrentUser(null)
          return
        }

        setCurrentUser(data.user)
        router.push('/app/containers')
      } catch {
        setCurrentUser(null)
      }
    }

    loadCurrentUser()
  }, [])

  useEffect(() => {
    function handleDocumentClick() {
      setShowMenu(false)
    }

    if (!showMenu) {
      return
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [showMenu])

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
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
            title={showMenu ? 'Hide menu' : 'Show menu'}
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
              lineHeight: '18px',
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
                zIndex: 20,
              }}
            >
              <Link
                href="/"
                onClick={() => setShowMenu(false)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'rgba(0,0,0,0.08)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                Home
              </Link>

              <a
                href="#features"
                onClick={() => setShowMenu(false)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                Features
              </a>

              {currentUser ? (
                <Link
                  href="/app/containers"
                  onClick={() => setShowMenu(false)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'transparent',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  Open App
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setShowMenu(false)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'transparent',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  Login
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: '48px auto 0',
          display: 'grid',
          gap: 24,
        }}
      >
        <div
          style={{
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>
            FLEXIBLE TRACKING PLATFORM
          </div>

          <h1
            style={{
              marginTop: 12,
              marginBottom: 12,
              fontSize: 40,
              lineHeight: 1.1,
            }}
          >
            Build containers for anything you want to track, report, and analyze.
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.5,
              opacity: 0.8,
              maxWidth: 760,
            }}
          >
            ThreePanel gives you schema-driven containers for trackers, journals, todos,
            and custom workflows. Capture entries, visualize trends, and share reporting
            access without giving up editing control.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 20,
            }}
          >
            <Link
              href={currentUser ? '/app/containers' : '/login'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 42,
                padding: '0 16px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                textDecoration: 'none',
                color: 'inherit',
                fontWeight: 700,
              }}
            >
              {currentUser ? 'Open App' : 'Login'}
            </Link>

            <a
              href="#features"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 42,
                padding: '0 16px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              Explore Features
            </a>
          </div>
        </div>

        <section
          id="features"
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <div
            style={{
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Schema-Driven Containers</h2>
            <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
              Create trackers, journals, todos, and custom types from the same unified
              model.
            </p>
          </div>

          <div
            style={{
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Reporting Access</h2>
            <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
              Share read-only reporting views without exposing editing actions or container
              configuration.
            </p>
          </div>

          <div
            style={{
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Statistics and Trends</h2>
            <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
              Turn entry data into summaries, time series, and reporting outputs that stay
              derived from the source of truth.
            </p>
          </div>
        </section>
      </section>
    </main>
  )
}
