'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const finishAuth = async () => {
      const supabase = getSupabaseBrowserClient()
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (!code) {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          router.replace('/login')
          return
        }
        await redirectBasedOnWorkspace()
        return
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        setError('Could not validate your session. Please try signing in again.')
        return
      }

      await redirectBasedOnWorkspace()
    }

    const redirectBasedOnWorkspace = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        router.replace('/login')
        return
      }

      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userData.user.id)
        .limit(1)

      if (memberships?.length) {
        router.replace('/dashboard')
      } else {
        router.replace('/setup')
      }
    }

    void finishAuth()
  }, [router])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 h-10 w-10 animate-pulse rounded-full bg-yellow-400" />
        <h1 className="text-2xl font-semibold">Completing sign-in</h1>
        <p className="mt-3 text-sm text-slate-300">
          Validating your session and preparing your workspace.
        </p>
        {error ? (
          <div className="mt-6 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
            <p>{error}</p>
            <Link href="/login" className="mt-3 inline-block font-semibold text-yellow-300">
              Back to login
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}
