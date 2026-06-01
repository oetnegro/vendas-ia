drop policy if exists "Members can access google connections" on public.google_connections;

create or replace function public.get_google_connection_status(target_workspace_id uuid)
returns table (
  google_email text,
  status public.google_connection_status,
  expires_at timestamptz,
  updated_at timestamptz,
  scopes text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'not_authorized_for_workspace';
  end if;

  return query
  select
    gc.google_email,
    gc.status,
    gc.expires_at,
    gc.updated_at,
    gc.scopes
  from public.google_connections as gc
  where gc.workspace_id = target_workspace_id
    and gc.user_id = auth.uid()
  order by gc.updated_at desc
  limit 1;
end;
$$;

create or replace function public.disconnect_google_connection(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id uuid;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'not_authorized_for_workspace';
  end if;

  update public.google_connections
  set
    access_token_ciphertext = null,
    refresh_token_ciphertext = null,
    expires_at = null,
    status = 'revoked',
    updated_at = now()
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
  returning id into connection_id;

  if connection_id is not null then
    insert into public.activity_logs (
      workspace_id,
      actor_user_id,
      entity_type,
      entity_id,
      action
    )
    values (
      target_workspace_id,
      auth.uid(),
      'google_connection',
      connection_id,
      'disconnected'
    );
  end if;
end;
$$;

grant execute on function public.get_google_connection_status(uuid) to authenticated;
grant execute on function public.disconnect_google_connection(uuid) to authenticated;
