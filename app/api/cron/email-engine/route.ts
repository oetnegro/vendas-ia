import { NextResponse, type NextRequest } from 'next/server'
import { processAutomaticEmailReplies } from '@/lib/ai/email-reply-engine'
import { processCampaignCadenceSends } from '@/lib/campaign-dispatch-engine'
import { refreshGoogleAccessToken } from '@/lib/email/gmail'
import { syncWorkspaceGmail } from '@/lib/email/gmail-sync'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { captureServerEvent } from '@/lib/posthog-server'

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  const admin = getSupabaseAdminClient()
  const maxConnections = numberEnv('AI_ENGINE_MAX_CONNECTIONS_PER_RUN', 10)
  const maxThreads = numberEnv('AI_ENGINE_MAX_THREADS_PER_WORKSPACE', 25)
  const maxReplies = numberEnv('AI_ENGINE_MAX_REPLIES_PER_WORKSPACE_RUN', 5)
  const minimumInboundAgeMinutes = numberEnv('AI_REPLY_MIN_AGE_MINUTES', 3)
  const dailyWorkspaceLimit = numberEnv('AI_DAILY_EMAIL_LIMIT_PER_WORKSPACE', 80)

  const { data: connections, error } = await admin
    .from('google_connections')
    .select(
      'id, workspace_id, user_id, google_email, access_token_ciphertext, refresh_token_ciphertext, expires_at',
    )
    .eq('status', 'connected')
    .not('google_email', 'is', null)
    .not('access_token_ciphertext', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(maxConnections)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const results = []

  for (const connection of connections || []) {
    try {
      if (!connection.google_email || !connection.access_token_ciphertext) continue

      let accessToken = connection.access_token_ciphertext
      const expiresAtMs = connection.expires_at ? new Date(connection.expires_at).getTime() : 0

      if (expiresAtMs < Date.now() + 60_000) {
        if (!connection.refresh_token_ciphertext) {
          results.push({
            workspaceId: connection.workspace_id,
            googleEmail: connection.google_email,
            ok: false,
            error: 'Token Google expirado e sem refresh token.',
          })
          continue
        }

        try {
          const refreshed = await refreshGoogleAccessToken(connection.refresh_token_ciphertext)
          accessToken = refreshed.accessToken

          await admin
            .from('google_connections')
            .update({
              access_token_ciphertext: refreshed.accessToken,
              expires_at: refreshed.expiresAt,
              status: 'connected',
            })
            .eq('id', connection.id)
        } catch (refreshError) {
          await admin
            .from('google_connections')
            .update({ status: 'error' })
            .eq('id', connection.id)

          results.push({
            workspaceId: connection.workspace_id,
            googleEmail: connection.google_email,
            ok: false,
            error: `Falha ao renovar token Google: ${refreshError instanceof Error ? refreshError.message : 'Erro desconhecido.'}`,
          })
          continue
        }
      }

      const sync = await syncWorkspaceGmail({
        admin,
        workspaceId: connection.workspace_id,
        userId: connection.user_id,
        connectedGoogleEmail: connection.google_email,
        accessToken,
        maxThreads,
      })

      const aiReplies = await processAutomaticEmailReplies({
        admin,
        workspaceId: connection.workspace_id,
        actorUserId: connection.user_id,
        connection: {
          google_email: connection.google_email,
        },
        accessToken,
        limit: maxReplies,
        minimumInboundAgeMinutes,
        dailyWorkspaceLimit,
      })

      const campaignDispatch = await processCampaignCadenceSends({
        admin,
        workspaceId: connection.workspace_id,
        actorUserId: connection.user_id,
        connection: {
          google_email: connection.google_email,
        },
        accessToken,
      })

      results.push({
        workspaceId: connection.workspace_id,
        googleEmail: connection.google_email,
        ok: true,
        sync,
        aiReplies,
        campaignDispatch,
      })
    } catch (error) {
      results.push({
        workspaceId: connection.workspace_id,
        googleEmail: connection.google_email,
        ok: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na cron.',
      })
    }
  }

  await admin.from('activity_logs').insert(
    results.map((result) => ({
      workspace_id: result.workspaceId,
      actor_user_id: null,
      entity_type: 'email_engine_cron',
      entity_id: null,
      action: result.ok ? 'processed' : 'failed',
      metadata: result,
    })),
  )

  const totalSent = results.reduce((sum, r) => sum + (('sent' in r && typeof r.sent === 'number') ? r.sent : 0), 0)
  const totalFailed = results.reduce((sum, r) => sum + (('failed' in r && typeof r.failed === 'number') ? r.failed : 0), 0)

  if (totalSent > 0 || totalFailed > 0) {
    captureServerEvent('cron', 'cron_email_engine_run', {
      processed_connections: results.length,
      total_sent: totalSent,
      total_failed: totalFailed,
      trigger: 'cron',
    })
  }

  return NextResponse.json({
    ok: true,
    processedConnections: results.length,
    results,
  })
}
