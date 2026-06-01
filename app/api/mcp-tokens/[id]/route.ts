import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await getSupabaseServerClient().auth.getUser(token)
  return data.user?.id || null
}

// DELETE /api/mcp-tokens/:id — revoga (soft) o token. Não apaga a linha.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) return jsonError('Sessão inválida.', 401)

  const { id } = await params
  if (!id) return jsonError('id obrigatório.')

  let admin: ReturnType<typeof getSupabaseAdminClient>
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no servidor.', 500)
  }

  const { data: token } = await admin
    .from('workspace_api_tokens')
    .select('id, workspace_id, name, revoked_at')
    .eq('id', id)
    .maybeSingle()

  if (!token) return jsonError('Token não encontrado.', 404)

  const { data: member } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', token.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) return jsonError('Usuário não pertence a este workspace.', 403)

  if (!token.revoked_at) {
    const { error } = await admin
      .from('workspace_api_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return jsonError(error.message, 500)

    await admin.from('activity_logs').insert({
      workspace_id: token.workspace_id,
      actor_user_id: userId,
      entity_type: 'mcp',
      entity_id: id,
      action: 'mcp:token_revoked',
      metadata: { token_name: token.name },
    })
  }

  return NextResponse.json({ revoked: true, id })
}
