'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

type FeedbackType = 'BUG' | 'IMPROVEMENT' | 'QUESTION' | 'OTHER'

export default function FeedbackPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [summary, setSummary] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<FeedbackType>('OTHER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canSubmit = message.trim().length > 0 && !submitting

  async function onSubmit() {
    if (!canSubmit) {
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: summary.trim(),
        message: message.trim(),
        type,
        pagePath: pathname,
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
      setError(data?.error || raw || 'Failed to submit feedback')
      setSubmitting(false)
      return
    }

    setSummary('')
    setMessage('')
    setType('OTHER')
    setSuccess('Thanks! Your feedback was submitted.')
    setSubmitting(false)
  }

  return (
    <main style={{ maxWidth: 720 }}>
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Give Feedback</h1>
          <p style={{ opacity: 0.75, marginTop: 0 }}>
            Share bugs, ideas, and improvement requests with the admin team.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          style={{ height: 36, padding: '0 12px' }}
        >
          Back
        </button>
      </section>

      <section
        style={{
          marginTop: 16,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 12,
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FeedbackType)}
            style={{ padding: '10px 12px' }}
          >
            <option value="BUG">Bug</option>
            <option value="IMPROVEMENT">Improvement</option>
            <option value="QUESTION">Question</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Short summary (optional)</label>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Example: Entry edit form loses focus"
            maxLength={200}
            style={{ padding: '10px 12px' }}
          />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Feedback</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what happened, expected behavior, and steps to reproduce if this is a bug."
            rows={8}
            style={{ padding: '10px 12px', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{ height: 38, padding: '0 14px' }}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
          {success && <span style={{ color: 'green', fontSize: 13 }}>{success}</span>}
          {error && <span style={{ color: 'crimson', fontSize: 13 }}>{error}</span>}
        </div>
      </section>
    </main>
  )
}
