import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type ApproveCampaignBody = {
  workspaceId?: string
  campaignId?: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getUserIdFromRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')

  if (!token) return null

  const { data, error } = await getSupabaseServerClient().auth.getUser(token)

  if (error || !data.user) return null

  return data.user.id
}

export async function POST(request: NextRequest) {
  let body: ApproveCampaignBody

  try {
    body = (await request.json()) as ApproveCampaignBody
  } catch {
    return jsonError('Payload invalido.')
  }

  if (!body.workspaceId || !body.campaignId) {
    return jsonError('workspaceId e campaignId sao obrigatorios.')
  }

  const userId = await getUserIdFromRequest(request)

  if (!userId) {
    return jsonError('Sessao invalida.', 401)
  }

  const admin = getSupabaseAdminClient()

  const { data: membership } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', body.workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return jsonError('Usuario nao pertence a este workspace.', 403)
  }

  const [{ count: leadCount }, { count: stepCount }, { data: googleStatus }] = await Promise.all([
    admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', body.workspaceId),
    admin
      .from('cadence_steps')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', body.workspaceId)
      .eq('campaign_id', body.campaignId),
    admin.rpc('get_google_connection_status', {
      target_workspace_id: body.workspaceId,
    }),
  ])

  if (!leadCount) return jsonError('Importe leads antes de aprovar a campanha.')
  if (!stepCount) return jsonError('Configure a cadencia antes de aprovar a campanha.')
  if (googleStatus?.[0]?.status !== 'connected') {
    return jsonError('Conecte uma conta Google antes de aprovar a campanha.')
  }

  const approvedAt = new Date().toISOString()
  const { data: campaign, error: updateError } = await admin
    .from('campaigns')
    .update({
      status: 'approved',
      approved_at: approvedAt,
    })
    .eq('workspace_id', body.workspaceId)
    .eq('id', body.campaignId)
    .select('id, name, status, approved_at, daily_send_limit, monthly_lead_limit')
    .single()

  if (updateError || !campaign) {
    return jsonError(updateError?.message || 'Campanha nao encontrada para aprovacao.', 404)
  }

  await admin.from('activity_logs').insert({
    workspace_id: body.workspaceId,
    actor_user_id: userId,
    entity_type: 'campaign',
    entity_id: campaign.id,
    action: 'approved',
    metadata: {
      lead_count: leadCount,
      cadence_steps: stepCount,
      daily_send_limit: campaign.daily_send_limit,
      monthly_lead_limit: campaign.monthly_lead_limit,
    },
  })

  return NextResponse.json({
    ok: true,
    campaign,
  })
}
