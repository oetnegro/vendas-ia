'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'

type TokenRow = {
  id: string
  name: string
  token_prefix: string
  scopes: string[]
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

type ScopeKey = 'read' | 'write' | 'send'

const SCOPE_INFO: { key: ScopeKey; label: string; helper: string; locked?: boolean }[] = [
  { key: 'read', label: 'Read', helper: 'Query campaigns, funnel, replies, and leads.', locked: true },
  { key: 'write', label: 'Write', helper: 'Create campaign drafts, find leads, pause/resume.' },
  { key: 'send', label: 'Send', helper: 'Reserved for sending (no tool sends email directly today).' },
]

async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabaseBrowserClient().auth.getSession()
  return data.session?.access_token || null
}

export function McpIntegrationPanel() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<Record<ScopeKey, boolean>>({ read: true, write: true, send: false })
  const [creating, setCreating] = useState(false)
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState<'token' | 'command' | null>(null)

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'

  const loadTokens = useCallback(async () => {
    if (workspaceLoading) return
    if (!workspace) {
      setLoading(false)
      setTokens([])
      return
    }
    setLoading(true)
    setError(null)
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setError('Session not found. Reload the page.')
      setLoading(false)
      return
    }
    const res = await fetch(`/api/mcp-tokens?workspaceId=${workspace.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to load tokens.')
      setLoading(false)
      return
    }
    setTokens(json.tokens || [])
    setLoading(false)
  }, [workspace, workspaceLoading])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadTokens()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadTokens])

  const handleCreate = async () => {
    if (!workspace) return
    if (!name.trim()) {
      setError('Give the token a name (e.g., "John\'s Claude Desktop").')
      return
    }
    setCreating(true)
    setError(null)
    setPlaintext(null)

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setError('Session not found. Reload the page.')
      setCreating(false)
      return
    }

    const selected = (Object.keys(scopes) as ScopeKey[]).filter((k) => scopes[k])
    const res = await fetch('/api/mcp-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ workspaceId: workspace.id, name: name.trim(), scopes: selected }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to generate token.')
      setCreating(false)
      return
    }

    setPlaintext(json.token)
    setName('')
    setCreating(false)
    await loadTokens()
  }

  const handleRevoke = async (id: string) => {
    const accessToken = await getAccessToken()
    if (!accessToken) return
    const res = await fetch(`/api/mcp-tokens/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) await loadTokens()
  }

  const copy = async (value: string, which: 'token' | 'command') => {
    await navigator.clipboard.writeText(value)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const claudeCommand = `claude mcp add --transport http vendas-ia ${mcpUrl} --header "Authorization: Bearer YOUR_TOKEN"`

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-yellow-600">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">MCP Integration</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Connect Vendas+IA to Claude Desktop, Cursor, or Codex and operate the platform in natural
          language: &quot;how many leads replied this week?&quot;, &quot;create a campaign draft for SaaS CTOs&quot;,
          &quot;pause campaign X&quot;. Generate an access token below.
        </p>
      </div>

      {/* Geração de token */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-950">Generate new token</h2>
        <p className="mt-1 text-sm text-slate-500">
          The token is shown <strong>only once</strong>. Copy and store it securely — it will not be
          displayed again.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name (e.g., John's Claude Desktop)"
            disabled={creating || !workspace}
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !workspace || workspaceLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate token
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {SCOPE_INFO.map((scope) => (
            <label
              key={scope.key}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                scopes[scope.key] ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
              } ${scope.locked ? 'cursor-default opacity-90' : ''}`}
            >
              <input
                type="checkbox"
                checked={scopes[scope.key]}
                disabled={scope.locked}
                onChange={(e) => setScopes((prev) => ({ ...prev, [scope.key]: e.target.checked }))}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {scope.label}
                  {scope.locked ? ' (always)' : ''}
                </span>
                <span className="block text-xs leading-5 text-slate-500">{scope.helper}</span>
              </span>
            </label>
          ))}
        </div>

        {plaintext ? (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
              <TriangleAlert className="h-4 w-4" />
              Copy now — it will not be shown again.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-amber-200 bg-white px-3 py-2 text-xs text-slate-800">
                {plaintext}
              </code>
              <button
                type="button"
                onClick={() => copy(plaintext, 'token')}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                {copied === 'token' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      {/* Lista de tokens */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-950">Workspace tokens</h2>
        {loading || workspaceLoading ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </p>
        ) : tokens.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No tokens generated yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {tokens.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t.name}
                    {t.revoked_at ? (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        revoked
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        active
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <code>{t.token_prefix}…</code> · scopes: {t.scopes.join(', ')} · last used:{' '}
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleString('en-US') : 'never'}
                  </p>
                </div>
                {!t.revoked_at ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(t.id)}
                    className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Instruções de conexão */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Plug className="h-4 w-4 text-yellow-600" /> How to connect
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          In your terminal (with Claude Code/Desktop installed), run the command below replacing{' '}
          <code>YOUR_TOKEN</code> with the token you generated:
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
            {claudeCommand}
          </code>
          <button
            type="button"
            onClick={() => copy(claudeCommand, 'command')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {copied === 'command' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          URL do servidor MCP: <code>{mcpUrl}</code>
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          No tool sends email directly. All sends go through the platform&apos;s approval flow.
        </p>
      </section>
    </div>
  )
}
