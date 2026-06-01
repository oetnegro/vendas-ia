'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Mail, Send, Sparkles } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { renderRichTextHtml, renderTemplate, templateVariables } from '@/lib/template'
import type { Json } from '@/types/database'

type Lead = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  custom_fields: Json
}

type CadenceStep = {
  id: string
  step_order: number
  subject: string
  body: string
}

type Campaign = {
  objective: string | null
}

export function TemplateTestPanel({
  workspaceId,
  campaignId,
}: {
  workspaceId: string
  campaignId: string
}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [steps, setSteps] = useState<CadenceStep[]>([])
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [leadId, setLeadId] = useState('')
  const [stepId, setStepId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    async function loadOptions() {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()
      const [{ data: leadRows }, { data: stepRows }, { data: campaignRow }] = await Promise.all([
        supabase
          .from('leads')
          .select('id, email, first_name, last_name, company, title, custom_fields')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('cadence_steps')
          .select('id, step_order, subject, body')
          .eq('workspace_id', workspaceId)
          .eq('campaign_id', campaignId)
          .order('step_order', { ascending: true }),
        supabase
          .from('campaigns')
          .select('objective')
          .eq('workspace_id', workspaceId)
          .eq('id', campaignId)
          .single(),
      ])

      setLeads(leadRows || [])
      setSteps(stepRows || [])
      setCampaign(campaignRow || null)
      setLeadId(leadRows?.[0]?.id || '')
      setStepId(stepRows?.[0]?.id || '')
      setLoading(false)
    }

    void loadOptions()
  }, [campaignId, workspaceId])

  const selectedLead = leads.find((lead) => lead.id === leadId) || null
  const selectedStep = steps.find((step) => step.id === stepId) || null
  const preview = useMemo(() => {
    if (!selectedLead || !selectedStep) {
      return {
        subject: '',
        body: '',
      }
    }

    const variables = templateVariables(selectedLead, campaign)

    return {
      subject: renderTemplate(selectedStep.subject, variables),
      body: renderTemplate(selectedStep.body, variables),
    }
  }, [campaign, selectedLead, selectedStep])
  const previewHtml = useMemo(() => renderRichTextHtml(preview.body), [preview.body])

  const variables = selectedLead ? templateVariables(selectedLead, campaign) : {}

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedLead || !selectedStep) {
      setError('Selecione um lead e um passo da cadencia.')
      return
    }

    setSending(true)
    setError(null)
    setResult(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Sessao expirada. Faça login novamente.')
      setSending(false)
      return
    }

    const response = await fetch('/api/email/send-template-test', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        campaignId,
        leadId: selectedLead.id,
        cadenceStepId: selectedStep.id,
      }),
    })

    const json = (await response.json()) as {
      ok?: boolean
      messageId?: string
      to?: string
      subject?: string
      error?: string
    }

    setSending(false)

    if (!response.ok || !json.ok) {
      setError(json.error || 'Nao foi possivel enviar o template.')
      return
    }

    setResult(`Template enviado para ${json.to}. Gmail message id: ${json.messageId}.`)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">Teste de variaveis</p>
          <h2 className="mt-1 text-lg font-bold text-[#2C3E50]">Enviar template para um lead</h2>
          <p className="mt-1 text-sm text-slate-500">
            Escolha um lead e um email da cadencia para ver como as variaveis ficam antes do envio.
          </p>
        </div>
        <Sparkles className="hidden h-6 w-6 text-[#B98A1D] md:block" />
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Carregando leads e templates...</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Lead</span>
              <select
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              >
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email} -{' '}
                    {lead.company || lead.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email da cadencia</span>
              <select
                value={stepId}
                onChange={(event) => setStepId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              >
                {steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    Email {step.step_order} - {step.subject}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-[#2C3E50]">Variaveis disponiveis</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(variables).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                    title={value}
                  >
                    {`{{${key}}}`}
                  </span>
                ))}
              </div>
            </aside>

            <article className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#F4D58D]">
                <Mail className="h-4 w-4" />
                Preview renderizado
              </div>
              <h3 className="mt-4 text-sm font-bold">{preview.subject || 'Sem assunto'}</h3>
              {previewHtml ? (
                <div
                  className="email-preview mt-3 text-sm leading-6 text-slate-200"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-200">Sem corpo</p>
              )}
            </article>
          </div>

          {error ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          ) : null}

          {result ? (
            <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {result}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !selectedLead || !selectedStep}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Enviando...' : 'Enviar template real'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
