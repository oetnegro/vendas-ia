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

const SIZE_OPTIONS = ['Qualquer porte', 'Startup / PME', 'Empresa média', 'Enterprise']

export function EnrichmentPanel() {
  const { workspace, loading: workspaceLoading } = useWorkspace()

  const [form, setForm] = useState<IcpForm>({
    description: '',
    role: '',
    region: 'Brasil',
    companySize: 'Qualquer porte',
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
          setError(data.error || 'Busca falhou. Tente novamente.')
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
      setError('Descreva quem você quer prospectar antes de buscar.')
      return
    }

    setError(null)
    setStep('searching')

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

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
          setError(`Quota mensal atingida: ${data.used}/${data.cap} leads usados.`)
        } else {
          setError(data.error || 'Erro ao iniciar busca.')
        }
        setStep('form')
        return
      }

      setJobId(data.jobId!)
    } catch (err) {
      setError((err as Error).message || 'Erro ao conectar.')
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
      if (!session) throw new Error('Sessão expirada.')

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
        setError(data.error || 'Erro ao importar.')
        return
      }

      setPreview((prev) => ({
        ...prev!,
        leads_imported: data.imported,
        quota: data.quota,
      }))
      setStep('imported')
    } catch (err) {
      setError((err as Error).message || 'Erro ao importar.')
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
        <span className="text-sm">Carregando workspace…</span>
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
        <h2 className="text-lg font-bold text-[#2C3E50]">Procurando leads…</h2>
        <p className="max-w-sm text-sm text-slate-600">
          O agente está escolhendo a melhor estratégia de busca e coletando os leads.
          <br />
          Isso pode levar até 2 minutos.
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Consultando fontes de dados…
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
          <StatChip label="Encontrados" value={preview.result_count ?? leads.length} />
          <StatChip label="Com e-mail válido" value={preview.valid_count ?? validLeads.length} accent />
          {quota && (
            <StatChip
              label={`Quota restante`}
              value={`${quota.cap - quota.used} / ${quota.cap}`}
            />
          )}
        </div>

        {validLeads.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Nenhum lead desta busca tem e-mail detectado automaticamente. Você pode importá-los
            mesmo assim e adicionar e-mails manualmente depois, ou refinar o ICP e buscar novamente.
          </div>
        )}

        {/* Preview table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  E-mail
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cargo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Setor
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
                    {lead.email || <span className="text-slate-400 italic">sem e-mail</span>}
                    {lead.email_guessed && (
                      <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                        inferido
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
                        válido
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        sem e-mail
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
              ? 'Importando…'
              : `Importar ${validLeads.length > 0 ? validLeads.length : leads.length} leads`}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Buscar novamente
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
            {preview?.leads_imported} lead(s) importados
          </h2>
          {quota && (
            <p className="mt-1 text-sm text-slate-500">
              Quota do mês: {quota.used} / {quota.cap} leads usados
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <a
            href="/leads"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white hover:bg-[#34495E]"
          >
            Ver leads
            <ChevronRight className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Buscar mais leads
          </button>
        </div>
      </div>
    )
  }

  // ── ICP Form ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#B98A1D]">Buscar com IA</p>
        <h1 className="mt-1 text-2xl font-bold text-[#2C3E50]">Encontrar leads pelo ICP</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Descreva quem você quer prospectar. O agente escolhe a melhor fonte de dados,
          busca os leads e entrega uma lista pronta para importar — sem você precisar
          configurar nada externo.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#2C3E50]">Qualificação do ICP</h2>

        <div className="space-y-4">
          {/* Main ICP description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Quem você quer prospectar? <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ex: veterinários em São Paulo, CTOs de startups SaaS, donos de clínica odontológica"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Role */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Cargo ou função-alvo
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                placeholder="Ex: CTO, Diretor Comercial, veterinário"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#F4D58D] focus:outline-none focus:ring-2 focus:ring-[#F4D58D]/40"
              />
            </div>

            {/* Region */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Região</label>
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
                Porte da empresa
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
                Sinais extras{' '}
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.extraSignals}
                onChange={(e) => setForm((p) => ({ ...p, extraSignals: e.target.value }))}
                placeholder="Ex: tem site ativo, faturamento > 1M, região capital"
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
            Buscar leads com IA
          </button>
          <p className="text-xs text-slate-400">
            O agente vai escolher a melhor estratégia automaticamente
          </p>
        </div>
      </section>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-700">Como funciona:</strong> descreva o ICP e o agente
          escolhe dinamicamente a melhor fonte de dados, coleta os leads e entrega uma
          pré-visualização antes de importar. Quota de {Number(1000).toLocaleString('pt-BR')} leads/mês por workspace.
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
