create unique index if not exists send_jobs_workspace_lead_step_active_key
on public.send_jobs(workspace_id, lead_id, cadence_step_id)
where status in ('queued', 'running', 'sent');

create index if not exists send_jobs_campaign_sent_at_idx
on public.send_jobs(campaign_id, status, sent_at);
