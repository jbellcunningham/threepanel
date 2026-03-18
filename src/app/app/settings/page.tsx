'use client'

import { useEffect, useMemo, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

type Settings = {
  appTitle: string
  theme: Theme
}

const STORAGE_KEY = 'threepanel_settings_v1'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { appTitle: 'ThreePanel', theme: 'system' }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      appTitle: typeof parsed.appTitle === 'string' ? parsed.appTitle : 'ThreePanel',
      theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
        ? parsed.theme
        : 'system',
    }
  } catch {
    return { appTitle: 'ThreePanel', theme: 'system' }
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function applyTheme(theme: Theme) {
  // Simple approach: add a data attribute to <html>
  // (Later we can swap to Tailwind/shadcn theming.)
  const root = document.documentElement
  root.dataset.theme = theme
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    applyTheme(s.theme)
  }, [])

  const canSave = useMemo(() => !!settings?.appTitle.trim(), [settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSavedMsg(null)
  }

  function onSave() {
    if (!settings) return
    const cleaned: Settings = {
      appTitle: settings.appTitle.trim() || 'ThreePanel',
      theme: settings.theme,
    }
    saveSettings(cleaned)
    window.dispatchEvent(new Event('threepanel-settings-changed'))
    applyTheme(cleaned.theme)
    setSavedMsg('Saved.')
    window.setTimeout(() => setSavedMsg(null), 1200)
  }

  if (!settings) return <main>Loading…</main>

  return (
    <main style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        This is a starter Settings panel. Right now it saves to your browser only (localStorage).
        Next we can store this per-user in Postgres.
      </p>

      <section style={{ marginTop: 20, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Branding</h2>

        <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
          App Title
        </label>
        <input
          value={settings.appTitle}
          onChange={(e) => update('appTitle', e.target.value)}
          placeholder="ThreePanel"
          style={{ width: '100%', padding: '10px 12px' }}
        />
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          We’ll use this to label the sidebar and the browser title.
        </p>
      </section>

      <section style={{ marginTop: 16, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Appearance</h2>

        <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
          Theme
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update('theme', t)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                fontWeight: settings.theme === t ? 700 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          For now, this sets <code>document.documentElement.dataset.theme</code>.
        </p>
      </section>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onSave} disabled={!canSave} style={{ height: 38, padding: '0 14px' }}>
          Save
        </button>
        {savedMsg && <span style={{ fontSize: 12, opacity: 0.8 }}>{savedMsg}</span>}
      </div>
    </main>
  )
}
