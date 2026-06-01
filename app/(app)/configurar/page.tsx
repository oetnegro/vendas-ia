'use client'

import Link from 'next/link'
import {
  Bot,
  CheckCircle2,
  Circle,
  FileText,
  Mail,
  FlaskConical,
} from 'lucide-react'
import { useWorkspace } from '@/lib/use-workspace'
import { TestEmailPanel } from '@/components/dashboard/test-email-panel'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'

type SetupStatus = {
  agent: boolean
  google: boolean
  leads: boolean
  campaign: boolean
}

export default function ConfigurarPage() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const [status, setStatus] = useState<SetupStatus | null>(null)

  useEffect(() => {
    if (!workspace?.id) return
    void loadStatus(workspace.id)
  }, [workspace?.id])

  async function loadStatus(wsId: string) {
    const supabase = getSupabaseBrowserClient()
    const [agentRes, googleRes, leadsRes, campaignsRes] = await Promise.all([
      supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId),
      supabase.rpc('get_google_connection_status', { target_workspace_id: wsId }),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId),
      supabase
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId),
    ])

    setStatus({
      agent: (agentRes.count ?? 0) > 0,
      google: googleRes.data?.[0]?.status === 'connected',
      leads: (leadsRes.count ?? 0) > 0,
      campaign: (campaignsRes.count ?? 0) > 0,
    })
  }

  const setupSteps = [
    {
      label: 'Conectar conta Google',
      description: 'Autorize o Gmail — sem isso nenhum email sai ou chega.',
      href: '/settings/google',
      icon: Mail,
      done: status?.google ?? false,
    },
    {
      label: 'Treinar o agente IA',
      description: 'Configure a personalidade, o produto e o objetivo da sua IA.',
      href: '/onboarding',
      icon: Bot,
      done: status?.agent ?? false,
    },
    {
      label: 'Importar leads',
      description: 'Suba uma lista de contatos em CSV para prospectar.',
      href: '/leads/import',
      icon: FileText,
      done: status?.leads ?? false,
    },
    {
      label: 'Criar uma campanha',
      description: 'Monte a cadência de emails que a IA vai disparar.',
      href: '/campaigns/new',
      icon: FileText,
      done: status?.campaign ?? false,
    },
  ]

  const completedCount = setupSteps.filter((s) => s.done).length
  const allDone = completedCount === setupSteps.length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-[#B98A1D]">Configurar</p>
        <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">Setup da plataforma</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Configure o agente, o email e as campanhas antes de comecar a prospectar.
        </p>
      </div>

      {/* Checklist de setup */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C3E50]">
              <CheckCircle2 className={`h-5 w-5 ${allDone ? 'text-green-500' : 'text-slate-300'}`} />
              Checklist de ativacao
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {workspaceLoading || !status
                ? 'Verificando...'
                : allDone
                  ? 'Tudo pronto! Sua plataforma esta configurada.'
                  : `${completedCount} de ${setupSteps.length} etapas concluidas`}
            </p>
          </div>
          {!workspaceLoading && status && (
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                allDone
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {completedCount}/{setupSteps.length}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {setupSteps.map((step) => {
            const Icon = step.icon
            return (
              <Link
                key={step.href}
                href={step.href}
                className={`group rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                  step.done
                    ? 'border-green-200 bg-green-50'
                    : 'border-slate-200 bg-white hover:border-[#F4D58D]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      step.done ? 'bg-green-100 text-green-600' : 'bg-[#F4D58D]/30 text-[#2C3E50]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                  )}
                </div>
                <p
                  className={`mt-3 font-semibold ${
                    step.done ? 'text-green-800' : 'text-slate-900'
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                {!step.done && (
                  <p className="mt-3 text-xs font-bold text-[#B98A1D] group-hover:underline">
                    Configurar →
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Teste operacional */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <FlaskConical className="h-5 w-5 text-[#B98A1D]" />
          <div>
            <h2 className="text-lg font-bold text-[#2C3E50]">Teste operacional</h2>
            <p className="text-sm text-slate-500">
              Envie um email de teste para verificar se o agente esta respondendo corretamente.
            </p>
          </div>
        </div>
        <div className="p-6">
          <TestEmailPanel workspace={workspace ?? null} />
        </div>
      </section>
    </div>
  )
}
