import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { generateToken } from '@/lib/mcp/token'

export const runtime = 'nodejs'

const VALID_SCOPES = ['read', 'write', 'send'] as const

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await getSupabaseServerClient().auth.getUser(token)
  return data.user?.id || null
}

async function assertMembership(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// GET /api/mcp-tokens?workspaceId=... — lista tokens (sem nunca expor token_hash).
export async function GET(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return jsonError('Sessão inválida.', 401)

  const workspaceId = new URL(request.url).searchParams.get('workspaceId')
  if (!workspaceId) return jsonError('workspaceId obrigatório.')

  let admin: ReturnType<typeof getSupabaseAdminClient>
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no servidor.', 500)
  }

  if (!(await assertMembership(admin, workspaceId, userId))) {
    return jsonError('Usuário não pertence a este workspace.', 403)
  }

  const { data, error } = await admin
    .from('workspace_api_tokens')
    .select('id, name, token_prefix, scopes, last_used_at, created_at, revoked_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ tokens: data || [] })
}

// POST /api/mcp-tokens — cria token. Retorna o texto puro UMA ÚNICA vez.
export async function POST(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return jsonError('Sessão inválida.', 401)

  let admin: ReturnType<typeof getSupabaseAdminClient>
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no servidor.', 500)
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError('Payload inválido.')
  }

  const workspaceId = String(body.workspaceId || '')
  const name = String(body.name || '').trim()
  const scopesInput = Array.isArray(body.scopes) ? (body.scopes as unknown[]).map(String) : []

  if (!workspaceId) return jsonError('workspaceId obrigatório.')
  if (!name) return jsonError('Dê um nome ao token.')

  const scopes = [...new Set(scopesInput)].filter((s) =>
    (VALID_SCOPES as readonly string[]).includes(s),
  )
  if (scopes.length === 0) return jsonError('Selecione ao menos um scope (read, write, send).')
  // "read" é implícito sempre que houver qualquer permissão de leitura nas tools.
  if (!scopes.includes('read')) scopes.unshift('read')

  if (!(await assertMembership(admin, workspaceId, userId))) {
    return jsonError('Usuário não pertence a este workspace.', 403)
  }

  const { token, prefix, hash } = generateToken()

  const { data, error } = await admin
    .from('workspace_api_tokens')
    .insert({
      workspace_id: workspaceId,
      name,
      token_prefix: prefix,
      token_hash: hash,
      scopes,
      created_by: userId,
    })
    .select('id, name, token_prefix, scopes, created_at')
    .single()

  if (error || !data) return jsonError(error?.message || 'Falha ao criar token.', 500)

  await admin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    entity_type: 'mcp',
    entity_id: data.id,
    action: 'mcp:token_created',
    metadata: { token_name: name, scopes },
  })

  // token (texto puro) só aparece AQUI, nunca mais.
  return NextResponse.json({ ...data, token })
}
