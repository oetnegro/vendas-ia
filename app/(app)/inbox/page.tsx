import type { Metadata } from 'next'
import { EmailInbox } from '@/components/inbox/email-inbox'

export const metadata: Metadata = {
  title: 'Inbox | Vendas+IA',
}

export default function InboxPage() {
  return <EmailInbox />
}
