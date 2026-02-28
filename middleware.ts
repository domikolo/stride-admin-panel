import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Endpoints allowed to receive fetch/XHR/WebSocket requests from the browser.
// Keep this list tight — every extra entry is attack surface.
const CONNECT_ALLOWLIST = [
  'https://whmpy9rli5.execute-api.eu-central-1.amazonaws.com',  // Admin API
  'wss://80q4hpdk84.execute-api.eu-central-1.amazonaws.com',    // WebSocket (Live)
  'https://cognito-idp.eu-central-1.amazonaws.com',             // Cognito auth
].join(' ')

function buildCsp(nonce: string): string {
  const directives: string[] = [
    "default-src 'self'",
    // nonce gates Next.js bootstrap scripts; 'strict-dynamic' trusts all scripts
    // dynamically loaded by those (Next.js chunk loader, lazy imports).
    // No 'unsafe-inline' — any injected inline script is blocked in CSP-L2+ browsers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind + CSS-in-JS generate inline styles at runtime — unavoidable.
    "style-src 'self' 'unsafe-inline'",
    // data: covers favicon/SVG inline; blob: covers KB file upload previews.
    "img-src 'self' data: blob:",
    // next/font/google bundles Inter locally — no Google CDN needed.
    "font-src 'self'",
    `connect-src 'self' ${CONNECT_ALLOWLIST}`,
    "object-src 'none'",
    "worker-src 'none'",
    // Prevents <base> tag injection (open-redirect vector).
    "base-uri 'self'",
    // Prevents form hijacking to external domains.
    "form-action 'self'",
    // belt + suspenders with X-Frame-Options in next.config.ts
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ]
  return directives.join('; ')
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Redirect Amplify legacy URL → custom domain (301 permanent)
  if (host.includes('amplifyapp.com')) {
    const url = request.nextUrl.clone()
    url.host = 'panel.stride-services.pl'
    url.port = ''
    return NextResponse.redirect(url, { status: 301 })
  }

  // Fresh nonce per request — base64(uuid) is URL-safe and unpredictable.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  // x-nonce is read by layout.tsx so Next.js can attach the nonce to its own
  // <script> tags during server rendering (required for nonce-based CSP to work).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  // Exclude static Next.js assets — they don't need CSP headers.
  matcher: '/((?!_next/static|_next/image|favicon).*)',
}
