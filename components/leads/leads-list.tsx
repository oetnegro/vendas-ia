'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2,
  FileUp,
  Mail,
  MessageCircleReply,
  Phone,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { Json, LeadStatus } from '@/types/database'

// ─────────────────────── Types ───────────────────────

type LeadRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  status: LeadStatus
  custom_fields: Json
  created_at: string
}

type MessageSummary = {
  lead_id: string
  total: number
  inbound: number
  lastAt: string | null
}

type SendJobRow = {
  lead_id: string
  cadence_step_id: string
}

type CadenceStepRow = {
  id: string
  step_order: number
}

// ─────────────────────── Helpers ───────────────────────

function leadName(lead: LeadRow) {
  return (
    [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
    lead.company ||
    lead.email ||
    'Sem nome'
  )
}

function leadInitials(lead: LeadRow) {
  const name =
    [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
    lead.company ||
    lead.email ||
    '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function leadPhone(lead: LeadRow): string | null {
  const cf = lead.custom_fields
  if (!cf || typeof cf !== 'object' || Array.isArray(cf)) return null
  const r = cf as Record<string, Json>
  const v = r.phone ?? r.telefone ?? r.celular ?? r.whatsapp ?? null
  return typeof v === 'string' ? v : null
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: LeadStatus) {
  const labels: Record<LeadStatus, string> = {
    new: 'Novo',
    queued: 'Na fila',
    contacted: 'Contactado',
    replied: 'Respondeu',
    interested: 'Interessado',
    meeting_booked: 'Agendado',
    negative: 'Negativa',
    opted_out: 'Descadastro',
    paused: 'Pausado',
  }
  return labels[status] || status
}

function statusClasses(status: LeadStatus) {
  if (['replied', 'interested', 'meeting_booked'].includes(status))
    return 'bg-green-100 text-green-700'
  if (['negative', 'opted_out'].includes(status)) return 'bg-red-100 text-red-700'
  if (status === 'paused') return 'bg-slate-200 text-slate-600'
  return 'bg-blue-100 text-blue-700'
}

function stepLabel(n: number) {
  if (n === 1) return '1ª Mensagem'
  if (n === 2) return 'Follow Up'
  return `Follow Up ${n - 1}`
}

const FILTER_LABELS: Record<string, string> = {
  acionados: 'Leads Acionados',
  responderam: 'Responderam',
  'status:qualified': 'Qualificados',
  'status:interested': 'Interessados',
  'status:meeting_booked': 'Agendamentos',
  'status:negative': 'Negativos',
}

function filterTitle(param: string | null) {
  if (!param) return null
  if (FILTER_LABELS[param]) return FILTER_LABELS[param]
  if (param.startsWith('step:')) return stepLabel(Number(param.split(':')[1]))
  return null
}

// ─────────────────────── Component ───────────────────────

export function LeadsList() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [sentJobs, setSentJobs] = useState<SendJobRow[]>([])
  const [cadenceSteps, setCadenceSteps] = useState<CadenceStepRow[]>([])
  const [msgSummary, setMsgSummary] = useState<Map<string, MessageSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!workspace?.id) return
    void loadData(workspace.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  async function loadData(wsId: string) {
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [leadsRes, jobsRes, stepsRes, messagesRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, email, first_name, last_name, company, title, status, custom_fields, created_at')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false }),
      supabase
        .from('send_jobs')
        .select('lead_id, cadence_step_id')
        .eq('workspace_id', wsId)
        .eq('status', 'sent'),
      supabase
        .from('cadence_steps')
        .select('id, step_order')
        .eq('workspace_id', wsId),
      supabase
        .from('email_messages')
        .select('lead_id, direction, sent_at')
        .eq('workspace_id', wsId)
        .gte('sent_at', startOfMonth),
    ])

    // Build per-lead message summary
    const summary = new Map<string, MessageSummary>()
    for (const msg of messagesRes.data || []) {
      const cur = summary.get(msg.lead_id) ?? {
        lead_id: msg.lead_id,
        total: 0,
        inbound: 0,
        lastAt: null,
      }
      cur.total += 1
      if (msg.direction === 'inbound') cur.inbound += 1
      if (msg.sent_at && (!cur.lastAt || msg.sent_at > cur.lastAt)) cur.lastAt = msg.sent_at
      summary.set(msg.lead_id, cur)
    }

    setLeads((leadsRes.data || []) as LeadRow[])
    setSentJobs((jobsRes.data || []) as SendJobRow[])
    setCadenceSteps((stepsRes.data || []) as CadenceStepRow[])
    setMsgSummary(summary)
    setLoading(false)
  }

  // Compute max step per lead
  const maxStepByLead = useMemo(() => {
    const stepById = new Map(cadenceSteps.map((s) => [s.id, s.step_order]))
    const result = new Map<string, number>()
    for (const job of sentJobs) {
      const n = stepById.get(job.cadence_step_id)
      if (n === undefined) continue
      const cur = result.get(job.lead_id) ?? 0
      if (n > cur) result.set(job.lead_id, n)
    }
    return result
  }, [sentJobs, cadenceSteps])

  // Leads after filter + search
  const filteredLeads = useMemo(() => {
    const acionadosIds = filterParam
      ? new Set(sentJobs.map((j) => j.lead_id))
      : null
    const respondedIds =
      filterParam === 'responderam'
        ? new Set(
            Array.from(msgSummary.values())
              .filter((s) => s.inbound > 0)
              .map((s) => s.lead_id),
          )
        : null

    let result = leads.filter((lead) => {
      if (!filterParam) return true
      if (filterParam === 'acionados') return acionadosIds!.has(lead.id)
      if (filterParam === 'responderam') return respondedIds!.has(lead.id)
      if (filterParam === 'status:qualified')
        return ['replied', 'interested', 'meeting_booked'].includes(lead.status)
      if (filterParam === 'status:interested')
        return ['interested', 'meeting_booked'].includes(lead.status)
      if (filterParam === 'status:meeting_booked') return lead.status === 'meeting_booked'
      if (filterParam === 'status:negative')
        return ['negative', 'opted_out'].includes(lead.status)
      if (filterParam.startsWith('step:')) {
        const n = Number(filterParam.split(':')[1])
        return maxStepByLead.get(lead.id) === n
      }
      return true
    })

    const term = search.trim().toLowerCase()
    if (term) {
      result = result.filter((lead) =>
        [lead.email, lead.first_name, lead.last_name, lead.company, lead.title]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
    }

    return result
  }, [leads, filterParam, sentJobs, maxStepByLead, msgSummary, search])

  const title = filterTitle(filterParam)
  const showEngagement = Boolean(filterParam) // show extra columns when coming from dashboard

  if (!workspaceLoading && !workspace) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#2C3E50]">Sem workspace ainda</h1>
        <p className="mt-2 text-sm text-slate-600">Crie o agente antes de carregar leads.</p>
        <Link
          href="/setup"
          className="mt-5 inline-flex rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white"
        >
          Começar configuração
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">CRM</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">Leads</h1>
          <p className="mt-2 text-sm text-slate-600">
            Lista de contatos importados para prospeccao por email.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          {filterParam && (
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Ver todos
            </Link>
          )}
          <Link
            href="/leads/import"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#34495E]"
          >
            <FileUp className="h-4 w-4" />
            Importar CSV
          </Link>
        </div>
      </div>

      {/* ── Filter banner ── */}
      {title && (
        <div className="flex items-center gap-3 rounded-lg border border-[#F4D58D]/60 bg-[#F4D58D]/15 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-[#B98A1D]" />
          <p className="text-sm font-semibold text-[#2C3E50]">
            Filtro ativo:{' '}
            <span className="font-bold">{title}</span>
          </p>
          <span className="ml-auto rounded-full bg-[#2C3E50] px-2.5 py-0.5 text-xs font-bold text-white">
            {loading ? '…' : filteredLeads.length} leads
          </span>
          <Link
            href="/leads"
            className="ml-1 text-xs font-semibold text-slate-500 underline hover:text-slate-700"
          >
            Limpar
          </Link>
        </div>
      )}

      {/* ── Table ── */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <UserRound className="h-4 w-4 text-[#2C3E50]" />
            {loading
              ? 'Carregando...'
              : filterParam
                ? `${filteredLeads.length} de ${leads.length} lead(s)`
                : `${leads.length} lead(s) no workspace`}
          </div>
          <label className="relative block md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por email, nome ou empresa"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>
        </div>

        {filteredLeads.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Status</th>
                  {showEngagement && (
                    <>
                      <th className="px-5 py-3 text-center">Engajamento</th>
                      <th className="px-5 py-3 text-right">Ultimo Contato</th>
                    </>
                  )}
                  {!showEngagement && <th className="px-5 py-3">Criado em</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => {
                  const phone = leadPhone(lead)
                  const msg = msgSummary.get(lead.id)
                  const maxStep = maxStepByLead.get(lead.id) ?? null
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => window.open(`/inbox?lead=${lead.id}`, '_blank', 'noreferrer')}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2C3E50] text-xs font-bold text-[#F4D58D]">
                            {leadInitials(lead)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {leadName(lead)}
                            </p>
                            {lead.title && (
                              <p className="truncate text-xs text-slate-500">{lead.title}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="grid gap-0.5">
                          {phone ? (
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                              {phone}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="max-w-[180px] truncate">{lead.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="max-w-[120px] truncate">{lead.company || '—'}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(lead.status)}`}
                        >
                          {statusLabel(lead.status)}
                        </span>
                      </td>
                      {showEngagement ? (
                        <>
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="flex items-center gap-1 font-bold text-slate-800">
                                <MessageCircleReply className="h-3.5 w-3.5 text-slate-400" />
                                {msg?.total ?? 0}
                                {msg && msg.inbound > 0 && (
                                  <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                                    {msg.inbound} resp.
                                  </span>
                                )}
                              </span>
                              {maxStep !== null && (
                                <span className="text-[11px] text-slate-500">
                                  {stepLabel(maxStep)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-slate-500">
                            {formatDate(msg?.lastAt ?? null)}
                          </td>
                        </>
                      ) : (
                        <td className="px-5 py-4 text-slate-500">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            {loading ? (
              <p className="text-sm text-slate-500">Carregando leads...</p>
            ) : filterParam ? (
              <>
                <p className="text-sm font-semibold text-slate-900">Nenhum lead neste filtro</p>
                <p className="mt-1 text-sm text-slate-500">
                  Tente outro filtro ou{' '}
                  <Link href="/leads" className="font-semibold text-blue-600 hover:underline">
                    veja todos os leads
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">Nenhum lead encontrado</p>
                <p className="mt-1 text-sm text-slate-500">
                  Importe um CSV para montar a primeira campanha.
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
