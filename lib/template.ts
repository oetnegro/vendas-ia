import type { Json } from '@/types/database'

export type TemplateLead = {
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  custom_fields?: Json
}

export type TemplateCampaign = {
  objective: string | null
}

function jsonObject(value: Json | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, Json | undefined>
}

export function templateVariables(lead: TemplateLead, campaign?: TemplateCampaign | null) {
  const customFields = jsonObject(lead.custom_fields)
  const variables: Record<string, string> = {
    email: lead.email || '',
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    full_name: [lead.first_name, lead.last_name].filter(Boolean).join(' '),
    company: lead.company || '',
    title: lead.title || '',
    objective: campaign?.objective || '',
  }

  Object.entries(customFields).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      variables[key] = String(value)
    }
  })

  return variables
}

export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => {
    return variables[key] || ''
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeUrl(value: string) {
  const trimmed = value.trim()

  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed
  }

  return '#'
}

export function renderRichTextHtml(value: string) {
  const escaped = escapeHtml(value)
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/gi,
      (_match, label: string, url: string) =>
        `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    )
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n][^*\n]*?[^*\n])\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('')
}
