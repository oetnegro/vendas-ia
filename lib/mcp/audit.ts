import type { getSupabaseAdminClient } from '@/lib/supabase-admin'
import type { Json } from '@/types/database'
import type { McpAuth } from '@/lib/mcp/auth'

type Admin = ReturnType<typeof getSupabaseAdminClient>

type AuditEntry = {
  tool: string
  status: 'ok' | 'error' | 'denied'
  args?: Record<string, unknown>
  resultSummary?: string
  entityId?: string | null
}

// Resume args para não vazar payloads grandes nem segredos no log.
function summarizeArgs(args?: Record<string, unknown>): Json {
  if (!args) return {}
  const out: Record<string, Json> = {}
  for (const [key, value] of Object.entries(args)) {
    if (value == null) continue
    if (typeof value === 'string') {
      out[key] = value.length > 120 ? `${value.slice(0, 120)}…` : value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    } else if (Array.isArray(value)) {
      out[key] = `[${value.length} itens]`
    } else {
      out[key] = '[objeto]'
    }
  }
  return out
}

export async function logMcpAction(admin: Admin, auth: McpAuth, entry: AuditEntry) {
  await admin.from('activity_logs').insert({
    workspace_id: auth.workspaceId,
    actor_user_id: null,
    entity_type: 'mcp',
    entity_id: entry.entityId ?? null,
    action: `mcp:${entry.tool}`,
    metadata: {
      tool: entry.tool,
      status: entry.status,
      token_name: auth.tokenName,
      args: summarizeArgs(entry.args),
      ...(entry.resultSummary ? { result: entry.resultSummary } : {}),
    } as Json,
  })
}
