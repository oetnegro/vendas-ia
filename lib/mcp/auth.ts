import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { hashToken } from '@/lib/mcp/token'

export type McpScope = 'read' | 'write' | 'send'

export type McpAuth = {
  tokenId: string
  workspaceId: string
  tokenName: string
  scopes: McpScope[]
}

export class McpAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'McpAuthError'
    this.status = status
  }
}

// ── Rate limit por token (janela deslizante simples, em memória) ────────────────
const RATE_LIMIT = Number(process.env.MCP_RATE_LIMIT_PER_MIN || 60)
const WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(tokenId: string) {
  const now = Date.now()
  const bucket = buckets.get(tokenId)
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(tokenId, { count: 1, windowStart: now })
    return
  }
  bucket.count += 1
  if (bucket.count > RATE_LIMIT) {
    throw new McpAuthError(
      `Limite de ${RATE_LIMIT} requisições por minuto atingido para este token.`,
      429,
    )
  }
}

// Evita escrever last_used_at a cada request (no máximo 1x/min por token).
const lastUsedWrites = new Map<string, number>()

export async function resolveMcpToken(authorizationHeader: string | null): Promise<McpAuth> {
  const raw = authorizationHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!raw) {
    throw new McpAuthError('Faltou o header Authorization: Bearer <token>.', 401)
  }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from('workspace_api_tokens')
    .select('id, workspace_id, name, scopes, revoked_at')
    .eq('token_hash', hashToken(raw))
    .maybeSingle()

  if (error) throw new McpAuthError('Falha ao validar o token.', 500)
  if (!data) throw new McpAuthError('Token inválido.', 401)
  if (data.revoked_at) throw new McpAuthError('Token revogado.', 401)

  checkRateLimit(data.id)

  const now = Date.now()
  const lastWrite = lastUsedWrites.get(data.id) || 0
  if (now - lastWrite > WINDOW_MS) {
    lastUsedWrites.set(data.id, now)
    await admin
      .from('workspace_api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
  }

  return {
    tokenId: data.id,
    workspaceId: data.workspace_id,
    tokenName: data.name,
    scopes: (data.scopes || []) as McpScope[],
  }
}

export function assertScope(auth: McpAuth, required: McpScope) {
  if (!auth.scopes.includes(required)) {
    throw new McpAuthError(
      `Este token não tem permissão "${required}". Scopes do token: ${auth.scopes.join(', ') || 'nenhum'}.`,
      403,
    )
  }
}
