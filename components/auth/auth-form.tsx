'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

type AuthFormProps = {
  mode: 'login' | 'signup'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSignup = mode === 'signup'

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/callback` },
        })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (isSignup && !result.data.session) {
      setMessage('Account created. Check your email to confirm access.')
      return
    }

    router.replace(isSignup ? '/setup' : '/dashboard')
  }

  const handleGoogleAuth = async () => {
    setLoading(true)
    setError(null)

    const { error: oauthError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
        scopes: 'openid email profile',
      },
    })

    if (oauthError) {
      setLoading(false)
      setError(oauthError.message)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1fr_440px]">
        <section className="hidden flex-col justify-between px-10 py-10 lg:flex">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-yellow-400 text-slate-950">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Vendas+IA</p>
              <p className="text-sm text-slate-400">Email Prospecting</p>
            </div>
          </Link>

          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-yellow-300">
              Self-service
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-tight">
              AI-powered email prospecting trained on your business.
            </h1>
            <p className="mt-5 text-lg text-slate-300">
              First the AI understands your context, objections, and goal. Then it suggests
              cadences, templates, and send windows — operating with human approval.
            </p>
          </div>

          <p className="text-sm text-slate-500">Landing page preserved on the main domain.</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
            <div>
              <h2 className="text-2xl font-semibold">{isSignup ? 'Create account' : 'Sign in'}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {isSignup
                  ? 'Create your account and connect Gmail in under 5 minutes.'
                  : 'Welcome back. Sign in to continue.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Mail className="h-4 w-4" />
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {message ? (
                <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Processing...' : isSignup ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-600">
              {isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
              <Link
                href={isSignup ? '/login' : '/signup'}
                className="font-semibold text-slate-950 underline decoration-yellow-400 decoration-2 underline-offset-4"
              >
                {isSignup ? 'Sign in' : 'Create account'}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
