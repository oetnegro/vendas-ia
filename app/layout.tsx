import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import { PostHogProvider } from '@/components/app/posthog-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = 'https://www.vendasmaisia.com'
const HOME_URL = `${BASE_URL}/`

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'Vendas+IA | IA de Prospecção e Pré-Vendas via WhatsApp',
  description:
    'Substitua SDRs por uma IA que prospecta, qualifica leads e agenda reuniões 24/7 via WhatsApp. CRM incluído. Ativação em 7 dias. A partir de R$599/mês.',
  alternates: {
    canonical: HOME_URL,
  },
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: HOME_URL,
    siteName: 'Vendas+IA',
    title: 'Vendas+IA | IA de Prospecção e Pré-Vendas via WhatsApp',
    description:
      'Substitua SDRs por uma IA que prospecta, qualifica leads e agenda reuniões 24/7 via WhatsApp. CRM incluído. Ativação em 7 dias. A partir de R$599/mês.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Vendas+IA — IA de Prospecção via WhatsApp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vendas+IA | IA de Prospecção e Pré-Vendas via WhatsApp',
    description:
      'Substitua SDRs por uma IA que prospecta, qualifica leads e agenda reuniões 24/7 via WhatsApp. CRM incluído. Ativação em 7 dias. A partir de R$599/mês.',
    images: ['/opengraph-image'],
  },
  verification: {
    google: 'ff54af9b5eee5412',
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Vendas+IA',
  url: HOME_URL,
  logo: `${BASE_URL}/favicon.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    areaServed: 'BR',
    availableLanguage: 'Portuguese',
  },
  sameAs: ['https://www.linkedin.com/company/vendasmaisia'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={inter.className}>
        <Suspense>
          <PostHogProvider>{children}</PostHogProvider>
        </Suspense>
      </body>
    </html>
  )
}
