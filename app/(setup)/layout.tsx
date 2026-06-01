import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/auth/auth-guard'

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">{children}</div>
    </AuthGuard>
  )
}
