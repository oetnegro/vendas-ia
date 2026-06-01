'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileUp,
  Loader2,
  Mail,
  Rocket,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import { buildGoogleOAuthUrl, getGoogleClientId } from '@/lib/google/oauth'

// ─────────────────── Types ───────────────────

type Step = 1 | 2 | 3 | 4

const SECTOR_OPTIONS = [
  { value: 'b2b_services', label: 'Servicos B2B (consultoria, assessoria)' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'agency', label: 'Agencia (marketing, performance, criativa)' },
  { value: 'ecommerce', label: 'E-commerce / Varejo' },
  { value: 'health', label: 'Saude (clinicas, healthtech)' },
  { value: 'education', label: 'Educacao (cursos, treinamentos)' },
  { value: 'real_estate', label: 'Imobiliaria / Construcao' },
  { value: 'finance', label: 'Financas / Fintech / Contabilidade' },
  { value: 'hr', label: 'RH / Recrutamento / Beneficios' },
  { value: 'intl', label: 'Internacional (EUA / Europa)' },
]

// Step order: 1=Agente IA, 2=Gmail, 3=Leads, 4=Campanha
const STEPS = [
  { label: 'Agente IA', icon: Bot },
  { label: 'Gmail', icon: Mail },
  { label: 'Leads', icon: FileUp },
  { label: 'Campanha', icon: Rocket },
]

// ─────────────────── Progress bar ───────────────────

function ProgressBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const stepNum = (i + 1) as Step
        const done = stepNum < current
        const active = stepNum === current
        const Icon = step.icon

        return (
          <div key={step.label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                      ? 'bg-[#2C3E50] text-white ring-4 ring-[#2C3E50]/15'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
              </div>
              <span
                className={`hidden text-xs font-semibold sm:block ${
                  active ? 'text-[#2C3E50]' : done ? 'text-green-600' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 sm:w-12 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────── Success screen between steps ───────────────────

function StepSuccess({
  icon,
  title,
  subtitle,
  onNext,
  nextLabel = 'Continuar',
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onNext: () => void
  nextLabel?: string
}) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        {icon}
      </div>
      <CheckCircle2 className="-mt-6 ml-12 h-7 w-7 text-green-500" />
      <h2 className="mt-6 text-2xl font-bold text-[#2C3E50]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{subtitle}</p>
      <button
        type="button"
        onClick={onNext}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#2C3E50] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#34495E]"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─────────────────── Main component ───────────────────

export function GuidedOnboardingWizard() {
  const router = useRouter()
  const { workspace, loading: workspaceLoading, refresh } = useWorkspace()
  const [step, setStep] = useState<Step>(1)
  const [stepSuccess, setStepSuccess] = useState(false)

  // Guards against re-running the initial check after workspace refresh mid-wizard
  const initialCheckDone = useRef(false)
  // Set by the Google OAuth callback detection effect
  const fromGoogleOAuthRef = useRef(false)

  // Step 2 (Gmail) state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [googleOAuthError, setGoogleOAuthError] = useState<string | null>(null)

  // Step 1 (Agent) state
  const [workspaceName, setWorkspaceName] = useState('')
  const [sector, setSector] = useState('b2b_services')
  const [businessContext, setBusinessContext] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [valueProposition, setValueProposition] = useState('')
  const [commonObjections, setCommonObjections] = useState('')
  const [campaignGoal, setCampaignGoal] = useState('')
  const [tone, setTone] = useState('Direto, consultivo e humano')
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [existingAgentId, setExistingAgentId] = useState<string | null>(null)

  // Step 3 (Leads) state
  const [leadCount, setLeadCount] = useState(0)
  const [leadsLoading, setLeadsLoading] = useState(true)

  const googleClientId = getGoogleClientId()

  // Detect Google OAuth callback — runs once on mount before workspace loads
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleStatus = params.get('google')

    if (googleStatus === 'connected') {
      window.history.replaceState(null, '', window.location.pathname)
      fromGoogleOAuthRef.current = true
      setGoogleConnected(true)
      setStep(2) // Gmail is step 2
      setStepSuccess(true)
    } else if (googleStatus === 'error') {
      window.history.replaceState(null, '', window.location.pathname)
      const msg = params.get('message') || 'Não foi possível conectar o Google.'
      setGoogleOAuthError(msg)
      setStep(2) // Show Gmail step so user sees the error
    }
  }, [])

  // Initial state check — only runs once per page load, not after mid-wizard refreshes
  useEffect(() => {
    if (workspaceLoading) return
    if (initialCheckDone.current) return

    if (!workspace?.id) {
      // New user — no workspace yet, start from step 1 (agent training)
      initialCheckDone.current = true
      setGoogleLoading(false)
      setLeadsLoading(false)
      return
    }

    setWorkspaceName(workspace.name)
    initialCheckDone.current = true
    void checkIfAlreadyConfigured(workspace.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, workspaceLoading, router])

  const checkIfAlreadyConfigured = async (wsId: string) => {
    const supabase = getSupabaseBrowserClient()

    const [googleRes, agentRes, wsDataRes] = await Promise.all([
      supabase
        .from('google_connections')
        .select('google_email, status')
        .eq('workspace_id', wsId)
        .eq('status', 'connected')
        .maybeSingle(),
      supabase.from('agents').select('id').eq('workspace_id', wsId).limit(1).maybeSingle(),
      supabase.from('workspaces').select('onboarding_step').eq('id', wsId).single(),
    ])

    const hasGoogle = !!googleRes.data
    const hasAgent = !!agentRes.data
    const savedStep = (wsDataRes.data?.onboarding_step ?? 1) as Step
    const isOAuthReturn = fromGoogleOAuthRef.current

    // Both configured and not coming from OAuth → send to dashboard
    if (hasGoogle && hasAgent && !isOAuthReturn) {
      router.replace('/dashboard')
      return
    }

    setGoogleConnected(hasGoogle)
    setGoogleEmail(googleRes.data?.google_email ?? null)
    setGoogleLoading(false)

    // Resume at saved step (skip ahead if data already shows completion)
    if (!isOAuthReturn) {
      const resumeStep: Step = !hasAgent ? 1 : !hasGoogle ? Math.max(savedStep, 2) as Step : savedStep
      setStep(resumeStep)
    }

    void loadLeadCount(wsId)

    if (agentRes.data) {
      const { data: fullAgent } = await supabase
        .from('agents')
        .select('id, business_context, common_objections, campaign_goal')
        .eq('id', agentRes.data.id)
        .single()
      if (fullAgent) {
        setExistingAgentId(fullAgent.id)
        setBusinessContext(fullAgent.business_context || '')
        setCommonObjections(fullAgent.common_objections || '')
        setCampaignGoal(fullAgent.campaign_goal || '')
      }
    }
  }

  async function loadLeadCount(wsId: string) {
    setLeadsLoading(true)
    const { count } = await getSupabaseBrowserClient()
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wsId)
    setLeadCount(count ?? 0)
    setLeadsLoading(false)
  }

  function buildOAuthState() {
    const bytes = new Uint8Array(24)
    window.crypto.getRandomValues(bytes)
    const random = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${window.crypto.randomUUID()}.${random}`
  }

  async function saveOnboardingStep(wsId: string, newStep: Step) {
    await getSupabaseBrowserClient()
      .from('workspaces')
      .update({ onboarding_step: newStep })
      .eq('id', wsId)
  }

  async function handleConnectGoogle() {
    if (!googleClientId || !workspace) return
    setConnecting(true)
    setGoogleOAuthError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setGoogleOAuthError('Sessão não encontrada. Faça login novamente.')
      setConnecting(false)
      return
    }

    const oauthState = buildOAuthState()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: stateError } = await supabase.from('google_oauth_states').insert({
      workspace_id: workspace.id,
      user_id: userData.user.id,
      state: oauthState,
      redirect_to: '/setup',
      expires_at: expiresAt,
    })

    if (stateError) {
      setGoogleOAuthError('Falha ao iniciar a conexão. Tente novamente.')
      setConnecting(false)
      return
    }

    window.location.href = buildGoogleOAuthUrl({ state: oauthState })
  }

  async function handleGenerateWithAI() {
    setGenerating(true)
    setAgentError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setAgentError('Sessão expirada.')
      setGenerating(false)
      return
    }

    const res = await fetch('/api/ai/generate-agent-context', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sector }),
    })

    const json = (await res.json()) as {
      ok?: boolean
      businessContext?: string
      targetAudience?: string
      valueProposition?: string
      commonObjections?: string
      campaignGoal?: string
      tone?: string
      error?: string
    }

    if (!res.ok || json.error) {
      setAgentError(json.error || 'Erro ao gerar com IA.')
      setGenerating(false)
      return
    }

    if (json.businessContext) setBusinessContext(json.businessContext)
    if (json.targetAudience) setTargetAudience(json.targetAudience)
    if (json.valueProposition) setValueProposition(json.valueProposition)
    if (json.commonObjections) setCommonObjections(json.commonObjections)
    if (json.campaignGoal) setCampaignGoal(json.campaignGoal)
    if (json.tone) setTone(json.tone)
    setGenerating(false)
  }

  async function handleSaveAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAgentLoading(true)
    setAgentError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setAgentLoading(false)
      setAgentError(userError?.message || 'Sessão não encontrada.')
      return
    }

    let workspaceId = workspace?.id || null

    if (workspaceId) {
      const { error: wsError } = await supabase
        .from('workspaces')
        .update({ name: workspaceName })
        .eq('id', workspaceId)

      if (wsError) {
        setAgentLoading(false)
        setAgentError('Não foi possível atualizar o workspace.')
        return
      }
    } else {
      const { data: createdWorkspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({ name: workspaceName })
        .select('id')
        .single()

      if (wsError || !createdWorkspace) {
        setAgentLoading(false)
        setAgentError('Não foi possível criar o workspace. Tente novamente.')
        return
      }

      workspaceId = createdWorkspace.id

      const { error: memberError } = await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: userData.user.id,
        role: 'owner',
      })

      if (memberError) {
        setAgentLoading(false)
        setAgentError('Não foi possível configurar o workspace. Tente novamente.')
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

    const { error: saveError } = existingAgentId
      ? await supabase.from('agents').update(agentPayload).eq('id', existingAgentId)
      : await supabase.from('agents').insert(agentPayload)

    if (saveError) {
      setAgentLoading(false)
      setAgentError('Não foi possível salvar o agente. Tente novamente.')
      return
    }

    // Mark that Gmail (step 2) is next
    void saveOnboardingStep(workspaceId, 2)

    await refresh()
    setAgentLoading(false)
    setStepSuccess(true)
  }

  // ─── Render helpers ───

  // Step 1: Agent training (creates workspace if needed)
  function renderStep1() {
    if (stepSuccess) {
      return (
        <StepSuccess
          icon={<Bot className="h-9 w-9 text-green-600" />}
          title="Agente treinado!"
          subtitle="A IA agora sabe sobre o seu negócio, público-alvo e como responder objeções."
          nextLabel="Conectar Gmail"
          onNext={() => {
            setStep(2)
            setStepSuccess(false)
          }}
        />
      )
    }

    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4D58D]/30">
            <Bot className="h-7 w-7 text-[#B98A1D]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Treinar o agente IA</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Explique seu negócio para a IA. Ela vai usar isso para responder leads e classificar conversas.
          </p>
        </div>

        {/* AI generation */}
        <div className="rounded-2xl border border-[#F4D58D]/60 bg-[#FFF9E8] p-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-[#B98A1D]" />
            <p className="text-sm font-semibold text-[#2C3E50]">Gerar exemplo com IA</p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Selecione o setor e clique em Gerar — a IA preenche todos os campos com um exemplo real que você edita.
          </p>
          <div className="mt-3 flex gap-2">
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="flex-1 rounded-lg border border-[#2C3E50]/15 bg-white px-3 py-2 text-sm text-[#2C3E50] outline-none focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/40"
            >
              {SECTOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={generating}
              onClick={() => { void handleGenerateWithAI() }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2C3E50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Gerando...' : 'Gerar'}
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { void handleSaveAgent(e) }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nome da empresa
            </label>
            <input
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ex: Acme Comercial"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Explique o negócio
            </label>
            <p className="mt-0.5 text-xs text-slate-400">O que você vende, para quem, diferencial e tom de voz</p>
            <textarea
              required
              rows={4}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="Ex: Somos uma plataforma SaaS de gestão comercial para times de vendas B2B..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Público alvo / ICP
              </label>
              <textarea
                rows={3}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ex: Diretores comerciais de SaaS B2B, 50–500 funcionários"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Proposta de valor
              </label>
              <textarea
                rows={3}
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                placeholder="Ex: Reduzir custo de prospecção e aumentar reuniões qualificadas"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Objeções comuns
            </label>
            <textarea
              rows={3}
              value={commonObjections}
              onChange={(e) => setCommonObjections(e.target.value)}
              placeholder="Ex: Já tenho fornecedor. | Não tenho orçamento. | Preciso falar com meu sócio."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Objetivo da campanha
            </label>
            <textarea
              required
              rows={2}
              value={campaignGoal}
              onChange={(e) => setCampaignGoal(e.target.value)}
              placeholder="Ex: Marcar reunião de diagnóstico com decisores B2B"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tom de voz
            </label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          {agentError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {agentError}
            </p>
          )}

          <button
            type="submit"
            disabled={agentLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E50] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {agentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {agentLoading ? 'Salvando...' : 'Salvar e continuar'}
          </button>
        </form>
      </div>
    )
  }

  // Step 2: Gmail connect (workspace always exists by this point)
  function renderStep2() {
    if (stepSuccess) {
      return (
        <StepSuccess
          icon={<Mail className="h-9 w-9 text-green-600" />}
          title="Gmail conectado!"
          subtitle={
            googleEmail
              ? `Emails serão enviados por ${googleEmail}`
              : 'Sua conta Google está pronta para disparos.'
          }
          nextLabel="Importar leads"
          onNext={() => {
            if (workspace?.id) void saveOnboardingStep(workspace.id, 3)
            setStep(3)
            setStepSuccess(false)
          }}
        />
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Mail className="h-7 w-7 text-[#2C3E50]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Conectar o Gmail</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Sua conta Google é usada para enviar os e-mails e receber respostas. Os tokens ficam associados ao workspace e nunca aparecem no browser.
          </p>
        </div>

        {googleLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="mx-auto max-w-sm space-y-3">
            {!googleClientId && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                GOOGLE_CLIENT_ID não configurado. Configure a variável de ambiente.
              </div>
            )}

            {!workspace && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Workspace não encontrado. Volte ao passo anterior e salve o agente primeiro.
              </div>
            )}

            {googleOAuthError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Falha na conexão Google</p>
                  <p className="mt-0.5">{googleOAuthError}</p>
                </div>
              </div>
            )}

            {googleConnected && !stepSuccess ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Conectado como {googleEmail}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (workspace?.id) void saveOnboardingStep(workspace.id, 3)
                      setStep(3)
                    }}
                    className="mt-1 text-xs font-semibold text-green-700 underline"
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={connecting || !googleClientId || !workspace}
                onClick={() => { void handleConnectGoogle() }}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {connecting ? 'Redirecionando...' : 'Continuar com Google'}
              </button>
            )}

            {!googleConnected && (
              <button
                type="button"
                onClick={() => {
                  if (workspace?.id) void saveOnboardingStep(workspace.id, 3)
                  setStep(3)
                  setStepSuccess(false)
                }}
                className="w-full text-center text-xs text-slate-400 transition hover:text-slate-600"
              >
                Pular por agora → (conecte antes do primeiro disparo)
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderStep3() {
    if (stepSuccess) {
      return (
        <StepSuccess
          icon={<FileUp className="h-9 w-9 text-green-600" />}
          title={`${leadCount} leads prontos!`}
          subtitle="Sua lista está carregada. Agora basta criar a campanha e configurar a cadência."
          nextLabel="Criar campanha"
          onNext={() => {
            if (workspace?.id) void saveOnboardingStep(workspace.id, 4)
            setStep(4)
            setStepSuccess(false)
          }}
        />
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <FileUp className="h-7 w-7 text-[#2C3E50]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Importar leads</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Faça upload de um CSV com nome, e-mail, empresa e cargo dos seus prospects.
          </p>
        </div>

        <div className="mx-auto max-w-sm space-y-3">
          {leadsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          ) : leadCount > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">{leadCount} leads importados</p>
                  <p className="text-xs text-green-600">Você pode importar mais a qualquer momento</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/leads/import"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#2C3E50] hover:bg-slate-50"
                >
                  <FileUp className="h-4 w-4" />
                  Importar mais
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (workspace?.id) void saveOnboardingStep(workspace.id, 4)
                    setStep(4)
                    setStepSuccess(false)
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2C3E50] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E]"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-600">Colunas do CSV</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {['email', 'first_name', 'last_name', 'company', 'title'].map((col) => (
                    <code key={col} className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700">{col}</code>
                  ))}
                </div>
              </div>
              <Link
                href="/leads/import"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E50] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#34495E]"
              >
                <FileUp className="h-4 w-4" />
                Fazer upload do CSV
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (workspace?.id) void saveOnboardingStep(workspace.id, 4)
                  setStep(4)
                  setStepSuccess(false)
                }}
                className="w-full text-center text-xs text-slate-400 transition hover:text-slate-600"
              >
                Pular por agora → (importe antes de disparar)
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderStep4() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4D58D]/30">
            <Rocket className="h-7 w-7 text-[#B98A1D]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Criar a campanha</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Tudo pronto! Defina objetivo, volume diário e horários de envio da sua primeira campanha.
          </p>
        </div>

        {/* Checklist */}
        <div className="mx-auto max-w-sm space-y-2">
          <MiniCheck
            done={!!(businessContext && campaignGoal)}
            label="Agente IA treinado"
            note="Contexto e objetivo definidos"
          />
          <MiniCheck
            done={googleConnected}
            label="Gmail conectado"
            note={googleConnected ? (googleEmail ?? '') : 'Conecte em Configurações > Google'}
          />
          <MiniCheck
            done={leadCount > 0}
            label={leadCount > 0 ? `${leadCount} leads importados` : 'Sem leads ainda'}
            note={leadCount > 0 ? 'Lista pronta' : 'Importe em /leads/import'}
          />
        </div>

        <div className="mx-auto max-w-sm space-y-2.5">
          <Link
            href="/campaigns/new"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B98A1D] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#A07818]"
          >
            <Rocket className="h-4 w-4" />
            Criar campanha agora
          </Link>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#2C3E50] transition hover:bg-slate-50"
          >
            Ir para o dashboard →
          </Link>
        </div>
      </div>
    )
  }

  if (workspaceLoading && !initialCheckDone.current) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <span className="text-sm font-bold text-[#2C3E50]">
          Vendas<span className="text-[#B98A1D]">+IA</span>
        </span>
        <ProgressBar current={step} />
        <Link href="/dashboard" className="text-xs text-slate-400 transition hover:text-slate-600">
          Pular setup →
        </Link>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-xl">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-400">
        Passo {step} de 4 ·{' '}
        <button
          type="button"
          onClick={() => setStep(Math.max(1, step - 1) as Step)}
          className="underline hover:text-slate-600"
        >
          Voltar
        </button>
      </footer>
    </div>
  )
}

// ─────────────────── Tiny helper ───────────────────

function MiniCheck({ done, label, note }: { done: boolean; label: string; note: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
      <CheckCircle2 className={`h-4 w-4 shrink-0 ${done ? 'text-green-500' : 'text-slate-200'}`} />
      <div>
        <p className={`text-sm font-semibold ${done ? 'text-slate-800' : 'text-slate-400'}`}>
          {label}
        </p>
        <p className="text-xs text-slate-400">{note}</p>
      </div>
    </div>
  )
}
