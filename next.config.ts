import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'vendasmaisia.com' }],
        destination: 'https://www.vendasmaisia.com/:path*',
        permanent: true,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'vendasia',
  project: 'vendasmaisia-app',

  // Silencia logs do Sentry no build local
  silent: !process.env.CI,

  // Source maps — so envia em CI com SENTRY_AUTH_TOKEN configurado
  widenClientFileUpload: true,
  disableLogger: true,

  // Tunnel evita bloqueio de adblocker
  tunnelRoute: '/monitoring',

  automaticVercelMonitors: true,
})
