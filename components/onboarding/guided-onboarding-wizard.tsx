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
  { value: 'b2b_services', label: 'B2B Services (consulting, advisory)' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'agency', label: 'Agency (marketing, performance, creative)' },
  { value: 'ecommerce', label: 'E-commerce / Retail' },
  { value: 'health', label: 'Healthcare (clinics, healthtech)' },
  { value: 'education', label: 'Education (courses, training)' },
  { value: 'real_estate', label: 'Real Estate / Construction' },
  { value: 'finance', label: 'Finance / Fintech / Accounting' },
  { value: 'hr', label: 'HR / Recruiting / Benefits' },
  { value: 'intl', label: 'International (US / Europe)' },
]

// Step order: 1=AI Agent, 2=Gmail, 3=Leads, 4=Campaign
const STEPS = [
  { label: 'AI Agent', icon: Bot },
  { label: 'Gmail', icon: Mail },
  { label: 'Leads', icon: FileUp },
  { label: 'Campaign', icon: Rocket },
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
  nextLabel = 'Continue',
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
      const msg = params.get('message') || 'Could not connect Google.'
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
      setGoogleOAuthError('Session not found. Please sign in again.')
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
      setGoogleOAuthError('Failed to start the connection. Try again.')
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
      setAgentError('Session expired.')
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
      setAgentError(json.error || 'Error generating with AI.')
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
      setAgentError(userError?.message || 'Session not found.')
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
        setAgentError('Could not update workspace.')
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
        setAgentError('Could not create workspace. Try again.')
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
        setAgentError('Could not configure workspace. Try again.')
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
      setAgentError('Could not save the agent. Try again.')
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
          title="Agent trained!"
          subtitle="The AI now knows your business, target audience, and how to handle objections."
          nextLabel="Connect Gmail"
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
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Train the AI agent</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Describe your business to the AI. It will use this to reply to leads and classify conversations.
          </p>
        </div>

        {/* AI generation */}
        <div className="rounded-2xl border border-[#F4D58D]/60 bg-[#FFF9E8] p-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-[#B98A1D]" />
            <p className="text-sm font-semibold text-[#2C3E50]">Generate example with AI</p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Select the sector and click Generate — the AI fills all fields with a real example you can edit.
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
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { void handleSaveAgent(e) }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Company name
            </label>
            <input
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="E.g.: Acme Commercial"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Describe the business
            </label>
            <p className="mt-0.5 text-xs text-slate-400">What you sell, who you sell to, differentiators, and tone of voice</p>
            <textarea
              required
              rows={4}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="E.g.: We are a SaaS platform for commercial management for B2B sales teams..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target audience / ICP
              </label>
              <textarea
                rows={3}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="E.g.: Commercial directors at B2B SaaS companies, 50–500 employees"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Value proposition
              </label>
              <textarea
                rows={3}
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                placeholder="E.g.: Reduce prospecting costs and increase qualified meetings"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Common objections
            </label>
            <textarea
              rows={3}
              value={commonObjections}
              onChange={(e) => setCommonObjections(e.target.value)}
              placeholder="E.g.: Already have a vendor. | No budget. | Need to talk to my partner."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Campaign goal
            </label>
            <textarea
              required
              rows={2}
              value={campaignGoal}
              onChange={(e) => setCampaignGoal(e.target.value)}
              placeholder="E.g.: Book diagnostic meetings with B2B decision-makers"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tone of voice
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
            {agentLoading ? 'Saving...' : 'Save and continue'}
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
          title="Gmail connected!"
          subtitle={
            googleEmail
              ? `Emails will be sent from ${googleEmail}`
              : 'Your Google account is ready for sending.'
          }
          nextLabel="Import leads"
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
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Connect Gmail</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Your Google account is used to send emails and receive replies. Tokens are scoped to the workspace and never exposed in the browser.
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
                GOOGLE_CLIENT_ID is not configured. Set the environment variable.
              </div>
            )}

            {!workspace && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Workspace not found. Go back to the previous step and save the agent first.
              </div>
            )}

            {googleOAuthError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Google connection failed</p>
                  <p className="mt-0.5">{googleOAuthError}</p>
                </div>
              </div>
            )}

            {googleConnected && !stepSuccess ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Connected as {googleEmail}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (workspace?.id) void saveOnboardingStep(workspace.id, 3)
                      setStep(3)
                    }}
                    className="mt-1 text-xs font-semibold text-green-700 underline"
                  >
                    Continue →
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
                {connecting ? 'Redirecting...' : 'Continue with Google'}
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
                Skip for now → (connect before your first send)
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
          title={`${leadCount} leads ready!`}
          subtitle="Your list is loaded. Now just create the campaign and configure the cadence."
          nextLabel="Create campaign"
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
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Import leads</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Upload a CSV with name, email, company, and title for your prospects.
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
                  <p className="text-sm font-semibold text-green-800">{leadCount} leads imported</p>
                  <p className="text-xs text-green-600">You can import more at any time</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/leads/import"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#2C3E50] hover:bg-slate-50"
                >
                  <FileUp className="h-4 w-4" />
                  Import more
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
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-600">CSV columns</p>
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
                Upload CSV
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
                Skip for now → (import before sending)
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
          <h2 className="mt-4 text-2xl font-bold text-[#2C3E50]">Create campaign</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            All set! Define the goal, daily volume, and send schedule for your first campaign.
          </p>
        </div>

        {/* Checklist */}
        <div className="mx-auto max-w-sm space-y-2">
          <MiniCheck
            done={!!(businessContext && campaignGoal)}
            label="AI Agent trained"
            note="Context and goal defined"
          />
          <MiniCheck
            done={googleConnected}
            label="Gmail connected"
            note={googleConnected ? (googleEmail ?? '') : 'Connect in Settings > Google'}
          />
          <MiniCheck
            done={leadCount > 0}
            label={leadCount > 0 ? `${leadCount} leads imported` : 'No leads yet'}
            note={leadCount > 0 ? 'List ready' : 'Import at /leads/import'}
          />
        </div>

        <div className="mx-auto max-w-sm space-y-2.5">
          <Link
            href="/campaigns/new"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B98A1D] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#A07818]"
          >
            <Rocket className="h-4 w-4" />
            Create campaign now
          </Link>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#2C3E50] transition hover:bg-slate-50"
          >
            Go to dashboard →
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
          Skip setup →
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
        Step {step} of 4 ·{' '}
        <button
          type="button"
          onClick={() => setStep(Math.max(1, step - 1) as Step)}
          className="underline hover:text-slate-600"
        >
          Back
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
