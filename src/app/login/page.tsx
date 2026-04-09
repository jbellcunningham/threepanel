'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Login</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px 12px' }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px 12px' }}
        />

        {error && <div style={{ color: 'crimson' }}>{error}</div>}

        <button type="submit" disabled={loading} style={{ padding: '10px 12px' }}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </main>
  )
}
