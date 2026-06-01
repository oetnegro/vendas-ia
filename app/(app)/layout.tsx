import type { ReactNode } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { AuthGuard } from '@/components/auth/auth-guard'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
