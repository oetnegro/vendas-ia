import { ImageResponse } from 'next/og'

export const alt = 'Vendas+IA — IA de Prospecção e Pré-Vendas via WhatsApp'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0f172a',
          color: '#f8fafc',
          padding: '72px',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #eab308',
              borderRadius: '18px',
              fontSize: '42px',
              fontWeight: 800,
              color: '#eab308',
            }}
          >
            +
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '48px',
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            Vendas<span style={{ color: '#eab308' }}>+</span>IA
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div
            style={{
              color: '#facc15',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            IA de Prospecção e Pré-Vendas via WhatsApp
          </div>
          <div
            style={{
              maxWidth: '930px',
              fontSize: '74px',
              lineHeight: 1.02,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            Substitua SDRs por uma IA que prospecta, qualifica e agenda reuniões
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            color: '#cbd5e1',
            fontSize: '28px',
            fontWeight: 600,
          }}
        >
          <span>CRM incluído</span>
          <span style={{ color: '#eab308' }}>•</span>
          <span>Ativação em 7 dias</span>
          <span style={{ color: '#eab308' }}>•</span>
          <span>A partir de R$599/mês</span>
        </div>
      </div>
    ),
    size
  )
}
