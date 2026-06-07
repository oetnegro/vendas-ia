'use client'

import Link from 'next/link'
import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Lightbulb, Plus, Send, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'

const timezoneOptions = [
  { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
  { value: 'America/New_York', label: 'US Eastern (New York)' },
  { value: 'America/Chicago', label: 'US Central (Chicago)' },
  { value: 'America/Denver', label: 'US Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { value: 'Europe/London', label: 'Western Europe (London)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Berlin)' },
]

const campaignSuggestions = {
  b2b_services: {
    label: 'B2B Services',
    name: 'Outbound consultivo B2B',
    objective: 'Gerar reunioes de diagnostico com decisores B2B que tenham dor comercial clara.',
    dailyLimit: 30,
    sendWindows: ['09:00', '14:00'],
    spacingMinutes: 5,
    timezone: 'America/Sao_Paulo',
  },
  saas: {
    label: 'SaaS / Software',
    name: 'Outbound SaaS - decisores',
    objective: 'Abrir conversas com decisores para validar dor, maturidade e fit para demonstracao.',
    dailyLimit: 30,
    sendWindows: ['08:30', '13:00'],
    spacingMinutes: 4,
    timezone: 'America/Sao_Paulo',
  },
  agency: {
    label: 'Agencies',
    name: 'Outbound agencias',
    objective: 'Marcar conversas com donos de agencias interessados em melhorar prospeccao e previsibilidade.',
    dailyLimit: 25,
    sendWindows: ['10:00', '15:00'],
    spacingMinutes: 5,
    timezone: 'America/Sao_Paulo',
  },
  intl: {
    label: 'International (US/Europe)',
    name: 'Outbound internacional',
    objective: 'Prospectar decisores nos EUA ou Europa com abordagem direta e objetiva.',
    dailyLimit: 20,
    sendWindows: ['09:00', '15:00'],
    spacingMinutes: 5,
    timezone: 'America/New_York',
  },
}

const MAX_WINDOWS = 3

export function CampaignBuilder() {
  const router = useRouter()
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [dailyLimit, setDailyLimit] = useState(30)
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  // Multiple send windows (up to 3)
  const [sendWindows, setSendWindows] = useState<string[]>(['09:00'])
  const [spacingMinutes, setSpacingMinutes] = useState(5)
  const [sector, setSector] = useState<keyof typeof campaignSuggestions>('b2b_services')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const applyCampaignSuggestion = () => {
    const suggestion = campaignSuggestions[sector]
    setName(suggestion.name)
    setObjective(suggestion.objective)
    setDailyLimit(suggestion.dailyLimit)
    setSendWindows(suggestion.sendWindows)
    setSpacingMinutes(suggestion.spacingMinutes)
    setTimezone(suggestion.timezone)
  }

  const addWindow = () => {
    if (sendWindows.length >= MAX_WINDOWS) return
    // Default next window +4h from last
    const last = sendWindows[sendWindows.length - 1] ?? '09:00'
    const [h, m] = last.split(':').map(Number)
    const next = `${String(Math.min(h + 4, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    setSendWindows((prev) => [...prev, next])
  }

  const removeWindow = (index: number) => {
    if (sendWindows.length <= 1) return
    setSendWindows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateWindow = (index: number, value: string) => {
    setSendWindows((prev) => prev.map((w, i) => (i === index ? value : w)))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submittingRef.current) return

    if (!workspace) {
      setError('Create a workspace before creating a campaign.')
      return
    }

    submittingRef.current = true
    setLoading(true)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: agents } = await supabase
      .from('agents')
      .select('id')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })
      .limit(1)

    // Sort windows chronologically
    const sortedWindows = [...sendWindows].sort()

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspace.id,
        agent_id: agents?.[0]?.id || null,
        name,
        objective,
        monthly_lead_limit: 9999, // not enforced — daily limit is the real control
        daily_send_limit: dailyLimit,
        sending_window: {
          mode: sortedWindows.length > 1 ? 'blocks' : 'single',
          timezone,
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          blocks: sortedWindows,
          time: sortedWindows[0],
          spacing_minutes: spacingMinutes,
        },
        status: 'draft',
      })
      .select('id')
      .single()

    setLoading(false)

    if (campaignError || !campaign) {
      submittingRef.current = false
      setError(campaignError?.message || 'Could not create the campaign.')
      return
    }

    router.push(`/campaigns/${campaign.id}/cadence`)
  }

  if (!workspaceLoading && !workspace) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#2C3E50]">Set up the agent first</h1>
        <p className="mt-2 text-sm text-slate-600">
          A campaign requires a workspace and AI context.
        </p>
        <Link
          href="/setup"
          className="mt-5 inline-flex rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white"
        >
          Go to setup
        </Link>
      </section>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">Campaigns</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">New campaign</h1>
          <p className="mt-2 text-sm text-slate-600">
            Set objective, daily volume, and send windows. The campaign starts as a draft.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SlidersHorizontal className="h-5 w-5 text-[#B98A1D]" />
          <h2 className="mt-3 text-sm font-semibold text-[#2C3E50]">Anti-spam best practices</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
            <li>• 20–30/day for new accounts, up to 50 for warmed accounts</li>
            <li>• 3–5 cadence steps is the quality standard</li>
            <li>• 4–7 min spacing between sends prevents bursts</li>
            <li>• AI stops automatically when a lead replies</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[#F4D58D]/60 bg-[#F4D58D]/10 p-5 shadow-sm">
          <Sparkles className="h-5 w-5 text-[#B98A1D]" />
          <h2 className="mt-3 text-sm font-semibold text-[#2C3E50]">Suggestion by sector</h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-700">
            Fills in objective, recommended volume, and name.
          </p>
          <select
            value={sector}
            onChange={(event) => setSector(event.target.value as keyof typeof campaignSuggestions)}
            className="mt-3 w-full rounded-lg border border-[#2C3E50]/25 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/40"
          >
            {Object.entries(campaignSuggestions).map(([key, suggestion]) => (
              <option key={key} value={key}>
                {suggestion.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyCampaignSuggestion}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#34495E]"
          >
            <Lightbulb className="h-4 w-4" />
            Apply suggestion
          </button>
        </div>
      </aside>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Campaign name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Outbound SaaS B2B - June"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Objective</span>
            <textarea
              required
              rows={3}
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="e.g. Book diagnostic meetings with B2B commercial directors."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          {/* Volume */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Sends per day</span>
              <p className="text-xs text-slate-500">Recommended: 25–40 for active accounts</p>
              <input
                type="number"
                min={1}
                max={200}
                value={dailyLimit}
                onChange={(event) => setDailyLimit(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Spacing between sends</span>
              <p className="text-xs text-slate-500">Minutes between each email</p>
              <input
                type="number"
                min={2}
                max={60}
                value={spacingMinutes}
                onChange={(event) => setSpacingMinutes(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>
          </div>

          {/* Timezone */}
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Leads timezone</span>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* Send windows */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarClock className="h-4 w-4 text-[#B98A1D]" />
                  Send windows
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  Times when emails can be dispatched (up to 3)
                </p>
              </div>
              {sendWindows.length < MAX_WINDOWS && (
                <button
                  type="button"
                  onClick={addWindow}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C3E50] hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add window
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {sendWindows.map((window, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2C3E50] text-[10px] font-bold text-[#F4D58D]">
                    {index + 1}
                  </div>
                  <input
                    type="time"
                    value={window}
                    onChange={(event) => updateWindow(index, event.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
                  />
                  {sendWindows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeWindow(index)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-2 rounded-lg border border-[#F4D58D]/60 bg-[#FFF9E8] px-3 py-2 text-xs text-slate-600">
              The daily limit is spread across windows. With {sendWindows.length} window{sendWindows.length > 1 ? 's' : ''}, each processes up to <strong>{Math.ceil(dailyLimit / sendWindows.length)}</strong> sends with a {spacingMinutes} min interval.
            </p>
          </div>

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
              {loading ? 'Creating...' : 'Create campaign'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
