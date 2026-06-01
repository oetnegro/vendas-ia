import type { getSupabaseAdminClient } from '@/lib/supabase-admin'
import type { McpAuth, McpScope } from '@/lib/mcp/auth'

export type ToolContext = {
  admin: ReturnType<typeof getSupabaseAdminClient>
  auth: McpAuth
}

// JSON Schema simples (Draft-07) — é exatamente o que tools/list retorna ao cliente.
export type JsonSchema = {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export type ToolResult = {
  // Texto que o cliente (Claude) lê, e um bloco estruturado opcional.
  text: string
  data?: Record<string, unknown>
  entityId?: string | null
  resultSummary?: string
}

export type ToolDef = {
  name: string
  description: string
  scope: McpScope
  inputSchema: JsonSchema
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>
}
