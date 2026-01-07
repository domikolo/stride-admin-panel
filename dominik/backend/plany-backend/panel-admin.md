# Panel Administracyjny SaaS - Plan Projektu

> **Cel**: Centralny panel do zarządzania wieloma chatbotami AI dla różnych klientów.
> **Status**: MVP ukończone ✅ | Rozszerzenia w trakcie 🚧

---

## Spis Treści

1. [Architektura](#1-architektura)
2. [Baza Danych (DynamoDB)](#2-baza-danych-dynamodb)
3. [Backend API](#3-backend-api)
4. [Frontend Admin Panel](#4-frontend-admin-panel)
5. [Autentykacja (Cognito)](#5-autentykacja-cognito)
6. [Status Implementacji](#6-status-implementacji)
7. [Aktualny Projekt: Trending Topics](#7-aktualny-projekt-trending-topics)
8. [Kolejne Funkcje (Do Zrealizowania)](#8-kolejne-funkcje-do-zrealizowania)
9. [Pomysły na Przyszłość](#9-pomysly-na-przyszlosc)
10. [Koszty i Infrastruktura](#10-koszty-i-infrastruktura)

---

## 1. Architektura

### Kluczowe Założenia

- **Twój chatbot** (Stride Services) = pierwszy klient (`client_id = "stride-services"`)
- **Shared analytics** - wszystkie chatboty piszą do wspólnej tabeli `platform_analytics_events`
- **Per-client tables** - każdy klient ma własne tabele conversations/appointments
- Architektura gotowa na wielu klientów w przyszłości

### Stack Technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| Backend API | AWS Lambda (Python 3.11) |
| Baza Danych | AWS DynamoDB |
| Autentykacja | AWS Cognito |
| Hosting Frontend | AWS Amplify |
| API Gateway | AWS HTTP API |
| AI | AWS Bedrock (Claude Haiku 4.5) |

### Struktura Projektu

```
/backend/
├── chatbot-backend/          # Chatbot Lambda (chatbot.py, services/, utils/)
├── admin-panel-backend/      # Admin API Lambda (api/, faq/, personality/)
└── plany-backend/            # Plany i dokumentacja

/frontend/
└── admin-panel/              # Next.js 14 Admin Panel
```

---

## 2. Baza Danych (DynamoDB)

### Tabele Wspólne (Shared Platform)

#### `clients_registry`
Centralna rejestracja wszystkich klientów.

| Klucz | Typ | Opis |
|-------|-----|------|
| PK: `client_id` | String | ID klienta |
| SK: `SK` | String | Zawsze "PROFILE" |

**Atrybuty:**
- `company_name`, `domain`, `status` (active/paused/cancelled)
- `subscription_plan` (basic/pro/enterprise), `monthly_fee`
- `lambda_function_name`, `lambda_arn`, `tables_prefix`
- `s3_bucket`, `s3_kb_prefix`
- `personality_config`, `features_enabled`, `limits`
- `created_at`, `deployed_at`, `last_activity`, `total_conversations`

**GSI:** `status-created_at-index`

---

#### `platform_analytics_events`
Wszystkie eventy z chatbotów trafiają tutaj.

| Klucz | Typ | Opis |
|-------|-----|------|
| PK: `client_id` | String | ID klienta |
| SK: `event_timestamp` | String | ISO z mikrosekundami |

**Atrybuty:**
- `event_id` (UUID), `session_id`, `event_type`
- `metadata` (tokens, cost, appointment_id, rating, etc.)
- `ttl` (90 dni)

**Event Types:**
- `conversation_start`, `message_sent`, `message_received`
- `appointment_created`, `appointment_verified`
- `escalation_detected`, `feedback_received`
- `topic_mentioned` (dla trending topics)

**GSI:** `event_type-event_timestamp-index`

---

#### `platform_personality_variants`
Warianty osobowości dla personality tournament.

| Klucz | Typ |
|-------|-----|
| PK: `client_id` | String |
| SK: `variant_id` | String |

**Atrybuty:**
- `example_question`, `response_text`, `style_description`
- `tournament_status` (active/eliminated/winner)
- `wins`, `losses`
- `prompt_modifiers` (tone, formality, emoji_usage)

---

#### `platform_trending_topics`
Zgrupowane pytania użytkowników.

| Klucz | Typ |
|-------|-----|
| PK: `client_id` | String |
| SK: `topic_id` | String |

**Atrybuty:**
- `topic_name`, `question_examples`, `count`
- `trend` (up/down/stable)
- `intent_breakdown` (buying/comparing/info %)
- `is_gap` (czy brakuje odpowiedzi w KB)
- `last_updated`, `period`

---

### Tabele Per-Client

Każdy klient ma własne tabele z prefixem `{client_id}-`:

- **`{client_id}-conversations`** - historia konwersacji
- **`{client_id}-appointments`** - uówione spotkania

**Dla Stride Services:**
- `Conversations-stride` (istniejąca tabela)
- `appointments-stride` (istniejąca tabela)

---

## 3. Backend API

### Lambda: `admin-api`

**Konfiguracja:**
- Runtime: Python 3.11
- Memory: 256 MB
- Timeout: 30s
- Handler: `api.handler.lambda_handler`

**API Gateway:** `https://whmpy9rli5.execute-api.eu-central-1.amazonaws.com/`

### Endpointy

#### Podstawowe
| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/` | Health check |
| GET | `/health` | Health check |
| GET | `/test-db` | Test połączenia z DynamoDB |

#### Klienci (wymaga auth)
| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/clients` | Lista wszystkich klientów |
| GET | `/clients/{client_id}` | Szczegóły klienta |
| GET | `/clients/{client_id}/stats` | Statystyki (conversations, appointments, cost) |
| GET | `/clients/{client_id}/stats/daily?days=30` | Daily breakdown dla wykresów |

#### Konwersacje (wymaga auth)
| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/clients/{client_id}/conversations` | Lista konwersacji |
| GET | `/clients/{client_id}/conversations/{session_id}` | Szczegóły konwersacji |

#### Spotkania (wymaga auth)
| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/clients/{client_id}/appointments` | Lista spotkań |

#### Trending Topics (wymaga auth)
| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/clients/{client_id}/trending-topics` | Top pytania + gaps |
| GET | `/clients/{client_id}/trending-topics/gaps` | Tylko luki w KB |
| POST | `/clients/{client_id}/trending-topics/analyze` | Manual trigger analizy |

---

### Lambda: `trending-topics-analyzer`

Automatyczna analiza pytań użytkowników.

**Trigger:** EventBridge (daily cron)

**Funkcje:**
1. Pre-filtering (usuwa śmieci: powitania, spam, przekleństwa)
2. AI clustering (Claude Haiku grupuje podobne pytania)
3. Gaps detection (heurystyka: bot nie umiał odpowiedzieć)
4. Intent analysis (buying/comparing/info)
5. Smart threshold (tylko znaczące tematy)

---

## 4. Frontend Admin Panel

### Deployment

- **GitHub:** https://github.com/domikolo/stride-admin-panel
- **URL:** https://master.dwbypdlefsahq.amplifyapp.com
- **Hosting:** AWS Amplify (auto-deploy z GitHub)

### Struktura

```
/admin-panel/
├── app/
│   ├── (auth)/login/           # Login (Cognito)
│   ├── (dashboard)/
│   │   ├── dashboard/          # Dashboard ze stats + charts
│   │   ├── conversations/      # Lista konwersacji
│   │   │   └── [sessionId]/    # Szczegóły konwersacji
│   │   ├── appointments/       # Lista spotkań
│   │   ├── insights/           # Trending Topics
│   │   └── (owner)/clients/    # Lista klientów (tylko owner)
├── components/
│   ├── ui/                     # shadcn/ui
│   ├── dashboard/              # StatsCard, etc.
│   ├── insights/               # TrendingTopicCard, GapCard, etc.
│   └── layout/                 # Sidebar
├── lib/
│   ├── auth.ts                 # Cognito wrapper
│   ├── api.ts                  # API client z JWT
│   └── types.ts                # TypeScript interfaces
└── hooks/
    └── useAuth.tsx             # Auth context
```

### Zaimplementowane Strony

| Strona | Opis |
|--------|------|
| `/login` | Login przez Cognito |
| `/dashboard` | 4 StatsCards + LineChart + BarChart |
| `/conversations` | Lista konwersacji (klikalna) |
| `/conversations/[id]` | Pełna historia wiadomości |
| `/appointments` | Lista spotkań z status badges |
| `/insights` | Trending Topics + Gaps (🚧 w trakcie) |
| `/clients` | Lista klientów (tylko owner) |

---

## 5. Autentykacja (Cognito)

### User Pool

- **Nazwa:** `stride-admin-panel-cognito`
- **User Pool ID:** `eu-central-1_foqQPqZsC`
- **App Client ID:** `2tkv1rheoufn1c19cf8mppdmus`
- **Region:** `eu-central-1`

### Custom Attributes

- `custom:client_id` - ID klienta (dla client users)
- `custom:role` - "client" | "owner"

### User Groups

- `owners` - admini platformy (widzą wszystkich klientów)
- `clients` - użytkownicy firm (widzą tylko swoje dane)

### Autoryzacja w Lambda

```python
def get_user_from_token(token: str) -> dict:
    claims = verify_jwt(token)
    return {
        "user_id": claims["sub"],
        "email": claims["email"],
        "role": claims.get("custom:role", "client"),
        "client_id": claims.get("custom:client_id"),
        "groups": claims.get("cognito:groups", [])
    }
```

---

## 6. Status Implementacji

### ✅ Ukończone (MVP)

| Komponent | Status | Data |
|-----------|--------|------|
| DynamoDB tables (shared) | ✅ | 2025-12-15 |
| Platform Analytics SDK | ✅ | 2025-12-15 |
| Token/cost tracking w chatbocie | ✅ | 2025-12-15 |
| AWS Cognito setup | ✅ | 2025-12-16 |
| Admin API Lambda | ✅ | 2025-12-16 |
| API Gateway HTTP API | ✅ | 2025-12-16 |
| Frontend Admin Panel | ✅ | 2025-12-17 |
| Dashboard (stats + charts) | ✅ | 2025-12-17 |
| Conversations page + detail view | ✅ | 2025-12-17 |
| Appointments page | ✅ | 2025-12-17 |
| Clients page (owner) | ✅ | 2025-12-17 |

### 🚧 W Trakcie

| Komponent | Status | Notatki |
|-----------|--------|---------|
| Trending Topics Lambda | ✅ Kod gotowy | Wymaga EventBridge rules |
| Trending Topics Frontend | ✅ Gotowe | Insights page |
| EventBridge daily cron | ⏳ | Ręczna konfiguracja |
| Weekly full re-analysis | ⏳ | Lambda do stworzenia |

---

## 7. Aktualny Projekt: Trending Topics

### Cel
Automatyczne wykrywanie najczęściej zadawanych pytań + luki w knowledge base + intent analysis.

### Jak Działa

1. **Chatbot zbiera** pytania użytkowników (automatycznie)
2. **AI analizuje** (raz dziennie) - grupuje podobne pytania
3. **Admin panel pokazuje** top pytania + insights + gaps
4. **Owner widzi** co poprawić na stronie / w chatbocie

### Funkcjonalność

- ✅ Pre-filtering (śmieci, spam, przekleństwa)
- ✅ AI clustering (Claude Haiku)
- ✅ Top questions ranking (smart threshold)
- ✅ Gaps detection (heurystyka)
- ✅ Intent analysis (buying/comparing/info)
- ✅ Trend detection (up/down/stable)

### Koszt

~$0.60/miesiąc (daily AI analysis)

### Backend Tasks

- [x] Pre-filtering function
- [x] DynamoDB table `platform_trending_topics`
- [x] Lambda `trending-topics-analyzer`
- [x] Gaps detection heuristic
- [x] Intent analysis (keyword-based)
- [x] Smart threshold algorithm
- [x] API endpoints
- [ ] EventBridge rules (daily 2 AM, weekly Sunday 3 AM)
- [ ] Weekly full re-analysis Lambda

### Frontend Tasks

- [x] `/insights` page
- [x] TrendingTopicCard component
- [x] GapCard component
- [x] SmartInsightCard component
- [x] Category Pie Chart (Weekly view)
- [x] Top Mover Card (Weekly view)
- [x] API integration
- [x] Sidebar link

### Do Zrobienia

1. **EventBridge Rules** - ręczna konfiguracja w AWS Console
2. **Weekly Re-analysis Lambda** - pełne przeliczenie co tydzień
3. **"Add to KB" button** - sugestia dodania brakującej odpowiedzi

---

## 8. Kolejne Funkcje (Do Zrealizowania)

### Extended Analytics Page

**Priorytet:** 🟡 Średni | **Czas:** 2-3 dni

Rozszerzona analityka z większą ilością szczegółów.

**Zakres:**
- Date range picker
- Hourly/daily/weekly breakdown charts
- Szczegółowy cost breakdown
- Filter by event type
- Export to CSV

---

### Personality Tournament (A/B Testing)

**Priorytet:** 🟡 Średni | **Czas:** 5-7 dni

A/B test osobowości chatbota, auto-select best performer.

**Zakres:**
- Tabela `platform_personality_variants`
- A/B assignment logic w chatbocie
- Conversion tracking per variant
- Tournament UI (warianty obok siebie, głosowanie)
- Results dashboard

**Algorytm (Swiss Tournament):**
```
1. Paruj warianty z podobnym win/loss record
2. User głosuje A vs B
3. Eliminate po 2+ losses
4. Winner → default personality
```

---

## 9. Pomysły na Przyszłość

### A/B Testing Osobowości (Rozszerzone)

**Concept:** Połowa użytkowników rozmawia z wariantem A, połowa z B. Po określonym czasie klient widzi który styl lepiej konwertuje.

**Schema:** `platform_ab_tests`
- `variant_a_id`, `variant_b_id`
- `traffic_split` (%)
- `duration_days`
- Results: `variant_a_conversations`, `variant_a_conversion_rate`, etc.
- `winner_variant_id`, `winner_reason`

**Frontend:**
- Start test form (wybór wariantów, split, duration)
- Active test card z real-time stats
- Stats comparison table
- Statistical significance badge
- Past tests history

---

### Analiza Sentymentu

**Concept:** Każda rozmowa oznaczana jako pozytywna/neutralna/negatywna. Dashboard pokazuje trend nastrojów.

**Implementacja:**
- Claude Haiku dla fast sentiment analysis
- Track `sentiment_score` w analytics events
- Conversation-level aggregation (co 5 min)
- CloudWatch alarm przy spike negatywnych

**Frontend:**
- Donut chart (positive/neutral/negative %)
- Sentiment timeline chart
- Lista negatywnych konwersacji do review
- Alerty przy wzroście negatywnych

---

### Gorące Tematy (Trending Topics Rozszerzone)

**Concept:** System wykrywa gdy nagle dużo użytkowników pyta o ten sam temat. Powiadomienie o spike'u.

**Implementacja:**
- Hourly topic spike detection (EventBridge)
- Porównanie: ostatnia godzina vs poprzednia
- Alert jeśli spike >200%
- SNS notification do ownera

**Frontend:**
- Trending Topics Widget z sparklines
- Heatmap calendar (jak GitHub contributions)
- Topic breakdown table

---

### Knowledge Base Upload

**Concept:** Miejsce gdzie klient wrzuca dokumenty do bazy wiedzy. Platform team przegląda i dodaje.

**Schema:** `platform_kb_uploads`
- `file_name`, `file_size`, `file_type`, `s3_key`
- `status` (pending/processing/completed/rejected)
- `notes`, `priority`
- `reviewed_by`, `review_notes`, `kb_section`

**Implementacja:**
- S3 bucket dla uploads
- Lambda triggered on upload (PDF/DOCX extraction)
- Owner review queue
- Auto-notify platform team

**Frontend (Client):**
- Drag & drop upload form
- Uploads history z status
- Review notes display

**Frontend (Owner):**
- Pending uploads queue
- Download/preview file
- Mark as completed/rejected

---

### Changelog (Update History)

**Concept:** Lista wszystkich zmian w chatbocie klienta. Transparentność.

**Schema:** `platform_changelog`
- `change_type` (kb_update/personality_change/feature_enabled/bug_fix)
- `title`, `description`, `severity` (major/minor/patch)
- `emoji`, `tags`
- `related_upload_id`

**Auto-generation:**
- Triggered when KB upload completed
- Triggered when A/B test completes

**Frontend:**
- Timeline view (jak GitHub activity feed)
- Filter by change type
- Dashboard widget: Recent Changes

---

### Deployment Automation

**Concept:** Owner klika "Create Client" → automatycznie tworzy wszystko.

**Zakres:**
- Auto-create DynamoDB tables
- Auto-create S3 bucket
- Auto-deploy Lambda z template
- Auto-register w clients_registry

**Alternatywa:** Polished manual deployment script.

---

### Billing & Cost Tracking

**Zakres:**
- Cost calculation per client (Bedrock + DynamoDB + S3)
- Monthly billing report
- Billing dashboard dla owner
- Invoice generation (PDF export)

---

### Email Notifications

**Zakres:**
- Weekly reports
- Topic spike alerts
- Sentiment alerts
- New upload notifications

---

## 10. Koszty i Infrastruktura

### Miesięczne Koszty (MVP)

| Usługa | Koszt |
|--------|-------|
| AWS Amplify Hosting | ~$15 |
| Lambda + API Gateway | FREE (free tier) |
| Cognito | FREE (free tier) |
| DynamoDB | ~$5-15 |
| S3 | ~$2 |
| **Total MVP** | **~$20-30/miesiąc** |

### Dodatkowe Koszty (Features)

| Feature | Koszt |
|---------|-------|
| Trending Topics (daily AI) | ~$0.60/miesiąc |
| Sentiment Analysis | ~$2/miesiąc |
| Topic Spike Detection | ~$0.50/miesiąc |
| SNS Notifications | ~$0.50/miesiąc |

### ROI (przy 800 PLN/miesiąc per klient)

- 10 klientów: 8,000 PLN - 200 PLN infra = **7,800 PLN/m (97.5% margin)**
- Break-even: 2-4 miesiące z 10 klientami

---

## Security Checklist

- [ ] Data Isolation: zawsze filtruj po client_id
- [ ] Auth: wszystkie endpoints wymagają JWT
- [ ] Authorization: role-based access server-side
- [ ] Rate Limiting: per-user/per-client limits
- [ ] Input Validation: validate wszystkie inputs
- [ ] CORS: restrict do admin domain
- [ ] Secrets: AWS Secrets Manager (nie env vars)
- [ ] Testing: automated tests dla data isolation

---

## Przydatne Linki

- **Admin Panel:** https://master.dwbypdlefsahq.amplifyapp.com
- **API Gateway:** https://whmpy9rli5.execute-api.eu-central-1.amazonaws.com/
- **GitHub Frontend:** https://github.com/domikolo/stride-admin-panel
- **Cognito Console:** AWS Console → Cognito → stride-admin-panel-cognito

---

*Ostatnia aktualizacja: 2026-01-07*
