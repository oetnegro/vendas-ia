'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Code,
  Italic,
  Lightbulb,
  Link as LinkIcon,
  List,
  Mail,
  Plus,
  Save,
  Sparkles,
  Type,
  Trash2,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { Json } from '@/types/database'

type CadenceStep = {
  id?: string
  step_order: number
  delay_days: number
  subject: string
  body: string
}

type Campaign = {
  id: string
  name: string
  objective: string | null
  status: string
  monthly_lead_limit: number
  daily_send_limit: number
  sending_window: Json
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

const timezoneOptions = [
  { value: 'America/New_York', label: 'EUA Leste (New York)' },
  { value: 'America/Chicago', label: 'EUA Central (Chicago)' },
  { value: 'America/Denver', label: 'EUA Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'EUA Pacifico (Los Angeles)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (Sao Paulo)' },
]

const defaultSteps: CadenceStep[] = [
  {
    step_order: 1,
    delay_days: 0,
    subject: 'Ideia rapida para {{company}}',
    body: 'Oi {{first_name}}, tudo bem? Vi que voce atua na {{company}} e queria entender se faz sentido conversar sobre {{objective}}.\n\nSe fizer sentido, posso te mandar um contexto rapido?',
  },
  {
    step_order: 2,
    delay_days: 3,
    subject: 'Re: Ideia rapida para {{company}}',
    body: 'Oi {{first_name}}, passando rapido aqui.\n\nA ideia nao e tomar seu tempo agora, e sim entender se existe abertura para uma conversa curta sobre {{objective}}. Faz sentido eu te mandar 2 horarios?',
  },
  {
    step_order: 3,
    delay_days: 7,
    subject: 'Fecho por aqui?',
    body: 'Oi {{first_name}}, prometo ser breve.\n\nSe isso nao for prioridade agora, eu paro por aqui. Se fizer sentido avaliar, posso sugerir alguns horarios para uma conversa inicial.',
  },
]

const sectorSuggestions: Record<
  string,
  {
    label: string
    recommendedSteps: number
    reason: string
    steps: CadenceStep[]
  }
> = {
  b2b_services: {
    label: 'Servicos B2B',
    recommendedSteps: 4,
    reason: 'Venda consultiva costuma precisar de contexto, follow-up leve e encerramento elegante.',
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: 'Ideia rapida para {{company}}',
        body: 'Oi {{first_name}}, tudo bem?\n\nVi que voce atua na {{company}} e queria entender se faz sentido conversar sobre {{objective}}.\n\nSe fizer sentido, posso te mandar um contexto rapido?',
      },
      {
        step_order: 2,
        delay_days: 3,
        subject: 'Re: Ideia rapida para {{company}}',
        body: 'Oi {{first_name}}, passando rapido por aqui.\n\nNormalmente ajudamos empresas parecidas com a {{company}} a abrir conversas mais qualificadas sem aumentar o time comercial.\n\nFaz sentido uma conversa curta esta semana?',
      },
      {
        step_order: 3,
        delay_days: 7,
        subject: 'Vale explorar isso agora?',
        body: 'Oi {{first_name}}, queria ser direto.\n\nSe {{objective}} estiver no radar de voces, posso sugerir dois horarios para uma conversa objetiva. Se nao for prioridade, eu paro por aqui sem problema.',
      },
      {
        step_order: 4,
        delay_days: 12,
        subject: 'Fecho por aqui?',
        body: 'Oi {{first_name}}, ultima tentativa por aqui.\n\nNao quero insistir se nao fizer sentido. Quer que eu encerre o contato ou vale deixar uma conversa rapida agendada?',
      },
    ],
  },
  saas: {
    label: 'SaaS / Software',
    recommendedSteps: 5,
    reason: 'SaaS se beneficia de uma cadencia um pouco maior, alternando dor, prova e CTA.',
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: 'Pergunta sobre {{company}}',
        body: 'Oi {{first_name}}, tudo bem?\n\nEstou falando com empresas que querem resolver {{objective}} sem criar mais complexidade operacional.\n\nIsso e algo que faria sentido para a {{company}} olhar agora?',
      },
      {
        step_order: 2,
        delay_days: 2,
        subject: 'Re: Pergunta sobre {{company}}',
        body: 'Oi {{first_name}}, complemento rapido.\n\nO ponto principal costuma ser ganhar previsibilidade e reduzir trabalho manual no processo comercial.\n\nSe isso conversa com o momento de voces, posso te mostrar em 15 minutos.',
      },
      {
        step_order: 3,
        delay_days: 5,
        subject: 'Como voces lidam com isso hoje?',
        body: 'Oi {{first_name}}, fiquei curioso: hoje voces resolvem {{objective}} internamente, com ferramenta, ou ainda esta meio manual?\n\nDependendo da resposta, ja te digo se faz sentido continuar.',
      },
      {
        step_order: 4,
        delay_days: 9,
        subject: 'Dois horarios?',
        body: 'Oi {{first_name}}, se fizer sentido avaliar, posso sugerir dois horarios esta semana.\n\nPrometo uma conversa objetiva: entender contexto, ver se existe encaixe e sair com proximo passo claro.',
      },
      {
        step_order: 5,
        delay_days: 14,
        subject: 'Sem prioridade agora?',
        body: 'Oi {{first_name}}, imagino que talvez nao seja prioridade agora.\n\nQuer que eu encerre por aqui ou posso retomar em outro momento?',
      },
    ],
  },
  agency: {
    label: 'Agencias',
    recommendedSteps: 4,
    reason: 'Agencias respondem melhor com mensagens curtas, foco em ganho operacional e agenda clara.',
    steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject: 'Ideia para a {{company}}',
        body: 'Oi {{first_name}}, tudo certo?\n\nTrabalho com uma abordagem para ajudar agencias a resolver {{objective}} com menos carga operacional.\n\nFaz sentido eu te mandar a ideia em 2 linhas?',
      },
      {
        step_order: 2,
        delay_days: 3,
        subject: 'Re: Ideia para a {{company}}',
        body: 'Oi {{first_name}}, sendo bem direto: a ideia e apoiar a prospeccao sem depender de mais horas do time.\n\nSe isso for uma dor ai, podemos conversar 15 minutos?',
      },
      {
        step_order: 3,
        delay_days: 6,
        subject: 'Isso entra no radar?',
        body: 'Oi {{first_name}}, vale entender se {{objective}} entra no radar da {{company}} para este trimestre.\n\nSe sim, te mando dois horarios. Se nao, sem crise.',
      },
      {
        step_order: 4,
        delay_days: 10,
        subject: 'Ultima tentativa',
        body: 'Oi {{first_name}}, ultima mensagem minha sobre isso.\n\nSe fizer sentido, responda com “vamos ver” que eu sugiro horarios. Se nao, eu encerro por aqui.',
      },
    ],
  },
}

function applyTextFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: string,
  options?: { url?: string },
) {
  const selected = value.slice(selectionStart, selectionEnd)
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  const fallback = selected || 'texto'

  if (format === 'bold') return `${before}**${fallback}**${after}`
  if (format === 'italic') return `${before}*${fallback}*${after}`
  if (format === 'link') return `${before}[${fallback}](${options?.url || 'https://exemplo.com'})${after}`
  if (format === 'list') return `${before}${selected ? selected.split('\n').map((line) => `- ${line}`).join('\n') : '- item'}${after}`
  if (format === 'code') return `${before}\`${fallback}\`${after}`

  return value
}

export function CadenceEditor({ campaignId }: { campaignId: string }) {
  const { workspace } = useWorkspace()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [steps, setSteps] = useState<CadenceStep[]>(defaultSteps)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSector, setSelectedSector] = useState('b2b_services')
  const [campaignSettings, setCampaignSettings] = useState({
    name: '',
    objective: '',
    monthlyLeadLimit: 500,
    dailySendLimit: 30,
    timezone: 'America/New_York',
    sendTime: '09:00',
    spacingMinutes: 4,
  })

  const estimatedDurationMinutes =
    Math.max(0, Math.floor(campaignSettings.dailySendLimit || 0) - 1) *
    Math.max(1, Math.floor(campaignSettings.spacingMinutes || 1))

  useEffect(() => {
    if (!workspace) return

    const load = async () => {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()
      const [{ data: campaignData }, { data: stepData }] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id, name, objective, status, monthly_lead_limit, daily_send_limit, sending_window')
          .eq('workspace_id', workspace.id)
          .eq('id', campaignId)
          .single(),
        supabase
          .from('cadence_steps')
          .select('id, step_order, delay_days, subject, body')
          .eq('workspace_id', workspace.id)
          .eq('campaign_id', campaignId)
          .order('step_order', { ascending: true }),
      ])

      setCampaign(campaignData || null)
      if (campaignData) {
        const sendingWindow = (campaignData.sending_window || {}) as SendingWindow
        setCampaignSettings({
          name: campaignData.name,
          objective: campaignData.objective || '',
          monthlyLeadLimit: campaignData.monthly_lead_limit,
          dailySendLimit: campaignData.daily_send_limit,
          timezone: sendingWindow?.timezone || 'America/New_York',
          sendTime: sendingWindow?.time || sendingWindow?.blocks?.[0] || sendingWindow?.start || '09:00',
          spacingMinutes: Number(sendingWindow?.spacing_minutes || 4),
        })
      }
      if (stepData?.length) {
        setSteps(stepData)
      }
      setLoading(false)
    }

    void load()
  }, [campaignId, workspace])

  const updateStep = (index: number, update: Partial<CadenceStep>) => {
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...update } : step)),
    )
  }

  const formatStepBody = (
    index: number,
    textarea: HTMLTextAreaElement | null,
    format: string,
  ) => {
    if (!textarea) return
    const url =
      format === 'link'
        ? window.prompt('Cole a URL do link', 'https://')
        : null

    if (format === 'link' && !url) return

    const nextBody = applyTextFormat(
      steps[index].body,
      textarea.selectionStart,
      textarea.selectionEnd,
      format,
      { url: url || undefined },
    )

    updateStep(index, { body: nextBody })
    window.requestAnimationFrame(() => textarea.focus())
  }

  const insertVariable = (index: number, textarea: HTMLTextAreaElement | null, variable: string) => {
    if (!textarea) return

    const before = steps[index].body.slice(0, textarea.selectionStart)
    const after = steps[index].body.slice(textarea.selectionEnd)
    updateStep(index, { body: `${before}{{${variable}}}${after}` })
    window.requestAnimationFrame(() => textarea.focus())
  }

  const addStep = () => {
    setSteps((current) => [
      ...current,
      {
        step_order: current.length + 1,
        delay_days: 5,
        subject: 'Novo follow-up',
        body: 'Oi {{first_name}}, tudo bem?',
      },
    ])
  }

  const applySuggestion = () => {
    const suggestion = sectorSuggestions[selectedSector]
    setSteps(suggestion.steps.map((step, index) => ({ ...step, step_order: index + 1 })))
    setMessage(`Sugestao aplicada: ${suggestion.recommendedSteps} emails para ${suggestion.label}.`)
    setError(null)
  }

  const removeStep = (index: number) => {
    setSteps((current) =>
      current
        .filter((_step, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({ ...step, step_order: stepIndex + 1 })),
    )
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!workspace) return

    setSaving(true)
    setMessage(null)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const existingIds = steps.map((step) => step.id).filter(Boolean)
    const shouldRequireReapproval = campaign?.status && campaign.status !== 'draft'

    const { error: campaignUpdateError } = await supabase
      .from('campaigns')
      .update({
        name: campaignSettings.name,
        objective: campaignSettings.objective,
        monthly_lead_limit: campaignSettings.monthlyLeadLimit,
        daily_send_limit: campaignSettings.dailySendLimit,
        sending_window: {
          mode: 'single',
          timezone: campaignSettings.timezone,
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          time: campaignSettings.sendTime,
          spacing_minutes: campaignSettings.spacingMinutes,
          start: campaignSettings.sendTime,
          end: campaignSettings.sendTime,
        },
        ...(shouldRequireReapproval ? { status: 'draft', approved_at: null } : {}),
      })
      .eq('workspace_id', workspace.id)
      .eq('id', campaignId)

    if (campaignUpdateError) {
      setSaving(false)
      setError(campaignUpdateError.message)
      return
    }

    const { data: currentSteps } = await supabase
      .from('cadence_steps')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('campaign_id', campaignId)

    const idsToDelete =
      currentSteps?.map((step) => step.id).filter((id) => !existingIds.includes(id)) || []

    if (idsToDelete.length) {
      await supabase.from('cadence_steps').delete().in('id', idsToDelete)
    }

    const normalizedSteps = steps.map((step, index) => ({
      workspace_id: workspace.id,
      campaign_id: campaignId,
      step_order: index + 1,
      delay_days: Number(step.delay_days) || 0,
      subject: step.subject,
      body: step.body,
      requires_approval: true,
    }))

    const stepsToUpdate = normalizedSteps
      .map((step, index) => ({ ...step, id: steps[index].id }))
      .filter((step): step is typeof step & { id: string } => Boolean(step.id))

    const stepsToInsert = normalizedSteps.filter((_step, index) => !steps[index].id)

    for (const step of stepsToUpdate) {
      const { id, ...update } = step
      const { error: updateError } = await supabase
        .from('cadence_steps')
        .update(update)
        .eq('id', id)
        .eq('workspace_id', workspace.id)

      if (updateError) {
        setSaving(false)
        setError(updateError.message)
        return
      }
    }

    if (stepsToInsert.length) {
      const { error: insertError } = await supabase.from('cadence_steps').insert(stepsToInsert)

      if (insertError) {
        setSaving(false)
        setError(insertError.message)
        return
      }
    }

    setSaving(false)

    setCampaign((current) =>
      current
        ? {
            ...current,
              name: campaignSettings.name,
              objective: campaignSettings.objective,
              monthly_lead_limit: campaignSettings.monthlyLeadLimit,
              daily_send_limit: campaignSettings.dailySendLimit,
              sending_window: {
              mode: 'single',
              timezone: campaignSettings.timezone,
              days: ['mon', 'tue', 'wed', 'thu', 'fri'],
              time: campaignSettings.sendTime,
              spacing_minutes: campaignSettings.spacingMinutes,
              start: campaignSettings.sendTime,
              end: campaignSettings.sendTime,
            },
            status: shouldRequireReapproval ? 'draft' : current.status,
          }
        : current,
    )

    setMessage(
      shouldRequireReapproval
        ? 'Campanha salva como rascunho. Revise e aprove novamente antes de usar na engine.'
        : 'Cadencia salva como rascunho.',
    )
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando cadencia...</p>
  }

  if (!campaign) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#2C3E50]">Campanha nao encontrada</h1>
        <Link href="/campaigns" className="mt-5 inline-flex text-sm font-semibold text-[#2C3E50]">
          Voltar para campanhas
        </Link>
      </section>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#2C3E50]"
          >
            <ArrowLeft className="h-4 w-4" />
            Campanhas
          </Link>
          <p className="mt-4 text-sm font-semibold text-[#B98A1D]">Cadencia</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">{campaign.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Edite objetivo, horarios, volume e emails. Se uma campanha aprovada for alterada, ela
            volta para rascunho para nova revisao.
          </p>
        </div>
        <button
          type="button"
          onClick={addStep}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C3E50]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#2C3E50] shadow-sm hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar passo
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F4D58D]/25 text-[#2C3E50]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#2C3E50]">Configuracao da campanha</h2>
            <p className="mt-1 text-sm text-slate-600">
              Defina o horario local do publico e um espacamento entre e-mails para reduzir risco
              de spam.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Nome da campanha</span>
            <input
              required
              value={campaignSettings.name}
              onChange={(event) =>
                setCampaignSettings((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Objetivo</span>
            <textarea
              required
              rows={3}
              value={campaignSettings.objective}
              onChange={(event) =>
                setCampaignSettings((current) => ({ ...current, objective: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Leads por mes</span>
              <input
                type="number"
                min={1}
                value={campaignSettings.monthlyLeadLimit}
                onChange={(event) =>
                  setCampaignSettings((current) => ({
                    ...current,
                    monthlyLeadLimit: Number(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Envios por dia</span>
              <input
                type="number"
                min={1}
                value={campaignSettings.dailySendLimit}
                onChange={(event) =>
                  setCampaignSettings((current) => ({
                    ...current,
                    dailySendLimit: Number(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Timezone dos leads</span>
              <select
                value={campaignSettings.timezone}
                onChange={(event) =>
                  setCampaignSettings((current) => ({ ...current, timezone: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Horario inicial</span>
              <input
                type="time"
                value={campaignSettings.sendTime}
                onChange={(event) =>
                  setCampaignSettings((current) => ({ ...current, sendTime: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Espacamento</span>
              <input
                type="number"
                min={1}
                max={60}
                value={campaignSettings.spacingMinutes}
                onChange={(event) =>
                  setCampaignSettings((current) => ({
                    ...current,
                    spacingMinutes: Number(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
              />
              <p className="mt-1 text-xs text-slate-500">minutos entre um envio e outro</p>
              </label>
          </div>

          <p className="rounded-lg border border-[#F4D58D]/60 bg-[#FFF9E8] px-3 py-2 text-xs font-medium text-slate-700">
            Com {campaignSettings.dailySendLimit || 0}/dia e espacamento de{' '}
            {campaignSettings.spacingMinutes || 0} minuto(s), a rodada leva cerca de{' '}
            {estimatedDurationMinutes} minuto(s). O Email 1 deve ficar com delay 0 para sair no
            primeiro horario elegivel depois da aprovacao.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-[#F4D58D]/60 bg-[#F4D58D]/10 p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2C3E50] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#2C3E50]">Sugestao de IA para cadencia</h2>
              <p className="mt-1 text-sm text-slate-800">
                Escolha o setor e aplique uma estrutura inicial com quantidade de emails, assuntos,
                corpo e delays. Voce ainda edita tudo antes de aprovar.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="sector-suggestion">
              Setor
            </label>
            <select
              id="sector-suggestion"
              value={selectedSector}
              onChange={(event) => setSelectedSector(event.target.value)}
              className="rounded-lg border border-[#2C3E50]/25 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#B98A1D] focus:ring-2 focus:ring-[#F4D58D]/40"
            >
              {Object.entries(sectorSuggestions).map(([key, suggestion]) => (
                <option key={key} value={key}>
                  {suggestion.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applySuggestion}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#34495E]"
            >
              <Lightbulb className="h-4 w-4" />
              Aplicar sugestao
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-[#F4D58D]/70 bg-white px-3 py-2 text-sm font-medium text-slate-800">
          Para {sectorSuggestions[selectedSector].label}, indicamos{' '}
          <strong>{sectorSuggestions[selectedSector].recommendedSteps} emails</strong>.{' '}
          {sectorSuggestions[selectedSector].reason}
        </p>
      </section>

      <section className="grid gap-4">
        {steps.map((step, index) => (
          <article key={step.id || index} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4D58D]/25 text-sm font-bold text-[#2C3E50]">
                  {index + 1}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Email {index + 1}</h2>
                  <p className="text-xs text-slate-500">Delay de {step.delay_days} dia(s)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeStep(index)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block md:w-48">
                <span className="text-sm font-semibold text-slate-700">Delay em dias</span>
                <input
                  type="number"
                  min={0}
                  value={step.delay_days}
                  onChange={(event) => updateStep(index, { delay_days: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Mail className="h-4 w-4" />
                  Assunto
                </span>
                <input
                  required
                  value={step.subject}
                  onChange={(event) => updateStep(index, { subject: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
                />
              </label>

              <label className="block">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-slate-700">Corpo</span>
                  <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {[
                      { key: 'bold', label: 'Negrito', icon: Type },
                      { key: 'italic', label: 'Italico', icon: Italic },
                      { key: 'link', label: 'Link', icon: LinkIcon },
                      { key: 'list', label: 'Lista', icon: List },
                      { key: 'code', label: 'Codigo', icon: Code },
                    ].map((action) => {
                      const Icon = action.icon

                      return (
                        <button
                          key={action.key}
                          type="button"
                          title={action.label}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const textarea = document.getElementById(
                              `cadence-body-${index}`,
                            ) as HTMLTextAreaElement | null
                            formatStepBody(index, textarea, action.key)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-[#2C3E50]"
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      )
                    })}
                    <select
                      aria-label="Inserir variavel"
                      defaultValue=""
                      onChange={(event) => {
                        const textarea = document.getElementById(
                          `cadence-body-${index}`,
                        ) as HTMLTextAreaElement | null
                        insertVariable(index, textarea, event.target.value)
                        event.target.value = ''
                      }}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-[#2C3E50]"
                    >
                      <option value="" disabled>
                        Variavel
                      </option>
                      <option value="first_name">{'{{first_name}}'}</option>
                      <option value="company">{'{{company}}'}</option>
                      <option value="title">{'{{title}}'}</option>
                      <option value="objective">{'{{objective}}'}</option>
                    </select>
                  </div>
                </div>
                <textarea
                  id={`cadence-body-${index}`}
                  required
                  rows={7}
                  value={step.body}
                  onChange={(event) => updateStep(index, { body: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Dica: os botoes salvam como texto formatado. No Gmail, negrito, links e listas
                  saem como HTML no envio.
                </p>
              </label>
            </div>
          </article>
        ))}
      </section>

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

      <div className="flex justify-end">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/campaigns/${campaignId}/review`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#2C3E50] transition hover:bg-slate-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Revisar campanha
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar cadencia'}
          </button>
        </div>
      </div>
    </form>
  )
}
