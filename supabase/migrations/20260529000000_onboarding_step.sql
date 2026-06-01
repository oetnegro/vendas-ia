-- Persist onboarding wizard progress so users can resume mid-flow
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1;
