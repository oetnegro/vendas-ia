-- Workspace API tokens: autenticam chamadas do MCP server (Claude Desktop / Cursor / Codex).
-- Guardamos SOMENTE o hash sha256 do token. O texto puro aparece uma única vez na geração.
CREATE TABLE IF NOT EXISTS public.workspace_api_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  token_prefix text NOT NULL,                       -- primeiros chars, exibidos na UI
  token_hash   text NOT NULL UNIQUE,                -- sha256 hex do token completo
  scopes       text[] NOT NULL DEFAULT '{read}',    -- subconjunto de {read,write,send}
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

ALTER TABLE public.workspace_api_tokens ENABLE ROW LEVEL SECURITY;

-- Membros do workspace podem gerenciar seus tokens. O token_hash nunca é enviado ao
-- browser: a app seleciona apenas colunas seguras (ver app/api/mcp-tokens).
CREATE POLICY "Members can manage workspace api tokens"
  ON public.workspace_api_tokens FOR ALL
  TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- Lookup rápido por hash na autenticação do MCP (admin client) e listagem por workspace.
CREATE INDEX idx_workspace_api_tokens_hash
  ON public.workspace_api_tokens (token_hash);
CREATE INDEX idx_workspace_api_tokens_workspace
  ON public.workspace_api_tokens (workspace_id, created_at DESC);
