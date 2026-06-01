'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  CloudDownload,
  ExternalLink,
  Globe,
  Mail,
  MessageSquareText,
  NotebookPen,
  PauseCircle,
  Save,
  Search,
  SendHorizontal,
  Star,
  Tag,
  UserCheck,
  UserRound,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'
import type { Json, LeadStatus } from '@/types/database'

type InboxLead = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  status: LeadStatus
  custom_fields: Json
  created_at: string
}

type InboxMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  subject: string | null
  body_text: string | null
  sent_at: string | null
  created_at: string
}

type InboxThread = {
  id: string
  workspace_id: string
  lead_id: string
  gmail_thread_id: string | null
  status: string
  ai_enabled: boolean
  last_message_at: string | null
  created_at: string
  leads: InboxLead | null
  email_messages: InboxMessage[]
}

type InboxConversation = {
  id: string
  lead: InboxLead | null
  threads: InboxThread[]
  messages: InboxMessage[]
  ai_enabled: boolean
  status: string
  last_message_at: string | null
  created_at: string
}

function formatDate(value: string | null) {
  if (!value) return 'Sem data'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatMessageTime(value: string | null) {
  if (!value) return 'Sem data'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function initials(lead?: InboxLead | null) {
  const source =
    [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || lead?.company || lead?.email || '?'

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function leadName(lead?: InboxLead | null) {
  return [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || lead?.company || lead?.email || 'Lead'
}

function customFieldValue(lead: InboxLead | null, key: string) {
  const fields = lead?.custom_fields

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null

  const value = fields[key]
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function customFieldsObject(lead: InboxLead | null) {
  const fields = lead?.custom_fields

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {}

  return fields as Record<string, Json>
}

function cleanReplyForDisplay(value: string | null) {
  if (!value) return ''

  const lines = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')

  const stopIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim()
    const nextLine = lines[index + 1]?.trim() || ''
    const followingLine = lines[index + 2]?.trim() || ''

    return (
      /^on .+ wrote:$/i.test(trimmed) ||
      /escreveu:$/i.test(trimmed) ||
      (/^em .+/i.test(trimmed) && /escreveu:$/i.test(nextLine)) ||
      (/^em .+/i.test(trimmed) && /escreveu:$/i.test(followingLine)) ||
      /^-+\s*original message\s*-+$/i.test(trimmed) ||
      /^-+\s*mensagem original\s*-+$/i.test(trimmed)
    )
  })

  return (stopIndex >= 0 ? lines.slice(0, stopIndex) : lines)
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function messagePreview(message?: InboxMessage) {
  if (!message) return 'Sem mensagens ainda'

  const body =
    message.direction === 'inbound'
      ? cleanReplyForDisplay(message.body_text) || message.body_text
      : message.body_text

  return body || message.subject || 'Mensagem sem corpo'
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    new: 'Cliente Novo',
    contacted: 'Contactado',
    replied: 'Responderam',
    interested: 'Interessado',
    meeting_booked: 'Agendamento',
    negative: 'Negativa',
    opted_out: 'Descadastro',
    paused: 'Pausado',
  }

  return status ? labels[status] || status : 'Cliente Novo'
}

function statusClasses(status?: string | null) {
  if (status === 'replied' || status === 'interested' || status === 'meeting_booked') {
    return 'bg-green-100 text-green-700'
  }

  if (status === 'negative' || status === 'opted_out') {
    return 'bg-red-100 text-red-700'
  }

  if (status === 'paused') {
    return 'bg-slate-200 text-slate-600'
  }

  return 'bg-blue-100 text-blue-700'
}

function messageCount(conversation: InboxConversation) {
  return conversation.messages.length
}

function inboundCount(conversation: InboxConversation) {
  return conversation.messages.filter((message) => message.direction === 'inbound').length
}

function conversationSubject(conversation: InboxConversation | null) {
  if (!conversation) return null

  const latestWithSubject = [...conversation.messages]
    .reverse()
    .find((message) => message.subject?.trim())

  return latestWithSubject?.subject?.trim() || null
}

const FAVORITES_STORAGE_PREFIX = 'vendasia:inbox-favorites'

export function EmailInbox() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const searchParams = useSearchParams()
  const leadParam = searchParams.get('lead')
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connectedGoogleEmail, setConnectedGoogleEmail] = useState<string | null>(null)
  const [favoriteLeadIds, setFavoriteLeadIds] = useState<string[]>([])
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'favorites' | 'replied' | 'unanswered'>('all')
  const [notesDraft, setNotesDraft] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  // Mobile: toggle between conversation list and chat panel
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const workspaceIdRef = useRef<string | undefined>(undefined)

  const loadThreads = async () => {
    if (!workspace?.id) return

    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { data, error: loadError } = await supabase
      .from('email_threads')
      .select(
        `
        id,
        workspace_id,
        lead_id,
        gmail_thread_id,
        status,
        ai_enabled,
        last_message_at,
        created_at,
        leads (
          id,
          email,
          first_name,
          last_name,
          company,
          title,
          status,
          custom_fields,
          created_at
        ),
        email_messages (
          id,
          direction,
          subject,
          body_text,
          sent_at,
          created_at
        )
      `,
      )
      .eq('workspace_id', workspace.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (loadError) {
      setError(loadError.message)
      setThreads([])
      setConnectedGoogleEmail(null)
      setLoading(false)
      return
    }

    const { data: connection } = await supabase
      .from('google_connections')
      .select('google_email')
      .eq('workspace_id', workspace.id)
      .eq('status', 'connected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const rows = (data || []) as unknown as InboxThread[]
    const normalized = rows.map((thread) => ({
      ...thread,
      email_messages: [...(thread.email_messages || [])].sort((a, b) => {
        const aTime = new Date(a.sent_at || a.created_at).getTime()
        const bTime = new Date(b.sent_at || b.created_at).getTime()
        return aTime - bTime
      }),
    }))

    setThreads(normalized)
    setConnectedGoogleEmail(connection?.google_email || null)
    setSelectedThreadId((current) => {
      if (current) return current
      // Pré-seleciona lead vindo do CRM via ?lead=<lead_id>
      if (leadParam && normalized.some((t) => t.lead_id === leadParam)) return leadParam
      return normalized[0]?.lead_id || normalized[0]?.id || ''
    })
    setLoading(false)
  }

  useEffect(() => {
    workspaceIdRef.current = workspace?.id
  }, [workspace?.id])

  useEffect(() => {
    if (!workspaceLoading && workspace?.id) {
      void loadThreads()
    }
    if (!workspaceLoading && !workspace) {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceLoading, workspace?.id])

  // Auto-sync silencioso a cada 2 minutos enquanto a aba está visível.
  // Na produção o n8n já roda a cada 5 min; aqui aceleramos para melhor UX na inbox aberta.
  useEffect(() => {
    if (!workspace?.id) return
    let running = false

    const tick = async () => {
      if (running || typeof document === 'undefined' || document.visibilityState !== 'visible') return
      const wsId = workspaceIdRef.current
      if (!wsId) return
      running = true
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) { running = false; return }

        const res = await fetch('/api/email/sync', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ workspaceId: wsId }),
        })

        if (res.ok) {
          const { data } = await supabase
            .from('email_threads')
            .select(`id, workspace_id, lead_id, gmail_thread_id, status, ai_enabled, last_message_at, created_at,
              leads(id, email, first_name, last_name, company, title, status, custom_fields, created_at),
              email_messages(id, direction, subject, body_text, sent_at, created_at)`)
            .eq('workspace_id', wsId)
            .order('last_message_at', { ascending: false, nullsFirst: false })
          if (data) {
            setThreads(
              (data as unknown as InboxThread[]).map((thread) => ({
                ...thread,
                email_messages: [...(thread.email_messages || [])].sort(
                  (a, b) =>
                    new Date(a.sent_at || a.created_at).getTime() -
                    new Date(b.sent_at || b.created_at).getTime(),
                ),
              })),
            )
          }
        }
      } catch { /* silencioso — não interrompe o usuário */ }
      running = false
    }

    const id = setInterval(() => { void tick() }, 2 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  useEffect(() => {
    if (!workspace?.id || typeof window === 'undefined') {
      setFavoriteLeadIds([])
      setFavoritesLoaded(false)
      return
    }

    const raw = window.localStorage.getItem(`${FAVORITES_STORAGE_PREFIX}:${workspace.id}`)

    try {
      setFavoriteLeadIds(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      setFavoriteLeadIds([])
    }

    setFavoritesLoaded(true)
  }, [workspace?.id])

  useEffect(() => {
    if (!workspace?.id || !favoritesLoaded || typeof window === 'undefined') return

    window.localStorage.setItem(
      `${FAVORITES_STORAGE_PREFIX}:${workspace.id}`,
      JSON.stringify(favoriteLeadIds),
    )
  }, [favoriteLeadIds, favoritesLoaded, workspace?.id])

  const conversations = useMemo(() => {
    const grouped = new Map<string, InboxConversation>()

    threads.forEach((thread) => {
      const groupId = thread.lead_id || thread.id
      const current =
        grouped.get(groupId) ||
        ({
          id: groupId,
          lead: thread.leads,
          threads: [],
          messages: [],
          ai_enabled: true,
          status: thread.status,
          last_message_at: thread.last_message_at,
          created_at: thread.created_at,
        } satisfies InboxConversation)

      current.threads.push(thread)
      current.messages.push(...thread.email_messages)
      current.ai_enabled = current.threads.some((item) => item.ai_enabled)
      current.status = thread.leads?.status || thread.status

      const currentTime = new Date(current.last_message_at || current.created_at).getTime()
      const threadTime = new Date(thread.last_message_at || thread.created_at).getTime()

      if (threadTime > currentTime) {
        current.last_message_at = thread.last_message_at
        current.created_at = thread.created_at
      }

      grouped.set(groupId, current)
    })

    return Array.from(grouped.values())
      .map((conversation) => ({
        ...conversation,
        messages: conversation.messages.sort((a, b) => {
          const aTime = new Date(a.sent_at || a.created_at).getTime()
          const bTime = new Date(b.sent_at || b.created_at).getTime()
          return aTime - bTime
        }),
      }))
      .sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.created_at).getTime()
        const bTime = new Date(b.last_message_at || b.created_at).getTime()
        return bTime - aTime
      })
  }, [threads])

  const filteredConversations = useMemo(() => {
    const search = query.trim().toLowerCase()

    return conversations.filter((conversation) => {
      if (filter === 'favorites' && !favoriteLeadIds.includes(conversation.id)) return false
      if (filter === 'replied' && inboundCount(conversation) === 0) return false
      if (filter === 'unanswered' && inboundCount(conversation) > 0) return false

      if (!search) return true

      const lead = conversation.lead
      const lastMessage = conversation.messages.at(-1)
      const haystack = [
        lead?.email,
        lead?.first_name,
        lead?.last_name,
        lead?.company,
        lead?.title,
        lastMessage?.subject,
        lastMessage?.body_text,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [conversations, favoriteLeadIds, filter, query])

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedThreadId) ||
    filteredConversations[0] ||
    null
  const selectedLead = selectedConversation?.lead || null
  const selectedLeadNotes = customFieldValue(selectedLead, 'notes') || ''
  const selectedSubject = conversationSubject(selectedConversation)

  useEffect(() => {
    setNotesDraft(selectedLeadNotes)
    setEditingNotes(false)
  }, [selectedLead?.id, selectedLeadNotes])

  const toggleAi = async () => {
    if (!selectedConversation || !workspace?.id) return

    const nextValue = !selectedConversation.ai_enabled
    const threadIds = selectedConversation.threads.map((thread) => thread.id)
    setSaving(true)
    setNotice(null)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: userData } = await supabase.auth.getUser()
    const { error: updateError } = await supabase
      .from('email_threads')
      .update({ ai_enabled: nextValue })
      .in('id', threadIds)
      .eq('workspace_id', workspace.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await supabase.from('activity_logs').insert({
      workspace_id: workspace.id,
      actor_user_id: userData.user?.id || null,
      entity_type: 'email_conversation',
      entity_id: selectedConversation.id,
      action: nextValue ? 'ai_enabled' : 'ai_paused',
      metadata: {
        lead_id: selectedConversation.id,
        thread_ids: threadIds,
        gmail_thread_ids: selectedConversation.threads.map((thread) => thread.gmail_thread_id),
      },
    })

    setThreads((current) =>
      current.map((thread) =>
        threadIds.includes(thread.id) ? { ...thread, ai_enabled: nextValue } : thread,
      ),
    )
    setNotice(nextValue ? 'IA ativada para esta conversa.' : 'IA pausada para esta conversa.')
    setSaving(false)
  }

  const syncGmail = async () => {
    if (!workspace?.id) return

    setSyncing(true)
    setNotice(null)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Sessao expirada. Faça login novamente.')
      setSyncing(false)
      return
    }

    const response = await fetch('/api/email/sync', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: workspace.id,
      }),
    })

    const json = (await response.json()) as {
      ok?: boolean
      syncedThreads?: number
      syncedMessages?: number
      inboundMessages?: number
      aiReplies?: {
        processed: number
        sent: number
        skipped: number
        optedOut: number
        errors: Array<{ threadId: string; message: string }>
      } | null
      errors?: Array<{ threadId?: string; message: string }>
      error?: string
    }

    if (!response.ok || !json.ok) {
      setError(json.error || 'Nao foi possivel sincronizar o Gmail.')
      setSyncing(false)
      return
    }

    await loadThreads()
    const partialErrors = json.errors?.filter((item) => item.message) || []

    if (partialErrors.length > 0) {
      setError(
        `Sync rodou, mas ${partialErrors.length} thread(s) falharam. Primeiro erro: ${partialErrors[0].message}`,
      )
    }

    const baseNotice = `Gmail sincronizado: ${json.syncedThreads || 0} thread(s), ${
      json.syncedMessages || 0
    } mensagem(ns), ${json.inboundMessages || 0} resposta(s) recebida(s).`
    const aiNotice = json.aiReplies
      ? ` IA: ${json.aiReplies.sent} enviada(s)${json.aiReplies.skipped > 0 ? ` · ${json.aiReplies.skipped} sem pendencia` : ''}.`
      : ''

    setNotice(
      json.inboundMessages && json.inboundMessages > 0
        ? `${baseNotice}${aiNotice}`
        : `${baseNotice}${aiNotice} Se voce respondeu ha poucos segundos, aguarde um pouco e rode o Sync de novo.`,
    )
    setSyncing(false)
  }

  const toggleFavorite = (conversationId: string) => {
    setFavoriteLeadIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId],
    )
  }

  const saveNotes = async () => {
    if (!selectedLead || !workspace?.id) return

    setSavingNotes(true)
    setError(null)
    setNotice(null)

    const nextCustomFields = {
      ...customFieldsObject(selectedLead),
      notes: notesDraft.trim(),
    }

    const supabase = getSupabaseBrowserClient()
    const { error: updateError } = await supabase
      .from('leads')
      .update({ custom_fields: nextCustomFields })
      .eq('id', selectedLead.id)
      .eq('workspace_id', workspace.id)

    if (updateError) {
      setError(updateError.message)
      setSavingNotes(false)
      return
    }

    setThreads((current) =>
      current.map((thread) =>
        thread.lead_id === selectedLead.id && thread.leads
          ? {
              ...thread,
              leads: {
                ...thread.leads,
                custom_fields: nextCustomFields,
              },
            }
          : thread,
      ),
    )
    setEditingNotes(false)
    setNotice('Anotacao salva no lead.')
    setSavingNotes(false)
  }

  const sendManualReply = async () => {
    if (!selectedConversation || !workspace?.id || !replyDraft.trim()) return

    const targetThread = selectedConversation.threads.find((thread) => thread.gmail_thread_id)
    if (!targetThread) {
      setError('Nao foi possivel encontrar o thread Gmail para responder.')
      return
    }

    setSendingReply(true)
    setError(null)
    setNotice(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Sessao expirada. Faca login novamente.')
      setSendingReply(false)
      return
    }

    const response = await fetch('/api/email/reply', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        threadId: targetThread.id,
        body: replyDraft.trim(),
        workspaceId: workspace.id,
      }),
    })

    const json = (await response.json()) as { ok?: boolean; error?: string }

    if (!response.ok || !json.ok) {
      setError(json.error || 'Nao foi possivel enviar a resposta.')
      setSendingReply(false)
      return
    }

    // Otimista: desativa IA localmente enquanto o banco atualiza
    const threadIds = selectedConversation.threads.map((thread) => thread.id)
    setThreads((current) =>
      current.map((thread) =>
        threadIds.includes(thread.id) ? { ...thread, ai_enabled: false } : thread,
      ),
    )
    setReplyDraft('')
    setNotice('Resposta enviada. IA pausada para este lead — retome pelo painel lateral quando quiser.')
    await loadThreads()
    setSendingReply(false)
  }

  if (!workspaceLoading && !workspace) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#B98A1D]">Conversas</p>
        <h1 className="mt-2 text-2xl font-bold text-[#2C3E50]">Crie um workspace primeiro</h1>
        <p className="mt-2 text-sm text-slate-500">O inbox usa threads por workspace.</p>
      </section>
    )
  }

  return (
    <div className="grid h-full grid-rows-1 overflow-hidden border-t border-slate-200 bg-white min-[700px]:grid-cols-[250px_minmax(0,1fr)_230px] min-[900px]:grid-cols-[300px_minmax(0,1fr)_270px] xl:grid-cols-[360px_minmax(0,1fr)_320px] 2xl:grid-cols-[380px_minmax(0,1fr)_340px]">
      {/* Conversation list — hidden on mobile when chat is open */}
      <aside className={`min-h-0 flex-col border-slate-200 bg-slate-50 min-[700px]:border-r ${mobileView === 'chat' ? 'hidden min-[700px]:flex' : 'flex border-b min-[700px]:border-b-0'}`}>
        <div className="border-b border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <MessageSquareText className="h-4 w-4" />
                Conversas
              </h1>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={syncGmail}
                disabled={syncing}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#2C3E50] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CloudDownload className={`h-3.5 w-3.5 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </div>
          </div>

          {notice ? (
            <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
              {notice}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, email ou empresa..."
              className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>

          <p className="mt-3 text-[10px] font-bold uppercase text-slate-500">Filtros</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ['all', 'Todas Conversas'],
              ['favorites', 'Favoritos'],
              ['replied', 'Responderam'],
              ['unanswered', 'Sem resposta'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as typeof filter)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  filter === value
                    ? 'bg-[#2C3E50] text-white'
                    : value === 'favorites'
                      ? 'bg-yellow-50 text-[#B98A1D] hover:bg-yellow-100'
                      : value === 'replied'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Carregando conversas...</p>
          ) : null}

          {!loading && filteredConversations.length === 0 ? (
            <div className="p-4">
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Envie um template real no review da campanha para criar a primeira conversa.
              </div>
            </div>
          ) : null}

          {filteredConversations.map((conversation) => {
            const lead = conversation.lead
            const lastMessage = conversation.messages.at(-1)
            const active = selectedConversation?.id === conversation.id
            const favorite = favoriteLeadIds.includes(conversation.id)
            const count = messageCount(conversation)
            const hasReply = inboundCount(conversation) > 0

            return (
              <div
                key={conversation.id}
                className={`group flex w-full items-start gap-3 border-b border-slate-200 px-3 py-4 transition hover:bg-white ${
                  active ? 'bg-[#FFFDF7] shadow-[inset_4px_0_0_#2C3E50]' : 'bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedThreadId(conversation.id)
                    setMobileView('chat')
                  }}
                  className="flex min-w-0 flex-1 gap-3 text-left"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2C3E50] text-sm font-bold text-[#F4D58D] shadow-sm">
                    {initials(lead)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm font-bold text-[#1F2D3D]">
                        {leadName(lead)}
                      </strong>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {formatDate(conversation.last_message_at || conversation.created_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium uppercase text-slate-600">
                      {lead?.company || lead?.email}
                    </span>
                    <span className="mt-2 line-clamp-1 text-xs leading-5 text-slate-500">
                      {messagePreview(lastMessage)}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          hasReply ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {hasReply ? 'Respondeu' : 'Sem resposta'}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        {count} msg
                      </span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(conversation.id)}
                  className={`mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                    favorite
                      ? 'text-[#B98A1D] hover:bg-yellow-50'
                      : 'text-slate-300 hover:bg-slate-100 hover:text-[#B98A1D]'
                  }`}
                  aria-label={favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                >
                  <Star className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Chat panel — hidden on mobile when list is shown */}
      <section className={`min-h-0 flex-col overflow-hidden bg-[#E8DFD5] min-[700px]:flex min-[700px]:min-h-0 ${mobileView === 'list' ? 'hidden' : 'flex'}`}>
        <header className="border-b border-slate-200 bg-white px-4 py-3">
          {selectedConversation ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {/* Back button — mobile only */}
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 min-[700px]:hidden"
                  aria-label="Voltar para lista"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2C3E50] text-sm font-bold text-[#F4D58D] shadow-sm">
                  {initials(selectedLead)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold uppercase text-[#2C3E50]">
                    {leadName(selectedLead)}
                  </h2>
                  <p className="truncate text-xs font-medium uppercase text-slate-600">
                    {selectedLead?.company || selectedLead?.email}
                  </p>
                  {selectedSubject ? (
                    <p className="mt-1 truncate text-xs font-semibold normal-case text-slate-500">
                      Assunto: <span className="font-medium text-slate-700">{selectedSubject}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="hidden text-xs font-semibold text-slate-400 md:inline">
                {selectedConversation.messages.length > 0
                  ? `Total de mensagens: ${selectedConversation.messages.length}`
                  : 'Sem mensagens'}
              </span>
            </div>
          ) : (
            <h2 className="text-base font-bold text-[#2C3E50]">Nenhuma conversa selecionada</h2>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {selectedConversation ? (
            <div className="grid gap-3">
              {selectedConversation.messages.length === 0 ? (
                <div className="mx-auto mt-20 max-w-md rounded-lg border border-dashed border-slate-300 bg-white/80 p-6 text-center">
                  <MessageSquareText className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-[#2C3E50]">
                    Thread criada, sem mensagens sincronizadas.
                  </p>
                </div>
              ) : null}

              {selectedConversation.messages.map((message) => {
                const outbound = message.direction === 'outbound'
                const displayBody =
                  message.direction === 'inbound'
                    ? cleanReplyForDisplay(message.body_text) || message.body_text
                    : message.body_text

                return (
                  <article key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`flex w-full max-w-[86%] items-start gap-2 min-[900px]:max-w-[78%] ${
                        outbound ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {outbound ? (
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                          <Bot className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow-sm">
                          {initials(selectedLead).slice(0, 1)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <div
                          className={`mb-1 flex items-center gap-2 text-[11px] font-bold text-slate-600 ${
                            outbound ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {outbound ? (
                            <>
                              <span>IA</span>
                            </>
                          ) : (
                            <span className="uppercase">{leadName(selectedLead)}</span>
                          )}
                        </div>
                        <div
                          className={`rounded-lg px-4 py-3 text-[13px] leading-6 shadow-sm ${
                            outbound
                              ? 'rounded-tr-sm bg-blue-600 text-left text-white'
                              : 'rounded-tl-sm bg-white text-[#1F2D3D]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{displayBody || 'Mensagem sem corpo.'}</p>
                        </div>
                        <time className={`mt-1 block text-[10px] text-slate-500 ${outbound ? 'text-right' : ''}`}>
                          {formatMessageTime(message.sent_at || message.created_at)}
                        </time>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="mx-auto mt-20 max-w-md rounded-lg border border-dashed border-slate-300 bg-white/80 p-6 text-center">
              <Mail className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-[#2C3E50]">Nenhuma conversa ainda.</p>
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  selectedConversation?.ai_enabled ? 'bg-green-500' : 'bg-slate-400'
                }`}
              />
              {selectedConversation?.ai_enabled
                ? 'IA Ativa — responde automaticamente'
                : 'IA pausada — somente resposta manual'}
            </div>
          </div>
          <div className="px-4 pb-3 pt-2">
            {selectedConversation?.ai_enabled ? (
              <p className="mb-2 text-[11px] text-slate-400">
                Ao responder manualmente a IA sera pausada para este lead.
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault()
                    void sendManualReply()
                  }
                }}
                placeholder={
                  selectedConversation
                    ? 'Escreva uma resposta... (Ctrl+Enter para enviar)'
                    : 'Selecione uma conversa'
                }
                disabled={!selectedConversation || sendingReply}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-[#2C3E50] focus:ring-2 focus:ring-[#2C3E50]/10 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="button"
                onClick={() => { void sendManualReply() }}
                disabled={!selectedConversation || !replyDraft.trim() || sendingReply}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-[#2C3E50] px-4 text-sm font-bold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <SendHorizontal className="h-4 w-4" />
                {sendingReply ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </footer>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto border-t border-slate-200 bg-white p-4 min-[700px]:border-l min-[700px]:border-t-0 xl:p-5 min-[700px]:block">
        {selectedConversation && selectedLead ? (
          <div className="grid gap-6">
            {(() => {
              const website = customFieldValue(selectedLead, 'website')
              const linkedin = customFieldValue(selectedLead, 'linkedin')
              const extraFieldEntries = Object.entries(customFieldsObject(selectedLead)).filter(
                ([key, value]) =>
                  !['website', 'linkedin', 'notes'].includes(key) &&
                  (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
                  String(value).trim(),
              )

              return (
                <>
            <div className="relative border-b border-slate-200 pb-5 text-center">
              <button
                type="button"
                onClick={() => toggleFavorite(selectedConversation.id)}
                className={`absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full transition ${
                  favoriteLeadIds.includes(selectedConversation.id)
                    ? 'text-[#B98A1D] hover:bg-yellow-50'
                    : 'text-slate-300 hover:bg-slate-100 hover:text-[#B98A1D]'
                }`}
                aria-label="Favoritar conversa"
              >
                <Star
                  className={`h-4 w-4 ${
                    favoriteLeadIds.includes(selectedConversation.id) ? 'fill-current' : ''
                  }`}
                />
              </button>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2C3E50] text-xl font-bold text-[#F4D58D]">
                {initials(selectedLead)}
              </div>
              <h2 className="mt-3 text-lg font-bold uppercase text-[#2C3E50]">
                {leadName(selectedLead)}
              </h2>
              <p className="text-sm uppercase text-slate-600">{selectedLead.company || selectedLead.email}</p>
            </div>

            <section>
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#2C3E50]">
                <UserRound className="h-4 w-4" />
                Informacoes
              </h3>
              <dl className="mt-3 grid gap-3 text-sm text-slate-700">
                <div className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-500">Email</dt>
                    <dd className="break-all font-medium text-green-700">{selectedLead.email}</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-500">Empresa</dt>
                    <dd>{selectedLead.company || 'Nao informada'}</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-500">Cargo</dt>
                    <dd>{selectedLead.title || 'Nao informado'}</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-500">Remetente conectado</dt>
                    <dd className="break-all">{connectedGoogleEmail || 'Nao conectada'}</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-500">Fonte</dt>
                    <dd>CSV</dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">Site</dt>
                    <dd className="break-all">
                      {website ? (
                        <a
                          href={website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 font-medium text-blue-700 hover:underline"
                        >
                          <span>{website}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        'Nao informado'
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-2">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">LinkedIn</dt>
                    <dd className="break-all">
                      {linkedin ? (
                        <a
                          href={linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 font-medium text-blue-700 hover:underline"
                        >
                          <span>{linkedin}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        'Nao informado'
                      )}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            <section className="border-t border-slate-200 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#2C3E50]">
                <CheckCircle2 className="h-4 w-4" />
                Status
              </h3>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">Status Funil</span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClasses(selectedLead.status)}`}>
                  {statusLabel(selectedLead.status)}
                </span>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <CalendarClock className="h-4 w-4" />
                Ultima mensagem: {formatDate(selectedConversation.last_message_at || selectedConversation.created_at)}
              </p>
            </section>

            <button
              type="button"
              onClick={toggleAi}
              disabled={saving}
              className={`flex w-full flex-col items-center justify-center gap-1 rounded-none px-4 py-4 text-sm font-bold transition ${
                selectedConversation.ai_enabled
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="flex items-center gap-2">
                {selectedConversation.ai_enabled ? <Bot className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                {saving ? 'Salvando...' : selectedConversation.ai_enabled ? 'IA Ativa' : 'IA Pausada'}
              </span>
              <span className="text-xs font-medium">
                {selectedConversation.ai_enabled ? 'Clique para desativar' : 'Clique para ativar'}
              </span>
            </button>

            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-none bg-slate-100 px-4 py-4 text-sm font-bold text-slate-600"
            >
              <UserCheck className="h-4 w-4" />
              Agendar Reuniao
            </button>

            <section className="border-t border-slate-200 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#2C3E50]">
                <NotebookPen className="h-4 w-4" />
                Anotacoes
              </h3>
              {editingNotes ? (
                <div className="mt-3 grid gap-2">
                  <textarea
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={4}
                    placeholder="Escreva uma anotacao sobre esse lead..."
                    className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#2C3E50] focus:ring-2 focus:ring-[#2C3E50]/10"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveNotes}
                      disabled={savingNotes}
                      className="inline-flex items-center gap-2 rounded-md bg-[#2C3E50] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingNotes ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotesDraft(selectedLeadNotes)
                        setEditingNotes(false)
                      }}
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    {selectedLeadNotes || 'Nenhuma anotacao ainda.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingNotes(true)}
                    className="mt-2 text-xs font-bold text-blue-700 hover:underline"
                  >
                    Editar
                  </button>
                </div>
              )}
            </section>

            {extraFieldEntries.length > 0 ? (
              <section className="border-t border-slate-200 pt-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#2C3E50]">
                  <Building2 className="h-4 w-4" />
                  Campos extras
                </h3>
                <div className="mt-3 grid gap-2">
                  {extraFieldEntries.map(([key, value]) => (
                    <p key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <strong className="mr-1 text-slate-700">{key}:</strong>
                      {String(value)}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}
                </>
              )
            })()}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Selecione uma conversa para ver o lead.</p>
        )}
      </aside>
    </div>
  )
}
