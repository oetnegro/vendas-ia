export type ParsedCsvRow = Record<string, string>

const HEADER_ALIASES: Record<string, string> = {
  cargo: 'title',
  companhia: 'company',
  e_mail: 'email',
  email: 'email',
  empresa: 'company',
  first_name: 'first_name',
  linkedin: 'linkedin',
  last_name: 'last_name',
  nome: 'first_name',
  observacoes: 'notes',
  primeiro_nome: 'first_name',
  sobrenome: 'last_name',
  site: 'website',
  title: 'title',
  website: 'website',
}

export const LEADS_CSV_TEMPLATE = [
  ['email', 'first_name', 'last_name', 'company', 'title', 'website', 'linkedin', 'notes'],
  [
    'ana@empresa.com',
    'Ana',
    'Silva',
    'Empresa Exemplo',
    'Diretora Comercial',
    'https://empresa.com',
    'https://linkedin.com/in/ana',
    'Lead vindo de lista outbound',
  ],
]

export function csvTemplateText(options?: { bom?: boolean; lineEnding?: '\n' | '\r\n' }) {
  const lineEnding = options?.lineEnding || '\n'
  const body = LEADS_CSV_TEMPLATE.map((row) => row.map(escapeCsvCell).join(',')).join(lineEnding)

  return options?.bom ? `\uFEFF${body}` : body
}

export function getCsvHeaders(text: string) {
  const delimiter = detectCsvDelimiter(text)
  const rows = expandPackedCsvRows(parseCsvRows(text.replace(/^\uFEFF/, ''), delimiter), delimiter)
  const [headerRow] = rows

  return {
    delimiter,
    headers: (headerRow || []).map((header) => normalizeHeader(header)).filter(Boolean),
  }
}

export function parseCsv(text: string): ParsedCsvRow[] {
  const delimiter = detectCsvDelimiter(text)
  const rows = expandPackedCsvRows(parseCsvRows(text.replace(/^\uFEFF/, ''), delimiter), delimiter)
  const [headerRow, ...bodyRows] = rows

  if (!headerRow?.length) {
    return []
  }

  const headers = headerRow.map((header) => normalizeHeader(header))

  return bodyRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const parsed: ParsedCsvRow = {}

      headers.forEach((header, index) => {
        if (!header) return
        parsed[header] = row[index]?.trim() || ''
      })

      return parsed
    })
}

function parseCsvRows(text: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  rows.push(row)

  return rows
}

function expandPackedCsvRows(rows: string[][], delimiter: string) {
  return rows.map((row) => {
    if (row.length !== 1 || !row[0]?.includes(delimiter)) {
      return row
    }

    return parseCsvRows(row[0], delimiter)[0] || row
  })
}

function normalizeHeader(header: string) {
  const normalized = header
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return HEADER_ALIASES[normalized] || normalized
}

function escapeCsvCell(cell: string) {
  if (!/[",\n\r]/.test(cell)) {
    return cell
  }

  return `"${cell.replace(/"/g, '""')}"`
}

function detectCsvDelimiter(text: string) {
  const firstLine = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .find((line) => line.trim())

  if (!firstLine) {
    return ','
  }

  const candidates = [',', ';', '\t']
  const [bestDelimiter] = candidates
    .map((delimiter) => [delimiter, countDelimiter(firstLine, delimiter)] as const)
    .sort((a, b) => b[1] - a[1])

  return bestDelimiter?.[0] || ','
}

function countDelimiter(line: string, delimiter: string) {
  let quoted = false
  let count = 0

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      count += 1
    }
  }

  return count
}
