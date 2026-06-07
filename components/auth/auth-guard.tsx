'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import posthog from 'posthog-js'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login')
        return
      }

      setSession(data.session)
      setChecking(false)
      if (data.session?.user) posthog.identify(data.session.user.id, { email: data.session.user.email })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        router.replace('/login')
        return
      }

      setSession(nextSession)
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (checking || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-pulse rounded-full bg-yellow-400" />
          <p className="text-sm text-slate-300">Validating session...</p>
        </div>
      </main>
    )
  }

  return children
}
