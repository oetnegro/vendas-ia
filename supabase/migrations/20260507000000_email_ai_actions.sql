create table if not exists public.email_ai_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  inbound_message_id uuid references public.email_messages(id) on delete set null,
  action text not null,
  intent text,
  confidence numeric,
  summary text,
  response_subject text,
  response_body text,
  sent_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, inbound_message_id, action)
);

create index if not exists email_ai_actions_workspace_created_idx
on public.email_ai_actions(workspace_id, created_at desc);

create index if not exists email_ai_actions_thread_idx
on public.email_ai_actions(thread_id, created_at desc);

alter table public.email_ai_actions enable row level security;

drop policy if exists "Members can access email ai actions" on public.email_ai_actions;
create policy "Members can access email ai actions"
on public.email_ai_actions for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
