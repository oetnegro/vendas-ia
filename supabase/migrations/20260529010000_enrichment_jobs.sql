-- Tracks enrichment runs: ICP prompt → Apify actor chosen → leads found → imported
CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  prompt         text NOT NULL,
  apify_actor    text NOT NULL,
  apify_run_id   text,
  params_json    jsonb,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','preview_ready','done','failed','blocked')),
  cost_usd       numeric(10,4),
  result_count   integer NOT NULL DEFAULT 0,
  leads_imported integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members manage enrichment_jobs"
  ON public.enrichment_jobs FOR ALL
  USING (public.is_workspace_member(workspace_id));

-- Used by quota check: SUM(leads_imported) WHERE workspace_id AND month
CREATE INDEX idx_enrichment_jobs_workspace_month
  ON public.enrichment_jobs (workspace_id, created_at);
