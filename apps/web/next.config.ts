import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js injecte encore quelques scripts inline au bootstrap. On garde
      // unsafe-inline temporairement pour compatibilité, tout en bloquant les
      // scripts tiers. Une CSP à nonce pourra durcir ce point ensuite.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.scw.cloud",
      "font-src 'self' data:",
      "connect-src 'self' https://*.scw.cloud",
      "worker-src 'self' blob:",
      "frame-src 'self' blob: https://*.scw.cloud",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const privateNoStoreHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/admin/:path*', headers: privateNoStoreHeaders },
      { source: '/explorer/:path*', headers: privateNoStoreHeaders },
      { source: '/assistant/:path*', headers: privateNoStoreHeaders },
      { source: '/viewer/:path*', headers: privateNoStoreHeaders },
      { source: '/dashboard/:path*', headers: privateNoStoreHeaders },
      { source: '/users/:path*', headers: privateNoStoreHeaders },
      { source: '/groups/:path*', headers: privateNoStoreHeaders },
      { source: '/trash/:path*', headers: privateNoStoreHeaders },
      { source: '/settings/:path*', headers: privateNoStoreHeaders },
      { source: '/signatures/:path*', headers: privateNoStoreHeaders },
      { source: '/connexion', headers: privateNoStoreHeaders },
    ];
  },
};

export default nextConfig;
