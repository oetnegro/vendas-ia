'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { MappedLead } from '@/lib/enrichment/apify'

type IcpForm = {
  description: string
  role: string
  region: string
  companySize: string
  extraSignals: string
}

type JobPollResult = {
  status: 'running' | 'preview_ready' | 'done' | 'failed'
  leads?: MappedLead[]
  result_count?: number
  valid_count?: number
  leads_imported?: number
  quota?: { used: number; cap: number }
  error?: string
}

const REGION_OPTIONS = [
  // Brasil
  'Brasil',
  'São Paulo (cidade)',
  'São Paulo (estado)',
  'Rio de Janeiro',
  'Minas Gerais',
  'Sul do Brasil',
  'Nordeste',
  'Brasília / Centro-Oeste',
  // América Latina
  'Argentina',
  'México',
  'Colômbia',
  'Chile',
  'Peru',
  'América Latina',
  // América do Norte
  'Estados Unidos',
  'Nova York, EUA',
  'Los Angeles, EUA',
  'Miami, EUA',
  'Canadá',
  // Europa
  'Portugal',
  'Espanha',
  'Reino Unido',
  'Alemanha',
  'França',
  'Europa',
  // Global
  'Global / Qualquer país',
]

const SIZE_OPTIONS = ['Any size', 'Startup / SMB', 'Mid-market', 'Enterprise']

export function EnrichmentPanel() {
  const { workspace, loading: workspaceLoading } = useWorkspace()

  const [form, setForm] = useState<IcpForm>({
    description: '',
    role: '',
    region: 'Brasil',
    companySize: 'Any size',
    extraSignals: '',
  })

  const [agentContext, setAgentContext] = useState<string>('')
  const [agentLoaded, setAgentLoaded] = useState(false)
  const [step, setStep] = useState<'form' | 'searching' | 'preview' | 'imported'>('form')
  const [jobId, setJobId] = useState<string | null>(null)
  const [preview, setPreview] = useState<JobPollResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load agent context silently (used by Gemini, NOT pre-filled in form)
  useEffect(() => {
    if (!workspace || agentLoaded) return

    async function loadAgent() {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('agents')
        .select('business_context, campaign_goal')
        .eq('workspace_id', workspace!.id)
        .maybeSingle()

      if (!data) return

      // Pass agent context to Gemini as background info only — never pre-fill the form
      const ctx = [data.business_context, data.campaign_goal].filter(Boolean).join(' | ')
      if (ctx) setAgentContext(ctx)
      setAgentLoaded(true)
    }

    loadAgent()
  }, [workspace, agentLoaded])

  // Polling
  useEffect(() => {
    if (step !== 'searching' || !jobId || !workspace) return

    async function poll() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch(
          `/api/leads/enrich?jobId=${jobId}&workspaceId=${workspace!.id}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        )
        const data = (await res.json()) as JobPollResult

        if (data.status === 'running') {
          pollRef.current = setTimeout(poll, 3000)
          return
        }

        if (data.status === 'failed') {
          setError(data.error || 'Search failed. Please try again.')
          setStep('form')
          return
        }

        if (data.status === 'preview_ready' || data.status === 'done') {
          setPreview(data)
          setStep('preview')
        }
      } catch {
        pollRef.current = setTimeout(poll, 4000)
      }
    }

    poll()
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [step, jobId, workspace])

  async function handleSearch() {
    if (!workspace) return
    if (!form.description.trim()) {
      setError('Describe who you want to prospect before searching.')
      return
    }

    setError(null)
    setStep('searching')

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired.')

      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'start',
          workspaceId: workspace.id,
          icp: {
            description: form.description,
            role: form.role,
            region: form.region,
            companySize: form.companySize,
            extraSignals: form.extraSignals,
            agentContext: agentContext || undefined,
          },
        }),
      })

      const data = (await res.json()) as { jobId?: string; error?: string; used?: number; cap?: number }

      if (!res.ok) {
        if (data.error === 'quota_exceeded') {
          setError(`Monthly quota reached: ${data.used}/${data.cap} leads used.`)
        } else {
          setError(data.error || 'Error starting search.')
        }
        setStep('form')
        return
      }

      setJobId(data.jobId!)
    } catch (err) {
      setError((err as Error).message || 'Connection error.')
      setStep('form')
    }
  }

  async function handleImport() {
    if (!workspace || !jobId) return
    setImporting(true)
    setError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired.')

      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'import',
          workspaceId: workspace.id,
          jobId,
        }),
      })

      const data = (await res.json()) as {
        imported?: number
        dupes_skipped?: number
        quota?: { used: number; cap: number }
        error?: string
      }

      if (!res.ok) {
        setError(data.error || 'Error importing leads.')
        return
      }

      setPreview((prev) => ({
        ...prev!,
        leads_imported: data.imported,
        quota: data.quota,
      }))
      setStep('imported')
    } catch (err) {
      setError((err as Error).message || 'Error importing leads.')
    } finally {
      setImporting(false)
    }
  }

  function handleReset() {
    setStep('form')
    setJobId(null)
    setPreview(null)
    setError(null)
    if (pollRef.current) clearTimeout(pollRef.current)
  }

  if (workspaceLoading) {
    return (
      <div className="flex items-center gap-3 py-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading workspace…</span>
      </div>
    )
  }

  // ── Searching ──────────────────────────────────────────────────────────────
  if (step === 'searching') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2C3E50]/10">
          <Sparkles className="h-8 w-8 animate-pulse text-[#2C3E50]" />
        </div>
        <h2 className="text-lg font-bold text-[#2C3E50]">Searching for leads…</h2>
        <p className="max-w-sm text-sm text-slate-600">
          The agent is choosing the best search strategy and collecting leads.
          <br />
          This may take up to 2 minutes.
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Querying data sources…
        </div>
      </div>
    )
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (step === 'preview' && preview) {
    const leads = preview.leads || []
    const validLeads = leads.filter((l) => l.email_valid)
    const quota = preview.quota

    return (
      <div className="space-y-5">
        {/* Header stats */}
        <div className="flex flex-wrap gap-3">
          <StatChip label="Found" value={preview.result_count ?? leads.length} />
          <StatChip label="With valid email" value={preview.valid_count ?? validLeads.length} accent />
          {quota && (
            <StatChip
              label={`Remaining quota`}
              value={`${quota.cap - quota.used} / ${quota.cap}`}
            />
          )}
        </div>

        {validLeads.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No leads from this search have an email automatically detected. You can still import them
            and add emails manually later, or refine the ICP and search again.
          </div>
        )}

        {/* Preview table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sector
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.slice(0, 25).map((lead, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {lead.email || <span className="text-slate-400 italic">no email</span>}
                    {lead.email_guessed && (
                      <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                        guessed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.company || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.title || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.category || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.email_valid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        no email
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {importing
              ? 'Importing…'
              : `Import ${validLeads.length > 0 ? validLeads.length : leads.length} leads`}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Search again
          </button>
        </div>
      </div>
    )
  }

  // ── Imported ───────────────────────────────────────────────────────────────
  if (step === 'imported') {
    const quota = preview?.quota
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#2C3E50]">
            {preview?.leads_imported} lead(s) imported
          </h2>
          {quota && (
            <p className="mt-1 text-sm text-slate-500">
              Monthly quota: {quota.used} / {quota.cap} leads used
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <a
            href="/leads"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white hover:bg-[#34495E]"
          >
            View leads
            <ChevronRight className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Search for more leads
          </button>
        </div>
      </div>
    )
  }

  // ── ICP Form ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#B98A1D]">AI-powered search</p>
        <h1 className="mt-1 text-2xl font-bold text-[#2C3E50]">Find leads by ICP</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Describe who you want to prospect. The agent picks the best data source,
          finds the leads, and delivers a ready-to-import list — no external configuration needed.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#2C3E50]">ICP qualification</h2>

        <div className="space-y-4">
          {/* Main ICP description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Who do you want to prospect? <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="E.g.: vets in São Paulo, SaaS startup CTOs, dental clinic owners"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Role */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Target role or function
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                placeholder="E.g.: CTO, VP of Sales, veterinarian"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
              />
            </div>

            {/* Region */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Company size */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Company size
              </label>
              <select
                value={form.companySize}
                onChange={(e) => setForm((p) => ({ ...p, companySize: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
              >
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Extra signals */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Extra signals{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={form.extraSignals}
                onChange={(e) => setForm((p) => ({ ...p, extraSignals: e.target.value }))}
                placeholder="E.g.: active website, revenue > 1M, capital city"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
              />
            </div>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSearch}
            disabled={!form.description.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Search leads with AI
          </button>
          <p className="text-xs text-slate-400">
            The agent will automatically choose the best strategy
          </p>
        </div>
      </section>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-700">How it works:</strong> describe the ICP and the agent
          dynamically picks the best data source, collects leads, and delivers a
          preview before importing. Quota: {Number(1000).toLocaleString('en-US')} leads/month per workspace.
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-2 ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-lg font-bold ${accent ? 'text-emerald-700' : 'text-[#2C3E50]'}`}
      >
        {value}
      </p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}
