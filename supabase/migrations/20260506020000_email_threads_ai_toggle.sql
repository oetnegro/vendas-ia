alter table public.email_threads
add column if not exists ai_enabled boolean not null default true;
