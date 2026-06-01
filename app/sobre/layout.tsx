import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre a Vendas+IA | IA de Prospecção via WhatsApp',
  description:
    'Conheça a equipe e a missão da Vendas+IA: a plataforma de inteligência artificial que substitui SDRs e automatiza a pré-vendas via WhatsApp para empresas B2B.',
  alternates: {
    canonical: 'https://www.vendasmaisia.com/sobre',
  },
  openGraph: {
    title: 'Sobre a Vendas+IA | IA de Prospecção via WhatsApp',
    description:
      'Conheça a equipe e a missão da Vendas+IA: a plataforma de inteligência artificial que substitui SDRs e automatiza a pré-vendas via WhatsApp para empresas B2B.',
    url: 'https://www.vendasmaisia.com/sobre',
  },
}

export default function SobreLayout({ children }: { children: React.ReactNode }) {
  return children
}
