create unique index if not exists email_messages_workspace_gmail_message_id_key
on public.email_messages(workspace_id, gmail_message_id);
