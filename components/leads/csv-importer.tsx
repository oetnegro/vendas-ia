'use client'

import Link from 'next/link'
import { ChangeEvent, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  FileUp,
  Table,
  Upload,
} from 'lucide-react'
import { csvTemplateText, getCsvHeaders, parseCsv, type ParsedCsvRow } from '@/lib/csv'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useWorkspace } from '@/lib/use-workspace'

type LeadInsert = {
  workspace_id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  title?: string | null
  source?: string | null
  custom_fields?: Record<string, string>
}

const knownFields = new Set(['email', 'first_name', 'last_name', 'company', 'title'])

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const copied = document.execCommand('copy')
    textarea.remove()

    return copied
  }
}

export function CsvImporter() {
  const { workspace, loading: workspaceLoading } = useWorkspace()
  const [rows, setRows] = useState<ParsedCsvRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState(false)

  const validRows = useMemo(() => rows.filter((row) => row.email?.includes('@')), [rows])
  const importableRows = useMemo(() => {
    const seenEmails = new Set<string>()

    return validRows.filter((row) => {
      const email = row.email.trim().toLowerCase()
      if (!email || seenEmails.has(email)) return false

      seenEmails.add(email)
      return true
    })
  }, [validRows])
  const invalidRows = rows.length - validRows.length
  const duplicateRows = validRows.length - importableRows.length
  const template = csvTemplateText()

  const handleTemplateCopy = async () => {
    setError(null)
    const copied = await copyText(template)

    if (copied) {
      setCopiedTemplate(true)
      setSuccess('Template copied. Paste it into a spreadsheet keeping the first row as headers.')
      window.setTimeout(() => setCopiedTemplate(false), 1800)
    } else {
      setError('Could not copy automatically. Select the template and copy it manually.')
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSuccess(null)
    setError(null)

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file.')
      return
    }

    const text = await file.text()
    const { headers, delimiter } = getCsvHeaders(text)

    if (!headers.includes('email')) {
      setRows([])
      setFileName(null)
      setError(
        `Required column "email" not found in headers. Headers detected: ${
          headers.join(', ') || 'none'
        }. Delimiter: ${delimiter === '\t' ? 'tab' : delimiter}.`,
      )
      return
    }

    const parsedRows = parseCsv(text)

    if (!parsedRows.length) {
      setError('No valid rows found in the CSV.')
      return
    }

    setFileName(file.name)
    setRows(parsedRows)
  }

  const handleImport = async () => {
    if (!workspace) {
      setError('Create a workspace before importing leads.')
      return
    }

    setImporting(true)
    setError(null)
    setSuccess(null)

    const leads: LeadInsert[] = importableRows.map((row) => {
      const customFields = Object.fromEntries(
        Object.entries(row).filter(([key, value]) => !knownFields.has(key) && value),
      )

      return {
        workspace_id: workspace.id,
        email: row.email.trim().toLowerCase(),
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        company: row.company || null,
        title: row.title || null,
        source: fileName || 'csv',
        custom_fields: customFields,
      }
    })

    const { error: insertError } = await getSupabaseBrowserClient()
      .from('leads')
      .upsert(leads, { onConflict: 'workspace_id,email' })

    setImporting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    const duplicateMessage = duplicateRows ? ` ${duplicateRows} duplicate(s) skipped.` : ''
    setSuccess(`${leads.length} lead(s) imported or updated.${duplicateMessage}`)
  }

  if (!workspaceLoading && !workspace) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#2C3E50]">Create a workspace first</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Before importing leads, we need to save your company and agent context.
        </p>
        <Link
          href="/setup"
          className="mt-5 inline-flex rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white"
        >
          Go to setup
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#B98A1D]">Leads</p>
          <h1 className="mt-2 text-3xl font-bold text-[#2C3E50]">Import CSV</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload your list in the standard format. Unknown columns are stored as extra lead fields for the AI to use.
          </p>
        </div>
        <a
          href="/templates/modelo-leads-vendas-ia.csv"
          download="modelo-leads-vendas-ia.csv"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C3E50]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#2C3E50] shadow-sm hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Download CSV template
        </a>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-sm font-bold text-[#2C3E50]">Template to fill out</h2>
            <p className="mt-1 text-sm text-slate-700">
              The `email` column is required. The importer also accepts semicolon-separated files and column names like `e-mail`, `nome`, `empresa`, and `cargo`.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/templates/modelo-leads-vendas-ia.csv"
              download="modelo-leads-vendas-ia.csv"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C3E50]/20 bg-white px-3 py-2 text-sm font-semibold text-[#2C3E50] hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Direct download
            </a>
            <button
              type="button"
              onClick={handleTemplateCopy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-3 py-2 text-sm font-semibold text-white hover:bg-[#34495E]"
            >
              <Clipboard className="h-4 w-4" />
              {copiedTemplate ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {template}
        </pre>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-[#F4D58D] hover:bg-[#F4D58D]/10">
          <FileUp className="h-10 w-10 text-[#2C3E50]" />
          <span className="mt-4 text-sm font-semibold text-[#2C3E50]">
            Click to choose a CSV
          </span>
          <span className="mt-1 text-xs font-medium text-slate-700">email is required</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" />
        </label>

        {fileName ? (
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Table className="h-5 w-5 text-[#2C3E50]" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{fileName}</p>
                <p className="text-xs text-slate-500">
                  {importableRows.length} valid, {invalidRows} without email, {duplicateRows} duplicates
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importableRows.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3E50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#34495E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import leads'}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error === 'ON CONFLICT DO UPDATE command cannot affect row a second time'
              ? 'The spreadsheet has duplicate emails. Remove duplicates or re-select the file for the importer to skip them automatically.'
              : error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </p>
        ) : null}
      </section>

      {rows.length ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#2C3E50]">Preview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 8).map((row, index) => (
                  <tr key={`${row.email}-${index}`} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.email || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{row.company || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{row.title || '-'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.email?.includes('@')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.email?.includes('@') ? 'Valid' : 'No email'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
