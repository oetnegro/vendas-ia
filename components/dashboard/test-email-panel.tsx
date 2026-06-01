'use client'

import { FormEvent, useState } from 'react'
import { AlertCircle, CheckCircle2, Mail, Send } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import type { WorkspaceSummary } from '@/lib/use-workspace'

export function TestEmailPanel({ workspace }: { workspace: WorkspaceSummary | null }) {
  const [to, setTo] = useState('depaularoupas@gmail.com')
  const [subject, setSubject] = useState('Teste de envio Vendas+IA')
  const [body, setBody] = useState(
    'Oi, este e um teste real de envio pelo Gmail conectado ao Vendas+IA.\n\nSe voce recebeu, a conexao Google e a rota de envio estao funcionando.',
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!workspace) {
      setError('Selecione um workspace antes de enviar teste.')
      return
    }

    setSending(true)
    setError(null)
    setResult(null)

    const supabase = getSupabaseBrowserClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Sessao expirada. Faça login novamente.')
      setSending(false)
      return
    }

    const response = await fetch('/api/email/send-test', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: workspace.id,
        to,
        subject,
        body,
      }),
    })

    const json = (await response.json()) as {
      ok?: boolean
      messageId?: string
      from?: string
      to?: string
      error?: string
    }

    setSending(false)

    if (!response.ok || !json.ok) {
      setError(json.error || 'Nao foi possivel enviar o teste.')
      return
    }

    setResult(`Enviado de ${json.from} para ${json.to}. Gmail message id: ${json.messageId}.`)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">Teste operacional</p>
          <h2 className="mt-1 text-lg font-bold text-[#2C3E50]">Enviar e-mail de teste</h2>
          <p className="mt-1 text-sm text-slate-500">
            Valida Gmail API, token do workspace e entrega antes da engine automatica.
          </p>
        </div>
        <Mail className="hidden h-6 w-6 text-[#B98A1D] md:block" />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Destinatario</span>
          <input
            type="email"
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Assunto</span>
          <input
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Mensagem</span>
          <textarea
            required
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#F4D58D] focus:ring-2 focus:ring-[#F4D58D]/30"
          />
        </label>

        {error ? (
          <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}

        {result ? (
          <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {result}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !workspace}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Enviando...' : 'Enviar teste real'}
          </button>
        </div>
      </form>
    </section>
  )
}
