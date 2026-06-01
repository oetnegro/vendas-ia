import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { assertScope, McpAuthError, type McpAuth } from '@/lib/mcp/auth'
import { logMcpAction } from '@/lib/mcp/audit'
import type { ToolDef } from '@/lib/mcp/types'
import { readTools } from '@/lib/mcp/tools/read'
import { writeTools } from '@/lib/mcp/tools/write'

const SERVER_INFO = { name: 'vendas-ia', title: 'Vendas+IA', version: '1.0.0' }

export const TOOLS: ToolDef[] = [...readTools, ...writeTools]
const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]))

type JsonRpcId = string | number | null
type JsonRpcMessage = {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method?: string
  params?: Record<string, unknown>
}

function ok(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result }
}
function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } }
}

function toolsListPayload() {
  return {
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: t.scope === 'read' },
    })),
  }
}

async function runToolCall(message: JsonRpcMessage, auth: McpAuth) {
  const id = message.id ?? null
  const params = (message.params || {}) as { name?: string; arguments?: Record<string, unknown> }
  const tool = params.name ? TOOLS_BY_NAME.get(params.name) : undefined

  if (!tool) {
    return rpcError(id, -32602, `Tool desconhecida: ${params.name ?? '(vazio)'}`)
  }

  const admin = getSupabaseAdminClient()
  const args = params.arguments || {}

  try {
    assertScope(auth, tool.scope)
    const result = await tool.handler(args, { admin, auth })
    await logMcpAction(admin, auth, {
      tool: tool.name,
      status: 'ok',
      args,
      resultSummary: result.resultSummary,
      entityId: result.entityId ?? null,
    })
    return ok(id, {
      content: [{ type: 'text', text: result.text }],
      structuredContent: result.data ?? {},
    })
  } catch (err) {
    const denied = err instanceof McpAuthError
    const text = (err as Error).message || 'Erro ao executar a tool.'
    await logMcpAction(admin, auth, {
      tool: tool.name,
      status: denied ? 'denied' : 'error',
      args,
      resultSummary: text,
    })
    // Erros de tool voltam como resultado isError (o modelo lê e explica ao usuário).
    return ok(id, { content: [{ type: 'text', text }], isError: true })
  }
}

// Processa uma mensagem JSON-RPC. Retorna a resposta, ou null para notificações.
export async function handleRpcMessage(
  message: JsonRpcMessage,
  auth: McpAuth,
): Promise<object | null> {
  const id = message.id ?? null
  const method = message.method

  // Notificações (sem id) não geram resposta.
  if (message.id === undefined || message.id === null) {
    if (method && method.startsWith('notifications/')) return null
  }

  switch (method) {
    case 'initialize': {
      const requested = (message.params?.protocolVersion as string) || LATEST_PROTOCOL_VERSION
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : LATEST_PROTOCOL_VERSION
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Servidor MCP da Vendas+IA. Tools de leitura (campanhas, funil, respostas, leads) e de escrita (criar rascunho de campanha, buscar leads, pausar/retomar). Nenhuma tool envia e-mail diretamente — envios passam pelo fluxo de aprovação da plataforma.',
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, toolsListPayload())
    case 'tools/call':
      return runToolCall(message, auth)
    default:
      if (id === null) return null
      return rpcError(id, -32601, `Método não suportado: ${method}`)
  }
}
