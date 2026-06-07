'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  MailPlus,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Send,
  Trash2,
  Zap,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'

type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  monthly_lead_limit: number
  daily_send_limit: number
  created_at: string
}

export function CampaignsList() {
  const { workspace } = useWorkspace()
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dispatchResult, setDispatchResult] = useState<{ campaignId: string; message: string } | null>(null)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)

  const loadCampaigns = useCallback(async () => {
    if (!workspace) return

    setLoading(true)
    const { data } = await getSupabaseBrowserClient()
      .from('campaigns')
      .select('id, name, objective, status, monthly_lead_limit, daily_send_limit, created_at')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })

    setCampaigns(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => {
    if (!workspace) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadCampaigns()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [workspace, loadCampaigns])

  const updateCampaignStatus = async (campaign: CampaignRow, status: 'approved' | 'paused') => {
    if (!workspace) return

    setActionId(campaign.id)
    setError(null)

    const { error: updateError } = await getSupabaseBrowserClient()
      .from('campaigns')
      .update({ status })
      .eq('workspace_id', workspace.id)
      .eq('id', campaign.id)

    if (updateError) {
      setError(updateError.message)
      setActionId(null)
      return
    }

    setCampaigns((current) =>
      current.map((item) => (item.id === campaign.id ? { ...item, status } : item)),
    )
    setActionId(null)
  }

  const deleteCampaign = async (campaign: CampaignRow) => {
    if (!workspace) return

    const confirmed = window.confirm(
      `Delete campaign "${campaign.name}"? The cadence and associated jobs will also be removed.`,
    )
    if (!confirmed) return

    setActionId(campaign.id)
    setError(null)

    const { error: deleteError } = await getSupabaseBrowserClient()
      .from('campaigns')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('id', campaign.id)

    if (deleteError) {
      setError(deleteError.message)
      setActionId(null)
      return
    }

    setCampaigns((current) => current.filter((item) => item.id !== campaign.id))
    setActionId(null)
  }

  const dispatchNow = async (campaign: CampaignRow) => {
    if (!workspace) return
    setDispatchingId(campaign.id)
    setDispatchResult(null)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setError('Session expired. Please sign in again.')
      setDispatchingId(null)
      return
    }

    const res = await fetch('/api/campaigns/dispatch', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: workspace.id, campaignId: campaign.id }),
    })

    const json = (await res.json()) as {
      ok?: boolean
      sent?: number
      skipped?: number
      failed?: number
      error?: string
    }

    if (!res.ok || !json.ok) {
      setError(json.error || 'Could not dispatch campaign.')
    } else {
      setDispatchResult({
        campaignId: campaign.id,
        message: `${json.sent ?? 0} sent${json.skipped ? `, ${json.skipped} skipped` : ''}${json.failed ? `, ${json.failed} failed` : ''}`,
      })
    }
    setDispatchingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">Campaigns</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">Prospecting cadences</h1>
          <p className="mt-2 text-sm text-slate-600">
            Campaigns stay as drafts until you approve templates, schedules, and volume. In this phase,
            approving does not yet trigger automatic sending.
          </p>
          {!loading && campaigns.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              {(() => {
                const active = campaigns.filter((c) => c.status === 'approved' || c.status === 'active').length
                const paused = campaigns.filter((c) => c.status === 'paused').length
                return (
                  <>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${active > 0 ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {active} active
                    </span>
                    {paused > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        {paused} paused
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{campaigns.length} total</span>
                  </>
                )
              })()}
            </div>
          )}
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#34495E]"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Status <strong>approved</strong> means the campaign is ready for the engine.
            Automatic outbound sending is not yet enabled in this phase.
          </p>
        </div>
      </section>

      {dispatchResult ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          Dispatch complete: {dispatchResult.message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#2C3E50]">
            {loading ? 'Loading...' : `${campaigns.length} campaign(s)`}
          </h2>
        </div>

        {campaigns.length ? (
          <div className="divide-y divide-slate-100">
            {campaigns.map((campaign) => (
              <article
                key={campaign.id}
                className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F4D58D]/25 text-[#2C3E50]">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      {campaign.objective || 'No objective defined'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {campaign.status === 'draft'
                      ? 'Draft'
                      : campaign.status === 'approved'
                        ? 'Approved'
                        : campaign.status === 'active'
                          ? 'Active'
                          : campaign.status === 'paused'
                            ? 'Paused'
                            : 'Completed'}
                  </span>
                  <span className="rounded-full bg-[#F4D58D]/25 px-2.5 py-1 text-xs font-semibold text-[#2C3E50]">
                    {campaign.daily_send_limit}/day
                  </span>
                  <Link
                    href={`/campaigns/${campaign.id}/cadence`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#2C3E50] hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <Link
                    href={`/campaigns/${campaign.id}/review`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2C3E50] px-3 py-2 text-xs font-semibold text-white hover:bg-[#34495E]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Review
                  </Link>
                  {(campaign.status === 'approved' || campaign.status === 'active') && (
                    <div className="flex flex-col items-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => { void dispatchNow(campaign) }}
                        disabled={dispatchingId === campaign.id}
                        title="Triggers the engine for this campaign now, without waiting for the cron"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Zap className={`h-3.5 w-3.5 ${dispatchingId === campaign.id ? 'animate-pulse' : ''}`} />
                        {dispatchingId === campaign.id ? 'Sending...' : 'Send now'}
                      </button>
                      {dispatchResult?.campaignId === campaign.id && (
                        <span className="text-[10px] font-medium text-green-600">
                          ✓ {dispatchResult.message}
                        </span>
                      )}
                    </div>
                  )}
                  {campaign.status === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => updateCampaignStatus(campaign, 'approved')}
                      disabled={actionId === campaign.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Resume
                    </button>
                  ) : campaign.status === 'approved' || campaign.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => updateCampaignStatus(campaign, 'paused')}
                      disabled={actionId === campaign.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#2C3E50] hover:bg-slate-100 disabled:opacity-60"
                    >
                      <PauseCircle className="h-3.5 w-3.5" />
                      Pause
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => deleteCampaign(campaign)}
                    disabled={actionId === campaign.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <MailPlus className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 text-sm font-semibold text-slate-900">No campaigns yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create your first campaign to set up a cadence and templates.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
