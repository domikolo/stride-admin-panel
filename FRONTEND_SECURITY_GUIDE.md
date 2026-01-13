# Frontend Security Implementation Guide

## ⚠️ NOTE: This guide is for ENTERPRISE-LEVEL security

**For low traffic (5 admin users):**
- Most of this is OPTIONAL
- Focus on backend security first (see `SECURITY_UPDATE.md`)
- Cognito authentication (already implemented) is sufficient

**When to implement these features:**
- httpOnly cookies: When >20 users or handling sensitive PII
- CSP headers: When deploying to production domain
- Input sanitization: When >100 users or public-facing

**Current recommendation:** Skip these unless preparing for production launch.

See: `SECURITY_UPDATE.md` for realistic security plan

---

## 🎯 Goal: Upgrade Frontend Security to 10/10 (Enterprise)

---

## 1. SECURE TOKEN STORAGE (httpOnly Cookies)

### Problem
Currently tokens are stored in localStorage by Cognito SDK, which is vulnerable to XSS attacks.

### Solution: Next.js Middleware + httpOnly Cookies

#### Step 1: Create authentication middleware

Create `middleware.ts` in root:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('cognito_id_token')?.value
  const refreshToken = request.cookies.get('cognito_refresh_token')?.value

  // Protected routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                          request.nextUrl.pathname.startsWith('/conversations') ||
                          request.nextUrl.pathname.startsWith('/appointments') ||
                          request.nextUrl.pathname.startsWith('/insights') ||
                          request.nextUrl.pathname.startsWith('/clients')

  // Public routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

  // Redirect logic
  if (isProtectedRoute && !token) {
    // Not authenticated - redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && token) {
    // Already authenticated - redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Add security headers
  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

#### Step 2: Create API route for authentication

Create `app/api/auth/login/route.ts`:

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CognitoUser, AuthenticationDetails, CognitoUserPool } from 'amazon-cognito-identity-js'

const userPool = new CognitoUserPool({
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
})

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Authenticate with Cognito
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    })

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    })

    return new Promise((resolve) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
          const idToken = result.getIdToken().getJwtToken()
          const accessToken = result.getAccessToken().getJwtToken()
          const refreshToken = result.getRefreshToken().getToken()

          // Create response with httpOnly cookies
          const response = NextResponse.json({
            success: true,
            user: result.getIdToken().payload,
          })

          // Set httpOnly cookies (not accessible via JavaScript)
          response.cookies.set('cognito_id_token', idToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60, // 1 hour
            path: '/',
          })

          response.cookies.set('cognito_access_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60,
            path: '/',
          })

          response.cookies.set('cognito_refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60, // 30 days
            path: '/',
          })

          resolve(response)
        },
        onFailure: (err) => {
          resolve(NextResponse.json(
            { success: false, error: err.message },
            { status: 401 }
          ))
        },
      })
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
```

#### Step 3: Create API route for logout

Create `app/api/auth/logout/route.ts`:

```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear all authentication cookies
  response.cookies.delete('cognito_id_token')
  response.cookies.delete('cognito_access_token')
  response.cookies.delete('cognito_refresh_token')

  return response
}
```

#### Step 4: Update login page

```typescript
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Login successful!')
        router.push('/dashboard')
        router.refresh() // Refresh to trigger middleware
      } else {
        toast.error(data.error || 'Login failed')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  )
}
```

---

## 2. CONTENT SECURITY POLICY (CSP)

### Update `next.config.ts`:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Remove unsafe-* in production
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://whmpy9rli5.execute-api.eu-central-1.amazonaws.com https://cognito-idp.eu-central-1.amazonaws.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

---

## 3. INPUT SANITIZATION

### Create sanitization utility

```typescript
// lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//,
  })
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  return text.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * Strip all HTML tags
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize user input before sending to API
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .slice(0, 5000) // Limit length
}

/**
 * Validate and sanitize session ID
 */
export function sanitizeSessionId(sessionId: string): string {
  // Only allow alphanumeric, hyphens, underscores
  return sessionId.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().slice(0, 255)
}
```

### Install dependency:

```bash
npm install isomorphic-dompurify
```

### Use in conversation display:

```typescript
// app/(dashboard)/conversations/[sessionId]/page.tsx
import { sanitizeHtml, escapeHtml } from '@/lib/sanitize'

export default function ConversationDetail() {
  // ...

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.timestamp}>
          {/* Safe rendering of user messages */}
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.text) }} />

          {/* Or use escape for plaintext */}
          <div>{escapeHtml(msg.text)}</div>
        </div>
      ))}
    </div>
  )
}
```

---

## 4. API CLIENT SECURITY

### Update `lib/api.ts`:

```typescript
// lib/api.ts
import { sanitizeInput, sanitizeSessionId } from './sanitize'

export class ApiClient {
  private baseURL: string

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || ''
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    // Token is sent via httpOnly cookie automatically
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: 'include', // Send cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Don't expose backend error details
      if (response.status === 401) {
        // Redirect to login
        window.location.href = '/login'
        throw new Error('Unauthorized')
      }

      if (response.status === 403) {
        throw new Error('Access denied')
      }

      if (response.status >= 500) {
        throw new Error('Server error. Please try again.')
      }

      throw new Error('Request failed')
    }

    return response.json()
  }

  async getConversations(clientId: string, limit: number = 10) {
    // Sanitize inputs
    const sanitizedClientId = sanitizeSessionId(clientId)
    const sanitizedLimit = Math.min(Math.max(1, limit), 100)

    return this.request(
      `/clients/${sanitizedClientId}/conversations?limit=${sanitizedLimit}`
    )
  }

  async getConversationDetail(clientId: string, sessionId: string) {
    const sanitizedClientId = sanitizeSessionId(clientId)
    const sanitizedSessionId = sanitizeSessionId(sessionId)

    return this.request(
      `/clients/${sanitizedClientId}/conversations/${sanitizedSessionId}`
    )
  }
}
```

---

## 5. RATE LIMITING ON FRONTEND

### Prevent abuse of expensive operations

```typescript
// lib/rate-limit.ts
interface RateLimitState {
  count: number
  resetTime: number
}

const rateLimits = new Map<string, RateLimitState>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const state = rateLimits.get(key)

  if (!state || state.resetTime < now) {
    // Reset window
    rateLimits.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return true
  }

  if (state.count >= maxRequests) {
    return false
  }

  state.count++
  return true
}

export function getRateLimitError(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000)
  return `Too many requests. Please try again in ${seconds} seconds.`
}

// Usage example
export async function analyzeTopicsWithRateLimit(clientId: string) {
  const rateLimitKey = `analyze-topics-${clientId}`

  // Max 5 requests per hour
  if (!checkRateLimit(rateLimitKey, 5, 60 * 60 * 1000)) {
    throw new Error(getRateLimitError(60 * 60 * 1000))
  }

  // Proceed with API call
  return fetch(`/api/clients/${clientId}/trending-topics/analyze`, {
    method: 'POST',
  })
}
```

---

## 6. SECURE ENVIRONMENT VARIABLES

### `.env.local`:

```bash
# Public (can be exposed to browser)
NEXT_PUBLIC_API_URL=https://whmpy9rli5.execute-api.eu-central-1.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-central-1_foqQPqZsC
NEXT_PUBLIC_COGNITO_CLIENT_ID=2tkv1rheoufn1c19cf8mppdmus
NEXT_PUBLIC_COGNITO_REGION=eu-central-1

# Private (server-side only)
# Add if needed for server-side operations
```

### Never commit:
- `.env.local`
- `.env.production`
- API keys
- Secrets

---

## 7. DEPENDENCY SECURITY

### Add to `package.json` scripts:

```json
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "audit:production": "npm audit --production"
  }
}
```

### Run regularly:

```bash
npm audit
npm audit fix
```

### Use Dependabot:

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/frontend/admin-panel"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    versioning-strategy: increase
```

---

## 8. SECURITY CHECKLIST

### Before Production:

- [ ] All tokens in httpOnly cookies
- [ ] CSP headers configured
- [ ] Input sanitization on all user inputs
- [ ] Output encoding on all displays
- [ ] Rate limiting on expensive operations
- [ ] HTTPS only (no HTTP)
- [ ] Secure cookies (secure: true, sameSite: 'strict')
- [ ] No sensitive data in localStorage
- [ ] No console.log() with sensitive data
- [ ] Dependencies audited
- [ ] Environment variables secured
- [ ] Error messages don't expose internals
- [ ] CORS properly configured
- [ ] No inline scripts (CSP compliance)

---

## 9. TESTING SECURITY

### Install security testing tools:

```bash
npm install --save-dev @next/eslint-plugin-next eslint-plugin-security
```

### Update `.eslintrc.json`:

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:security/recommended"
  ],
  "rules": {
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-unsafe-regex": "error"
  }
}
```

### Run security audit:

```bash
npm run lint
npm audit
```

---

## 10. MONITORING & ALERTING

### Add error boundary for security errors:

```typescript
// components/SecurityErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class SecurityErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to monitoring service
    console.error('Security error:', error, errorInfo)

    // Send to backend for logging
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // Fail silently
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2>Something went wrong</h2>
          <p>Please refresh the page or contact support.</p>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Wrap app in `app/layout.tsx`:

```typescript
import { SecurityErrorBoundary } from '@/components/SecurityErrorBoundary'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SecurityErrorBoundary>
          {children}
        </SecurityErrorBoundary>
      </body>
    </html>
  )
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1 (Critical):
- [ ] Implement httpOnly cookies for auth
- [ ] Add CSP headers
- [ ] Sanitize all user inputs
- [ ] Update API client with security measures

### Phase 2 (High Priority):
- [ ] Add rate limiting on frontend
- [ ] Implement error boundary
- [ ] Add security headers via middleware
- [ ] Audit dependencies

### Phase 3 (Important):
- [ ] Setup Dependabot
- [ ] Add security linting
- [ ] Create monitoring/alerting
- [ ] Document security practices

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [Content Security Policy Guide](https://content-security-policy.com/)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
