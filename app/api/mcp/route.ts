import { NextResponse, type NextRequest } from 'next/server'
import { resolveMcpToken, McpAuthError } from '@/lib/mcp/auth'
import { handleRpcMessage } from '@/lib/mcp/server'

export const runtime = 'nodejs'
export const maxDuration = 60

type RpcMessage = {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function rpcError(id: string | number | null, code: number, message: string, status: number) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { status, headers: JSON_HEADERS })
}

export async function POST(request: NextRequest) {
  // 1) Autenticação por token de workspace (Bearer). Vale para toda chamada, inclusive initialize.
  let auth
  try {
    auth = await resolveMcpToken(request.headers.get('authorization'))
  } catch (err) {
    if (err instanceof McpAuthError) {
      return rpcError(null, -32001, err.message, err.status)
    }
    return rpcError(null, -32603, 'Erro interno de autenticação.', 500)
  }

  // 2) Corpo JSON-RPC (mensagem única ou batch).
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return rpcError(null, -32700, 'JSON inválido.', 400)
  }

  const messages = Array.isArray(body) ? (body as RpcMessage[]) : [body as RpcMessage]

  const responses: object[] = []
  for (const message of messages) {
    if (!message || message.jsonrpc !== '2.0') {
      responses.push({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Requisição inválida.' } })
      continue
    }
    try {
      const response = await handleRpcMessage(message, auth)
      if (response) responses.push(response)
    } catch (err) {
      responses.push({
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: (err as Error).message || 'Erro interno.' },
      })
    }
  }

  // Só notificações → nada a responder.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202 })
  }

  const payload = Array.isArray(body) ? responses : responses[0]
  return NextResponse.json(payload, { headers: JSON_HEADERS })
}

// Transporte stateless: não há stream SSE iniciado pelo servidor nem sessão para encerrar.
export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}

export async function DELETE() {
  return new NextResponse(null, { status: 405 })
}
