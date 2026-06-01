create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.agent_status as enum ('draft', 'active', 'paused');
create type public.google_connection_status as enum ('pending', 'connected', 'revoked', 'error');
create type public.campaign_status as enum ('draft', 'approved', 'active', 'paused', 'completed');
create type public.lead_status as enum ('new', 'queued', 'contacted', 'replied', 'interested', 'meeting_booked', 'opted_out', 'paused');
create type public.send_job_status as enum ('queued', 'running', 'sent', 'failed', 'cancelled', 'blocked');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text,
  scopes text[] not null default '{}',
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  status public.google_connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  business_context text,
  common_objections text,
  campaign_goal text,
  status public.agent_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  name text not null,
  objective text,
  status public.campaign_status not null default 'draft',
  monthly_lead_limit integer not null default 0,
  daily_send_limit integer not null default 0,
  sending_window jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cadence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  step_order integer not null,
  delay_days integer not null default 0,
  subject text not null,
  body text not null,
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  email text not null,
  first_name text,
  last_name text,
  company text,
  title text,
  source text,
  status public.lead_status not null default 'new',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  gmail_thread_id text,
  status text not null default 'open',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, gmail_thread_id)
);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  gmail_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  subject text,
  body_text text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.send_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  cadence_step_id uuid references public.cadence_steps(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status public.send_job_status not null default 'queued',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opt_outs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index google_connections_workspace_id_idx on public.google_connections(workspace_id);
create index agents_workspace_id_idx on public.agents(workspace_id);
create index campaigns_workspace_id_idx on public.campaigns(workspace_id);
create index leads_workspace_id_idx on public.leads(workspace_id);
create index send_jobs_workspace_status_idx on public.send_jobs(workspace_id, status, scheduled_for);
create index activity_logs_workspace_id_idx on public.activity_logs(workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger set_google_connections_updated_at
before update on public.google_connections
for each row execute function public.set_updated_at();

create trigger set_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

create trigger set_campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger set_send_jobs_updated_at
before update on public.send_jobs
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.google_connections enable row level security;
alter table public.agents enable row level security;
alter table public.campaigns enable row level security;
alter table public.cadence_steps enable row level security;
alter table public.leads enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.send_jobs enable row level security;
alter table public.opt_outs enable row level security;
alter table public.activity_logs enable row level security;

create policy "Users can create workspaces"
on public.workspaces for insert
to authenticated
with check (created_by = auth.uid());

create policy "Members can read workspaces"
on public.workspaces for select
to authenticated
using (created_by = auth.uid() or public.is_workspace_member(id));

create policy "Members can update workspaces"
on public.workspaces for update
to authenticated
using (public.is_workspace_member(id))
with check (public.is_workspace_member(id));

create policy "Users can create own membership"
on public.workspace_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.workspaces
      where workspaces.id = workspace_members.workspace_id
        and workspaces.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.workspace_members as wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
);

create policy "Members can read workspace memberships"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Owners and admins can manage memberships"
on public.workspace_members for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
)
with check (public.is_workspace_member(workspace_id));

create policy "Members can access google connections"
on public.google_connections for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access agents"
on public.agents for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access campaigns"
on public.campaigns for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access cadence steps"
on public.cadence_steps for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access leads"
on public.leads for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access email threads"
on public.email_threads for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access email messages"
on public.email_messages for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access send jobs"
on public.send_jobs for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can access opt outs"
on public.opt_outs for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can read activity logs"
on public.activity_logs for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members can create activity logs"
on public.activity_logs for insert
to authenticated
with check (public.is_workspace_member(workspace_id));
