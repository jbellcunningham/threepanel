'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Theme = 'system' | 'light' | 'dark'
type CurrentUserRole = 'USER' | 'TESTER' | 'ADMIN' | 'REPORTING'

type Settings = {
  appTitle: string
  theme: Theme
  hiddenSidebarTypes: string[]
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

type AdminUserEditForm = {
  email: string
  password: string
}

type SettingsTab = 'general' | 'admin'

type DbTableListItem = {
  name: string
  estimatedRowCount: number | null
}

type DbColumn = {
  name: string
  dataType: string
  isNullable: boolean
}

type DbInspectorTableResponse = {
  ok: true
  mode: 'table'
  table: string
  rowCount: number
  columns: DbColumn[]
  rows: Array<Record<string, unknown>>
}

type DbInspectorTablesResponse = {
  ok: true
  mode: 'tables'
  tables: DbTableListItem[]
}

type ContainerTypesResponse = {
  ok: true
  types: string[]
}

type UserSettingsApiResponse = {
  ok: true
  settings: {
    appTitle: string
    theme: Theme
    hiddenSidebarTypes: string[]
  }
}

type ContainerAccessUser = {
  id: string
  email: string
  role: CurrentUserRole
}

type ContainerAccessContainer = {
  id: string
  title: string
  type: string
  userId: string
  ownerEmail: string
  createdAt: string
}

type ContainerAccessGrant = {
  id: string
  userId: string
  trackerItemId: string
  accessType: string
  createdAt: string
}

type ContainerAccessResponse = {
  ok: true
  users: ContainerAccessUser[]
  containers: ContainerAccessContainer[]
  access: ContainerAccessGrant[]
}

function formatContainerTypeLabel(value: string) {
  if (value === 'tracker') return 'Tracker'
  if (value === 'todo') return 'To-Do'
  if (value === 'journal') return 'Journal'

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildAdminUserEditForms(users: AdminUserListItem[]) {
  const forms: Record<string, AdminUserEditForm> = {}

  for (const user of users) {
    forms[user.id] = {
      email: user.email,
      password: '',
    }
  }

  return forms
}

async function loadSettings(): Promise<Settings> {
  try {
    const res = await fetch('/api/user-settings', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        appTitle: 'ThreePanel',
        theme: 'system',
        hiddenSidebarTypes: [],
      }
    }

    const data = (await res.json().catch(() => null)) as UserSettingsApiResponse | null

    if (!data?.ok || !data.settings) {
      return {
        appTitle: 'ThreePanel',
        theme: 'system',
        hiddenSidebarTypes: [],
      }
    }

    return {
      appTitle:
        typeof data.settings.appTitle === 'string' && data.settings.appTitle.trim()
          ? data.settings.appTitle
          : 'ThreePanel',
      theme:
        data.settings.theme === 'light' ||
        data.settings.theme === 'dark' ||
        data.settings.theme === 'system'
          ? data.settings.theme
          : 'system',
      hiddenSidebarTypes: Array.isArray(data.settings.hiddenSidebarTypes)
        ? data.settings.hiddenSidebarTypes
            .map((value) => String(value).trim().toLowerCase())
            .filter(Boolean)
        : [],
    }
  } catch {
    return {
      appTitle: 'ThreePanel',
      theme: 'system',
      hiddenSidebarTypes: [],
    }
  }
}

async function saveSettings(s: Settings): Promise<boolean> {
  try {
    const res = await fetch('/api/user-settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })

    return res.ok
  } catch {
    return false
  }
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

function formatDbCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
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

async function loadContainerTypes(): Promise<string[]> {
  try {
    const res = await fetch('/api/container-types', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!res.ok) {
      return []
    }

    const data = (await res.json().catch(() => null)) as ContainerTypesResponse | null

    if (!data?.ok || !Array.isArray(data.types)) {
      return []
    }

    return data.types
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean)
  } catch {
    return []
  }
}

export default function SettingsPage() {
  const router = useRouter()
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [adminMsg, setAdminMsg] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [adminUserEditForms, setAdminUserEditForms] = useState<Record<string, AdminUserEditForm>>({})

  const [dbTables, setDbTables] = useState<DbTableListItem[]>([])
  const [dbInspectorLoading, setDbInspectorLoading] = useState(false)
  const [dbInspectorError, setDbInspectorError] = useState<string | null>(null)
  const [selectedDbTable, setSelectedDbTable] = useState('')
  const [dbColumns, setDbColumns] = useState<DbColumn[]>([])
  const [dbRows, setDbRows] = useState<Array<Record<string, unknown>>>([])
  const [dbRowCount, setDbRowCount] = useState<number | null>(null)

  const [availableSidebarTypes, setAvailableSidebarTypes] = useState<string[]>([])

  const [accessUsers, setAccessUsers] = useState<ContainerAccessUser[]>([])
  const [accessContainers, setAccessContainers] = useState<ContainerAccessContainer[]>([])
  const [accessGrants, setAccessGrants] = useState<ContainerAccessGrant[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [selectedAccessUserId, setSelectedAccessUserId] = useState('')
  const [selectedAccessContainerId, setSelectedAccessContainerId] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s)
      applyTheme(s.theme)
    })

    loadCurrentUser().then((user) => {
      setCurrentUser(user)
    })
    loadContainerTypes().then((types) => {
      setAvailableSidebarTypes(types)
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
        setAdminUserEditForms(buildAdminUserEditForms(users))
      })
      .finally(() => {
        setAdminUsersLoading(false)
      })
  }, [currentUser])

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN' || settingsTab !== 'admin') {
      return
    }

    loadDbTables()
  }, [currentUser, settingsTab])

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN' || settingsTab !== 'admin' || !selectedDbTable) {
      return
    }

    loadDbTable(selectedDbTable)
  }, [currentUser, settingsTab, selectedDbTable])

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN' || settingsTab !== 'admin') {
      return
    }

    loadContainerAccess()
  }, [currentUser, settingsTab])

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

function toggleSidebarType(type: string) {
  if (!settings) return

  const normalizedType = type.trim().toLowerCase()
  const exists = settings.hiddenSidebarTypes.includes(normalizedType)

  const nextHiddenSidebarTypes = exists
    ? settings.hiddenSidebarTypes.filter((value) => value !== normalizedType)
    : [...settings.hiddenSidebarTypes, normalizedType]

  setSettings({
    ...settings,
    hiddenSidebarTypes: nextHiddenSidebarTypes,
  })

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

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })

    router.push('/login')
  }

  function applyTypeFilter(nextType: string) {
    setShowMenu(false)

    if (!nextType) {
      router.push('/app/containers')
      return
    }

    router.push(`/app/containers?type=${encodeURIComponent(nextType)}`)
  }

  async function refreshAdminUsers() {
    if (currentUser?.role !== 'ADMIN') {
      return
    }

    setAdminUsersLoading(true)

    try {
      const users = await loadAdminUsers()
      setAdminUsers(users)
      setAdminUserEditForms(buildAdminUserEditForms(users))
    } finally {
      setAdminUsersLoading(false)
    }
  }

  async function loadDbTables() {
    if (currentUser?.role !== 'ADMIN') {
      return
    }

    setDbInspectorLoading(true)
    setDbInspectorError(null)

    try {
      const res = await fetch('/api/admin/db', {
        credentials: 'include',
        cache: 'no-store',
      })

      const raw = await res.text()

      let data: DbInspectorTablesResponse | { ok?: false; error?: string } | null = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.ok !== true || data.mode !== 'tables') {
        setDbTables([])
        setDbInspectorError((data as any)?.error || raw || 'Failed to load database tables')
        return
      }

      setDbTables(data.tables)

      if (data.tables.length > 0 && !selectedDbTable) {
        setSelectedDbTable(data.tables[0].name)
      }
    } finally {
      setDbInspectorLoading(false)
    }
  }

  async function loadDbTable(tableName: string) {
    if (currentUser?.role !== 'ADMIN' || !tableName) {
      return
    }

    setDbInspectorLoading(true)
    setDbInspectorError(null)

    try {
      const res = await fetch(`/api/admin/db?table=${encodeURIComponent(tableName)}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      const raw = await res.text()

      let data: DbInspectorTableResponse | { ok?: false; error?: string } | null = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.ok !== true || data.mode !== 'table') {
        setDbColumns([])
        setDbRows([])
        setDbRowCount(null)
        setDbInspectorError((data as any)?.error || raw || 'Failed to load table data')
        return
      }

      setDbColumns(data.columns)
      setDbRows(data.rows)
      setDbRowCount(data.rowCount)
    } finally {
      setDbInspectorLoading(false)
    }
  }

  async function loadContainerAccess() {
    if (currentUser?.role !== 'ADMIN') {
      return
    }

    setAccessLoading(true)
    setAdminError(null)

    try {
      const res = await fetch('/api/admin/container-access', {
        credentials: 'include',
        cache: 'no-store',
      })

      const raw = await res.text()

      let data: ContainerAccessResponse | { ok?: false; error?: string } | null = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.ok !== true) {
        setAccessUsers([])
        setAccessContainers([])
        setAccessGrants([])
        setAdminError((data as any)?.error || raw || 'Failed to load container access')
        return
      }

      setAccessUsers(data.users)
      setAccessContainers(data.containers)
      setAccessGrants(data.access)

      if (data.users.length > 0 && !selectedAccessUserId) {
        setSelectedAccessUserId(data.users[0].id)
      }

      if (data.containers.length > 0 && !selectedAccessContainerId) {
        setSelectedAccessContainerId(data.containers[0].id)
      }
    } finally {
      setAccessLoading(false)
    }
  }

  async function grantContainerReadAccess() {
    if (!selectedAccessUserId || !selectedAccessContainerId) {
      return
    }

    setAdminMsg(null)
    setAdminError(null)

    const res = await fetch('/api/admin/container-access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedAccessUserId,
        trackerItemId: selectedAccessContainerId,
        accessType: 'read',
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
      setAdminError(data?.error || raw || 'Failed to grant container access')
      return
    }

    setAdminMsg('Container access granted.')
    await loadContainerAccess()
  }

  async function revokeContainerReadAccess(userId: string, trackerItemId: string) {
    setAdminMsg(null)
    setAdminError(null)

    const res = await fetch('/api/admin/container-access', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        trackerItemId,
        accessType: 'read',
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
      setAdminError(data?.error || raw || 'Failed to revoke container access')
      return
    }

    setAdminMsg('Container access revoked.')
    await loadContainerAccess()
  }


async function onSave() {
  if (!settings) return

  const cleanedAvailableTypes = availableSidebarTypes
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)

  const cleanedHiddenSidebarTypes = settings.hiddenSidebarTypes
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .filter((value) => cleanedAvailableTypes.includes(value))

  const cleaned: Settings = {
    appTitle: settings.appTitle.trim() || 'ThreePanel',
    theme: settings.theme,
    hiddenSidebarTypes: cleanedHiddenSidebarTypes,
  }

  const ok = await saveSettings(cleaned)

  if (!ok) {
    setSavedMsg('Save failed.')
    window.setTimeout(() => setSavedMsg(null), 1600)
    return
  }

  setSettings(cleaned)
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

  function updateAdminUserEditForm(
    userId: string,
    key: keyof AdminUserEditForm,
    value: string
  ) {
    setAdminUserEditForms((prev) => ({
      ...prev,
      [userId]: {
        email: prev[userId]?.email ?? '',
        password: prev[userId]?.password ?? '',
        [key]: value,
      },
    }))
    setAdminMsg(null)
    setAdminError(null)
  }

  async function saveAdminUserProfile(userId: string) {
    const form = adminUserEditForms[userId]
    if (!form) {
      return
    }

    const email = form.email.trim().toLowerCase()
    const password = form.password

    if (!email && !password) {
      setAdminError('Enter an email and/or password update first')
      return
    }

    setUpdatingUserId(userId)
    setAdminMsg(null)
    setAdminError(null)

    const payload: { email?: string; password?: string } = {}

    if (email) payload.email = email
    if (password) payload.password = password

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const raw = await res.text()

    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!res.ok || !data?.ok) {
      setAdminError(data?.error || raw || 'Failed to update user profile')
      setUpdatingUserId(null)
      return
    }

    setAdminMsg('User profile updated.')
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
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          position: 'relative',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Settings</h1>
          <p style={{ opacity: 0.75, marginTop: 0 }}>
            Manage your app title, appearance, navigation preferences, and admin tools.
          </p>
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
              height: 36,
              width: 36,
              borderRadius: 8,
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
                top: 44,
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
              <button
                type="button"
                onClick={() => applyTypeFilter('')}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                All
              </button>

              {availableSidebarTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => applyTypeFilter(type)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {formatContainerTypeLabel(type)}
                </button>
              ))}

              <div
                style={{
                  height: 1,
                  background: 'rgba(0,0,0,0.08)',
                  margin: '4px 0',
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/reporting')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Reporting
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/settings')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                }}
              >
                Settings
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/feedback')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Give Feedback
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  router.push('/app/notifications')
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Notifications
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  logout()
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setSettingsTab('general')}
          style={{
            height: 34,
            padding: '0 12px',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.12)',
            background: settingsTab === 'general' ? 'rgba(0,0,0,0.08)' : 'transparent',
            fontWeight: settingsTab === 'general' ? 700 : 400,
          }}
        >
          General
        </button>

        {currentUser?.role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => setSettingsTab('admin')}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.12)',
              background: settingsTab === 'admin' ? 'rgba(0,0,0,0.08)' : 'transparent',
              fontWeight: settingsTab === 'admin' ? 700 : 400,
            }}
          >
            Admin
          </button>
        )}
      </section>

      {settingsTab === 'general' && (
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
                We’ll use this to label the app header and browser title.
              </p>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                  Sidebar Container Types
                </div>

                {availableSidebarTypes.length === 0 ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    No container types found yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {availableSidebarTypes.map((type) => {
                      const hidden = settings.hiddenSidebarTypes.includes(type)
                      const selected = !hidden

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleSidebarType(type)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.12)',
                            background: selected ? 'rgba(0,0,0,0.08)' : 'transparent',
                            fontWeight: selected ? 700 : 400,
                          }}
                        >
                          {formatContainerTypeLabel(type)}
                        </button>
                      )
                    })}
                  </div>
                )}

                <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  Choose which container types are available in app navigation. By default, all existing types are shown. Click a type to hide or show it.
                </p>
              </div>              
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
      )}

      {currentUser?.role === 'ADMIN' && settingsTab === 'admin' && (
        <section
          style={{
            marginTop: 16,
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Admin</h2>
            <>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 12, marginBottom: 12 }}>
                User management and read-only database inspection for testing and administration.
              </div>
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => router.push('/app/admin/feedback')}
                  style={{ height: 36, padding: '0 12px' }}
                >
                  Open Feedback Tracker
                </button>
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
              <option value="REPORTING">REPORTING</option>
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
            <h3 style={{ margin: 0, fontSize: 16 }}>Database Inspector</h3>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedDbTable}
                onChange={(e) => setSelectedDbTable(e.target.value)}
                style={{ padding: '10px 12px', minWidth: 240 }}
              >
                {dbTables.length === 0 ? (
                  <option value="">No tables found</option>
                ) : (
                  dbTables.map((table) => (
                    <option key={table.name} value={table.name}>
                      {table.name}
                      {typeof table.estimatedRowCount === 'number'
                        ? ` (${table.estimatedRowCount})`
                        : ''}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={() => {
                  loadDbTables()
                  if (selectedDbTable) {
                    loadDbTable(selectedDbTable)
                  }
                }}
                style={{ height: 38, padding: '0 14px' }}
              >
                Refresh
              </button>
            </div>

            {dbInspectorError && (
              <div style={{ fontSize: 12, color: 'crimson' }}>{dbInspectorError}</div>
            )}

            {selectedDbTable && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Row count: {dbRowCount ?? '—'} • Showing up to 50 rows
              </div>
            )}

            {dbColumns.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Columns</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {dbColumns.map((column) => (
                    <div
                      key={column.name}
                      style={{
                        border: '1px solid rgba(0,0,0,0.10)',
                        borderRadius: 999,
                        padding: '4px 8px',
                        fontSize: 12,
                      }}
                    >
                      {column.name} ({column.dataType}
                      {column.isNullable ? ', nullable' : ', required'})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dbInspectorLoading ? (
              <div>Loading database info...</div>
            ) : dbRows.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No rows to display.</div>
            ) : (
              <div
                style={{
                  overflowX: 'auto',
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 8,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {dbColumns.map((column) => (
                        <th
                          key={column.name}
                          style={{
                            textAlign: 'left',
                            padding: '8px',
                            borderBottom: '1px solid rgba(0,0,0,0.10)',
                            background: 'rgba(0,0,0,0.03)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {dbColumns.map((column) => (
                          <td
                            key={column.name}
                            style={{
                              padding: '8px',
                              borderBottom: '1px solid rgba(0,0,0,0.06)',
                              verticalAlign: 'top',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {formatDbCellValue(row[column.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
            <h3 style={{ margin: 0, fontSize: 16 }}>Container Access</h3>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={selectedAccessUserId}
                onChange={(e) => setSelectedAccessUserId(e.target.value)}
                style={{ padding: '10px 12px', minWidth: 220 }}
              >
                {accessUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role})
                  </option>
                ))}
              </select>

              <select
                value={selectedAccessContainerId}
                onChange={(e) => setSelectedAccessContainerId(e.target.value)}
                style={{ padding: '10px 12px', minWidth: 260 }}
              >
                {accessContainers.map((container) => (
                  <option key={container.id} value={container.id}>
                    {container.title} ({container.type}) — {container.ownerEmail}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={grantContainerReadAccess}
                style={{ height: 38, padding: '0 14px' }}
              >
                Grant Read Access
              </button>
            </div>

            {accessLoading ? (
              <div>Loading container access...</div>
            ) : accessGrants.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No container access grants yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {accessGrants.map((grant) => {
                  const user = accessUsers.find((item) => item.id === grant.userId)
                  const container = accessContainers.find((item) => item.id === grant.trackerItemId)

                  return (
                    <div
                      key={grant.id}
                      style={{
                        border: '1px solid rgba(0,0,0,0.10)',
                        borderRadius: 8,
                        padding: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {user?.email || grant.userId}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {container?.title || grant.trackerItemId} • {grant.accessType}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Granted: {formatDate(grant.createdAt)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => revokeContainerReadAccess(grant.userId, grant.trackerItemId)}
                        style={{
                          height: 32,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(0,0,0,0.12)',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
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
                      <option value="REPORTING">REPORTING</option>
                    </select>
                    <input
                      value={adminUserEditForms[user.id]?.email ?? user.email}
                      onChange={(e) =>
                        updateAdminUserEditForm(user.id, 'email', e.target.value)
                      }
                      placeholder="Email"
                      disabled={updatingUserId === user.id}
                      style={{ padding: '8px 10px', minWidth: 220 }}
                    />
                    <input
                      type="password"
                      value={adminUserEditForms[user.id]?.password ?? ''}
                      onChange={(e) =>
                        updateAdminUserEditForm(user.id, 'password', e.target.value)
                      }
                      placeholder="New password (optional)"
                      disabled={updatingUserId === user.id}
                      style={{ padding: '8px 10px', minWidth: 220 }}
                    />
                    <button
                      type="button"
                      title="Save email/password updates"
                      onClick={() => saveAdminUserProfile(user.id)}
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
                      Save Profile
                    </button>
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
        </section>
      )}

      {settingsTab === 'general' && (
      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onSave} disabled={!canSave} style={{ height: 38, padding: '0 14px' }}>
          Save
        </button>
        {savedMsg && <span style={{ fontSize: 12, opacity: 0.8 }}>{savedMsg}</span>}
      </div>
      )}
    </main>
  )
}
