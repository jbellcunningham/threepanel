import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getTodoAgendaForUser } from '@/lib/todoAgenda'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const agenda = await getTodoAgendaForUser(user.id)

  return NextResponse.json({
    ok: true,
    ...agenda,
    totalCount: agenda.overdue.length + agenda.dueToday.length,
  })
}
