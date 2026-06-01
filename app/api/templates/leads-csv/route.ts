import { NextResponse } from 'next/server'
import { csvTemplateText } from '@/lib/csv'

export function GET() {
  return new NextResponse(csvTemplateText({ bom: true, lineEnding: '\r\n' }), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-leads-vendas-ia.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
