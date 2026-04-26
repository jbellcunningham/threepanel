import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOverdueTodoCountForUser } from '@/lib/overdueTodos'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const overdueCount = await getOverdueTodoCountForUser(user.id)

  return NextResponse.json({
    ok: true,
    overdueCount,
  })
}
