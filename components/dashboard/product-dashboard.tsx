'use client'

import React from 'react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarCheck,
  FileUp,
  HeartHandshake,
  Inbox,
  MessageCircleReply,
  Target,
  ThumbsDown,
  Users,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { LeadStatus } from '@/types/database'

// ─────────────────────── Types ───────────────────────

type LeadRow = {
  id: string
  status: LeadStatus
}

type MessageRow = {
  lead_id: string
  direction: string
  subject?: string | null
}

type SendJobRow = {
  lead_id: string
  cadence_step_id: string
  campaign_id: string
}

type CadenceStepRow = {
  id: string
  step_order: number
  campaign_id: string
}

type CampaignOption = {
  id: string
  name: string
  status: string
}

type DashData = {
  leads: LeadRow[]
  messages: MessageRow[]
  sentJobs: SendJobRow[]
  cadenceSteps: CadenceStepRow[]
  campaigns: CampaignOption[]
  campaignCount: number
  googleConnected: boolean
}

// ─────────────────────── Helpers ───────────────────────

function stepLabel(n: number) {
  if (n === 1) return '1st Email'
  if (n === 2) return 'Follow Up'
  return `Follow Up ${n - 1}`
}

// ─────────────────────── Component ───────────────────────

export function ProductDashboard() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const [dash, setDash] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all')

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

    const [leadsRes, messagesRes, sentJobsRes, stepsRes, campaignsRes, googleRes] =
      await Promise.all([
        supabase.from('leads').select('id, status').eq('workspace_id', wsId),
        supabase
          .from('email_messages')
          .select('lead_id, direction, subject')
          .eq('workspace_id', wsId)
          .gte('sent_at', startOfMonth),
        supabase
          .from('send_jobs')
          .select('lead_id, cadence_step_id, campaign_id')
          .eq('workspace_id', wsId)
          .eq('status', 'sent'),
        supabase.from('cadence_steps').select('id, step_order, campaign_id').eq('workspace_id', wsId),
        supabase
          .from('campaigns')
          .select('id, name, status')
          .eq('workspace_id', wsId)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_google_connection_status', { target_workspace_id: wsId }),
      ])

    const campaignsData = (campaignsRes.data || []) as CampaignOption[]

    setDash({
      leads: (leadsRes.data || []) as LeadRow[],
      messages: (messagesRes.data || []) as MessageRow[],
      sentJobs: (sentJobsRes.data || []) as SendJobRow[],
      cadenceSteps: (stepsRes.data || []) as CadenceStepRow[],
      campaigns: campaignsData,
      campaignCount: campaignsData.length,
      googleConnected: googleRes.data?.[0]?.status === 'connected',
    })
    setLoading(false)
  }

  // ── Derived metrics ──
  const metrics = useMemo(() => {
    if (!dash) return null
    const { leads, messages, cadenceSteps } = dash

    // Filter send_jobs by selected campaign
    const sentJobs = selectedCampaignId === 'all'
      ? dash.sentJobs
      : dash.sentJobs.filter((j) => j.campaign_id === selectedCampaignId)

    // Filter cadence steps by selected campaign (for step labels)
    const filteredSteps = selectedCampaignId === 'all'
      ? cadenceSteps
      : cadenceSteps.filter((s) => s.campaign_id === selectedCampaignId)

    // step_id → step_number
    const stepById = new Map(filteredSteps.map((s) => [s.id, s.step_order]))

    // Per-lead max cadence step sent
    const maxStepByLead = new Map<string, number>()
    for (const job of sentJobs) {
      const n = stepById.get(job.cadence_step_id)
      if (n === undefined) continue
      const cur = maxStepByLead.get(job.lead_id) ?? 0
      if (n > cur) maxStepByLead.set(job.lead_id, n)
    }

    // Leads acionados = distinct leads with at least 1 sent campaign job (same source as funnel)
    const acionadosIds = new Set(sentJobs.map((j) => j.lead_id))
    const acionados = acionadosIds.size
    const BOUNCE_SUBJECT_RE =
      /delivery status notification|undeliverable|undelivered mail|failure notice|message not delivered/i

    const inboundLeadIds = new Set(
      messages
        .filter((m) => m.direction === 'inbound')
        .filter((m) => !BOUNCE_SUBJECT_RE.test(m.subject || ''))
        .map((m) => m.lead_id),
    )
    const replyRate =
      acionados > 0 ? Math.round((inboundLeadIds.size / acionados) * 1000) / 10 : 0

    // By status
    const byStatus = {} as Record<LeadStatus, number>
    for (const lead of leads) byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1

    // Leads grouped by max step
    const byStep = new Map<number, Set<string>>()
    for (const [leadId, n] of maxStepByLead.entries()) {
      if (!byStep.has(n)) byStep.set(n, new Set())
      byStep.get(n)!.add(leadId)
    }

    // Unique step numbers that actually have leads
    const activeStepOrders = Array.from(byStep.keys()).sort((a, b) => a - b)

    const cadenceFunnelRows = activeStepOrders.map((n) => ({
      label: stepLabel(n),
      count: byStep.get(n)!.size,
      filter: `step:${n}`,
      type: 'cadence' as const,
    }))

    const stageFunnelRows = [
      {
        label: 'Qualified',
        count: (byStatus.replied ?? 0) + (byStatus.interested ?? 0) + (byStatus.meeting_booked ?? 0),
        filter: 'status:qualified',
        type: 'stage' as const,
      },
      {
        label: 'Showed Interest',
        count: (byStatus.interested ?? 0) + (byStatus.meeting_booked ?? 0),
        filter: 'status:interested',
        type: 'stage' as const,
      },
      {
        label: 'Meeting Booked',
        count: byStatus.meeting_booked ?? 0,
        filter: 'status:meeting_booked',
        type: 'stage' as const,
      },
      {
        label: 'Negative',
        count: (byStatus.negative ?? 0) + (byStatus.opted_out ?? 0),
        filter: 'status:negative',
        type: 'stage' as const,
      },
    ]

    const funnelRows = [...cadenceFunnelRows, ...stageFunnelRows]
    const funnelBase = acionados || 1

    return {
      acionados,
      replyRate,
      inboundMonth: inboundLeadIds.size,
      byStatus,
      funnelRows,
      funnelBase,
    }
  }, [dash, selectedCampaignId])

  const isLoading = loading || workspaceLoading

  // ── KPI cards ──
  const metricCards = [
    {
      href: '/leads?filter=acionados',
      title: 'Contacted Leads',
      value: metrics?.acionados ?? 0,
      helper: 'Received at least 1 message',
      icon: Users,
      color: 'bg-[#2C3E50]',
    },
    {
      href: '/leads?filter=responderam',
      title: 'Reply Rate',
      value: `${metrics?.replyRate ?? 0}%`,
      helper: `${metrics?.inboundMonth ?? 0} replies this month`,
      icon: BarChart3,
      color: 'bg-blue-600',
    },
    {
      href: '/leads?filter=status:qualified',
      title: 'Qualified',
      value:
        (metrics?.byStatus.replied ?? 0) +
        (metrics?.byStatus.interested ?? 0) +
        (metrics?.byStatus.meeting_booked ?? 0),
      helper: 'Replied with interest',
      icon: MessageCircleReply,
      color: 'bg-violet-600',
    },
    {
      href: '/leads?filter=status:interested',
      title: 'Interested',
      value: metrics?.byStatus.interested ?? 0,
      helper: 'Positive signal received',
      icon: HeartHandshake,
      color: 'bg-orange-600',
    },
    {
      href: '/leads?filter=status:meeting_booked',
      title: 'Meetings Booked',
      value: metrics?.byStatus.meeting_booked ?? 0,
      helper: 'Meetings scheduled',
      icon: CalendarCheck,
      color: 'bg-green-600',
    },
    {
      href: '/leads?filter=status:negative',
      title: 'Negative',
      value: (metrics?.byStatus.negative ?? 0) + (metrics?.byStatus.opted_out ?? 0),
      helper: 'Declined or opted out',
      icon: ThumbsDown,
      color: 'bg-red-600',
    },
  ]


  if (!workspaceLoading && !workspace) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#B98A1D]">Dashboard</p>
        <h1 className="mt-2 text-2xl font-bold text-[#2C3E50]">Create a workspace first</h1>
        <p className="mt-2 text-sm text-slate-500">Dashboard data is scoped to your workspace.</p>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">
            {workspace ? workspace.name : 'Self-service product'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Control center: volume, replies, interested leads, meetings, and negatives.
          </p>
          {/* Campaign selector */}
          {dash && dash.campaigns.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Campaign:</span>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#2C3E50] outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              >
                <option value="all">All campaigns</option>
                {dash.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Link
          href={workspace ? '/leads/import' : '/setup'}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#34495E]"
        >
          <FileUp className="h-4 w-4" />
          {workspace ? 'Import leads' : 'Start onboarding'}
        </Link>
      </div>

      {/* ── KPI cards (clicáveis) ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C3E50]">
              <Target className="h-5 w-5 text-[#B98A1D]" />
              Operational Overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">Current month · click a card to view leads</p>
          </div>
          <Link
            href="/inbox"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#34495E]"
          >
            <Inbox className="h-4 w-4" />
            View inbox
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {metricCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                target="_blank"
                rel="noreferrer"
                className={`rounded-lg p-4 shadow-sm transition hover:brightness-110 ${card.color}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold uppercase leading-4 text-white/85">{card.title}</p>
                  <Icon className="h-4 w-4 shrink-0 text-white/80" />
                </div>
                <p className="mt-4 text-3xl font-bold text-white">
                  {isLoading ? '-' : card.value}
                </p>
                <p className="mt-2 text-xs font-medium text-white/80">{card.helper}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Funil de prospecção ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C3E50]">
          <BarChart3 className="h-5 w-5 text-[#B98A1D]" />
          Prospecting Funnel
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Cadence by step + qualification stage. Click to view leads.
        </p>
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Stage</th>
                <th className="px-4 py-3 text-right font-bold">Count</th>
                <th className="px-4 py-3 text-right font-bold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics?.funnelRows.map((row, i) => {
                const pct =
                  metrics.funnelBase > 0
                    ? Math.round((row.count / metrics.funnelBase) * 1000) / 10
                    : 0
                const isCadence = row.type === 'cadence'
                const isFirstStage =
                  row.type === 'stage' &&
                  (i === 0 || metrics.funnelRows[i - 1]?.type === 'cadence')

                return (
                  <React.Fragment key={row.filter}>
                    {isFirstStage && (
                      <tr className="bg-slate-50">
                        <td
                          colSpan={3}
                          className="px-4 py-1.5 text-[10px] font-bold uppercase text-slate-400"
                        >
                          Qualification
                        </td>
                      </tr>
                    )}
                    <tr className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        <Link
                          href={`/leads?filter=${row.filter}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 hover:text-[#2C3E50] hover:underline"
                        >
                          {isCadence && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#B98A1D]" />
                          )}
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {isLoading ? '-' : row.count}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {isLoading ? '-' : `${pct}%`}
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
              {!isLoading && (!metrics || metrics.funnelRows.every((r) => r.count === 0)) && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-sm text-slate-400">
                    No data yet — send your first campaign to see the funnel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
