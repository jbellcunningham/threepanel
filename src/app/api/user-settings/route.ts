import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

type UserSettingsResponse = {
  ok: true
  settings: {
    appTitle: string
    theme: 'system' | 'light' | 'dark'
    hiddenSidebarTypes: string[]
  }
}

type UpdateUserSettingsBody = {
  appTitle?: unknown
  theme?: unknown
  hiddenSidebarTypes?: unknown
}

function normalizeTheme(value: unknown): 'system' | 'light' | 'dark' {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  return 'system'
}

function normalizeHiddenSidebarTypes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item: any) => String(item).trim().toLowerCase())
    .filter(Boolean)
}

function normalizeAppTitle(value: unknown): string {
  if (typeof value !== 'string') {
    return 'ThreePanel'
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : 'ThreePanel'
}

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await prisma.userSettings.findUnique({
    where: {
      userId: user.id,
    },
  })

  const response: UserSettingsResponse = {
    ok: true,
    settings: {
      appTitle:
        typeof settings?.appTitle === 'string' && settings.appTitle.trim()
          ? settings.appTitle
          : 'ThreePanel',
      theme: normalizeTheme(settings?.theme),
      hiddenSidebarTypes: normalizeHiddenSidebarTypes(settings?.hiddenSidebarTypes),
    },
  }

  return NextResponse.json(response)
}

export async function PUT(req: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: UpdateUserSettingsBody

  try {
    body = (await req.json()) as UpdateUserSettingsBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const appTitle = normalizeAppTitle(body.appTitle)
  const theme = normalizeTheme(body.theme)
  const hiddenSidebarTypes = normalizeHiddenSidebarTypes(body.hiddenSidebarTypes)

  const settings = await prisma.userSettings.upsert({
    where: {
      userId: user.id,
    },
    update: {
      appTitle,
      theme,
      hiddenSidebarTypes,
    },
    create: {
      userId: user.id,
      appTitle,
      theme,
      hiddenSidebarTypes,
    },
  })

  return NextResponse.json({
    ok: true,
    settings: {
      appTitle:
        typeof settings.appTitle === 'string' && settings.appTitle.trim()
          ? settings.appTitle
          : 'ThreePanel',
      theme: normalizeTheme(settings.theme),
      hiddenSidebarTypes: normalizeHiddenSidebarTypes(settings.hiddenSidebarTypes),
    },
  })
}
