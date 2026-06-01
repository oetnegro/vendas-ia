import type { CampaignStatus, LeadStatus } from '@/types/database'
import type { ToolDef, ToolContext } from '@/lib/mcp/types'

function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

function periodStart(days: unknown, fallbackDays = 30): string {
  const n = Number(days)
  const d = Number.isFinite(n) && n > 0 ? Math.floor(n) : fallbackDays
  const start = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
  return start.toISOString()
}

// ── list_campaigns ─────────────────────────────────────────────────────────────
const listCampaigns: ToolDef = {
  name: 'list_campaigns',
  description:
    'Lista as campanhas do workspace (id, nome, objetivo, status e data de criação). Use para ver o que existe antes de pausar, retomar ou detalhar uma campanha.',
  scope: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'approved', 'active', 'paused', 'completed'],
        description: 'Filtra por status da campanha (opcional).',
      },
      limit: { type: 'number', description: 'Máximo de campanhas a retornar (padrão 25, máx 100).' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    let query = ctx.admin
      .from('campaigns')
      .select('id, name, objective, status, created_at')
      .eq('workspace_id', ctx.auth.workspaceId)
      .order('created_at', { ascending: false })
      .limit(clampLimit(args.limit, 25, 100))

    if (typeof args.status === 'string') query = query.eq('status', args.status as CampaignStatus)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const campaigns = data || []
    const lines = campaigns.length
      ? campaigns.map((c) => `• ${c.name} — ${c.status} (id: ${c.id})`).join('\n')
      : 'Nenhuma campanha encontrada.'

    return {
      text: `${campaigns.length} campanha(s):\n${lines}`,
      data: { campaigns },
      resultSummary: `${campaigns.length} campanhas`,
    }
  },
}

// ── get_campaign ───────────────────────────────────────────────────────────────
const getCampaign: ToolDef = {
  name: 'get_campaign',
  description:
    'Detalha uma campanha pelo id, incluindo os passos de cadência (assunto e corpo de cada e-mail) e quantos leads estão associados.',
  scope: 'read',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'ID da campanha.' } },
    required: ['id'],
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    const id = String(args.id || '')
    if (!id) throw new Error('Informe o id da campanha.')

    const { data: campaign, error } = await ctx.admin
      .from('campaigns')
      .select('id, name, objective, status, daily_send_limit, monthly_lead_limit, created_at')
      .eq('workspace_id', ctx.auth.workspaceId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!campaign) throw new Error('Campanha não encontrada neste workspace.')

    const { data: steps } = await ctx.admin
      .from('cadence_steps')
      .select('step_order, delay_days, subject, body, requires_approval')
      .eq('workspace_id', ctx.auth.workspaceId)
      .eq('campaign_id', id)
      .order('step_order', { ascending: true })

    const { count: leadCount } = await ctx.admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.auth.workspaceId)
      .eq('campaign_id', id)

    const stepLines = (steps || [])
      .map((s) => `  ${s.step_order}. (+${s.delay_days}d) ${s.subject}`)
      .join('\n')

    return {
      text: `Campanha "${campaign.name}" — status ${campaign.status}, ${leadCount || 0} leads, ${(steps || []).length} passos:\n${stepLines || '  (sem passos)'}`,
      data: { campaign, steps: steps || [], lead_count: leadCount || 0 },
      entityId: campaign.id,
      resultSummary: `campanha ${campaign.name}`,
    }
  },
}

// ── get_funnel_stats ───────────────────────────────────────────────────────────
const getFunnelStats: ToolDef = {
  name: 'get_funnel_stats',
  description:
    'Resumo do funil no período (padrão últimos 30 dias): leads contatados, respostas, taxa de resposta, reuniões marcadas e opt-outs.',
  scope: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      period_days: { type: 'number', description: 'Janela em dias (padrão 30).' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    const since = periodStart(args.period_days, 30)
    const ws = ctx.auth.workspaceId

    const [{ data: outbound }, { data: inbound }, { count: meetings }, { count: optOuts }] =
      await Promise.all([
        ctx.admin
          .from('email_messages')
          .select('lead_id')
          .eq('workspace_id', ws)
          .eq('direction', 'outbound')
          .gte('created_at', since),
        ctx.admin
          .from('email_messages')
          .select('lead_id')
          .eq('workspace_id', ws)
          .eq('direction', 'inbound')
          .gte('created_at', since),
        ctx.admin
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws)
          .eq('status', 'meeting_booked')
          .gte('updated_at', since),
        ctx.admin
          .from('opt_outs')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws)
          .gte('created_at', since),
      ])

    const contacted = new Set((outbound || []).map((r) => r.lead_id)).size
    const replied = new Set((inbound || []).map((r) => r.lead_id)).size
    const responseRate = contacted > 0 ? Math.round((replied / contacted) * 1000) / 10 : 0

    const stats = {
      period_days: Number(args.period_days) > 0 ? Math.floor(Number(args.period_days)) : 30,
      contacted,
      replied,
      response_rate_pct: responseRate,
      meetings_booked: meetings || 0,
      opt_outs: optOuts || 0,
    }

    return {
      text: `Funil (${stats.period_days}d): ${contacted} contatados, ${replied} responderam (${responseRate}%), ${meetings || 0} reuniões, ${optOuts || 0} opt-outs.`,
      data: { stats },
      resultSummary: `${contacted} contatados / ${replied} respostas`,
    }
  },
}

// ── list_recent_replies ────────────────────────────────────────────────────────
const listRecentReplies: ToolDef = {
  name: 'list_recent_replies',
  description:
    'Resumo das respostas recentes do inbox: quem respondeu (nome, empresa, e-mail), a intenção detectada pela IA, um resumo e o status do lead.',
  scope: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Máximo de respostas (padrão 10, máx 50).' },
      period_days: { type: 'number', description: 'Janela em dias (padrão 14).' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    const ws = ctx.auth.workspaceId
    const since = periodStart(args.period_days, 14)
    const limit = clampLimit(args.limit, 10, 50)

    const { data: messages, error } = await ctx.admin
      .from('email_messages')
      .select('id, lead_id, thread_id, subject, body_text, created_at')
      .eq('workspace_id', ws)
      .eq('direction', 'inbound')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    const msgs = messages || []

    const leadIds = [...new Set(msgs.map((m) => m.lead_id))]
    const threadIds = [...new Set(msgs.map((m) => m.thread_id))]

    const [{ data: leads }, { data: actions }] = await Promise.all([
      leadIds.length
        ? ctx.admin
            .from('leads')
            .select('id, email, first_name, last_name, company, status')
            .eq('workspace_id', ws)
            .in('id', leadIds)
        : Promise.resolve({ data: [] as never[] }),
      threadIds.length
        ? ctx.admin
            .from('email_ai_actions')
            .select('thread_id, intent, summary, created_at')
            .eq('workspace_id', ws)
            .in('thread_id', threadIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
    ])

    const leadById = new Map((leads || []).map((l) => [l.id, l]))
    const intentByThread = new Map<string, { intent: string | null; summary: string | null }>()
    for (const a of actions || []) {
      if (!intentByThread.has(a.thread_id)) {
        intentByThread.set(a.thread_id, { intent: a.intent, summary: a.summary })
      }
    }

    const replies = msgs.map((m) => {
      const lead = leadById.get(m.lead_id)
      const ai = intentByThread.get(m.thread_id)
      const name = lead
        ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email
        : 'desconhecido'
      return {
        lead_name: name,
        company: lead?.company || null,
        email: lead?.email || null,
        lead_status: lead?.status || null,
        intent: ai?.intent || null,
        summary: ai?.summary || (m.body_text ? m.body_text.slice(0, 160) : null),
        replied_at: m.created_at,
      }
    })

    const lines = replies.length
      ? replies
          .map(
            (r) =>
              `• ${r.lead_name}${r.company ? ` (${r.company})` : ''} — intenção: ${r.intent || 'n/d'} — ${r.summary || ''}`,
          )
          .join('\n')
      : 'Nenhuma resposta no período.'

    return {
      text: `${replies.length} resposta(s) recente(s):\n${lines}`,
      data: { replies },
      resultSummary: `${replies.length} respostas`,
    }
  },
}

// ── list_leads ─────────────────────────────────────────────────────────────────
const listLeads: ToolDef = {
  name: 'list_leads',
  description:
    'Lista leads do workspace com filtros simples (status, busca por e-mail/empresa). Retorna nome, e-mail, empresa, cargo e status.',
  scope: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filtra por status do lead (ex.: new, contacted, replied, meeting_booked).',
      },
      search: { type: 'string', description: 'Busca por e-mail ou empresa (parcial).' },
      limit: { type: 'number', description: 'Máximo de leads (padrão 25, máx 100).' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    let query = ctx.admin
      .from('leads')
      .select('id, email, first_name, last_name, company, title, status, created_at')
      .eq('workspace_id', ctx.auth.workspaceId)
      .order('created_at', { ascending: false })
      .limit(clampLimit(args.limit, 25, 100))

    if (typeof args.status === 'string') query = query.eq('status', args.status as LeadStatus)
    if (typeof args.search === 'string' && args.search.trim()) {
      const term = args.search.trim().replace(/[%,]/g, '')
      query = query.or(`email.ilike.%${term}%,company.ilike.%${term}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const leads = data || []

    const lines = leads.length
      ? leads
          .map(
            (l) =>
              `• ${[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email} — ${l.company || 's/ empresa'} — ${l.status}`,
          )
          .join('\n')
      : 'Nenhum lead encontrado.'

    return {
      text: `${leads.length} lead(s):\n${lines}`,
      data: { leads },
      resultSummary: `${leads.length} leads`,
    }
  },
}

export const readTools: ToolDef[] = [
  listCampaigns,
  getCampaign,
  getFunnelStats,
  listRecentReplies,
  listLeads,
]
