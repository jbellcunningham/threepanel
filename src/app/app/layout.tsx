'use client'

import { useEffect, useState } from 'react'

type UserSettingsApiResponse = {
  ok: true
  settings: {
    appTitle: string
    theme: 'system' | 'light' | 'dark'
    hiddenSidebarTypes: string[]
  }
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = useState('ThreePanel')

  useEffect(() => {
    async function syncTitle() {
      let nextTitle = 'ThreePanel'

      try {
        const settingsRes = await fetch('/api/user-settings', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (settingsRes.ok) {
          const settingsData = (await settingsRes.json().catch(() => null)) as
            | UserSettingsApiResponse
            | null

          if (settingsData?.ok && settingsData.settings) {
            nextTitle =
              typeof settingsData.settings.appTitle === 'string' &&
              settingsData.settings.appTitle.trim()
                ? settingsData.settings.appTitle
                : 'ThreePanel'
          }
        }
      } catch {
        nextTitle = 'ThreePanel'
      }

      setTitle(nextTitle)
    }

    syncTitle()
    window.addEventListener('threepanel-settings-changed', syncTitle)

    return () => {
      window.removeEventListener('threepanel-settings-changed', syncTitle)
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.12)',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontWeight: 700 }}>{title}</div>
      </header>

      <main
        style={{
          flex: 1,
          padding: 16,
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  )
}
