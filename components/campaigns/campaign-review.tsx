'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { Json } from '@/types/database'
import { TemplateTestPanel } from '@/components/campaigns/template-test-panel'

type Campaign = {
  id: string
  agent_id: string | null
  name: string
  objective: string | null
  status: string
  monthly_lead_limit: number
  daily_send_limit: number
  sending_window: Json
  approved_at: string | null
}

type ReviewState = {
  campaign: Campaign | null
  agentCount: number
  leadCount: number
  stepCount: number
  googleConnected: boolean
  googleEmail: string | null
}

type SendingWindow = {
  mode?: 'single' | 'blocks'
  timezone?: string
  days?: string[]
  blocks?: string[]
  time?: string
  spacing_minutes?: number
  start?: string
  end?: string
}

function formatSendingWindow(value: Json) {
  const windowValue = (value || {}) as SendingWindow
  const days = windowValue.days?.length ? windowValue.days.join(', ') : 'business days'
  const timezone = windowValue.timezone || 'America/New_York'
  const time = windowValue.time || windowValue.blocks?.[0] || windowValue.start || '09:00'
  const spacing = Number(windowValue.spacing_minutes || 4)
  const blocks = Array.isArray(windowValue.blocks) && windowValue.blocks.length
    ? windowValue.blocks.join(', ')
    : null
  const start = windowValue.start || '09:00'
  const end = windowValue.end || '17:00'

  if (windowValue.mode === 'single' || windowValue.time) {
    return `${time} (${timezone}), ${spacing} min between sends, ${days}`
  }

  return blocks ? `${blocks}, ${days}` : `${start}-${end}, ${days}`
}

export function CampaignReview({ campaignId }: { campaignId: string }) {
  const { workspace } = useWorkspace()
  const [review, setReview] = useState<ReviewState>({
    campaign: null,
    agentCount: 0,
    leadCount: 0,
    stepCount: 0,
    googleConnected: false,
    googleEmail: null,
  })
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return

    async function loadReview() {
      if (!workspace) return

      setLoading(true)
      setError(null)

      const supabase = getSupabaseBrowserClient()
      const [
        { data: campaignData, error: campaignError },
        { count: leadCount },
        { count: stepCount },
        { count: agentCount },
        { data: googleStatus },
      ] = await Promise.all([
        supabase
          .from('campaigns')
          .select(
            'id, agent_id, name, objective, status, monthly_lead_limit, daily_send_limit, sending_window, approved_at',
          )
          .eq('workspace_id', workspace.id)
          .eq('id', campaignId)
          .single(),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id),
        supabase
          .from('cadence_steps')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('campaign_id', campaignId),
        supabase
          .from('agents')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id),
        supabase.rpc('get_google_connection_status', {
          target_workspace_id: workspace.id,
        }),
      ])

      if (campaignError) {
        setError(campaignError.message)
      }

      const connection = googleStatus?.[0] || null

      setReview({
        campaign: campaignData || null,
        agentCount: agentCount || 0,
        leadCount: leadCount || 0,
        stepCount: stepCount || 0,
        googleConnected: connection?.status === 'connected',
        googleEmail: connection?.google_email || null,
      })
      setLoading(false)
    }

    void loadReview()
  }, [campaignId, workspace])

  const checks = useMemo(
    () => [
      {
        key: 'agent',
        title: 'AI Agent trained',
        helper: 'At least one agent with business context exists in this workspace.',
        ok: review.agentCount > 0,
        href: '/onboarding',
        action: 'Configure agent',
        icon: Sparkles,
      },
      {
        key: 'leads',
        title: 'Leads imported',
        helper: `${review.leadCount} lead(s) available for prospecting.`,
        ok: review.leadCount > 0,
        href: '/leads/import',
        action: 'Import leads',
        icon: Users,
      },
      {
        key: 'google',
        title: 'Google connected',
        helper: review.googleEmail
          ? `Connected account: ${review.googleEmail}`
          : 'Connect Gmail and Calendar before approving.',
        ok: review.googleConnected,
        href: '/settings/google',
        action: 'Connect Google',
        icon: Mail,
      },
      {
        key: 'cadence',
        title: 'Cadence ready',
        helper: `${review.stepCount} email(s) configured for this campaign.`,
        ok: review.stepCount > 0,
        href: `/campaigns/${campaignId}/cadence`,
        action: 'Edit cadence',
        icon: FileText,
      },
      {
        key: 'limits',
        title: 'Healthy limits',
        helper: `${review.campaign?.daily_send_limit || 0}/day and ${
          review.campaign?.monthly_lead_limit || 0
        }/month.`,
        ok:
          Boolean(review.campaign) &&
          review.campaign!.daily_send_limit > 0 &&
          review.campaign!.monthly_lead_limit > 0 &&
          review.campaign!.daily_send_limit <= review.campaign!.monthly_lead_limit,
        href: '/campaigns',
        action: 'Review volume',
        icon: ShieldCheck,
      },
    ],
    [campaignId, review],
  )

  const canApprove = checks.every((check) => check.ok) && review.campaign?.status !== 'approved'

  const handleApprove = async () => {
    if (!workspace || !review.campaign || !canApprove) return

    setApproving(true)
    setError(null)
    setMessage(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Session expired. Sign in again to approve the campaign.')
      setApproving(false)
      return
    }

    const response = await fetch('/api/campaigns/approve', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: workspace.id,
        campaignId: review.campaign.id,
      }),
    })
    const json = (await response.json()) as {
      error?: string
      campaign?: { status: string; approved_at: string | null }
    }

    if (!response.ok || !json.campaign) {
      setError(json.error || 'Could not approve the campaign.')
      setApproving(false)
      return
    }

    const approvedCampaign = json.campaign

    setReview((current) => ({
      ...current,
      campaign: current.campaign
        ? {
            ...current.campaign,
            status: approvedCampaign.status,
            approved_at: approvedCampaign.approved_at,
          }
        : current.campaign,
    }))
    setMessage('Campaign approved and confirmed in the database.')
    setApproving(false)
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading review...</p>
  }

  if (!review.campaign) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#2C3E50]">Campaign not found</h1>
        <Link href="/campaigns" className="mt-5 inline-flex text-sm font-semibold text-[#2C3E50]">
          Back to campaigns
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            href={`/campaigns/${campaignId}/cadence`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#2C3E50]"
          >
            <ArrowLeft className="h-4 w-4" />
            Cadence
          </Link>
          <p className="mt-4 text-sm font-semibold text-[#B98A1D]">Review</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">{review.campaign.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Check the minimum requirements before approving. Approving changes the campaign status but
            does not yet trigger automatic email sending.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-sm font-bold text-[#2C3E50]">{review.campaign.status}</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#2C3E50]">Checklist de aprovacao</h2>
          <div className="mt-5 grid gap-3">
            {checks.map((check) => {
              const Icon = check.icon

              return (
                <article
                  key={check.key}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{check.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{check.helper}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {check.ok ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-amber-600" />
                    )}
                    {!check.ok ? (
                      <Link
                        href={check.href}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#2C3E50] hover:bg-slate-50"
                      >
                        {check.action}
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarClock className="h-5 w-5 text-[#B98A1D]" />
            <h2 className="mt-4 text-sm font-bold text-[#2C3E50]">Janela e volume</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Envios por dia</dt>
                <dd className="font-semibold text-slate-900">{review.campaign.daily_send_limit}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Leads por mes</dt>
                <dd className="font-semibold text-slate-900">
                  {review.campaign.monthly_lead_limit}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Horario</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {formatSendingWindow(review.campaign.sending_window)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-[#F4D58D]/60 bg-[#F4D58D]/10 p-5 shadow-sm">
            <ShieldCheck className="h-5 w-5 text-[#B98A1D]" />
            <h2 className="mt-4 text-sm font-bold text-[#2C3E50]">Compliance do MVP</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              A aprovacao registra log e exige Google, leads, cadencia e limites. Opt-out existe no
              banco, mas o footer/unsubscribe e a engine ainda entram na fase de disparo.
            </p>
          </div>
        </aside>
      </section>

      {workspace ? <TemplateTestPanel workspaceId={workspace.id} campaignId={campaignId} /> : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href={`/campaigns/${campaignId}/cadence`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#2C3E50] hover:bg-slate-50"
        >
          Voltar para cadencia
        </Link>
        <button
          type="button"
          onClick={handleApprove}
          disabled={!canApprove || approving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <CheckCircle2 className="h-4 w-4" />
          {review.campaign.status === 'approved'
            ? 'Campanha aprovada'
            : approving
              ? 'Aprovando...'
              : 'Aprovar campanha'}
        </button>
      </div>
    </div>
  )
}
