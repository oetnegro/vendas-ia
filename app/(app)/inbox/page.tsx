import type { Metadata } from 'next'
import { EmailInbox } from '@/components/inbox/email-inbox'

export const metadata: Metadata = {
  title: 'Conversas | Vendas+IA App',
}

export default function InboxPage() {
  return <EmailInbox />
}
