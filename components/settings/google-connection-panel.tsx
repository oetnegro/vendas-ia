'use client'

import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { buildGoogleOAuthUrl, getGoogleClientId } from '@/lib/google/oauth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { Database } from '@/types/database'

type GoogleConnection = Pick<
  Database['public']['Tables']['google_connections']['Row'],
  'google_email' | 'status' | 'expires_at' | 'updated_at' | 'scopes'
>

const scopes = [
  {
    title: 'Gmail',
    helper: 'Enviar e ler respostas necessárias para o inbox e classificação da IA.',
    icon: Mail,
  },
  {
    title: 'Google Calendar',
    helper: 'Criar eventos quando a conversa chegar na etapa de reunião.',
    icon: Calendar,
  },
  {
    title: 'Consentimento explícito',
    helper: 'Tokens ficam associados ao workspace e não são expostos no browser.',
    icon: ShieldCheck,
  },
]

function createOAuthState() {
  const bytes = new Uint8Array(24)
  window.crypto.getRandomValues(bytes)
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `${window.crypto.randomUUID()}.${random}`
}

export function GoogleConnectionPanel() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const [connection, setConnection] = useState<GoogleConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null

    const params = new URLSearchParams(window.location.search)
    if (params.get('google') !== 'error') return null

    return params.get('message') || 'Nao foi possivel concluir a conexao Google.'
  })
  const [notice, setNotice] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null

    const params = new URLSearchParams(window.location.search)
    return params.get('google') === 'connected' ? 'Conta Google conectada com sucesso.' : null
  })

  const googleClientId = getGoogleClientId()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleStatus = params.get('google')

    if (googleStatus === 'connected' || googleStatus === 'error') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    async function loadConnection() {
      if (workspaceLoading) return

      if (!workspace) {
        setLoading(false)
        setConnection(null)
        return
      }

      setLoading(true)
      setError(null)

      const supabase = getSupabaseBrowserClient()
      const { data, error: connectionError } = await supabase.rpc('get_google_connection_status', {
        target_workspace_id: workspace.id,
      })

      if (connectionError) {
        setError(connectionError.message)
        setLoading(false)
        return
      }

      setConnection(data?.[0] || null)
      setLoading(false)
    }

    void loadConnection()
  }, [workspace, workspaceLoading])

  const handleConnect = async () => {
    if (!googleClientId) {
      setError('Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID para ativar o OAuth do Google.')
      return
    }

    if (!workspace) {
      setError('Crie ou selecione um workspace antes de conectar o Google.')
      return
    }

    setConnecting(true)
    setError(null)
    setNotice(null)

    const supabase = getSupabaseBrowserClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setError(userError?.message || 'Sessao nao encontrada.')
      setConnecting(false)
      return
    }

    const state = createOAuthState()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: stateError } = await supabase.from('google_oauth_states').insert({
      workspace_id: workspace.id,
      user_id: userData.user.id,
      state,
      redirect_to: '/settings/google',
      expires_at: expiresAt,
    })

    if (stateError) {
      setError(stateError.message)
      setConnecting(false)
      return
    }

    window.location.href = buildGoogleOAuthUrl({ state })
  }

  const handleDisconnect = async () => {
    if (!workspace) {
      setError('Crie ou selecione um workspace antes de desconectar o Google.')
      return
    }

    setDisconnecting(true)
    setError(null)
    setNotice(null)

    const supabase = getSupabaseBrowserClient()
    const { error: disconnectError } = await supabase.rpc('disconnect_google_connection', {
      target_workspace_id: workspace.id,
    })

    if (disconnectError) {
      setError(disconnectError.message)
      setDisconnecting(false)
      return
    }

    setConnection(null)
    setNotice('Conta Google desconectada deste workspace.')
    setDisconnecting(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-yellow-600">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Conexão Google</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Conecte Gmail e Calendar do workspace para permitir envio pelo e-mail do usuario e
          agendamento quando a IA chegar na etapa de reuniao.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {scopes.map((scope) => {
            const Icon = scope.icon

            return (
              <div key={scope.title} className="rounded-lg border border-slate-200 p-4">
                <Icon className="h-5 w-5 text-yellow-600" />
                <h2 className="mt-4 text-sm font-semibold text-slate-950">{scope.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{scope.helper}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Status</h2>
              {loading || workspaceLoading ? (
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando conexão...
                </p>
              ) : connection?.status === 'connected' ? (
                <div className="mt-2 space-y-1">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Conectado como {connection.google_email || 'conta Google'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Ultima atualização: {new Date(connection.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Nenhuma conta Google conectada neste workspace.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {connection?.status === 'connected' ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting || connecting || loading || workspaceLoading || !workspace}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Desconectar
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || disconnecting || loading || workspaceLoading || !workspace}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {connection?.status === 'connected' ? 'Conectar outra conta' : 'Conectar Google'}
              </button>
            </div>
          </div>

          {!googleClientId ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <TriangleAlert className="h-4 w-4" />
              Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID.
            </p>
          ) : null}

          {notice ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-950">Escopos solicitados</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {connection?.scopes?.length ? (
              connection.scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {scope}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Os escopos aparecem aqui depois da primeira conexão aprovada.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            No MVP, o token fica associado ao workspace e sera usado apenas por rotas/server jobs.
            Antes de produção, a camada de criptografia dos tokens deve ser ativada.
          </p>
        </div>
      </section>
    </div>
  )
}
