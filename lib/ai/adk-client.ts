import {
  generateEmailAgentDecision,
  type EmailAgentDecision,
  type EmailAgentLead,
  type EmailAgentMessage,
  type EmailAgentProfile,
} from '@/lib/ai/email-agent'

type DecisionInput = {
  agent: EmailAgentProfile
  lead: EmailAgentLead
  messages: EmailAgentMessage[]
}

const VALID_ACTIONS = new Set(['reply', 'skip', 'opt_out'])
const VALID_LEAD_STATUS = new Set(['replied', 'interested', 'meeting_booked', 'negative', 'opted_out'])

function isEmailAgentDecision(value: unknown): value is EmailAgentDecision {
  if (!value || typeof value !== 'object') return false
  const decision = value as Record<string, unknown>
  return (
    typeof decision.action === 'string' &&
    VALID_ACTIONS.has(decision.action) &&
    typeof decision.intent === 'string' &&
    typeof decision.body === 'string' &&
    typeof decision.lead_status === 'string' &&
    VALID_LEAD_STATUS.has(decision.lead_status)
  )
}

async function callAdkAgent(input: DecisionInput): Promise<EmailAgentDecision> {
  const url = process.env.ADK_REPLY_URL
  const secret = process.env.ADK_SHARED_SECRET

  if (!url || !secret) {
    throw new Error('ADK_REPLY_URL or ADK_SHARED_SECRET not configured.')
  }

  const timeoutMs = Number(process.env.ADK_TIMEOUT_MS || 30_000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-ADK-Secret': secret,
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`ADK agent returned ${response.status}.`)
    }

    const json = (await response.json()) as unknown

    if (!isEmailAgentDecision(json)) {
      throw new Error('ADK agent returned an invalid decision payload.')
    }

    return json
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Returns the reply decision, routing through the ADK agent when USE_ADK_REPLY is
 * enabled. If the ADK call fails or times out, falls back to the in-process TS
 * brain so the pilot is never left without a response.
 */
export async function getEmailAgentDecision(input: DecisionInput): Promise<EmailAgentDecision> {
  if (process.env.USE_ADK_REPLY !== 'true') {
    return generateEmailAgentDecision(input)
  }

  try {
    return await callAdkAgent(input)
  } catch (error) {
    console.error(
      '[adk-client] ADK reply agent failed, falling back to TS brain:',
      error instanceof Error ? error.message : error,
    )
    return generateEmailAgentDecision(input)
  }
}
