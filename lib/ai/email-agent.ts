import type { Json } from '@/types/database'
import { generateGeminiContent } from '@/lib/ai/vertex'

export type EmailAgentLead = {
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  custom_fields: Json
}

export type EmailAgentProfile = {
  name: string
  business_context: string | null
  common_objections: string | null
  campaign_goal: string | null
}

export type EmailAgentMessage = {
  direction: 'inbound' | 'outbound'
  subject: string | null
  body_text: string | null
  sent_at: string | null
}

export type EmailAgentDecision = {
  action: 'reply' | 'skip' | 'opt_out'
  intent:
    | 'interested'
    | 'objection'
    | 'question'
    | 'not_now'
    | 'negative'
    | 'opt_out'
    | 'neutral'
    | 'meeting'
  confidence: number
  summary: string
  subject: string
  body: string
  lead_status: 'replied' | 'interested' | 'meeting_booked' | 'negative' | 'opted_out'
  follow_up_days: number | null
  meeting_start_iso?: string | null
  meeting_end_iso?: string | null
  reasoning: string
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message?: string
  }
}

// === System instruction versionada (evals: baseline V1 vs tunada V2) ===
// V1 = baseline original (medido em 2026-06-01). Mantido para reverter/comparar.
// V2 = tunada a partir da análise de erro do baseline (ver evals/report.md).
// Seleção: env EMAIL_AGENT_PROMPT_VERSION = 'v1' | 'v2' (default 'v2' em produção).
const EMAIL_AGENT_INSTRUCTION_V1 =
  'Voce e uma IA SDR de prospeccao por e-mail. Responda como uma pessoa objetiva, educada e consultiva. Nao invente links de agenda, precos, cases ou promessas. Se o lead pedir descadastro, remover, parar ou unsubscribe, classifique como opt_out e responda apenas confirmando remocao. Se o lead apenas disser que nao tem interesse ou responder negativamente, classifique como negative, nao como opt_out. Se houver interesse em reuniao, conduza para combinar horarios. Quando o lead confirmar data e horario, use lead_status meeting_booked E preencha meeting_start_iso e meeting_end_iso em ISO 8601 com timezone (ex: 2026-05-30T11:00:00-03:00). A duracao padrao e 30 minutos se nao especificado. Nesse caso, o sistema criara automaticamente um convite Google Calendar com link do Meet e enviara ao lead por e-mail — entao no corpo da resposta diga algo como "Perfeito! Vou enviar o convite pelo Google Meet para o seu e-mail. Ate la!" — NUNCA peca para o lead enviar o convite. NUNCA invente links de Meet voce mesmo. Preserve o idioma do lead. Nunca inclua assinatura longa.'

// V2 (tunada 2026-06-03 a partir da analise de erro do baseline). Regras de classificacao
// mais nitidas para os padroes que o V1 errava: uso excessivo de "neutral", classe "question"
// nao reconhecida, "negative" confundido com opt_out/not_now, e baixa deteccao de "meeting".
const EMAIL_AGENT_INSTRUCTION_V2 =
  'Voce e uma IA SDR de prospeccao por e-mail/WhatsApp. Responda como uma pessoa objetiva, educada e consultiva. Nao invente links de agenda, precos, cases ou promessas. Preserve o idioma do lead e nunca inclua assinatura longa.\n\n' +
  'CLASSIFIQUE a intencao do lead considerando a CONVERSA INTEIRA (nao apenas a ultima mensagem). Escolha exatamente um "intent" seguindo estas regras, nesta ordem de prioridade:\n' +
  '1. opt_out: SOMENTE se o lead pedir explicitamente para parar, remover, descadastrar ou "unsubscribe". Apenas confirme a remocao no corpo. Recusa de interesse NAO e opt_out.\n' +
  '2. meeting: se houver QUALQUER interesse em agendar, conversar, receber uma demonstracao/apresentacao, ou se o lead estiver dando continuidade a um agendamento — MESMO sem ter batido data/horario. Se o lead fornecer e-mail ou telefone para RECEBER o convite, tambem e meeting. Se o lead CONFIRMAR uma data e horario especificos, use lead_status "meeting_booked" e preencha meeting_start_iso e meeting_end_iso em ISO 8601 com timezone (duracao padrao 30 min); nesse caso, no corpo diga que enviara o convite pelo Google Meet por e-mail (o sistema cria o convite automaticamente — NUNCA peca o convite ao lead nem invente links). Se houver interesse em agendar mas SEM data/horario definidos, mantenha intent "meeting", lead_status "interested" e meeting_start_iso/meeting_end_iso = null, e conduza para combinar horarios.\n' +
  '3. question: se o lead encaminhar voce para outra pessoa, COMPARTILHAR o contato de um decisor/responsavel, pedir para falar com outra area, ou fizer uma pergunta objetiva que precisa de resposta antes de avancar.\n' +
  '4. negative: se o lead recusar ou disser que nao tem interesse, mesmo de forma educada ("agradeco, mas nao", "ja temos solucao", "nao faz sentido para nos"). Recusa SEM pedido de remocao e negative (nao opt_out).\n' +
  '5. not_now: SOMENTE se o lead pedir explicitamente para retomar o contato mais tarde ("me procure no proximo trimestre", "agora nao, fale comigo em X").\n' +
  '6. interested: se o lead demonstrar abertura ou interesse positivo (elogia, pede mais informacao, sinaliza que faz sentido) mas ainda nao falar em agendar.\n' +
  '7. objection: se o lead levantar uma duvida/barreira concreta (preco, tempo, ja tem fornecedor) mas mantiver a conversa aberta.\n' +
  '8. neutral: use RARAMENTE — apenas quando NAO houver nenhum sinal de intencao (ex.: resposta automatica generica, mensagem fora de contexto). Na duvida entre neutral e qualquer classe com algum sinal, escolha a outra classe.'

function activeEmailAgentInstruction() {
  return process.env.EMAIL_AGENT_PROMPT_VERSION === 'v1'
    ? EMAIL_AGENT_INSTRUCTION_V1
    : EMAIL_AGENT_INSTRUCTION_V2
}

function stringifyFields(value: Json) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '{}'

  return JSON.stringify(value, null, 2)
}

function normalizeSubject(subject: string | null | undefined) {
  const cleaned = subject?.trim() || 'Retorno'
  return /^re:/i.test(cleaned) ? cleaned : `Re: ${cleaned}`
}

function extractOutputText(json: GeminiResponse) {
  return json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || ''
}

// O Gemini ocasionalmente devolve JSON com caracteres de controle crus (quebras de
// linha, tabs) dentro de valores string — JSON.parse rejeita isso. Escapamos apenas
// os caracteres de controle que estao DENTRO de strings, preservando a formatacao.
function escapeControlCharsInJsonStrings(raw: string) {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString) {
      const code = ch.charCodeAt(0)
      if (code < 0x20) {
        if (ch === '\n') out += '\\n'
        else if (ch === '\r') out += '\\r'
        else if (ch === '\t') out += '\\t'
        else out += '\\u' + code.toString(16).padStart(4, '0')
        continue
      }
    }
    out += ch
  }
  return out
}

// Parse tolerante: tenta direto, depois extrai do primeiro { ao ultimo } e
// reescapa caracteres de controle. Retorna null se nada funcionar.
function parseDecisionJson(outputText: string): EmailAgentDecision | null {
  const candidates = [outputText]
  const first = outputText.indexOf('{')
  const last = outputText.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const slice = outputText.slice(first, last + 1)
    candidates.push(slice)
    candidates.push(escapeControlCharsInJsonStrings(slice))
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as EmailAgentDecision
    } catch {
      // tenta o proximo candidato
    }
  }
  return null
}

function fallbackDecision({
  latestSubject,
  latestInbound,
}: {
  latestSubject: string | null
  latestInbound: string
}): EmailAgentDecision {
  const text = latestInbound.toLowerCase()
  const wantsOut = /\b(remover|descadastrar|unsubscribe|pare|parar)\b/i.test(text)
  const isNegative = /\b(nao quero|não quero|sem interesse|nao tenho interesse|não tenho interesse|negativo)\b/i.test(
    text,
  )
  const wantsMeeting = /\b(reuniao|reunião|agenda|horario|horário|call|conversar)\b/i.test(text)

  if (wantsOut) {
    return {
      action: 'opt_out',
      intent: 'opt_out',
      confidence: 0.8,
      summary: 'Lead pediu para parar ou demonstrou descadastro.',
      subject: normalizeSubject(latestSubject),
      body: 'Combinado, vou remover seu contato da nossa lista. Obrigado pelo retorno.',
      lead_status: 'opted_out',
      follow_up_days: null,
      meeting_start_iso: null,
      meeting_end_iso: null,
      reasoning: 'Fallback local detectou intenção de opt-out.',
    }
  }

  if (isNegative) {
    return {
      action: 'reply',
      intent: 'negative',
      confidence: 0.75,
      summary: 'Lead demonstrou falta de interesse, sem pedir descadastro.',
      subject: normalizeSubject(latestSubject),
      body: 'Obrigado pelo retorno. Vou encerrar o contato por aqui para nao insistir. Sucesso por ai.',
      lead_status: 'negative',
      follow_up_days: null,
      meeting_start_iso: null,
      meeting_end_iso: null,
      reasoning: 'Fallback local detectou resposta negativa sem opt-out.',
    }
  }

  return {
    action: 'reply',
    intent: wantsMeeting ? 'meeting' : 'question',
    confidence: 0.45,
    summary: 'Resposta automatica gerada por fallback local porque a Gemini nao esta configurada.',
    subject: normalizeSubject(latestSubject),
    body: wantsMeeting
      ? 'Perfeito, faz sentido avançarmos. Me diga dois horários bons para você nos próximos dias que eu organizo o próximo passo.'
      : 'Obrigado pelo retorno. Faz sentido eu te passar mais contexto por aqui ou prefere que eu envie uma sugestão objetiva de próximos passos?',
    lead_status: wantsMeeting ? 'interested' : 'replied',
    follow_up_days: wantsMeeting ? null : 3,
    meeting_start_iso: null,
    meeting_end_iso: null,
    reasoning: 'Sem GEMINI_API_KEY ou erro de IA; resposta conservadora para manter a conversa viva.',
  }
}

function skippedDecision({
  latestSubject,
  summary,
  reasoning,
}: {
  latestSubject: string | null | undefined
  summary: string
  reasoning: string
}): EmailAgentDecision {
  return {
    action: 'skip',
    intent: 'neutral',
    confidence: 1,
    summary,
    subject: normalizeSubject(latestSubject),
    body: '',
    lead_status: 'replied',
    follow_up_days: null,
    meeting_start_iso: null,
    meeting_end_iso: null,
    reasoning,
  }
}

export async function generateEmailAgentDecision({
  agent,
  lead,
  messages,
}: {
  agent: EmailAgentProfile
  lead: EmailAgentLead
  messages: EmailAgentMessage[]
}): Promise<EmailAgentDecision> {
  const latestInbound = [...messages]
    .reverse()
    .find((message) => message.direction === 'inbound' && message.body_text?.trim())
  const latestSubject =
    latestInbound?.subject || [...messages].reverse().find((message) => message.subject)?.subject || null

  if (!latestInbound?.body_text) {
    return {
      action: 'skip',
      intent: 'neutral',
      confidence: 1,
      summary: 'Nao existe resposta recebida para processar.',
      subject: normalizeSubject(latestSubject),
      body: '',
      lead_status: 'replied',
      follow_up_days: null,
      meeting_start_iso: null,
      meeting_end_iso: null,
      reasoning: 'Thread sem mensagem inbound.',
    }
  }

  const modelConfigured =
    process.env.GEMINI_PROVIDER === 'aistudio'
      ? !!process.env.GEMINI_API_KEY
      : !!(process.env.GCP_SA_KEY && process.env.GCP_PROJECT_ID)

  if (!modelConfigured) {
    if (process.env.AI_REPLY_FALLBACK_ENABLED !== 'true') {
      return skippedDecision({
        latestSubject,
        summary: 'Provedor Gemini nao configurado. Resposta automatica nao foi enviada.',
        reasoning: 'A engine exige modelo real para responder em nome do usuario.',
      })
    }

    return fallbackDecision({
      latestSubject,
      latestInbound: latestInbound.body_text,
    })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const nowIso = new Date().toISOString()
  const input = [
    `Data e hora atual (use para resolver referencias relativas como "amanha", "semana que vem", "segunda-feira"): ${nowIso}`,
    `Agente: ${agent.name}`,
    `Contexto do negocio:\n${agent.business_context || 'Nao informado.'}`,
    `Objetivo da campanha:\n${agent.campaign_goal || 'Marcar uma reuniao qualificada.'}`,
    `Objecoes comuns e respostas esperadas:\n${agent.common_objections || 'Nao informado.'}`,
    `Lead:\nNome: ${[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Nao informado'}\nEmail: ${
      lead.email
    }\nEmpresa: ${lead.company || 'Nao informada'}\nCargo: ${lead.title || 'Nao informado'}\nCampos extras: ${stringifyFields(
      lead.custom_fields,
    )}`,
    `Historico da thread, em ordem cronologica:\n${messages
      .map((message) => {
        const author = message.direction === 'outbound' ? 'Nosso agente' : 'Lead'
        return `[${author} | ${message.sent_at || 'sem data'} | ${message.subject || 'sem assunto'}]\n${
          message.body_text || ''
        }`
      })
      .join('\n\n---\n\n')}`,
  ].join('\n\n')

  const response = await generateGeminiContent({
    model,
    systemInstruction: {
      parts: [
        {
          text: activeEmailAgentInstruction(),
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${input}\n\nResponda somente com JSON valido no formato: {"action":"reply|skip|opt_out","intent":"interested|objection|question|not_now|negative|opt_out|neutral|meeting","confidence":0.0,"summary":"...","subject":"...","body":"...","lead_status":"replied|interested|meeting_booked|negative|opted_out","follow_up_days":3|null,"meeting_start_iso":"2026-05-07T14:00:00-03:00"|null,"meeting_end_iso":"2026-05-07T14:30:00-03:00"|null,"reasoning":"..."}. IMPORTANTE: quando o lead confirmar data e horario de reuniao, use lead_status meeting_booked e preencha meeting_start_iso e meeting_end_iso em ISO 8601 com timezone correto da conversa. Para calcular datas relativas como "amanha" ou "segunda-feira", use a data atual fornecida no contexto. Duracao padrao: 30 minutos. Se a data/hora nao estiver clara, use null e continue perguntando.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.35,
      // gemini-2.5-flash usa "thinking" por padrao, que consome o orcamento de tokens
      // e deixava a resposta JSON vazia/truncada (caia em skip/neutral). Desligamos o
      // thinking para esta tarefa de classificacao estruturada e damos folga no teto.
      maxOutputTokens: 4096,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  })

  const json = response.json as GeminiResponse

  if (!response.ok) {
    if (process.env.AI_REPLY_FALLBACK_ENABLED !== 'true') {
      return skippedDecision({
        latestSubject,
        summary: json.error?.message || 'Gemini retornou erro. Resposta automatica nao enviada.',
        reasoning: 'Falha na chamada Gemini.',
      })
    }

    return fallbackDecision({
      latestSubject,
      latestInbound: latestInbound.body_text,
    })
  }

  const outputText = extractOutputText(json)
  const decision = parseDecisionJson(outputText)

  if (decision) {
    return {
      ...decision,
      subject: normalizeSubject(decision.subject || latestSubject),
      body: (decision.body || '').trim(),
      confidence: Math.max(0, Math.min(1, Number(decision.confidence) || 0)),
    }
  }

  if (process.env.AI_REPLY_FALLBACK_ENABLED !== 'true') {
    return skippedDecision({
      latestSubject,
      summary: 'Gemini retornou JSON invalido. Resposta automatica nao enviada.',
      reasoning: 'Falha ao interpretar a resposta estruturada da Gemini.',
    })
  }

  return fallbackDecision({
    latestSubject,
    latestInbound: latestInbound.body_text,
  })
}
