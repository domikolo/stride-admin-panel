# 🚀 Stride Services - SaaS Platform Plan

> **Projekt**: Multi-tenant admin panel dla klientów chatbota
> **Cel**: Dashboard gdzie klienci widzą swoje statystyki, a admin widzi wszystkich klientów + finanse
> **Data utworzenia**: 2025-12-12
> **Status**: 💭 Planowanie - Do realizacji w przyszłości

---

## 📋 OVERVIEW

**Problem:**
Obecnie chatbot działa, ale nie ma sposobu dla klientów żeby widzieli:
- Historię swoich konwersacji
- Statystyki użycia
- Appointmenty
- (Opcjonalnie) Koszty

Admin (Stride Services) też nie ma widoku na:
- Wszystkich klientów w jednym miejscu
- Per-client statystyki
- Koszty vs Revenue (marża)
- Billing/invoicing

**Rozwiązanie:**
Multi-tenant SaaS platform z dwoma poziomami dostępu:
1. **Client View** - każdy klient widzi tylko swoje dane
2. **Admin View** - Stride widzi wszystkich klientów + finanse

---

## 🏢 ARCHITEKTURA

```
                admin.stride-services.com
                          ↓
        ┌─────────────────────────────────────┐
        │      Authentication Layer           │
        │  (NextAuth.js / JWT)                │
        └─────────────────────────────────────┘
                    ↓         ↓
        ┌───────────────┐  ┌──────────────────┐
        │  Client View  │  │   Admin View     │
        │  (tenant-1)   │  │  (super-admin)   │
        └───────────────┘  └──────────────────┘
                    ↓         ↓
        ┌─────────────────────────────────────┐
        │         Backend API                  │
        │  (Next.js API Routes)               │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │    Multi-tenant Database             │
        │  - Users (role-based)                │
        │  - Clients (companies)               │
        │  - Conversations (per client)        │
        │  - Billing (per client)              │
        └─────────────────────────────────────┘
```

---

## 👥 USER VIEWS

### **CLIENT VIEW** (Przykład: Firma "AutoSerwis Kowalski")

**Dashboard:**
- 📊 Statystyki ich chatbota (ten miesiąc)
  - Total Conversations
  - Total Appointments
  - Conversion Rate
  - Avg Response Time
- 💬 Historia konwersacji (tylko ich)
  - Tabela z filtrami (data, search)
  - Możliwość export CSV
  - Podgląd pełnej konwersacji
- 📅 Appointmenty
  - Lista appointmentów
  - Status (pending/confirmed/completed)
- 📈 Trendy
  - Wykresy: conversations over time
  - Peak hours heatmap
  - Popular queries

**Co NIE widzą:**
- ❌ Innych klientów
- ❌ Kosztów AWS
- ❌ Marży Stride

---

### **ADMIN VIEW** (Stride Services - Dominik/Jakub)

**Dashboard:**
- 💰 Revenue Overview
  - MRR (Monthly Recurring Revenue)
  - Total Clients
  - AWS Costs (total)
  - Margin (revenue - costs)
- 👥 Clients List
  - Tabela wszystkich klientów:
    - Company Name
    - Plan (Basic/Pro/Enterprise)
    - Conversations (this month)
    - AWS Cost
    - Revenue
    - Margin
  - Kliknięcie → szczegóły klienta
- 📊 All Conversations (wszystkich klientów)
  - Filtry per client
  - Search global
  - Export
- 💸 Billing & Invoicing
  - Generate invoices per client
  - Payment status tracking
  - Revenue reports
- 📈 Analytics
  - Growth trends
  - Churn rate
  - Client acquisition cost
  - Lifetime value

**Client Detail View (po kliknięciu na klienta):**
- Pełny dashboard jak w Client View
- Dodatkowo:
  - Edit client settings
  - Billing history
  - Actual costs breakdown
  - Notes/comments

---

## 🗄️ DATABASE SCHEMA (Multi-tenant)

### **Nowe tabele w DynamoDB:**

#### 1. `users` table
```javascript
{
  PK: "USER#user_123",
  SK: "PROFILE",
  userId: "user_123",
  email: "jan@autoserwis.pl",
  passwordHash: "...",         // bcrypt
  role: "client",              // client | admin
  clientId: "client_abc",      // tylko dla role=client
  name: "Jan Kowalski",
  phone: "+48123456789",
  createdAt: "2025-12-01T10:00:00Z",
  lastLogin: "2025-12-12T14:30:00Z",
  status: "active"             // active | inactive
}
```

#### 2. `clients` table
```javascript
{
  PK: "CLIENT#client_abc",
  SK: "PROFILE",
  clientId: "client_abc",
  companyName: "AutoSerwis Kowalski",
  domain: "autoserwis.pl",
  chatbotUrl: "https://autoserwis.pl/chat",

  // Subscription
  plan: "pro",                 // basic | pro | enterprise
  pricing: {
    monthlyFee: 800,           // PLN
    perConversation: 0,        // lub per-usage pricing
    currency: "PLN"
  },

  // Status
  status: "active",            // active | paused | cancelled
  createdAt: "2025-01-15T10:00:00Z",
  nextBillingDate: "2026-01-15",

  // Limits & Features
  settings: {
    maxConversations: 1000,    // per month (null = unlimited)
    features: ["calendar", "payments", "notifications"],
    knowledgeBaseUrl: "s3://...",
    customizations: {
      brandColor: "#FF5722",
      logo: "s3://...",
      language: "pl"
    }
  },

  // Contact
  contactEmail: "jan@autoserwis.pl",
  contactPhone: "+48123456789",
  address: "ul. Główna 123, Warszawa"
}
```

#### 3. `conversations` table (ROZSZERZENIE ISTNIEJĄCEJ)
```javascript
{
  PK: "SESSION#sess_xyz",
  SK: "CONVERSATION",
  session_id: "sess_xyz",
  clientId: "client_abc",      // ← DODAĆ!

  // Existing fields
  timestamp: "2025-12-12T10:30:00Z",
  messages: [...],

  // New fields
  cost: {
    bedrock: 0.003,            // calculated
    storage: 0.0001,
    total: 0.0031
  },

  metadata: {
    userAgent: "Mozilla/5.0...",
    source: "website",         // website | whatsapp | facebook
    location: "Warsaw, PL",
    device: "mobile"
  },

  outcome: {
    appointmentCreated: true,
    appointmentId: "appt_123",
    converted: true,           // czy doszło do celu (appointment/purchase)
  }
}
```

#### 4. `billing` table (NOWA)
```javascript
{
  PK: "CLIENT#client_abc",
  SK: "BILLING#2025-12",
  billingId: "bill_client_abc_202512",
  clientId: "client_abc",
  month: "2025-12",

  // Usage Stats
  stats: {
    totalConversations: 234,
    totalMessages: 1456,
    totalAppointments: 12,
    conversionRate: 5.1,       // %
    avgResponseTime: 1.2       // seconds
  },

  // Costs Breakdown
  costs: {
    bedrock: 12.34,            // AI model
    dynamodb: 0.45,            // storage
    s3: 0.12,                  // knowledge base
    lambda: 0.05,              // compute
    other: 0.15,
    total: 13.11
  },

  // Revenue & Margin
  revenue: 800,                // ile płaci klient
  margin: 786.89,              // revenue - costs
  marginPercent: 98.4,         // %

  // Invoicing
  invoiceNumber: "INV-2025-12-001",
  invoiceUrl: "s3://invoices/...",
  invoiceDate: "2025-12-31",
  dueDate: "2026-01-15",
  paid: true,
  paidDate: "2026-01-10",
  paymentMethod: "transfer"   // transfer | card | other
}
```

#### 5. `appointments` table (ROZSZERZENIE ISTNIEJĄCEJ)
```javascript
{
  PK: "APPOINTMENT#appt_123",
  SK: "SESSION#sess_xyz",
  appointment_id: "appt_123",
  session_id: "sess_xyz",
  clientId: "client_abc",      // ← DODAĆ!

  // Existing fields...
  datetime: "2025-12-20T14:00:00Z",
  contact: {...},
  status: "confirmed",

  // Tracking
  createdAt: "2025-12-12T10:35:00Z",
  confirmedAt: "2025-12-12T10:40:00Z",
  source: "chatbot"
}
```

---

## 🎨 TECH STACK

### **Frontend:**
- **Framework:** Next.js 14 (App Router)
- **UI Library:** shadcn/ui (Radix UI + Tailwind)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Tables:** @tanstack/react-table
- **Forms:** React Hook Form + Zod validation
- **State Management:** React Context (lub Zustand if needed)
- **Icons:** Lucide React

### **Backend:**
- **API:** Next.js API Routes (serverless)
- **AWS SDK:** boto3 → aws-sdk (JavaScript)
- **Database:** DynamoDB (multi-tenant design)
- **File Storage:** S3 (invoices, exports)
- **Authentication:** NextAuth.js
- **Password Hashing:** bcrypt
- **JWT:** jose (built-in Next.js)

### **Hosting & DevOps:**
- **Hosting:** Vercel (frontend + API routes)
- **Domain:** admin.stride-services.com
- **DNS:** Cloudflare (lub Route53)
- **CI/CD:** GitHub Actions → Vercel auto-deploy
- **Monitoring:** Vercel Analytics + Sentry (errors)

### **Optional Integrations:**
- **Email:** AWS SES (transactional emails)
- **Payments:** Stripe (jeśli chcesz online billing)
- **PDF Generation:** jsPDF (invoices)
- **Export:** papaparse (CSV), xlsx (Excel)

---

## ⏱️ OSZACOWANIE CZASU

### **FAZA 1: MVP** (~50-70 godzin)

#### Week 1: Foundation (20-25h)
- [ ] Project setup (Next.js + shadcn/ui) - 3h
- [ ] Database schema design - 3h
- [ ] Authentication system (NextAuth.js) - 8h
  - Login/logout
  - Session management
  - Role-based access
- [ ] Basic API routes - 6-8h
  - User CRUD
  - Client CRUD
  - Conversations read (multi-tenant)

#### Week 2: Client Dashboard (15-20h)
- [ ] Client dashboard layout - 4h
- [ ] Stats cards (conversations, appointments) - 4h
- [ ] Conversations table (filtered by clientId) - 5h
- [ ] Appointments list - 3h
- [ ] Date filters - 2-3h

#### Week 3: Admin Dashboard (15-20h)
- [ ] Admin layout - 3h
- [ ] Revenue overview cards - 4h
- [ ] Clients list table - 6h
- [ ] Client detail view - 4h
- [ ] Cost calculation logic - 3h

#### Week 4: Polish & Deploy (10-15h)
- [ ] Responsive design - 4h
- [ ] Error handling - 2h
- [ ] Loading states - 2h
- [ ] Testing - 3h
- [ ] Deployment (Vercel) - 2h
- [ ] Custom domain setup - 1h

**MVP Features:**
- ✅ User authentication (login/logout)
- ✅ Client dashboard (basic stats + conversations)
- ✅ Admin dashboard (clients list + basic analytics)
- ✅ Multi-tenant data isolation
- ✅ Responsive design
- ✅ Cost tracking per client

---

### **FAZA 2: Enhanced Features** (~50-80 godzin)

#### Charts & Analytics (15-20h)
- [ ] Recharts integration
- [ ] Conversations over time (line chart)
- [ ] Peak hours heatmap
- [ ] Conversion funnel
- [ ] Client growth chart (admin)

#### Billing & Invoicing (20-25h)
- [ ] Invoice generation (PDF)
- [ ] Billing history per client
- [ ] Payment status tracking
- [ ] Automated monthly billing
- [ ] Email invoice delivery

#### Advanced Features (15-20h)
- [ ] Export functionality (CSV/PDF)
- [ ] Advanced filters & search
- [ ] Email notifications (daily reports)
- [ ] Client settings management
- [ ] Usage alerts (quotas)

#### Multi-language & Customization (10-15h)
- [ ] i18n (PL/EN)
- [ ] White-labeling options
- [ ] Custom branding per client
- [ ] Theme customization

---

### **FAZA 3: Scale & Optimize** (~30-50 godzin)

#### Performance (10-15h)
- [ ] Caching strategy (Redis/Vercel KV)
- [ ] Database query optimization
- [ ] Lazy loading & code splitting
- [ ] Image optimization

#### Security (10-15h)
- [ ] Rate limiting
- [ ] API security audit
- [ ] CSRF protection
- [ ] SQL injection prevention (N/A for DynamoDB, but validate inputs)
- [ ] Audit logs

#### Integrations (10-20h)
- [ ] Stripe integration (payments)
- [ ] Webhook endpoints
- [ ] Slack notifications (new client, errors)
- [ ] Email marketing (Mailchimp)

---

## 💰 KOSZTY INFRASTRUKTURY

### **Development:**
- Domain: $12/rok (~1 PLN/miesiąc)
- **Total dev: praktycznie darmowe**

### **Production (10-50 klientów):**
| Service | Cost/month |
|---------|------------|
| Vercel Hobby | $0 (free tier) |
| DynamoDB | $5-10 (depends on usage) |
| AWS Lambda (existing) | $1-2 |
| S3 (invoices/exports) | $1-2 |
| Route53 (DNS) | $0.50 |
| SES (emails) | $1 |
| **TOTAL** | **$8-16/month** |

### **Production (100+ klientów):**
| Service | Cost/month |
|---------|------------|
| Vercel Pro | $20 |
| DynamoDB | $20-50 |
| AWS Lambda | $5-10 |
| S3 | $5 |
| Route53 | $0.50 |
| SES | $2-5 |
| Sentry (errors) | $26 |
| **TOTAL** | **$78-116/month** |

### **ROI Calculation:**
Jeśli masz:
- 10 klientów × 800 PLN = 8,000 PLN/miesiąc
- Infrastructure cost: ~50 PLN/miesiąc
- **Margin: 99.4%** 🚀

---

## 🎯 KLUCZOWE DECYZJE DO PODJĘCIA

### **1. Pricing Model dla klientów:**

**Opcja A: Fixed Monthly** (Proste)
```
Basic: 400 PLN/miesiąc (do 500 rozmów)
Pro: 800 PLN/miesiąc (do 2000 rozmów)
Enterprise: Custom (unlimited)
```
**Pros:** Przewidywalne, łatwe w rozliczeniach
**Cons:** Mniej elastyczne

**Opcja B: Usage-Based** (Fair)
```
2 PLN per conversation
Minimum: 200 PLN/miesiąc
```
**Pros:** Fair, pay-as-you-go
**Cons:** Trudniej przewidzieć koszty

**Opcja C: Hybrid** (Recommended)
```
Base fee: 400 PLN (includes 200 conversations)
Additional: 1.50 PLN per conversation
```
**Pros:** Przewidywalne + fair
**Cons:** Bardziej skomplikowane

### **2. Multi-tenant Architecture:**

**Opcja A: Single Lambda (Multi-tenant w kodzie)** ⭐ POLECAM
- Pros: Prostsze, tańsze, łatwiejsze maintenance
- Cons: Wszyscy klienci dzielą infrastrukturę
- Implementation: Każdy request ma `clientId` header/query param

**Opcja B: Per-Client Lambda**
- Pros: Izolacja, dedykowane resources
- Cons: Droższe, trudniejsze w zarządzaniu
- Implementation: Deploy osobny Lambda per client

**Rekomendacja:** Opcja A, potem migracja do B tylko dla enterprise clients

### **3. White-labeling:**

Czy klienci widzą:
- **Option A:** Branding Stride Services (prostsze)
- **Option B:** Ich własny branding (wymaga customization per client)

**Rekomendacja:** Start z A, dodaj B jako premium feature

### **4. Data Retention:**

Jak długo przechowywać conversations?
- **Option A:** Unlimited (DynamoDB with TTL after X months)
- **Option B:** Plan-based (Basic: 3 months, Pro: 12 months, Enterprise: unlimited)

**Rekomendacja:** Option B - różnicuj przez plan

---

## 📋 FEATURES CHECKLIST

### **MVP (Phase 1):**
- [ ] User authentication
  - [ ] Login/logout
  - [ ] Password reset
  - [ ] Session management
- [ ] Client dashboard
  - [ ] Stats overview
  - [ ] Conversations table
  - [ ] Appointments list
  - [ ] Date filters
- [ ] Admin dashboard
  - [ ] Revenue overview
  - [ ] Clients list
  - [ ] Per-client stats
  - [ ] All conversations view
- [ ] Multi-tenant data isolation
- [ ] Cost tracking
- [ ] Responsive design

### **Phase 2 (Enhanced):**
- [ ] Charts & visualizations
- [ ] Export (CSV/PDF)
- [ ] Billing & invoicing
- [ ] Email notifications
- [ ] Advanced filters
- [ ] Client settings management
- [ ] Multi-language (PL/EN)

### **Phase 3 (Scale):**
- [ ] Stripe integration
- [ ] Webhooks
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Audit logs
- [ ] Slack integration
- [ ] Mobile app (future)

---

## 🚀 DEPLOYMENT PLAN

### **Phase 1: MVP Deployment**

**Pre-launch checklist:**
- [ ] All MVP features tested
- [ ] Database schema finalized
- [ ] Environment variables configured
- [ ] Custom domain setup (admin.stride-services.com)
- [ ] SSL certificate active
- [ ] First admin user created

**Deployment steps:**
1. Push to GitHub main branch
2. Vercel auto-deploys
3. Run database migrations (if any)
4. Create first admin user (manual)
5. Test login & basic flows
6. Monitor Vercel logs for errors

**Post-launch:**
- Monitor for 24h
- Onboard first 1-2 test clients
- Gather feedback
- Fix critical bugs

### **Phase 2 & 3: Iterative**
- Weekly deploys
- Feature flags for gradual rollout
- A/B testing new features

---

## 🎨 UI/UX MOCKUPS (To Do)

**TODO:** Create mockups for:
1. Login page
2. Client dashboard
3. Admin dashboard
4. Client detail view
5. Conversations table
6. Billing page

**Tools:** Figma, Excalidraw, or even hand sketches

---

## 📚 RESOURCES & INSPIRATION

**Similar platforms to study:**
- Intercom (conversations view)
- Mixpanel (analytics dashboard)
- Stripe Dashboard (billing)
- Vercel Dashboard (clean UI)

**Tech docs:**
- Next.js: https://nextjs.org/docs
- shadcn/ui: https://ui.shadcn.com
- NextAuth.js: https://next-auth.js.org
- DynamoDB Multi-tenant: https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-amazon-dynamodb/

---

## ⚠️ RISKS & MITIGATIONS

### **Risk 1: Data Isolation Bug**
**Risk:** Klient widzi dane innego klienta
**Mitigation:**
- Thorough testing per-tenant queries
- Add `clientId` to ALL queries
- Audit logs to track data access

### **Risk 2: Performance Issues**
**Risk:** Dashboard wolny przy dużej ilości danych
**Mitigation:**
- Pagination
- Caching (Redis/Vercel KV)
- Database indexes
- Lazy loading

### **Risk 3: Cost Overrun**
**Risk:** AWS costs wyższe niż revenue
**Mitigation:**
- Set billing alerts
- Monitor costs per client
- Implement usage quotas
- Optimize queries

### **Risk 4: Security Breach**
**Risk:** Unauthorized access
**Mitigation:**
- Rate limiting
- Strong password policy
- 2FA (future)
- Regular security audits
- HTTPS only

---

## 🔮 FUTURE ENHANCEMENTS

**Later phases (6-12 months):**
- [ ] Mobile app (React Native)
- [ ] Real-time dashboard (WebSocket)
- [ ] AI-powered insights ("Your conversion rate dropped 15%")
- [ ] Automated A/B testing prompts
- [ ] Multi-channel support (WhatsApp, Messenger)
- [ ] Zapier integration
- [ ] Public API for clients
- [ ] Marketplace (template chatbots)
- [ ] Affiliate program

---

## 📞 CONTACT & NOTES

**Project Owner:** Dominik
**Start Date:** TBD
**Target Launch:** TBD

**Notes:**
- To jest długoterminowy projekt, nie rush
- Najpierw MVP, potem iteracje
- Zbierać feedback od prawdziwych klientów
- Priorytet: security + performance

---

**Status:** 📋 Planning Phase - Ready to start when needed

**Last Updated:** 2025-12-12
