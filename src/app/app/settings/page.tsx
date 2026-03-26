'use client'

import { useEffect, useMemo, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'
type CurrentUserRole = 'USER' | 'TESTER' | 'ADMIN'

type Settings = {
  appTitle: string
  theme: Theme
}

type CurrentUser = {
  id: string
  email: string
  role: CurrentUserRole
  createdAt: string
  updatedAt: string
}

type AdminUserListItem = {
  id: string
  email: string
  role: CurrentUserRole
  createdAt: string
  updatedAt: string
}

type CreateUserForm = {
  email: string
  password: string
  role: CurrentUserRole
}

const STORAGE_KEY = 'threepanel_settings_v1'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { appTitle: 'ThreePanel', theme: 'system' }

    const parsed = JSON.parse(raw) as Partial<Settings>

    return {
      appTitle: typeof parsed.appTitle === 'string' ? parsed.appTitle : 'ThreePanel',
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
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
  const root = document.documentElement
  root.dataset.theme = theme
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function loadCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch('/api/me', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json().catch(() => null)

    if (!data?.user) {
      return null
    }

    return data.user as CurrentUser
  } catch {
    return null
  }
}

async function loadAdminUsers(): Promise<AdminUserListItem[]> {
  try {
    const res = await fetch('/api/admin/users', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!res.ok) {
      return []
    }

    const data = await res.json().catch(() => null)

    if (!data?.ok || !Array.isArray(data.users)) {
      return []
    }

    return data.users as AdminUserListItem[]
  } catch {
    return []
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    role: 'USER',
  })

  const [creatingUser, setCreatingUser] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [showCurrentUserSettings, setShowCurrentUserSettings] = useState(true)
  const [showAdminSection, setShowAdminSection] = useState(false)
  const [adminMsg, setAdminMsg] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    const s = loadSettings()
    setSettings(s)
    applyTheme(s.theme)

    loadCurrentUser().then((user) => {
      setCurrentUser(user)
    })
  }, [])

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      return
    }

    setAdminUsersLoading(true)

    loadAdminUsers()
      .then((users) => {
        setAdminUsers(users)
      })
      .finally(() => {
        setAdminUsersLoading(false)
      })
  }, [currentUser])

  const canSave = useMemo(() => !!settings?.appTitle.trim(), [settings])

  const canCreateUser = useMemo(() => {
    return (
      !!createUserForm.email.trim() &&
      !!createUserForm.password &&
      createUserForm.password.length >= 8 &&
      !creatingUser
    )
  }, [createUserForm, creatingUser])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSavedMsg(null)
  }

  function updateCreateUserForm<K extends keyof CreateUserForm>(
    key: K,
    value: CreateUserForm[K]
  ) {
    setCreateUserForm((prev) => ({
      ...prev,
      [key]: value,
    }))
    setAdminMsg(null)
    setAdminError(null)
  }

  async function refreshAdminUsers() {
    if (currentUser?.role !== 'ADMIN') {
      return
    }

    setAdminUsersLoading(true)

    try {
      const users = await loadAdminUsers()
      setAdminUsers(users)
    } finally {
      setAdminUsersLoading(false)
    }
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

  async function onCreateUser() {
    if (!canCreateUser) return

    setCreatingUser(true)
    setAdminMsg(null)
    setAdminError(null)

    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: createUserForm.email.trim(),
        password: createUserForm.password,
        role: createUserForm.role,
      }),
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setAdminError(data?.error || raw || 'Failed to create user')
      setCreatingUser(false)
      return
    }

    setCreateUserForm({
      email: '',
      password: '',
      role: 'USER',
    })
    setAdminMsg('User created.')
    setCreatingUser(false)
    await refreshAdminUsers()
  }

  async function updateUserRole(userId: string, role: CurrentUserRole) {
    setUpdatingUserId(userId)
    setAdminMsg(null)
    setAdminError(null)

    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setAdminError(data?.error || raw || 'Failed to update user role')
      setUpdatingUserId(null)
      return
    }

    setAdminMsg('User role updated.')
    setUpdatingUserId(null)
    await refreshAdminUsers()
  }

  async function deleteUser(userId: string, email: string) {
    const confirmed = confirm(
      `Delete user "${email}"?\n\nThis will permanently delete all of their containers and data.`
    )

    if (!confirmed) return

    setUpdatingUserId(userId)
    setAdminMsg(null)
    setAdminError(null)

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setAdminError(data?.error || raw || 'Failed to delete user')
      setUpdatingUserId(null)
      return
    }

    setAdminMsg('User deleted.')
    setUpdatingUserId(null)
    await refreshAdminUsers()
  }

  if (!settings) return <main>Loading…</main>

  return (
    <main style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        This is a starter Settings panel. Right now it saves to your browser only
        (localStorage). Next we can store this per-user in Postgres.
      </p>

      <section
        style={{
          marginTop: 16,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Current User Settings</h2>

          <button
            type="button"
            onClick={() => setShowCurrentUserSettings((prev) => !prev)}
            style={{ height: 36, padding: '0 12px' }}
          >
            {showCurrentUserSettings ? 'Hide' : 'Show'}
          </button>
        </div>

        {showCurrentUserSettings && (
          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            <section
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: 18 }}>Account</h3>

              <div style={{ fontSize: 14, marginBottom: 6 }}>
                <strong>Email:</strong> {currentUser?.email || 'Loading...'}
              </div>

              <div style={{ fontSize: 14 }}>
                <strong>Role:</strong> {currentUser?.role || 'Loading...'}
              </div>
            </section>

            <section
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: 18 }}>Branding</h3>

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

            <section
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: 18 }}>Appearance</h3>

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
          </div>
        )}
      </section>

      {currentUser?.role === 'ADMIN' && (
        <section
          style={{
            marginTop: 16,
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Admin</h2>

            <button
              type="button"
              onClick={() => setShowAdminSection((prev) => !prev)}
              style={{ height: 36, padding: '0 12px' }}
            >
              {showAdminSection ? 'Hide' : 'Show'}
            </button>
          </div>

          {showAdminSection && (
            <>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 12, marginBottom: 12 }}>
                User management for testing and administration.
              </div>

          <section
            style={{
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Create User</h3>

            <input
              value={createUserForm.email}
              onChange={(e) => updateCreateUserForm('email', e.target.value)}
              placeholder="Email"
              style={{ padding: '10px 12px' }}
            />

            <input
              type="password"
              value={createUserForm.password}
              onChange={(e) => updateCreateUserForm('password', e.target.value)}
              placeholder="Password"
              style={{ padding: '10px 12px' }}
            />

            <select
              value={createUserForm.role}
              onChange={(e) =>
                updateCreateUserForm('role', e.target.value as CurrentUserRole)
              }
              style={{ padding: '10px 12px' }}
            >
              <option value="USER">USER</option>
              <option value="TESTER">TESTER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={onCreateUser}
                disabled={!canCreateUser}
                style={{ height: 38, padding: '0 14px' }}
              >
                {creatingUser ? 'Creating...' : 'Create User'}
              </button>

              {adminMsg && <span style={{ fontSize: 12, color: 'green' }}>{adminMsg}</span>}
              {adminError && (
                <span style={{ fontSize: 12, color: 'crimson' }}>{adminError}</span>
              )}
            </div>
          </section>

          {adminUsersLoading ? (
            <div>Loading users...</div>
          ) : adminUsers.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No users found.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {adminUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    border: '1px solid rgba(0,0,0,0.10)',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{user.email}</div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Role:</span>

                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateUserRole(user.id, e.target.value as CurrentUserRole)
                      }
                      disabled={updatingUserId === user.id}
                      style={{ padding: '8px 10px' }}
                    >
                      <option value="USER">USER</option>
                      <option value="TESTER">TESTER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button
                      type="button"
                      title="Delete user"
                      onClick={() => deleteUser(user.id, user.email)}
                      disabled={updatingUserId === user.id}
                      style={{
                        height: 32,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>

                    {updatingUserId === user.id ? (
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Updating...</span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                    Created: {formatDate(user.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </section>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onSave} disabled={!canSave} style={{ height: 38, padding: '0 14px' }}>
          Save
        </button>
        {savedMsg && <span style={{ fontSize: 12, opacity: 0.8 }}>{savedMsg}</span>}
      </div>
    </main>
  )
}
