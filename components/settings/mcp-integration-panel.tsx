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
  { key: 'read', label: 'Leitura', helper: 'Consultar campanhas, funil, respostas e leads.', locked: true },
  { key: 'write', label: 'Escrita', helper: 'Criar rascunho de campanha, buscar leads, pausar/retomar.' },
  { key: 'send', label: 'Envio', helper: 'Reservado para envios (nenhuma tool envia e-mail direto hoje).' },
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
      setError('Sessão não encontrada. Recarregue a página.')
      setLoading(false)
      return
    }
    const res = await fetch(`/api/mcp-tokens?workspaceId=${workspace.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Falha ao carregar tokens.')
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
      setError('Dê um nome ao token (ex.: "Claude Desktop do João").')
      return
    }
    setCreating(true)
    setError(null)
    setPlaintext(null)

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setError('Sessão não encontrada. Recarregue a página.')
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
      setError(json.error || 'Falha ao gerar token.')
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

  const claudeCommand = `claude mcp add --transport http vendas-ia ${mcpUrl} --header "Authorization: Bearer SEU_TOKEN"`

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-yellow-600">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Integração MCP</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Conecte o Vendas+IA ao Claude Desktop, Cursor ou Codex e opere a plataforma por linguagem
          natural: &quot;quantos leads responderam essa semana?&quot;, &quot;cria um rascunho de campanha pra CTOs de
          SaaS&quot;, &quot;pausa a campanha X&quot;. Gere um token de acesso abaixo.
        </p>
      </div>

      {/* Geração de token */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-950">Gerar novo token</h2>
        <p className="mt-1 text-sm text-slate-500">
          O token aparece <strong>uma única vez</strong>. Copie e guarde com segurança — ele não será
          exibido novamente.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do token (ex.: Claude Desktop do João)"
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
            Gerar token
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
                  {scope.locked ? ' (sempre)' : ''}
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
              Copie agora — não será exibido de novo.
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
                Copiar
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
        <h2 className="text-sm font-semibold text-slate-950">Tokens do workspace</h2>
        {loading || workspaceLoading ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </p>
        ) : tokens.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum token gerado ainda.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {tokens.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t.name}
                    {t.revoked_at ? (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        revogado
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ativo
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <code>{t.token_prefix}…</code> · scopes: {t.scopes.join(', ')} · último uso:{' '}
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleString('pt-BR') : 'nunca'}
                  </p>
                </div>
                {!t.revoked_at ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(t.id)}
                    className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revogar
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
          <Plug className="h-4 w-4 text-yellow-600" /> Como conectar
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          No terminal (com o Claude Code/Desktop instalado), rode o comando abaixo trocando{' '}
          <code>SEU_TOKEN</code> pelo token que você gerou:
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
            Copiar
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          URL do servidor MCP: <code>{mcpUrl}</code>
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Nenhuma tool envia e-mail diretamente. Envios sempre passam pelo fluxo de aprovação da
          plataforma.
        </p>
      </section>
    </div>
  )
}
