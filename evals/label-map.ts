// Gabarito: mapeia status_funil (rótulo humano no CRM legado) -> intent esperado
// do cérebro generateEmailAgentDecision. Revisável a olho nu.
//
// Origem: vendas_leads_consolidados.status_funil (conversas reais do Vendas+IA no WhatsApp).
// Só os status abaixo são considerados "desfecho rotulado" e entram nas medições.
// Estados de pipeline ("1º Mensagem", null, etc.) NÃO são gabarito e ficam de fora.

export type ExpectedIntent =
  | 'interested'
  | 'question'
  | 'not_now'
  | 'negative'
  | 'neutral'
  | 'meeting'

export const LABEL_MAP: Record<string, ExpectedIntent> = {
  NEGATIVA: 'negative',
  INTERESSE_AGENDAMENTO: 'meeting',
  AGENDAMENTO_CONFIRMADO: 'meeting',
  ENVIAR_FOLLOWUP: 'not_now',
  IGNORAR: 'neutral',
  COMPARTILHAMENTO_CONTATO_DECISOR: 'question',
  // Variante sem "_DECISOR" observada no dado real: mesmo sentido (lead encaminha contato).
  COMPARTILHAMENTO_CONTATO: 'question',
  CLIENTE_QUALIFICADO: 'interested',
  CLIENTE: 'interested',
}

// Regra de acerto parcial: para INTERESSE_AGENDAMENTO o esperado é 'meeting',
// mas 'interested' conta como acerto PARCIAL (lead quer reunião mas ainda não bateu horário).
// O runner registra acerto estrito (intent == esperado) e a taxa de acerto parcial à parte.
export const PARTIAL_CREDIT: Partial<Record<string, ExpectedIntent[]>> = {
  INTERESSE_AGENDAMENTO: ['interested'],
}

// lead_status esperado quando há reunião confirmada.
export const EXPECTED_MEETING_BOOKED_STATUSES = new Set(['AGENDAMENTO_CONFIRMADO'])

export function isLabeledOutcome(statusFunil: string | null): boolean {
  return !!statusFunil && statusFunil in LABEL_MAP
}
