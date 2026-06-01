'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'

export function OnboardingForm() {
  const router = useRouter()
  const { workspace, loading: workspaceLoading, refresh } = useWorkspace()
  const [workspaceName, setWorkspaceName] = useState('')
  const [businessContext, setBusinessContext] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [valueProposition, setValueProposition] = useState('')
  const [commonObjections, setCommonObjections] = useState('')
  const [campaignGoal, setCampaignGoal] = useState('')
  const [tone, setTone] = useState('Direto, consultivo e humano')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingAgentId, setExistingAgentId] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return

    const loadAgent = async () => {
      const { data } = await getSupabaseBrowserClient()
        .from('agents')
        .select('id, business_context, common_objections, campaign_goal')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      setWorkspaceName(workspace.name)

      if (!data) return

      setExistingAgentId(data.id)
      setBusinessContext(data.business_context || '')
      setCommonObjections(data.common_objections || '')
      setCampaignGoal(data.campaign_goal || '')
    }

    void loadAgent()
  }, [workspace])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setLoading(false)
      setError(userError?.message || 'Sessão não encontrada.')
      return
    }

    let workspaceId = workspace?.id || null

    if (workspaceId) {
      const { error: updateWorkspaceError } = await supabase
        .from('workspaces')
        .update({ name: workspaceName })
        .eq('id', workspaceId)

      if (updateWorkspaceError) {
        setLoading(false)
        setError(updateWorkspaceError.message)
        return
      }
    } else {
      const { data: createdWorkspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({ name: workspaceName })
        .select('id')
        .single()

      if (workspaceError || !createdWorkspace) {
        setLoading(false)
        setError(workspaceError?.message || 'Não foi possível criar o workspace.')
        return
      }

      workspaceId = createdWorkspace.id

      const { error: memberError } = await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: userData.user.id,
        role: 'owner',
      })

      if (memberError) {
        setLoading(false)
        setError(memberError.message)
        return
      }
    }

    const agentPayload = {
      workspace_id: workspaceId,
      name: 'Agente principal',
      business_context: [
        `Negocio: ${businessContext}`,
        `Publico alvo / ICP: ${targetAudience || 'Nao informado'}`,
        `Proposta de valor: ${valueProposition || 'Nao informado'}`,
        `Tom de voz: ${tone}`,
      ].join('\n\n'),
      common_objections: commonObjections,
      campaign_goal: campaignGoal,
      status: 'draft' as const,
    }

    const { error: agentError } = existingAgentId
      ? await supabase.from('agents').update(agentPayload).eq('id', existingAgentId)
      : await supabase.from('agents').insert(agentPayload)

    setLoading(false)

    if (agentError) {
      setError(agentError.message)
      return
    }

    await refresh()
    router.push('/setup')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#B98A1D]">Agente IA</p>
        <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">Treinar o agente</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Configure a personalidade, o produto e o objetivo da sua IA de prospecção.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5">
          {workspaceLoading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Verificando workspace...
            </p>
          ) : workspace ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Workspace encontrado. Vamos atualizar o agente existente.
            </p>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Nome da empresa/workspace</span>
            <input
              required
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Ex: Acme Comercial"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Explique o negocio</span>
            <textarea
              required
              rows={5}
              value={businessContext}
              onChange={(event) => setBusinessContext(event.target.value)}
              placeholder="O que vocês vendem, para quem vendem, ticket médio, região, diferenciais e tom de voz."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Publico alvo / ICP</span>
              <textarea
                rows={4}
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                placeholder="Ex: donos de agencias com 5 a 50 funcionarios, B2B, Brasil."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Proposta de valor</span>
              <textarea
                rows={4}
                value={valueProposition}
                onChange={(event) => setValueProposition(event.target.value)}
                placeholder="Ex: reduzir custo de prospeccao e aumentar reunioes qualificadas."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Objecoes comuns</span>
            <textarea
              rows={4}
              value={commonObjections}
              onChange={(event) => setCommonObjections(event.target.value)}
              placeholder="Ex: já tenho fornecedor, não tenho orçamento, não é prioridade, preciso falar com sócio."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Objetivo da campanha</span>
            <textarea
              required
              rows={4}
              value={campaignGoal}
              onChange={(event) => setCampaignGoal(event.target.value)}
              placeholder="Ex: marcar reunião de diagnóstico com decisores B2B em empresas de serviços."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Tom de voz</span>
            <input
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {loading ? 'Salvando...' : 'Salvar agente e continuar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

