create table if not exists public.google_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null unique,
  redirect_to text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_oauth_states_workspace_id_idx
on public.google_oauth_states(workspace_id);

create index if not exists google_oauth_states_state_idx
on public.google_oauth_states(state);

alter table public.google_oauth_states enable row level security;

drop policy if exists "Members can create google oauth states" on public.google_oauth_states;
create policy "Members can create google oauth states"
on public.google_oauth_states for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

drop policy if exists "Members can read own google oauth states" on public.google_oauth_states;
create policy "Members can read own google oauth states"
on public.google_oauth_states for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

create or replace function public.complete_google_oauth_connection(
  connection_state text,
  google_email_value text,
  scopes_value text[],
  access_token_value text,
  refresh_token_value text,
  expires_at_value timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  state_row public.google_oauth_states%rowtype;
  connection_id uuid;
begin
  select *
  into state_row
  from public.google_oauth_states
  where state = connection_state
    and used_at is null
    and expires_at > now()
  for update;

  if state_row.id is null then
    raise exception 'invalid_or_expired_google_oauth_state';
  end if;

  insert into public.google_connections (
    workspace_id,
    user_id,
    google_email,
    scopes,
    access_token_ciphertext,
    refresh_token_ciphertext,
    expires_at,
    status
  )
  values (
    state_row.workspace_id,
    state_row.user_id,
    google_email_value,
    coalesce(scopes_value, '{}'::text[]),
    access_token_value,
    refresh_token_value,
    expires_at_value,
    'connected'
  )
  on conflict (workspace_id, user_id)
  do update set
    google_email = excluded.google_email,
    scopes = excluded.scopes,
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = coalesce(
      excluded.refresh_token_ciphertext,
      public.google_connections.refresh_token_ciphertext
    ),
    expires_at = excluded.expires_at,
    status = 'connected',
    updated_at = now()
  returning id into connection_id;

  update public.google_oauth_states
  set used_at = now()
  where id = state_row.id;

  insert into public.activity_logs (
    workspace_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    state_row.workspace_id,
    state_row.user_id,
    'google_connection',
    connection_id,
    'connected',
    jsonb_build_object('google_email', google_email_value)
  );

  return connection_id;
end;
$$;

grant execute on function public.complete_google_oauth_connection(
  text,
  text,
  text[],
  text,
  text,
  timestamptz
) to anon, authenticated;
