'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Menu,
  MessageSquareText,
  Plug,
  Send,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import { useEffect, useRef, useState } from 'react'

const NAV_MAIN = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, highlight: false },
  { href: '/inbox', label: 'Inbox', icon: MessageSquareText, highlight: false },
  { href: '/leads', label: 'Leads', icon: Users, highlight: false },
  { href: '/leads/enrich', label: 'Find Leads', icon: Sparkles, highlight: true },
  { href: '/campaigns', label: 'Campaigns', icon: FileText, highlight: false },
]

const NAV_CONFIG = [
  { href: '/configurar', label: 'Configure', icon: Settings },
  { href: '/settings/integrations', label: 'MCP Integration', icon: Plug },
]

// ─────────────────────── Sidebar content ───────────────────────

type SidebarProps = {
  collapsed: boolean
  pathname: string
  workspace: ReturnType<typeof useWorkspace>['workspace']
  workspaces: ReturnType<typeof useWorkspace>['workspaces']
  selectWorkspace: ReturnType<typeof useWorkspace>['selectWorkspace']
  onNav?: () => void
  onSignOut: () => void
  onToggleCollapse?: () => void
}

function SidebarContent({
  collapsed,
  pathname,
  workspace,
  workspaces,
  selectWorkspace,
  onNav,
  onSignOut,
  onToggleCollapse,
}: SidebarProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const wsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/leads') return pathname === '/leads' || (pathname.startsWith('/leads') && !pathname.startsWith('/leads/enrich'))
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex h-16 shrink-0 items-center border-b border-white/10 ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'}`}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
          onClick={onNav}
          title="Dashboard"
        >
          <Send className="h-6 w-6 shrink-0 rotate-45 text-[#F4D58D]" strokeWidth={2.5} />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-base font-bold text-white">
                Vendas<span className="text-[#F4D58D]">+IA</span>
              </p>
              <p className="text-[10px] text-slate-400">Email Prospecting</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV_MAIN.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNav}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-[#F4D58D] text-[#1a2a38] shadow-sm'
                    : 'bg-[#F4D58D]/15 text-[#F4D58D] hover:bg-[#F4D58D]/25'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="flex flex-1 items-center justify-between">
                    {item.label}
                    <span className="rounded-full bg-[#F4D58D] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1a2a38]">
                      IA
                    </span>
                  </span>
                )}
              </Link>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              } ${
                active
                  ? 'bg-[#F4D58D] text-[#1a2a38] shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}

        <div className={`pt-4 mt-2 border-t border-white/10 ${collapsed ? '' : ''}`}>
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Configuration
            </p>
          )}
          {NAV_CONFIG.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNav}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-[#F4D58D] text-[#1a2a38] shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className={`shrink-0 border-t border-white/10 p-3 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Workspace switcher */}
        {!collapsed && workspaces.length > 1 ? (
          <div ref={wsRef} className="relative">
            <button
              type="button"
              onClick={() => setWorkspaceOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-[#F4D58D]" />
              <span className="flex-1 truncate text-left">{workspace?.name || 'Workspace'}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${workspaceOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {workspaceOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Workspaces
                </p>

                {workspaces.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      selectWorkspace(item.id)
                      setWorkspaceOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      item.id === workspace?.id
                        ? 'font-semibold text-[#2C3E50]'
                        : 'text-slate-600'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.id === workspace?.id ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    />
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : !collapsed && workspace ? (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="truncate">{workspace.name}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-300 transition hover:bg-red-500/20 hover:text-red-200 ${
            collapsed ? 'justify-center px-2' : 'gap-3 px-3'
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Sign out'}
        </button>

      </div>
    </div>
  )
}

// ─────────────────────── App shell ───────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { workspace, workspaces, selectWorkspace } = useWorkspace()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Fecha sidebar ao navegar
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const signOut = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    router.replace('/login')
  }

  const isInbox = pathname === '/inbox'

  const sidebarProps: SidebarProps = {
    collapsed,
    pathname,
    workspace,
    workspaces,
    selectWorkspace,
    onNav: () => setSidebarOpen(false),
    onSignOut: signOut,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* ── Desktop sidebar ── */}
      <div className={`relative hidden shrink-0 transition-all duration-200 lg:block ${collapsed ? 'w-14' : 'w-56'}`}>
        <aside className="flex h-full flex-col bg-[#1E2D3D]">
          <SidebarContent
            {...sidebarProps}
            onToggleCollapse={() => setCollapsed((v) => !v)}
          />
        </aside>
        {/* Collapse tab — floats on the right edge */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:bg-slate-50 hover:text-[#2C3E50]"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-56 bg-[#1E2D3D] lg:hidden">
            <SidebarContent {...sidebarProps} collapsed={false} />
          </aside>
        </>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Send className="h-5 w-5 rotate-45 text-[#2C3E50]" strokeWidth={2.5} />
            <span className="font-bold text-[#2C3E50]">
              Vendas<span className="text-[#B98A1D]">+IA</span>
            </span>
          </Link>
          <div className="h-9 w-9" />
        </header>

        {/* Page content */}
        <main className={isInbox ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto'}>
          {isInbox ? (
            children
          ) : (
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
          )}
        </main>
      </div>
    </div>
  )
}
