# Plan: Panel Administracyjny SaaS dla Platformy Chatbotów AI

## Executive Summary

**Cel**: Zbudować centralny panel administracyjny do zarządzania wieloma niezależnymi chatbotami dla różnych klientów.

**KLUCZOWA ARCHITEKTURA (WAŻNE!):**
- **Obecny chatbot** (`/backend`) = **Twój chatbot firmowy** (Stride Services)
- **Twój chatbot = pierwszy client** w platform analytics (client_id = "stride-services")
- **Na start: jeden chatbot** (Twój), ale architektura gotowa na wielu klientów w przyszłości
- **W przyszłości**: Możesz deployować osobne chatboty dla innych klientów (każdy z własnym client_id)

**Stan docelowy (MVP):**
- Panel admin (dla Ciebie jako owner):
  - Dashboard Twojego chatbota (Stride Services)
  - Konwersacje, spotkania, FAQ, personality tournament
  - Stats: conversations, conversion rate, costs, tokens
  - Miejsce przygotowane na przyszłych klientów
- **Shared analytics table** - Twój chatbot wysyła eventy do `platform_analytics_events` (client_id = "stride-services")
- **Twoje własne tables** - conversations/appointments pozostają w current tables

**Stack technologiczny**:
- Backend Chatbot: Modyfikujemy `/backend` (Twój chatbot)
- Backend Admin Panel: Lambda dla API endpoints
- Frontend: Next.js 14 + TypeScript + Tailwind CSS (jak w `/frontend/nowa strona`)
- Auth: AWS Cognito
- Hosting: AWS Amplify

---

## MVP vs FUTURE EXPANSION

### MVP (co robimy TERAZ):
✅ Modyfikuj `/backend/chatbot.py` - dodaj analytics tracking
✅ Jeden chatbot (Twój = client_id "stride-services")
✅ Shared `platform_analytics_events` table
✅ Admin panel dla Twojego chatbota (dashboard, conversations, appointments, FAQ)
✅ **Bez eskalacji** (nie potrzebna)
✅ **Bez template** (na razie)

### FUTURE (gdy będziesz mieć wielu klientów):
⏭️ `/backend-template/` - szablon do deployowania chatbotów dla innych klientów
⏭️ Per-client isolated tables (`client-{id}-conversations`, `client-{id}-appointments`)
⏭️ Deployment automation
⏭️ Owner panel (lista wszystkich klientów, cross-client stats)

**Architektura już GOTOWA na future expansion** - tylko zaczynamy od jednego chatbota!

---

## 1. SCHEMA BAZY DANYCH

**ARCHITEKTURA HYBRID:**
- **Per-client tables** (izolowane): conversations, appointments
- **Shared platform tables** (wspólne): analytics_events, clients_registry, personality_variants, feedback

### 1.1 SHARED Platform Tables (wspólne dla wszystkich)

#### `clients_registry` (centralna rejestracja wszystkich klientów)
```
PK: client_id (String)
SK: SK (String) - zawsze "PROFILE"

Atrybuty:
- client_id: "client-abc123"
- company_name: "AutoSerwis Kowalski"
- domain: "autoserwis.pl"
- status: "active" | "paused" | "cancelled"
- created_at: ISO timestamp
- subscription_plan: "basic" | "pro" | "enterprise"
- monthly_fee: Number (PLN)

- contact_email, contact_phone

- lambda_function_name: "chatbot-client-abc123"
- lambda_arn: "arn:aws:lambda:..."
- tables_prefix: "client-abc123"  # np. "client-abc123-conversations"
- s3_bucket: "client-abc123-kb"
- s3_kb_prefix: "kb/"

- personality_config: {
    current_variant_id: "variant_5",
    tournament_completed: true
  }

- features_enabled: ["calendar", "notifications", "escalation_detection"]
- limits: {
    max_conversations_monthly: 1000,
    max_kb_size_mb: 50
  }

- deployed_at: ISO timestamp
- last_activity: ISO timestamp  # ostatnia konwersacja
- total_conversations: Number    # cache dla dashboardu

GSI: status-created_at-index
  - PK: status
  - SK: created_at
  - Use case: Znajdź wszystkich aktywnych/nieaktywnych klientów
```

#### `platform_analytics_events` (SHARED - wszystkie chatboty piszą tutaj!)
```
PK: client_id (String)
SK: event_timestamp (String) - ISO z mikrosekundami dla unique sorting

Atrybuty:
- event_id: UUID
- client_id: "client-abc123"  ← WAŻNE: każdy event ma client_id!
- session_id: "sess_xyz"
- event_timestamp: "2025-12-15T10:30:45.123456Z"
- event_type: "conversation_start" | "message_sent" | "message_received" |
              "appointment_created" | "appointment_verified" |
              "escalation_detected" | "feedback_received"

- metadata: {
    # Dla message events
    bedrock_tokens_input: 1234,
    bedrock_tokens_output: 567,
    bedrock_cost: 0.00234,  # USD
    model_id: "claude-haiku-4-5",
    response_time_ms: 1200,

    # Dla appointment events
    appointment_id: "appt_123",
    appointment_datetime: ISO timestamp,

    # Dla feedback events
    rating: 5,
    feedback_text: "Great!",

    # Dla escalation events
    escalation_reason: "keyword_match",

    # Session metadata
    user_agent: "Mozilla/5.0...",
    device: "mobile" | "desktop",
    source: "website" | "whatsapp" | "facebook"
  }

- ttl: Number (90 dni - auto cleanup)

GSI: event_type-event_timestamp-index
  - PK: event_type
  - SK: event_timestamp
  - Use case: Znajdź wszystkie "appointment_created" events cross-client

Query patterns:
1. Stats dla klienta A: WHERE client_id = "client-a"
2. Wszystkie spotkania: WHERE event_type = "appointment_created"
3. Platform-wide stats: Scan (z limit) lub query per client_id
```

#### `platform_personality_variants` (SHARED - owner tworzy dla każdego klienta)
```
PK: client_id (String)
SK: variant_id (String)

Atrybuty:
- client_id: "client-abc123"
- variant_id: "variant_1"
- created_at: ISO timestamp
- created_by: "owner"  # owner tworzy pre-prepared warianty

- example_question: "Ile kosztuje wasza usługa?"
- response_text: "Nasze ceny zaczynają się od 1600 zł..."
- style_description: "Friendly and casual"

- tournament_status: "active" | "eliminated" | "winner"
- wins: 3
- losses: 1

- prompt_modifiers: {
    tone: "professional" | "casual" | "enthusiastic",
    formality: "formal" | "informal",
    emoji_usage: "none" | "minimal" | "frequent"
  }
```

#### `platform_feedback` (SHARED - opcjonalne, jeśli chcesz długoterminowe przechowywanie)
```
PK: client_id (String)
SK: feedback_id (String) - "session_id#timestamp"

Atrybuty:
- client_id: "client-abc123"
- feedback_id: "sess_xyz#1702648245"
- session_id: "sess_xyz"
- timestamp: ISO timestamp

- rating: Number (1-5)
- feedback_text: String (optional)
- feedback_type: "helpful" | "unhelpful" | "resolved" | "escalation_needed"

- conversation_summary: String (last 3 messages)
- ttl: Number (90 dni)

Note: Możesz też trackować feedback tylko przez analytics_events
      bez osobnej tabeli jeśli nie potrzebujesz long-term storage
```

### 1.2 Per-Client Tables (izolowane dla każdego klienta)

**Każdy klient ma SWOJE własne tables z własnym prefixem.**

**Naming convention**: `{client_id}-{table_type}`

**Przykład dla client-abc123:**
```
Tables:
- client-abc123-conversations
- client-abc123-appointments

S3 Buckets (or prefix):
- client-abc123-kb/  (knowledge base)
- client-abc123-assets/  (logo, branding)
```

#### `{client_id}-conversations` (schema IDENTICAL jak istniejący conversations_table)
```
PK: session_id (String)
SK: timestamp (String)

Atrybuty:
- session_id, timestamp, role, text, ttl
- bedrock_tokens_input, bedrock_tokens_output (DODAJ dla trackingu)
- bedrock_cost (DODAJ)
- model_id (DODAJ)
```

#### `{client_id}-appointments` (schema IDENTICAL jak istniejący appointments_table)
```
PK: appointment_id (String)
SK: created_at (Number)

Atrybuty:
- appointment_id, created_at, session_id, datetime, contact_info,
  verification_code, status, ttl, verified_at, google_event_id
```

**WAŻNE**: NIE modyfikujemy istniejących tabel Twojego chatbota!
Każdy nowy klient dostaje fresh copy tabel z tym samym schema.

---

## 2. MODYFIKACJE BACKEND CHATBOTA

**WAŻNE**: Modyfikujemy `/backend/chatbot.py` (Twój chatbot firmowy) żeby wysyłał analytics do shared platform table.

**CLIENT_ID**: "stride-services" (Twoja firma jako pierwszy client w systemie)

### 2.1 Dodaj Platform Analytics SDK

**Nowy plik**: `/backend/services/platform_analytics.py`
```
/backend-template/
├── chatbot.py                      # Template handler
├── config.py                       # Template config (CLIENT_ID jako env var)
├── requirements.txt
├── services/
│   ├── __init__.py
│   ├── bedrock_service.py         # Token tracking DODANE
│   ├── conversation_service.py    # Token fields DODANE
│   ├── appointment_service.py
│   ├── calendar_service.py
│   ├── notification_service.py
│   └── platform_analytics.py      # NOWY - shared analytics SDK
└── utils/
    ├── __init__.py
    ├── retry.py
    └── validation.py
```

### 2.2 Platform Analytics SDK

**Nowy plik**: `/backend-template/services/platform_analytics.py`

```python
"""
Shared Analytics SDK - każdy chatbot klienta używa tego do wysyłania analytics
do centralnej platform_analytics_events table.
"""

import boto3
import uuid
import time
from datetime import datetime
from typing import Dict, Optional

# SHARED table dla całej platformy
PLATFORM_ANALYTICS_TABLE = "platform_analytics_events"

analytics_table = boto3.resource("dynamodb").Table(PLATFORM_ANALYTICS_TABLE)

def track_event(
    client_id: str,
    session_id: str,
    event_type: str,
    metadata: Dict = None
):
    """
    Track analytics event do centralnej platform table.

    Args:
        client_id: ID klienta (ustawione w env var CLIENT_ID)
        session_id: Session ID z requestu
        event_type: Typ eventu (conversation_start, message_sent, etc.)
        metadata: Dodatkowe dane (tokens, cost, appointment_id, etc.)
    """
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    item = {
        "client_id": client_id,
        "event_timestamp": timestamp,
        "event_id": event_id,
        "session_id": session_id,
        "event_type": event_type,
        "metadata": metadata or {},
        "ttl": int(time.time()) + (90 * 24 * 3600)  # 90 dni
    }

    try:
        analytics_table.put_item(Item=item)
        print(f"Analytics event tracked: {event_type} for {client_id}")
    except Exception as e:
        print(f"Failed to track analytics event: {e}")
        # Don't fail the main request if analytics fails


# Convenience functions

def track_conversation_start(client_id: str, session_id: str, metadata: Dict = None):
    track_event(client_id, session_id, "conversation_start", metadata)


def track_message_sent(
    client_id: str,
    session_id: str,
    tokens_input: int,
    tokens_output: int,
    cost: float,
    response_time_ms: int,
    model_id: str
):
    track_event(client_id, session_id, "message_sent", {
        "bedrock_tokens_input": tokens_input,
        "bedrock_tokens_output": tokens_output,
        "bedrock_cost": cost,
        "response_time_ms": response_time_ms,
        "model_id": model_id
    })


def track_appointment_created(
    client_id: str,
    session_id: str,
    appointment_id: str,
    appointment_datetime: str
):
    track_event(client_id, session_id, "appointment_created", {
        "appointment_id": appointment_id,
        "appointment_datetime": appointment_datetime
    })


def track_appointment_verified(
    client_id: str,
    session_id: str,
    appointment_id: str
):
    track_event(client_id, session_id, "appointment_verified", {
        "appointment_id": appointment_id
    })


def track_escalation(
    client_id: str,
    session_id: str,
    reason: str,
    user_message: str = ""
):
    track_event(client_id, session_id, "escalation_detected", {
        "escalation_reason": reason,
        "user_message": user_message[:500]  # Limit length
    })


def track_feedback(
    client_id: str,
    session_id: str,
    rating: int,
    feedback_text: str = ""
):
    track_event(client_id, session_id, "feedback_received", {
        "rating": rating,
        "feedback_text": feedback_text[:1000]  # Limit length
    })
```

### 2.3 Modyfikacje Template Chatbot

**Template `/backend-template/chatbot.py` zmiany:**

```python
# Dodaj na początku
import os
from services.platform_analytics import (
    track_conversation_start,
    track_message_sent,
    track_appointment_created,
    track_appointment_verified,
    track_escalation
)

# Pobierz CLIENT_ID z env var (ustawione podczas deploymentu)
CLIENT_ID = os.environ["CLIENT_ID"]  # np. "client-abc123"

# W lambda_handler, po parse request:
session_id = payload.get("conversation_id", "default")

# Track conversation start (first message)
# ... sprawdź czy to pierwsza wiadomość (query history, jeśli pusta)
if not history_messages:
    track_conversation_start(CLIENT_ID, session_id)

# Po invoke Claude (gdy masz tokens i cost):
tokens_input, tokens_output, cost = ... # z bedrock response
response_time_ms = int(bedrock_time * 1000)

track_message_sent(
    CLIENT_ID,
    session_id,
    tokens_input,
    tokens_output,
    cost,
    response_time_ms,
    CLAUDE_MODEL_ID
)

# Po utworzeniu appointment:
track_appointment_created(
    CLIENT_ID,
    session_id,
    appointment_id,
    datetime_str
)

# Po weryfikacji appointment:
track_appointment_verified(CLIENT_ID, session_id, appointment_id)

# Detekcja eskalacji:
ESCALATION_KEYWORDS = ["agent", "człowiek", "human", "zadzwoń", "call me"]

def detect_escalation(message: str) -> bool:
    return any(kw in message.lower() for kw in ESCALATION_KEYWORDS)

if detect_escalation(user_query):
    track_escalation(CLIENT_ID, session_id, "keyword_match", user_query)
```

**Template `/backend-template/services/bedrock_service.py` zmiany:**

```python
def invoke_claude(...):
    # ... existing code

    response = bedrock.invoke_model_with_response_stream(...)

    # DODAJ: Extract token usage from response headers
    response_metadata = response.get("ResponseMetadata", {})
    headers = response_metadata.get("HTTPHeaders", {})

    tokens_input = int(headers.get("x-amzn-bedrock-input-token-count", 0))
    tokens_output = int(headers.get("x-amzn-bedrock-output-token-count", 0))

    # DODAJ: Calculate cost (Claude Haiku pricing 2025)
    COST_PER_1K_INPUT = 0.00025   # USD
    COST_PER_1K_OUTPUT = 0.00125  # USD

    cost = (tokens_input / 1000 * COST_PER_1K_INPUT) + \
           (tokens_output / 1000 * COST_PER_1K_OUTPUT)

    # ... process streaming response to get answer

    return answer, bedrock_time, tokens_input, tokens_output, cost
```

**Template `/backend-template/services/conversation_service.py` zmiany:**

```python
def save_message(...):
    item = {
        "session_id": session_id,
        "timestamp": str(base_ts),
        "role": role,
        "text": text,
        "ttl": base_ts + TTL_SECONDS,

        # DODAJ dla token tracking
        "bedrock_tokens_input": tokens_input,   # nowy param
        "bedrock_tokens_output": tokens_output, # nowy param
        "bedrock_cost": cost,                   # nowy param
        "model_id": model_id                    # nowy param
    }
```

### 2.4 Deployment Process (Manual)

**Kiedy dodajesz nowego klienta:**

1. **Stwórz DynamoDB tables** dla klienta:
   ```bash
   aws dynamodb create-table \
     --table-name client-abc123-conversations \
     --attribute-definitions AttributeName=session_id,AttributeType=S AttributeName=timestamp,AttributeType=S \
     --key-schema AttributeName=session_id,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
     --billing-mode PAY_PER_REQUEST

   aws dynamodb create-table \
     --table-name client-abc123-appointments \
     --attribute-definitions AttributeName=appointment_id,AttributeType=S AttributeName=created_at,AttributeType=N \
     --key-schema AttributeName=appointment_id,KeyType=HASH AttributeName=created_at,KeyType=RANGE \
     --billing-mode PAY_PER_REQUEST
   ```

2. **Skopiuj template code** do nowego folderu:
   ```bash
   cp -r /backend-template /deployments/client-abc123
   ```

3. **Zaktualizuj config.py** w deployed version:
   ```python
   # Client-specific configuration
   CLIENT_ID = "client-abc123"  # lub z env var
   CONV_TABLE_NAME = "client-abc123-conversations"
   APPOINTMENTS_TABLE = "client-abc123-appointments"
   S3_BUCKET = "client-abc123-kb"
   GOOGLE_CALENDAR_ID = "client_calendar@example.com"  # od klienta
   ```

4. **Deploy Lambda**:
   ```bash
   cd /deployments/client-abc123
   pip install -r requirements.txt -t .
   zip -r client-abc123-lambda.zip .

   aws lambda create-function \
     --function-name chatbot-client-abc123 \
     --runtime python3.11 \
     --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
     --handler chatbot.lambda_handler \
     --zip-file fileb://client-abc123-lambda.zip \
     --environment Variables="{CLIENT_ID=client-abc123,CONV_TABLE_NAME=client-abc123-conversations,..."
   ```

5. **Zarejestruj w clients_registry**:
   ```python
   clients_registry_table.put_item(Item={
       "client_id": "client-abc123",
       "SK": "PROFILE",
       "company_name": "AutoSerwis Kowalski",
       "lambda_function_name": "chatbot-client-abc123",
       "lambda_arn": "arn:aws:lambda:...",
       "tables_prefix": "client-abc123",
       "s3_bucket": "client-abc123-kb",
       "status": "active",
       "created_at": datetime.utcnow().isoformat(),
       "deployed_at": datetime.utcnow().isoformat(),
       # ... inne pola
   })
   ```

6. **Upload KB klienta** do S3:
   ```bash
   aws s3 cp client-kb-documents/ s3://client-abc123-kb/ --recursive
   ```

### 2.5 Opcjonalna automatyzacja (Future)

Możesz później stworzyć **deployment automation Lambda**:
- Owner przez admin panel klika "Create New Client"
- Lambda automatycznie:
  - Tworzy DynamoDB tables
  - Tworzy S3 bucket
  - Deployuje Lambda z template code
  - Rejestruje w clients_registry

### 2.6 Admin Panel Lambda Functions

**Lokalizacja**: `/admin-panel-backend/` (nowy folder)

#### `admin_api_lambda` - `/admin-panel-backend/api/handler.py`

REST API endpoints dla admin panel:

**Client Management:**
- `GET /api/v1/clients` - Lista wszystkich klientów (z clients_registry)
- `GET /api/v1/clients/{client_id}` - Szczegóły klienta
- `POST /api/v1/clients` - Utwórz nowego klienta (trigger deployment process)
- `PUT /api/v1/clients/{client_id}` - Edytuj klienta
- `DELETE /api/v1/clients/{client_id}` - Deaktywuj klienta

**Analytics (query shared platform_analytics_events table):**
- `GET /api/v1/clients/{client_id}/stats?period=MONTHLY` - Agregowane statystyki
  ```python
  # Query analytics events dla client_id
  events = platform_analytics_events.query(
      KeyConditionExpression=Key("client_id").eq(client_id) &
                            Key("event_timestamp").between(start_date, end_date)
  )

  # Oblicz stats on-the-fly
  conversation_starts = [e for e in events if e["event_type"] == "conversation_start"]
  appointments_created = [e for e in events if e["event_type"] == "appointment_created"]

  stats = {
      "conversations_count": len(conversation_starts),
      "appointments_created": len(appointments_created),
      "conversion_rate": len(appointments_created) / len(conversation_starts) * 100,
      "total_cost": sum(e["metadata"]["bedrock_cost"] for e in events if "bedrock_cost" in e.get("metadata", {})),
      # ... więcej metryk
  }
  ```

- `GET /api/v1/clients/{client_id}/conversations` - Proxied query to client's table
  ```python
  # Pobierz table name z registry
  client = clients_registry.get_item(Key={"client_id": client_id})
  table_name = f"{client['tables_prefix']}-conversations"

  # Query client-specific table
  conversations = dynamodb.Table(table_name).scan(Limit=50)
  ```

- `GET /api/v1/clients/{client_id}/appointments` - Proxied query to client's table

**Platform-wide:**
- `GET /api/v1/admin/stats/platform` - Platform stats (wszystkie client_id)
- `GET /api/v1/admin/billing/{month}` - Billing summary wszystkich klientów

#### `analytics_aggregator_lambda` - `/backend/analytics/aggregator.py`
Scheduled (cron daily midnight):
- Czyta analytics_events z poprzedniego dnia
- Oblicza daily/weekly/monthly aggregations
- Zapisuje do aggregated_stats_table
- Trigger: `cron(0 0 * * ? *)`

#### `faq_generator_lambda` - `/backend/faq/generator.py`
On-demand:
- Analizuje ostatnie 30 dni konwersacji
- Wyciąga najczęstsze pytania używając Claude
- Zwraca top 10-20 pytań z częstotliwością

#### `personality_tournament_lambda` - `/backend/personality/tournament.py`
API endpoints:
- `GET /personality/variants/{client_id}` - warianty
- `POST /personality/vote` - zagłosuj (A vs B)
- `GET /personality/tournament/{client_id}/status` - postęp

### 2.8 API Structure

**API Gateway HTTP API**:
```
Base: https://api.stride-services.com
Auth: AWS Cognito JWT

Client endpoints (scoped by user's client_id):
GET    /api/v1/dashboard/stats
GET    /api/v1/conversations?page=1&limit=50
GET    /api/v1/appointments?status=verified
POST   /api/v1/feedback
GET    /api/v1/faq/generate
GET    /api/v1/personality/variants
POST   /api/v1/personality/vote

Owner endpoints (requires owner role):
GET    /api/v1/admin/clients
GET    /api/v1/admin/clients/{client_id}
GET    /api/v1/admin/stats/platform
GET    /api/v1/admin/billing/{client_id}/{month}
POST   /api/v1/admin/clients
PUT    /api/v1/admin/clients/{client_id}
```

---

## 3. AUTHENTICATION & AUTHORIZATION

### 3.1 AWS Cognito Setup

**User Pool**:
- Nazwa: `stride-services-admin-pool`
- Region: `eu-central-1`
- Sign-in: Email
- MFA: Optional (włącz dla ownerów)

**Custom Attributes**:
- `custom:client_id` - dla client users
- `custom:role` - "client" | "owner"

**User Groups**:
- `owners` - admini platformy
- `clients` - użytkownicy firm

### 3.2 Authorization w Lambda

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

def require_role(required_role: str):
    def decorator(func):
        def wrapper(event, context):
            token = event["headers"].get("Authorization", "").replace("Bearer ", "")
            user = get_user_from_token(token)

            if user["role"] != required_role and "owners" not in user["groups"]:
                return {"statusCode": 403, "body": json.dumps({"error": "Forbidden"})}

            event["user"] = user
            return func(event, context)
        return wrapper
    return decorator
```

### 3.3 Data Scoping

**Client widzi tylko swoje dane:**
```python
def get_conversations_for_user(event, context):
    user = event["user"]

    if user["role"] == "client":
        client_id = user["client_id"]  # Tylko swoje
    elif user["role"] == "owner":
        client_id = event.get("queryStringParameters", {}).get("client_id")  # Może wybrać

    conversations = conversations_table.query(
        IndexName="client_id-timestamp-index",
        KeyConditionExpression=Key("client_id").eq(client_id)
    )
```

---

## 4. FRONTEND ARCHITECTURE

### 4.1 Struktura Next.js

```
/admin-panel/
├── app/
│   ├── layout.tsx                      # Root z auth provider
│   ├── page.tsx                        # Landing/login redirect
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (client)/                       # Client panel
│   │   ├── layout.tsx                  # Client sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── conversations/
│   │   │   ├── page.tsx
│   │   │   └── [sessionId]/page.tsx
│   │   ├── appointments/page.tsx
│   │   ├── faq/page.tsx
│   │   └── personality/page.tsx        # Tournament UI
│   └── (owner)/                        # Owner panel
│       ├── layout.tsx                  # Owner sidebar
│       ├── admin/page.tsx              # Platform dashboard
│       ├── clients/
│       │   ├── page.tsx
│       │   └── [clientId]/
│       │       ├── page.tsx
│       │       └── billing/page.tsx
│       └── analytics/page.tsx
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   ├── ConversationsTable.tsx
│   │   └── ChartContainer.tsx
│   ├── personality/
│   │   ├── TournamentBracket.tsx
│   │   ├── VariantComparison.tsx       # A vs B UI
│   │   └── VoteButton.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       └── ProtectedRoute.tsx
├── lib/
│   ├── auth.ts                         # Cognito auth
│   ├── api.ts                          # API client
│   └── types.ts
└── hooks/
    ├── useAuth.ts
    ├── useConversations.ts
    └── useStats.ts
```

### 4.2 Tech Stack

**Bazowe (już masz):**
- Next.js 14, TypeScript, Tailwind CSS
- Framer Motion, Lucide React

**Dodaj:**
```bash
npm install aws-amplify @aws-amplify/ui-react
npm install recharts  # charts
npm install @tanstack/react-table  # advanced tables
npm install date-fns  # date formatting
npm install zod  # validation
```

### 4.3 Auth Integration

**`lib/auth.ts`:**
```typescript
import { Amplify, Auth } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_XXXXXX',
    userPoolWebClientId: 'XXXXXXXXX',
  }
});

export const signIn = async (email: string, password: string) => {
  return await Auth.signIn(email, password);
};

export const getCurrentUser = async () => {
  const user = await Auth.currentAuthenticatedUser();
  const token = user.signInUserSession.idToken.jwtToken;
  return { user, token };
};
```

**`lib/api.ts`:**
```typescript
import { getCurrentUser } from './auth';

class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.stride-services.com';

  private async getHeaders(): Promise<HeadersInit> {
    const authData = await getCurrentUser();
    return {
      'Content-Type': 'application/json',
      'Authorization': authData ? `Bearer ${authData.token}` : '',
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return response.json();
  }
}

export const api = new ApiClient();
```

### 4.4 Key Components

**StatsCard:**
```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}
```

**ConversationsTable:**
```typescript
// Tabela z paginacją, filtrowaniem, search
// Kolumny: Session ID, Date, Messages, Outcome, Rating, Actions
```

**Personality Tournament UI:**
```typescript
// Wyświetl 2 warianty obok siebie
// Button "Choose Option A" / "Choose Option B"
// Postęp turnieju (rounds completed)
```

### 4.5 Charts (Recharts)

**Conversations Over Time:**
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

---

## 5. PERSONALITY TOURNAMENT

### 5.1 Algorytm (Swiss Tournament)

```typescript
class PersonalityTournament {
  async getNextMatchup(clientId: string): Promise<[Variant, Variant] | null> {
    const variants = await this.getActiveVariants(clientId);

    if (variants.length < 2) {
      if (variants.length === 1) {
        await this.markWinner(clientId, variants[0].variant_id);
      }
      return null;  // Koniec turnieju
    }

    // Paruj warianty z podobnym win/loss record
    const sorted = variants.sort((a, b) =>
      (b.wins - b.losses) - (a.wins - a.losses)
    );

    return [sorted[0], sorted[1]];
  }

  async recordVote(clientId: string, winnerVariantId: string, loserVariantId: string) {
    // Update wins/losses
    await this.updateVariant(clientId, winnerVariantId, { wins: +1 });
    await this.updateVariant(clientId, loserVariantId, { losses: +1 });

    // Eliminate if 2+ losses
    const loser = await this.getVariant(clientId, loserVariantId);
    if (loser.losses >= 2) {
      await this.updateVariant(clientId, loserVariantId, {
        tournament_status: 'eliminated'
      });
    }
  }
}
```

### 5.2 Zastosowanie Winning Personality

Po zakończeniu turnieju:
1. Zapisz `current_variant_id` w `clients_table.personality_config`
2. W bedrock_service.py, ładuj personality prompt przed invoke_claude
3. Dodaj personality guidelines do system prompt

---

## 6. FAZY IMPLEMENTACJI

### FAZA 1: ANALYTICS & PLATFORM INFRASTRUCTURE (MVP - 3 tygodnie)

**Tydzień 1: Shared Platform Tables & Analytics SDK**
- [ ] Utwórz shared DynamoDB tables:
  - `clients_registry` (przechowa meta-info o Twojej firmie "stride-services")
  - `platform_analytics_events` (główna tabela analytics)
  - `platform_personality_variants` (dla tournament)

- [ ] Dodaj `/backend/services/platform_analytics.py`:
  - `track_event()` function
  - `track_message_sent()` - with tokens/cost
  - `track_appointment_created()`
  - `track_appointment_verified()`
  - Write do `platform_analytics_events` table

- [ ] Zarejestruj Twoją firmę w `clients_registry`:
  ```python
  client_id = "stride-services"
  company_name = "Stride Services"
  lambda_function_name = "chatbot" # Twój istniejący Lambda
  ```

**Tydzień 2: Modyfikuj `/backend` Chatbot**
- [ ] `/backend/chatbot.py`:
  - Dodaj `from services.platform_analytics import track_*`
  - Dodaj `CLIENT_ID = "stride-services"` (hardcoded lub env var)
  - Track `conversation_start` (jeśli first message)
  - Track `message_sent` po invoke_claude (z tokens/cost)
  - Track `appointment_created`, `appointment_verified`

- [ ] `/backend/services/bedrock_service.py`:
  - Extract `tokens_input`, `tokens_output` z Bedrock response headers
  - Calculate `cost` (input/output × pricing)
  - Return `(answer, bedrock_time, tokens_input, tokens_output, cost)`

- [ ] `/backend/services/conversation_service.py`:
  - Dodaj pola `bedrock_tokens_input`, `bedrock_tokens_output`, `bedrock_cost` do save_message (optional - dla backup)

- [ ] Test: Wyślij message → sprawdź czy event trafił do `platform_analytics_events`

**Tydzień 3: Admin API & Authentication**
- [ ] Setup AWS Cognito:
  - User pool z group "owners"
  - Custom attribute: `custom:role = "owner"`
  - Dodaj siebie jako pierwszego usera

- [ ] Utwórz `/admin-panel-backend/api/handler.py`:
  - GET `/clients` - zwraca ["stride-services"] (z clients_registry)
  - GET `/clients/stride-services/stats?period=month` - query `platform_analytics_events WHERE client_id="stride-services"`
  - GET `/clients/stride-services/conversations` - query TWOJA conversations table
  - GET `/clients/stride-services/appointments` - query TWOJA appointments table

- [ ] Implementuj JWT verification (Cognito)

- [ ] Test: Query API → dostaniesz stats dla "stride-services"

**MVP Deliverables:**
✅ Twój chatbot trackuje analytics do shared table
✅ `platform_analytics_events` zbiera wszystkie eventy
✅ Admin API działa i zwraca stats dla Stride Services
✅ AWS Cognito auth setup

---

### FAZA 2: ANALYTICS & FEATURES (4 tygodnie)

**Tydzień 4: Analytics Infrastructure**
- [ ] Analytics aggregator Lambda (daily cron)
- [ ] Conversion tracking (appointment_created/verified events)
- [ ] Escalation detection (keywords)
- [ ] Feedback system (API + widget dla chatbota)
- [ ] CloudWatch custom metrics

**Tydzień 5: Enhanced Dashboards**
- [ ] Charts (Recharts): conversations over time, conversion funnel
- [ ] Advanced filters (date range, search, status)
- [ ] Conversations table z paginacją
- [ ] Appointments table z cancel/reschedule (future)

**Tydzień 6: FAQ & Personality**
- [x] FAQ generator Lambda (Claude analysis) - Implemented as "Trending Topics"
- [x] FAQ page w client panel - Implemented as "Insights" page
- [ ] Personality tournament algorithm
- [ ] Tournament UI (A vs B comparison)
- [ ] Apply winning personality do system prompt

**Tydzień 7: Polish & Frontend**
- [ ] Nowy Next.js projekt `/admin-panel/`
- [ ] Setup Amplify auth + protected routes
- [ ] Client dashboard (basic stats + charts)
- [ ] Owner dashboard (clients list)
- [ ] Loading states, error messages, empty states
- [ ] Responsive design

**Faza 2 Deliverables:**
✅ Frontend admin panel działający
✅ Client & Owner dashboards
✅ Charts & analytics visualization
✅ FAQ auto-generation
✅ Personality tournament

---

### FAZA 3: AUTOMATION & PRODUCTION (2-3 tygodnie)

**Tydzień 8: Deployment Automation**
- [ ] Deployment automation Lambda (optional ale BARDZO pomocne):
  - Owner clicks "Create Client" w admin panel
  - Auto-create DynamoDB tables
  - Auto-create S3 bucket
  - Auto-deploy Lambda z template code
  - Auto-register w clients_registry
- [ ] LUB: Polished manual deployment script (step-by-step checklist)

**Tydzień 9: Billing & Cost Tracking**
- [ ] Cost calculation per client:
  - Bedrock cost (already tracked)
  - DynamoDB cost estimation
  - S3 storage cost
- [ ] Monthly billing report
- [ ] Billing dashboard dla owner
- [ ] Invoice generation (optional - PDF export)

**Tydzień 10: Production Readiness**
- [ ] Security audit:
  - Data isolation test (client A vs client B)
  - IAM permissions review
  - Input validation
- [ ] CloudWatch alarms (high cost, errors, churn)
- [ ] Error tracking (Sentry optional)
- [ ] Documentation:
  - Manual deployment guide
  - API documentation
  - User guides (client + owner)
- [ ] Email notifications (optional): weekly reports

---

## 7. KRYTYCZNE PLIKI & FOLDERY

**WAŻNE**: NIE modyfikujemy istniejącego `/backend/`! To jest Twój prywatny chatbot.

### Nowe struktury do utworzenia:

#### 1. `/home/dominik/Documents/backend-template/` (nowy folder - TEMPLATE dla wszystkich klientów)
```
backend-template/
├── chatbot.py                           # ← COPY z /backend i MODIFY
├── config.py                            # ← COPY z /backend i MODIFY
├── requirements.txt                     # ← COPY z /backend
├── services/
│   ├── __init__.py
│   ├── bedrock_service.py              # ← MODIFY: extract tokens, calculate cost
│   ├── conversation_service.py         # ← MODIFY: save tokens/cost fields
│   ├── appointment_service.py          # ← COPY bez zmian
│   ├── calendar_service.py             # ← COPY bez zmian
│   ├── notification_service.py         # ← COPY bez zmian
│   └── platform_analytics.py           # ← NOWY! Analytics SDK
└── utils/
    ├── __init__.py
    ├── retry.py                        # ← COPY bez zmian
    └── validation.py                   # ← COPY bez zmian
```

**Klucz owe zmiany w template:**
- `chatbot.py`: Dodaj `CLIENT_ID = os.environ["CLIENT_ID"]`, wywołania `track_*()` functions
- `bedrock_service.py`: Extract token counts z response headers, calculate cost
- `conversation_service.py`: Dodaj pola tokens/cost do save_message
- `platform_analytics.py`: NOWY plik - SDK do wysyłania analytics do shared table

#### 2. `/home/dominik/Documents/admin-panel-backend/` (nowy folder - Admin API)
```
admin-panel-backend/
├── api/
│   ├── handler.py                      # ← NOWY! REST API dla admin panel
│   ├── auth.py                         # ← JWT verification, role-based auth
│   └── clients_service.py              # ← Query clients_registry, analytics_events
├── faq/
│   └── generator.py                    # ← FAQ generation Lambda
├── personality/
│   └── tournament.py                   # ← Tournament algorithm
└── requirements.txt
```

**Endpoints w handler.py:**
- GET /clients - lista z clients_registry
- GET /clients/{id}/stats - query platform_analytics_events WHERE client_id
- GET /clients/{id}/conversations - proxy do client-{id}-conversations table
- POST /clients - create new client entry w registry

#### 3. `/home/dominik/Documents/admin-panel/` (nowy folder - Frontend Next.js)
```
admin-panel/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (client)/
│   │   ├── dashboard/page.tsx
│   │   ├── conversations/page.tsx
│   │   ├── appointments/page.tsx
│   │   ├── faq/page.tsx
│   │   └── personality/page.tsx
│   └── (owner)/
│       ├── admin/page.tsx
│       ├── clients/page.tsx
│       └── analytics/page.tsx
├── components/
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   ├── ConversationsTable.tsx
│   │   └── ChartsContainer.tsx
│   └── personality/
│       ├── TournamentBracket.tsx
│       └── VariantComparison.tsx
├── lib/
│   ├── auth.ts                         # ← Cognito integration
│   ├── api.ts                          # ← API client with JWT
│   └── types.ts
└── package.json                        # ← Next.js 14, Amplify, Recharts
```

**Style: Identical jak `/frontend/nowa strona`** (Next.js 14 + TypeScript + Tailwind)

### Shared Platform Infrastructure (DynamoDB tables - utwórz przez AWS Console):

4. **`clients_registry`** table
   - PK: client_id, SK: SK (always "PROFILE")
   - Atrybuty: company_name, lambda_function_name, tables_prefix, status, etc.

5. **`platform_analytics_events`** table
   - PK: client_id, SK: event_timestamp
   - Atrybuty: event_id, session_id, event_type, metadata, ttl
   - GSI: event_type-event_timestamp-index

6. **`platform_personality_variants`** table
   - PK: client_id, SK: variant_id

7. **`platform_feedback`** table (optional)
   - PK: client_id, SK: feedback_id

### Per-Client Infrastructure (utworzyć dla każdego klienta):

8. **`client-{id}-conversations`** table (per client)
   - Schema: identical jak existing `/backend` conversations table
   - Dodaj pola: bedrock_tokens_input, bedrock_tokens_output, bedrock_cost, model_id

9. **`client-{id}-appointments`** table (per client)
   - Schema: identical jak existing `/backend` appointments table

10. **`client-{id}-kb`** S3 bucket (per client)
    - Knowledge base documents

### AWS Services do skonfigurowania:

11. **AWS Cognito User Pool**
    - Groups: owners, clients
    - Custom attributes: custom:client_id, custom:role

12. **API Gateway HTTP API**
    - Base URL: https://api.stride-services.com
    - Authorizer: Cognito JWT

13. **Lambda Functions**:
    - `admin-api` - dla admin panel endpoints
    - `chatbot-client-{id}` - per każdego klienta (deployed z template)
    - `faq-generator` - on-demand FAQ generation
    - `personality-tournament` - tournament logic

14. **IAM Roles & Permissions**:
    - Lambda execution role z dostępem do:
      - All DynamoDB tables (clients_registry + analytics + per-client tables)
      - Bedrock API
      - S3 buckets (wszystkie client buckets)

### Deployment Artifacts:

15. **`/deployments/`** folder (created during manual deployment)
```
deployments/
├── client-test-001/                    # Copied from /backend-template
├── client-abc123/                      # Copied from /backend-template
└── deploy-client.sh                    # Deployment automation script (optional)
```

---

## 8. SECURITY CHECKLIST

- [ ] **Data Isolation**: Zawsze filtruj query po client_id
- [ ] **Auth**: Wszystkie endpoints wymagają valid Cognito JWT
- [ ] **Authorization**: Role-based access enforced server-side
- [ ] **Rate Limiting**: Per-user/per-client limits
- [ ] **Input Validation**: Validate wszystkie user inputs
- [ ] **CORS**: Restrict do admin.stride-services.com
- [ ] **Secrets**: Use AWS Secrets Manager, NIE env vars
- [ ] **Testing**: Automated tests dla data isolation

---

## 10. COST ESTIMATION

### Infrastructure (10 clients):
- DynamoDB: ~$15/month
- Lambda: ~$5/month
- S3: ~$2/month
- Cognito: Free (under 50K MAU)
- Amplify Hosting: ~$15/month
- API Gateway: ~$3/month
- CloudWatch: ~$5/month
- **Total: ~$45/month**

### Development Time:
- **Faza 1 (MVP)**: 3 tygodnie = 120h
- **Faza 2 (Analytics)**: 4 tygodnie = 160h
- **Faza 3 (Billing)**: 3 tygodnie = 120h
- **Total**: 10 tygodni = 400h

### ROI (przy 800 PLN/miesiąc per klient):
- 10 klientów: 8,000 PLN/m - 200 PLN infra = 7,800 PLN/m (97.5% margin)
- Break-even: 2-4 miesiące z 10 klientami

---

## 11. NASTĘPNE KROKI

### Immediate (Tydzień 1):
1. ✅ **Review planu** - Potwierdź że MVP approach jest OK
2. ✅ **Utwórz shared platform tables** (DynamoDB):
   - ✅ `clients_registry` (PK: client_id, SK: SK)
   - ✅ `platform_analytics_events` (PK: client_id, SK: event_timestamp) + GSI
   - ✅ `platform_personality_variants` (PK: client_id, SK: variant_id)

3. ✅ **Dodaj Platform Analytics SDK** (`/backend/services/platform_analytics.py`):
   - ✅ Copy kod z planu (sekcja 2.2)
   - ✅ Functions: `track_event()`, `track_message_sent()`, `track_appointment_created()`, etc.

4. ✅ **Zarejestruj Stride Services** w `clients_registry`:
   - ✅ client_id: "stride-services"
   - ✅ lambda_function_name: "stride"
   - ✅ status: "active"
   - ✅ Zapisano 2025-12-15

### Następnie (Tydzień 2):
5. ✅ **Modyfikuj `/backend/chatbot.py`**:
   - ✅ Import `track_*` functions z platform_analytics
   - ✅ Dodaj `CLIENT_ID = "stride-services"`
   - ✅ Track conversation_start (jeśli first message)
   - ✅ Track message_sent() po invoke_claude (z tokens/cost)
   - ✅ Track appointment_created() w 2 miejscach
   - ✅ Track appointment_verified() w 2 miejscach

6. ✅ **Modyfikuj `/backend/services/bedrock_service.py`**:
   - ✅ Extract tokens z streaming events (message_start, message_delta)
   - ✅ Calculate cost (Haiku 4.5: $0.00025/1K input, $0.00125/1K output)
   - ✅ Return `(answer, bedrock_time, tokens_input, tokens_output, cost)`
   - ✅ Log tokens i cost w response metadata

7. ✅ **Fix platform_analytics.py**:
   - ✅ Dodano convert_floats_to_decimal() helper
   - ✅ Konwersja float → Decimal przed DynamoDB put_item
   - ✅ Fix błędu "Float types are not supported"

8. ✅ **Test**: Wszystkie eventy działają!
   - ✅ conversation_start - zapisuje się przy pierwszej wiadomości
   - ✅ message_sent - zapisuje tokens_input, tokens_output, cost, response_time_ms
   - ✅ appointment_created - zapisuje appointment_id, datetime
   - ✅ appointment_verified - zapisuje appointment_id
   - ✅ Dane w platform_analytics_events gotowe do analytics dashboard

### W kolejnych tygodniach (Tydzień 3+):
9. ✅ **AWS Cognito setup** (auth dla admin panel) - UKOŃCZONE 2025-12-16
10. ✅ **Admin API Lambda** (`/admin-panel-backend/`) - UKOŃCZONE 2025-12-16
11. ⏭️ **Frontend admin panel** (Next.js 14)
12. ⏭️ **FAQ & Personality tournament**

---

## PROGRESS UPDATE - 2025-12-15

**✅ TYDZIEŃ 1-2 UKOŃCZONY (MVP Backend Infrastructure)**

**Utworzone tabele DynamoDB:**
- `clients_registry` - centralna rejestracja klientów (stride-services zarejestrowany)
- `platform_analytics_events` - shared analytics table (z GSI)
- `platform_personality_variants` - dla personality tournament (future)

**Zmodyfikowane pliki backendu:**
- `/backend/services/platform_analytics.py` - NOWY! Analytics SDK
- `/backend/services/bedrock_service.py` - dodano tracking tokens/cost
- `/backend/chatbot.py` - dodano wywołania track_*()

**Co działa:**
- ✅ Każda konwersacja trackowana (conversation_start, message_sent)
- ✅ Każde appointment trackowane (appointment_created, appointment_verified)
- ✅ Tokens i cost zapisywane w realtime do DynamoDB
- ✅ Wszystkie eventy mają client_id = "stride-services"
- ✅ Backend gotowy do analytics dashboard

**Następny krok:** Tydzień 3 - AWS Cognito + Admin API Lambda

---

## PROGRESS UPDATE - 2025-12-16

**✅ TYDZIEŃ 3 UKOŃCZONY (Admin API & Authentication)**

**Utworzona infrastruktura AWS:**
- **AWS Cognito User Pool:** `stride-admin-panel-cognito`
  - User Pool ID: `eu-central-1_foqQPqZsC`
  - App Client ID: `2tkv1rheoufn1c19cf8mppdmus`
  - Custom attributes: `custom:client_id`, `custom:role`
  - Grupa: `owners` (dla platform adminów)
  - Pierwszy user (owner) utworzony i skonfigurowany

- **Lambda Function:** `admin-api`
  - Runtime: Python 3.11
  - Handler: `api.handler.lambda_handler`
  - Memory: 256 MB, Timeout: 30s
  - Lambda Layer: `admin-api-dependencies` (boto3, python-jose, etc.)

- **API Gateway HTTP API:**
  - Invoke URL: `https://whmpy9rli5.execute-api.eu-central-1.amazonaws.com/`
  - Routes: `ANY /{proxy+}` (catch-all)
  - Stage: `$default`

**Utworzone pliki Admin API:**
- `/backend/admin-panel-backend/api/handler.py` - główny API handler z endpointami
- `/backend/admin-panel-backend/api/auth.py` - JWT verification (Cognito)
- `/backend/admin-panel-backend/requirements.txt` - dependencies
- `/backend/admin-panel-backend/faq/` - folder dla FAQ generator (future)
- `/backend/admin-panel-backend/personality/` - folder dla tournament (future)

**Zaimplementowane API Endpoints:**
- ✅ `GET /` - Health check endpoint
- ✅ `GET /health` - Health check endpoint
- ✅ `GET /test-db` - Test DynamoDB connection (verified working!)
- ✅ `GET /clients` - Lista wszystkich klientów (requires auth)
- ✅ `GET /clients/{client_id}/stats` - Statystyki klienta (requires auth)
- ✅ `GET /clients/{client_id}/conversations` - Konwersacje klienta (requires auth)
- ✅ `GET /clients/{client_id}/appointments` - Spotkania klienta (requires auth)

**Security & Authorization:**
- ✅ JWT token verification z Cognito public keys (cached)
- ✅ Role-based access control (owner vs client)
- ✅ Data scoping (clients widzą tylko swoje dane, owners wszystko)
- ✅ CORS headers skonfigurowane

**Testy i weryfikacja:**
- ✅ Lambda deployed i działa poprawnie
- ✅ API Gateway routing działa
- ✅ DynamoDB connection verified:
  - Połączenie z `clients_registry` ✅ (znaleziono "stride-services")
  - Połączenie z `platform_analytics_events` ✅ (znaleziono 5 eventów)
- ✅ Health endpoints zwracają poprawne odpowiedzi
- ✅ Auth endpoints wymagają JWT token (security verified)

**Reorganizacja struktury projektu:**
```
/backend/
├── chatbot-backend/          ← Chatbot files (chatbot.py, services/, utils/)
├── admin-panel-backend/      ← Admin API files (api/, faq/, personality/)
└── plany-backend/            ← Plan files (panel-admin.md, plan.md, etc.)
```

**Co działa (end-to-end):**
1. ✅ Chatbot śle analytics events do `platform_analytics_events`
2. ✅ Admin API może odczytać dane z DynamoDB (clients, analytics)
3. ✅ JWT authentication działa (Cognito integration)
4. ✅ API Gateway routuje requesty do Lambda
5. ✅ Wszystkie komponenty backendu komunikują się poprawnie

**Koszty infrastruktury:**
- API Gateway HTTP API: **FREE** (1M requests/month free tier)
- Lambda: **FREE** (1M requests + 400K GB-seconds free tier)
- Cognito: **FREE** (50K MAU free tier)
- DynamoDB: Istniejące tabele (bez dodatkowych kosztów)
- **Całkowity koszt MVP: ~0 zł/miesiąc** (w ramach free tier)

**Następny krok:** Frontend Admin Panel (Next.js 14 + Dashboard UI)

---

## PROGRESS UPDATE - 2025-12-17

**✅ FRONTEND ADMIN PANEL UKOŃCZONY (MVP)**

**Utworzona aplikacja Next.js 14:**
- **Repo GitHub:** https://github.com/domikolo/stride-admin-panel
- **Deployment:** AWS Amplify
  - URL: https://master.dwbypdlefsahq.amplifyapp.com
  - Auto-deploy z GitHub master branch
  - Environment variables skonfigurowane (API URL, Cognito credentials)

**Stack technologiczny:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (dark theme)
- shadcn/ui components (button, card, table, badge, skeleton)
- AWS Cognito authentication (amazon-cognito-identity-js)
- Recharts (do wykresów)
- date-fns (formatowanie dat)

**Struktura projektu:**
```
/admin-panel/
├── app/
│   ├── layout.tsx                    # Root layout + AuthProvider
│   ├── (auth)/
│   │   └── login/page.tsx           # Login form (AWS Cognito)
│   ├── (dashboard)/
│   │   ├── layout.tsx               # Dashboard layout + Sidebar
│   │   ├── dashboard/page.tsx       # Main dashboard z stats + charts
│   │   ├── conversations/
│   │   │   ├── page.tsx            # Lista konwersacji (klikalnych)
│   │   │   └── [sessionId]/page.tsx # Szczegóły konwersacji (wszystkie wiadomości)
│   │   ├── appointments/page.tsx    # Lista appointmentów
│   │   └── (owner)/
│   │       └── clients/page.tsx     # Lista klientów (owner only)
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── dashboard/
│   │   └── StatsCard.tsx           # Card z metryką
│   └── layout/
│       └── Sidebar.tsx             # Navigation sidebar
├── lib/
│   ├── auth.ts                      # AWS Cognito wrapper
│   ├── api.ts                       # API client z JWT
│   └── types.ts                     # TypeScript interfaces
├── hooks/
│   └── useAuth.tsx                  # Auth context + hook
└── .env.local                       # Environment variables
```

**Zaimplementowane funkcjonalności:**

1. **Authentication (AWS Cognito):**
   - ✅ Login page z email/password
   - ✅ Session management (localStorage)
   - ✅ Auto-redirect na /dashboard po loginie
   - ✅ Sign out functionality
   - ✅ Protected routes (redirect do /login jeśli nie zalogowany)
   - ✅ Role-based UI (owner widzi Clients, client nie widzi)

2. **Dashboard Page:**
   - ✅ 4 StatsCards:
     - Conversations count
     - Appointments count
     - Conversion rate (%)
     - Total cost ($)
   - ✅ **LineChart (Recharts):** Activity Over Time
     - Conversations i appointments przez ostatnie 30 dni
     - Dane z endpoint `/clients/{id}/stats/daily`
   - ✅ **BarChart (Recharts):** Conversion Funnel
     - Conversations → Appointments → Verified
     - Wizualizacja conversion rate

3. **Conversations Page:**
   - ✅ Lista wszystkich konwersacji
   - ✅ Kolumny: Session ID, Messages count, Last Message, Preview
   - ✅ Formatowanie daty (date-fns: "2 hours ago")
   - ✅ **Klikalny row** → przekierowanie do szczegółów
   - ✅ **Conversation Detail Page:**
     - Wszystkie wiadomości chronologicznie
     - User/Assistant avatary i role
     - Timestamps dla każdej wiadomości
     - Ładny UI z colored borders (blue dla user, purple dla assistant)
     - Przycisk "Back" do powrotu

4. **Appointments Page:**
   - ✅ Lista wszystkich appointmentów
   - ✅ Kolumny: ID, Date & Time, Contact, Status, Session
   - ✅ Status badges (verified/pending/cancelled)
   - ✅ Formatowanie daty (date-fns PPp format)

5. **Clients Page (Owner only):**
   - ✅ Lista wszystkich klientów z `clients_registry`
   - ✅ Kolumny: Client ID, Company Name, Status, Conversations, Created
   - ✅ Access control (tylko dla owners)
   - ✅ Error message jeśli client próbuje wejść

**Backend updates dla frontend:**

6. **Nowe API endpoints:**
   - ✅ `GET /clients/{client_id}/conversations/{session_id}` - szczegóły konwersacji
   - ✅ `GET /clients/{client_id}/stats/daily?days=30` - daily breakdown dla wykresów

7. **Bug fixes w API:**
   - ✅ **CORS fix:** Dodano obsługę OPTIONS preflight requests
   - ✅ **Authorization header fix:** HTTP API v2 używa lowercase `authorization` zamiast `Authorization`
   - ✅ **Routing fix:** HTTP API v2 używa `rawPath` zamiast `path`
   - ✅ **Timestamp conversion:** Unix timestamps (string) → ISO 8601 format
   - ✅ **Table name fix:** `conversations` → `Conversations-stride`

**Naprawione problemy podczas deploymentu:**

1. **CORS błąd:** "No 'Access-Control-Allow-Origin' header"
   - Rozwiązanie: Dodano obsługę OPTIONS method w Lambda + API Gateway CORS config

2. **401 Unauthorized:** "Missing authorization token"
   - Rozwiązanie: API Gateway normalizuje headers do lowercase, backend sprawdzał uppercase

3. **404 Not Found:** Endpoints nie były znajdowane
   - Rozwiązanie: HTTP API v2 używa `rawPath` zamiast `path` w event

4. **Invalid time value:** Frontend nie mógł sparsować timestampów
   - Rozwiązanie: Dodano `convert_timestamp_to_iso()` w backendie (Unix → ISO string)

5. **ResourceNotFoundException:** Tabela conversations nie istniała
   - Rozwiązanie: Zmiana nazwy z `conversations` → `Conversations-stride`

**Deployment artifacts:**
- **Frontend:** Deployed on AWS Amplify (auto-deploy z GitHub)
- **Backend Lambda:** Zaktualizowany z wszystkimi fixami
  - File: `/backend/admin-panel-backend/admin-api-code.zip`
  - Nowe endpointy + wszystkie poprawki

**Co działa (end-to-end):**
1. ✅ Login przez AWS Cognito → JWT token
2. ✅ Dashboard wyświetla statystyki z API
3. ✅ Wykresy pokazują dane z ostatnich 30 dni
4. ✅ Conversations lista klikalnych sesji
5. ✅ Klik na konwersację → pełna historia wiadomości
6. ✅ Appointments lista z formatowanymi datami
7. ✅ Clients lista (owner) z wszystkimi klientami
8. ✅ Sign out → powrót do login
9. ✅ Role-based access (owner vs client)
10. ✅ Responsive dark theme UI

**Design:**
- Konsystentny dark theme jak w `/frontend/nowa strona`
- Glass card effects z backdrop-filter
- Gradient text headings (white → white/60)
- Smooth hover states i transitions
- Loading skeletons dla lepszego UX
- Error states z czerwonymi alertami

**Koszty:**
- AWS Amplify Hosting: ~$15/month (build minutes + hosting)
- Lambda + API Gateway: **FREE** (w ramach free tier)
- Cognito: **FREE** (50K MAU free tier)
- **Total: ~$15/month** dla MVP

**Następne kroki (Future enhancements):**
- ⏭️ FAQ Generator page (Claude analysis ostatnich konwersacji)
- ⏭️ Personality Tournament page (A vs B comparison UI)
- ⏭️ Advanced filters (date range picker, search, pagination)
- ⏭️ Real-time updates (WebSocket lub polling)
- ⏭️ Email notifications (weekly reports)
- ⏭️ Export data (CSV, PDF)
- ⏭️ Custom domain (`panel.stride-services.pl`)
- ⏭️ Mobile responsive improvements
- ⏭️ Dodatkowe wykresy (cost over time, response times, etc.)

**Status:** **MVP UKOŃCZONE** - Frontend + Backend działają w pełni!

---

## 12. ADVANCED FEATURES (Future Enhancements)

### 12.1 A/B Testing Osobowości

**Concept:**
Klient może uruchomić test porównujący dwa style komunikacji chatbota. Połowa użytkowników rozmawia z wariantem A, druga połowa z wariantem B. Po określonym czasie klient widzi który styl lepiej konwertuje i może go ustawić jako domyślny.

**Implementacja:**

#### Backend Schema

**Nowa tabela:** `platform_ab_tests`
```python
PK: client_id (String)
SK: test_id (String)

Atrybuty:
- client_id: "stride-services"
- test_id: "test_20251220_friendly_vs_professional"
- created_at: ISO timestamp
- status: "active" | "completed" | "paused"

- variant_a_id: "variant_1"  # personality_variant FK
- variant_b_id: "variant_5"  # personality_variant FK
- variant_a_name: "Friendly & Casual"
- variant_b_name: "Professional & Formal"

- traffic_split: 50  # % dla A (reszta to B)
- started_at: ISO timestamp
- ends_at: ISO timestamp (optional - może być open-ended)
- duration_days: 14

# Results (aggregated z analytics)
- variant_a_conversations: 234
- variant_a_appointments: 45
- variant_a_conversion_rate: 19.2
- variant_a_avg_sentiment: 0.72  # -1 do 1
- variant_a_avg_messages: 8.5

- variant_b_conversations: 241
- variant_b_appointments: 62
- variant_b_conversion_rate: 25.7
- variant_b_avg_sentiment: 0.68
- variant_b_avg_messages: 7.2

# Winner (auto-determined or manual)
- winner_variant_id: "variant_5"  # jeśli test completed
- winner_reason: "Higher conversion rate (+6.5pp)"
```

**Tracking w analytics:**
```python
# Modyfikacja platform_analytics_events
metadata: {
    # Dodaj dla każdego eventu:
    "ab_test_id": "test_20251220_friendly_vs_professional",
    "variant_assignment": "variant_b",  # Który wariant dostał ten user
    ...
}
```

#### Chatbot Logic (Traffic Split)

**Modyfikacja `/backend/chatbot.py`:**
```python
import hashlib

def get_ab_test_variant(client_id: str, session_id: str) -> str:
    """
    Deterministycznie przypisz session do wariantu A lub B.
    Używamy hash session_id żeby ten sam user zawsze dostał ten sam wariant.
    """
    # Sprawdź czy jest aktywny A/B test
    ab_test = get_active_ab_test(client_id)
    if not ab_test:
        return get_default_variant(client_id)  # Normal personality

    # Hash session_id do deterministic split
    hash_val = int(hashlib.md5(session_id.encode()).hexdigest(), 16)
    bucket = hash_val % 100  # 0-99

    if bucket < ab_test["traffic_split"]:
        variant_id = ab_test["variant_a_id"]
        variant_name = "A"
    else:
        variant_id = ab_test["variant_b_id"]
        variant_name = "B"

    return variant_id, ab_test["test_id"], variant_name

# W lambda_handler:
variant_id, ab_test_id, variant_assignment = get_ab_test_variant(CLIENT_ID, session_id)

# Load personality prompt dla tego wariantu
personality_prompt = load_personality_variant(CLIENT_ID, variant_id)

# Invoke Claude z personality modifiers
system_prompt = f"{BASE_SYSTEM_PROMPT}\n\n{personality_prompt}"

# Track w analytics
track_message_sent(CLIENT_ID, session_id, ..., metadata={
    "ab_test_id": ab_test_id,
    "variant_assignment": variant_assignment,
    ...
})
```

#### Admin API Endpoints

```python
# A/B Test Management
POST   /clients/{client_id}/ab-tests/start
  Body: {
    "variant_a_id": "variant_1",
    "variant_b_id": "variant_5",
    "traffic_split": 50,
    "duration_days": 14
  }

GET    /clients/{client_id}/ab-tests/active
  # Zwraca aktywny test jeśli istnieje

GET    /clients/{client_id}/ab-tests/{test_id}/results
  # Real-time results z analytics aggregation

POST   /clients/{client_id}/ab-tests/{test_id}/complete
  Body: { "winner_variant_id": "variant_5" }
  # Mark test as complete, optionally set winner as default

GET    /clients/{client_id}/ab-tests/history
  # Lista wszystkich testów (past + current)
```

**Results Calculation:**
```python
def calculate_ab_test_results(client_id: str, test_id: str):
    # Query analytics events WHERE ab_test_id = test_id
    events = query_analytics_by_metadata("ab_test_id", test_id)

    # Group by variant_assignment
    variant_a_events = [e for e in events if e["metadata"]["variant_assignment"] == "A"]
    variant_b_events = [e for e in events if e["metadata"]["variant_assignment"] == "B"]

    # Calculate stats
    results = {
        "variant_a": {
            "conversations": count_unique_sessions(variant_a_events, "conversation_start"),
            "appointments": count_events(variant_a_events, "appointment_created"),
            "conversion_rate": calculate_conversion_rate(variant_a_events),
            "avg_sentiment": calculate_avg_sentiment(variant_a_events),
            "avg_messages": calculate_avg_messages(variant_a_events)
        },
        "variant_b": { ... }
    }

    # Statistical significance test (Chi-square)
    results["is_significant"] = chi_square_test(
        variant_a_conversions, variant_a_total,
        variant_b_conversions, variant_b_total
    )

    return results
```

#### Frontend UI

**A/B Test Page:** `/app/(dashboard)/ab-testing/page.tsx`
```typescript
// Start test form
- Wybierz Variant A (dropdown z personality_variants)
- Wybierz Variant B (dropdown)
- Traffic split slider (0-100%)
- Duration (dni)
- Button: "Start Test"

// Active test card
- Variant A vs Variant B name
- Progress bar (days elapsed / total)
- Stats comparison table:
  | Metric              | Variant A | Variant B | Winner |
  |---------------------|-----------|-----------|--------|
  | Conversations       | 234       | 241       | -      |
  | Appointments        | 45        | 62        | 🏆 B   |
  | Conversion Rate     | 19.2%     | 25.7%     | 🏆 B   |
  | Avg Sentiment       | 😊 72%    | 😊 68%    | A      |
  | Avg Messages/Conv   | 8.5       | 7.2       | 🏆 B   |

- Statistical significance badge ("95% confident" lub "Not enough data")
- Actions: "Declare Winner & Apply" | "End Test" | "Pause"

// Past tests history
- List of completed tests
- Winner highlighted
```

**Visual Comparison:**
```typescript
// Side-by-side comparison cards
<div className="grid grid-cols-2 gap-6">
  <VariantCard variant="A" stats={...} />
  <VariantCard variant="B" stats={...} winner={true} />
</div>

// Conversion funnel chart (recharts)
<BarChart data={[
  { stage: 'Conversations', A: 234, B: 241 },
  { stage: 'Appointments', A: 45, B: 62 },
  { stage: 'Verified', A: 38, B: 55 }
]} />
```

**Benefits:**
- Data-driven personality optimization
- Eliminuje guesswork z personality selection
- Continuous improvement cycle
- Low risk (split traffic mitiguje bad variants)

---

### 12.2 Analiza Sentymentu

**Concept:**
Każda rozmowa jest automatycznie oznaczana jako pozytywna, neutralna lub negatywna na podstawie tonu użytkownika. Klient widzi w dashboardzie trend jak zmieniają się nastroje jego klientów w czasie. Pozwala to szybko wychwycić czy coś zaczyna irytować użytkowników.

**Implementacja:**

#### Backend - Sentiment Analysis

**Lambda Function:** `/backend/sentiment/analyzer.py`
```python
import boto3
from typing import Literal

bedrock = boto3.client("bedrock-runtime")

def analyze_sentiment(text: str) -> dict:
    """
    Używa Claude Haiku do fast sentiment analysis.

    Returns:
        {
            "sentiment": "positive" | "neutral" | "negative",
            "score": 0.85,  # -1 (very negative) to 1 (very positive)
            "confidence": 0.92,  # 0-1
            "keywords": ["happy", "satisfied", "thank you"]
        }
    """
    prompt = f"""Analyze the sentiment of this customer message.

Message: "{text}"

Respond with ONLY a JSON object in this format:
{{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <float from -1 to 1>,
  "confidence": <float from 0 to 1>,
  "keywords": [<list of sentiment keywords>]
}}"""

    response = bedrock.invoke_model(
        modelId="us.anthropic.claude-haiku-4.5:1:200k",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 200,
            "messages": [{"role": "user", "content": prompt}]
        })
    )

    result = json.loads(response["body"].read())
    sentiment_data = json.loads(result["content"][0]["text"])

    return sentiment_data
```

**Real-time tracking w chatbot:**
```python
# W chatbot.py, po user message:
user_message = payload.get("query", "")

# Async sentiment analysis (nie blokuj response)
sentiment = analyze_sentiment(user_message)

# Track w analytics
track_event(CLIENT_ID, session_id, "message_received", {
    "user_message": user_message[:500],
    "sentiment": sentiment["sentiment"],
    "sentiment_score": sentiment["score"],
    "sentiment_confidence": sentiment["confidence"],
    "sentiment_keywords": sentiment["keywords"]
})
```

**Conversation-level sentiment:**
```python
# EventBridge scheduled rule (co 5 min)
def aggregate_conversation_sentiment(event, context):
    """
    Dla każdej konwersacji z ostatnich 5 min, oblicz overall sentiment.
    """
    recent_conversations = get_recent_conversations(minutes=5)

    for session_id in recent_conversations:
        # Pobierz wszystkie message_received events z tym session_id
        messages = query_analytics_events(
            client_id=CLIENT_ID,
            event_type="message_received",
            session_id=session_id
        )

        # Oblicz weighted average sentiment
        sentiments = [m["metadata"]["sentiment_score"] for m in messages]
        avg_sentiment = sum(sentiments) / len(sentiments)

        # Kategoryzuj
        if avg_sentiment > 0.3:
            sentiment_label = "positive"
        elif avg_sentiment < -0.3:
            sentiment_label = "negative"
        else:
            sentiment_label = "neutral"

        # Track conversation-level sentiment
        track_event(CLIENT_ID, session_id, "conversation_sentiment_analyzed", {
            "sentiment": sentiment_label,
            "sentiment_score": avg_sentiment,
            "message_count": len(sentiments)
        })
```

#### Admin API Endpoints

```python
GET /clients/{client_id}/sentiment/overview?period=30d
  Response: {
    "positive": 65,    # % conversations
    "neutral": 25,
    "negative": 10,
    "avg_score": 0.42,  # -1 to 1
    "trend": "improving"  # "improving" | "declining" | "stable"
  }

GET /clients/{client_id}/sentiment/timeline?period=30d
  Response: [
    { "date": "2025-12-01", "positive": 70, "neutral": 20, "negative": 10, "avg_score": 0.5 },
    { "date": "2025-12-02", "positive": 62, "neutral": 28, "negative": 10, "avg_score": 0.38 },
    ...
  ]

GET /clients/{client_id}/sentiment/negative?limit=20
  # Lista konwersacji z negative sentiment (do review)
  Response: [
    {
      "session_id": "sess_123",
      "sentiment_score": -0.72,
      "timestamp": "2025-12-17T10:30:00Z",
      "keywords": ["frustrated", "doesn't work", "angry"],
      "preview": "This is ridiculous, I've been waiting..."
    },
    ...
  ]
```

#### Frontend UI

**Dashboard - Sentiment Widget:**
```typescript
// Donut chart (Recharts PieChart)
<PieChart>
  <Pie data={[
    { name: 'Positive', value: 65, fill: '#22c55e' },
    { name: 'Neutral', value: 25, fill: '#94a3b8' },
    { name: 'Negative', value: 10, fill: '#ef4444' }
  ]} />
</PieChart>

// Sentiment score gauge
<div className="text-4xl font-bold">
  {sentimentScore > 0 ? '😊' : sentimentScore < -0.3 ? '😞' : '😐'}
  {(sentimentScore * 100).toFixed(0)}
</div>
```

**Sentiment Timeline Page:** `/app/(dashboard)/sentiment/page.tsx`
```typescript
// Line chart - sentiment over time
<LineChart data={sentimentTimeline}>
  <Line dataKey="avg_score" stroke="#8b5cf6" />
  <Area dataKey="positive" fill="#22c55e" opacity={0.3} />
  <Area dataKey="negative" fill="#ef4444" opacity={0.3} />
</LineChart>

// Negative conversations list (action items)
<div className="space-y-4">
  <h3>🚨 Recent Negative Conversations</h3>
  {negativeConversations.map(conv => (
    <ConversationCard
      sentiment="negative"
      score={conv.sentiment_score}
      keywords={conv.keywords}
      preview={conv.preview}
      onClick={() => router.push(`/conversations/${conv.session_id}`)}
    />
  ))}
</div>
```

**Alerts:**
```python
# CloudWatch alarm: Negative sentiment spike
if (negative_conversations_last_hour > threshold):
    send_notification(
        email=client_email,
        subject="⚠️ Sentiment Alert: Increase in Negative Conversations",
        body=f"Negative conversations increased by {increase}% in last hour. Review: {dashboard_link}"
    )
```

**Benefits:**
- Early warning system dla customer satisfaction issues
- Prioritize negative conversations for review
- Track impact of changes (KB updates, personality tweaks)
- Quantify customer happiness

---

### 12.3 Gorące Tematy (Trending Topics)

**Concept:**
System wykrywa gdy nagle dużo użytkowników zaczyna pytać o ten sam temat. Klient dostaje powiadomienie że np. pytania o dostępność produktu wzrosły o 300% w ostatnich godzinach. Dzięki temu może szybko zareagować jeśli coś się dzieje z jego biznesem.

**Implementacja:**

#### Backend - Topic Extraction & Spike Detection

**Lambda Function:** `/backend/topics/extractor.py`
```python
def extract_topics(text: str) -> list[str]:
    """
    Używa Claude do wyciągnięcia kluczowych tematów z user message.

    Returns: ["product_availability", "pricing", "delivery_time"]
    """
    prompt = f"""Extract the main topics from this customer question.
Return a JSON array of topic slugs (lowercase, underscore-separated).

Common topics: product_availability, pricing, delivery_time, technical_support,
              refund_policy, account_issues, payment_problems, hours_of_operation

Question: "{text}"

Respond with ONLY a JSON array: ["topic1", "topic2", ...]"""

    response = invoke_claude_haiku(prompt)
    topics = json.loads(response)
    return topics
```

**Real-time tracking:**
```python
# W chatbot.py, po user message:
topics = extract_topics(user_message)

for topic in topics:
    track_event(CLIENT_ID, session_id, "topic_mentioned", {
        "topic": topic,
        "user_message": user_message[:500]
    })
```

**Scheduled aggregator:** `/backend/topics/spike_detector.py`
```python
# Runs every hour via EventBridge
def detect_topic_spikes(event, context):
    """
    Porównaj topic mentions z ostatniej godziny vs poprzednia godzina.
    Alert jeśli spike > 200%.
    """
    client_id = "stride-services"

    # Count topics last hour
    now = datetime.utcnow()
    last_hour_start = now - timedelta(hours=1)
    prev_hour_start = now - timedelta(hours=2)

    last_hour_topics = count_topics(client_id, last_hour_start, now)
    prev_hour_topics = count_topics(client_id, prev_hour_start, last_hour_start)

    # Calculate spike %
    spikes = []
    for topic, count in last_hour_topics.items():
        prev_count = prev_hour_topics.get(topic, 0)

        # Ignore if too few mentions (noise)
        if count < 5:
            continue

        # Calculate increase %
        if prev_count == 0:
            increase_pct = 999  # New topic
        else:
            increase_pct = ((count - prev_count) / prev_count) * 100

        if increase_pct > 200:  # 200% threshold
            spikes.append({
                "topic": topic,
                "count": count,
                "prev_count": prev_count,
                "increase_pct": increase_pct
            })

    # Track spike events
    for spike in spikes:
        track_event(client_id, "SYSTEM", "topic_spike_detected", {
            "topic": spike["topic"],
            "count": spike["count"],
            "prev_count": spike["prev_count"],
            "increase_pct": spike["increase_pct"]
        })

        # Send notification
        send_topic_spike_notification(client_id, spike)

def count_topics(client_id: str, start_time: datetime, end_time: datetime) -> dict:
    """Query analytics events and count topic mentions."""
    events = query_analytics_events(
        client_id=client_id,
        event_type="topic_mentioned",
        start_time=start_time.isoformat(),
        end_time=end_time.isoformat()
    )

    topic_counts = {}
    for event in events:
        topic = event["metadata"]["topic"]
        topic_counts[topic] = topic_counts.get(topic, 0) + 1

    return topic_counts
```

**Notification:**
```python
def send_topic_spike_notification(client_id: str, spike: dict):
    # SNS topic or SES email
    client = get_client_info(client_id)

    sns.publish(
        TopicArn=client["notification_topic_arn"],
        Subject=f"🔥 Trending Topic Alert: {humanize_topic(spike['topic'])}",
        Message=f"""
        A topic is trending among your customers:

        Topic: {humanize_topic(spike['topic'])}
        Mentions (last hour): {spike['count']}
        Previous hour: {spike['prev_count']}
        Increase: +{spike['increase_pct']:.0f}%

        This could indicate:
        - Product issue or outage
        - Popular new question
        - Marketing campaign impact

        Review conversations: {dashboard_url}/topics/{spike['topic']}
        """
    )
```

#### Admin API Endpoints

```python
GET /clients/{client_id}/topics/trending?period=24h
  Response: [
    {
      "topic": "product_availability",
      "count": 45,
      "increase_pct": 320,
      "sparkline": [2, 3, 5, 12, 23],  # Last 5 hours
      "sample_questions": [
        "When will X be back in stock?",
        "Is Y available for delivery?"
      ]
    },
    ...
  ]

GET /clients/{client_id}/topics/history?days=30
  # All topics with counts over time
  Response: [
    { "date": "2025-12-01", "product_availability": 12, "pricing": 8, ... },
    ...
  ]

GET /clients/{client_id}/topics/{topic}/conversations?limit=20
  # Conversations mentioning this topic
```

#### Frontend UI

**Dashboard - Trending Topics Widget:**
```typescript
<div className="space-y-3">
  <h3 className="flex items-center gap-2">
    🔥 Trending Topics
    <Badge variant="destructive">3 spikes</Badge>
  </h3>

  {trendingTopics.map(topic => (
    <div className="flex items-center justify-between p-3 border rounded">
      <div>
        <div className="font-medium">{humanize(topic.topic)}</div>
        <div className="text-sm text-muted-foreground">
          {topic.count} mentions
        </div>
      </div>
      <div className="flex items-center gap-3">
        <TrendSparkline data={topic.sparkline} />
        <Badge variant="destructive">
          +{topic.increase_pct}%
        </Badge>
      </div>
    </div>
  ))}
</div>
```

**Topics Page:** `/app/(dashboard)/topics/page.tsx`
```typescript
// Heatmap calendar (like GitHub contributions)
<TopicsHeatmap data={topicsHistory} />

// Topic breakdown table
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Topic</TableHead>
      <TableHead>Mentions (24h)</TableHead>
      <TableHead>Trend</TableHead>
      <TableHead>Sample Questions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {topics.map(topic => (
      <TableRow onClick={() => viewConversations(topic)}>
        <TableCell>{humanize(topic.topic)}</TableCell>
        <TableCell>{topic.count}</TableCell>
        <TableCell>
          {topic.increase_pct > 100 ? '📈' : '📉'} {topic.increase_pct}%
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {topic.sample_questions.slice(0, 2).join(', ')}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Benefits:**
- Real-time business intelligence
- Early warning for product/service issues
- Identify knowledge gaps in chatbot
- Track marketing campaign impact

---

### 12.4 Skrzynka z Materiałami (Knowledge Base Upload)

**Concept:**
Miejsce gdzie klient wrzuca dokumenty, cenniki, opisy produktów i inne materiały które powinny trafić do bazy wiedzy chatbota. Zespół platformy przegląda te materiały i dodaje je do chatbota w odpowiedni sposób. Klient nie musi wysyłać maili z załącznikami ani tłumaczyć co gdzie ma trafić.

**Implementacja:**

#### Backend Schema

**Nowa tabela:** `platform_kb_uploads`
```python
PK: client_id (String)
SK: upload_id (String)

Atrybuty:
- client_id: "stride-services"
- upload_id: "upload_20251217_abc123"
- created_at: ISO timestamp
- uploaded_by: user_id (z Cognito)

# File info
- file_name: "cennik_2025.pdf"
- file_size: 245678  # bytes
- file_type: "application/pdf"
- s3_key: "stride-services/uploads/upload_20251217_abc123/cennik_2025.pdf"
- s3_url: "https://s3.../..."

# Processing status
- status: "pending" | "processing" | "completed" | "rejected"
- notes: "Client upload notes: This is our new pricing for 2025"
- priority: "normal" | "high" | "low"

# Review by platform team
- reviewed_at: ISO timestamp
- reviewed_by: "admin_user_id"
- review_notes: "Added to KB section: pricing. Updated FAQ #5."
- kb_section: "pricing"  # Where it was added

# Actions taken
- actions: [
  "added_to_kb",
  "created_faq_entries",
  "updated_personality_context"
]
```

**S3 Bucket Structure:**
```
{client_id}/
  uploads/
    upload_20251217_abc123/
      cennik_2025.pdf
    upload_20251217_xyz456/
      product_catalog.docx
  kb/
    pricing/
      cennik_2025_processed.txt
    products/
      product_catalog_processed.txt
```

#### Admin API Endpoints

```python
# Upload file
POST /clients/{client_id}/kb/upload
  Headers: Content-Type: multipart/form-data
  Body: FormData with file + notes
  Response: { "upload_id": "...", "status": "pending" }

# List uploads
GET /clients/{client_id}/kb/uploads?status=pending
  Response: [
    {
      "upload_id": "upload_20251217_abc123",
      "file_name": "cennik_2025.pdf",
      "created_at": "2025-12-17T10:00:00Z",
      "status": "pending",
      "notes": "New 2025 pricing"
    },
    ...
  ]

# Get upload details
GET /clients/{client_id}/kb/uploads/{upload_id}
  Response: {
    "upload_id": "...",
    "file_name": "cennik_2025.pdf",
    "s3_url": "https://...",  # Presigned URL for download
    "status": "completed",
    "review_notes": "Added to KB",
    "actions": ["added_to_kb", "created_faq_entries"]
  }

# Owner endpoints (platform team)
GET /admin/kb/uploads/pending
  # All pending uploads across all clients

POST /admin/kb/uploads/{upload_id}/review
  Body: {
    "status": "completed" | "rejected",
    "review_notes": "Added to pricing section",
    "kb_section": "pricing",
    "actions": ["added_to_kb"]
  }
```

**File processing:**
```python
# Lambda triggered on S3 upload
def process_kb_upload(event, context):
    s3_key = event["Records"][0]["s3"]["object"]["key"]
    # Extract: stride-services/uploads/upload_123/file.pdf

    client_id, upload_id, file_name = parse_s3_key(s3_key)

    # Download file
    file_content = s3.get_object(Bucket=KB_BUCKET, Key=s3_key)

    # Extract text (depending on file type)
    if file_name.endswith('.pdf'):
        text = extract_text_from_pdf(file_content)
    elif file_name.endswith('.docx'):
        text = extract_text_from_docx(file_content)
    else:
        text = file_content.read().decode('utf-8')

    # Save extracted text to processing bucket
    processed_key = f"{client_id}/kb/pending/{upload_id}_extracted.txt"
    s3.put_object(Bucket=KB_BUCKET, Key=processed_key, Body=text)

    # Update status
    kb_uploads_table.update_item(
        Key={"client_id": client_id, "upload_id": upload_id},
        UpdateExpression="SET #status = :status, processed_text_s3_key = :key",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":status": "processing",
            ":key": processed_key
        }
    )

    # Notify platform team
    send_notification(
        topic="kb-review-queue",
        message=f"New KB upload ready for review: {client_id}/{file_name}"
    )
```

#### Frontend UI

**KB Upload Page:** `/app/(dashboard)/knowledge-base/page.tsx`
```typescript
// Upload form
<div className="border-2 border-dashed rounded-lg p-8 text-center">
  <input type="file" onChange={handleFileSelect} accept=".pdf,.docx,.txt,.md" />
  <p>Drag & drop files here or click to browse</p>
  <p className="text-sm text-muted-foreground">
    Supported: PDF, DOCX, TXT, MD (max 10MB)
  </p>
</div>

<Textarea
  placeholder="Add notes for the platform team (optional)
Example: This is our new pricing for Q1 2025. Please update chatbot to use these prices."
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
/>

<Button onClick={handleUpload}>Upload to Knowledge Base</Button>

// Uploads history
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>File Name</TableHead>
      <TableHead>Uploaded</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Review Notes</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {uploads.map(upload => (
      <TableRow>
        <TableCell>{upload.file_name}</TableCell>
        <TableCell>{formatDate(upload.created_at)}</TableCell>
        <TableCell>
          <Badge variant={
            upload.status === 'completed' ? 'success' :
            upload.status === 'pending' ? 'warning' : 'default'
          }>
            {upload.status}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">
          {upload.review_notes || 'Pending review...'}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Owner Review Panel:** `/app/(owner)/kb-review/page.tsx`
```typescript
// Pending uploads queue (for platform team)
{pendingUploads.map(upload => (
  <Card>
    <CardHeader>
      <div className="flex justify-between">
        <div>
          <h3>{upload.client_id}</h3>
          <p className="text-sm">{upload.file_name}</p>
        </div>
        <Badge>Pending</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{upload.notes}</p>
    </CardHeader>
    <CardContent>
      <Button onClick={() => downloadFile(upload.s3_url)}>
        Download File
      </Button>
      <Button onClick={() => viewExtractedText(upload.upload_id)}>
        View Extracted Text
      </Button>
    </CardContent>
    <CardFooter>
      <Textarea
        placeholder="Review notes (what did you do with this file?)"
        value={reviewNotes}
      />
      <Select value={kbSection}>
        <SelectItem value="pricing">Pricing</SelectItem>
        <SelectItem value="products">Products</SelectItem>
        <SelectItem value="policies">Policies</SelectItem>
      </Select>
      <div className="flex gap-2">
        <Button onClick={() => approveUpload(upload, 'completed')}>
          ✓ Mark as Completed
        </Button>
        <Button variant="destructive" onClick={() => rejectUpload(upload)}>
          ✗ Reject
        </Button>
      </div>
    </CardFooter>
  </Card>
))}
```

**Benefits:**
- Streamlined KB update process
- No more email attachments
- Client visibility into processing status
- Audit trail of all KB changes

---

### 12.5 Changelog (Update History)

**Concept:**
Lista wszystkich zmian wprowadzonych w chatbocie klienta w formie czytelnych wpisów z datami. Gdy klient prosi o modyfikację, po jej wdrożeniu widzi wpis potwierdzający co zostało zrobione. Daje to poczucie kontroli i transparentności nad tym co się dzieje z botem.

**Implementacja:**

#### Backend Schema

**Nowa tabela:** `platform_changelog`
```python
PK: client_id (String)
SK: change_id (String) - timestamp-based dla chronological sorting

Atrybuty:
- client_id: "stride-services"
- change_id: "change_20251217_103045"
- created_at: ISO timestamp
- created_by: "admin_user_id" | "system"

# Change details
- change_type: "kb_update" | "personality_change" | "feature_enabled" |
              "config_change" | "bug_fix" | "performance_improvement"
- title: "Updated pricing information for 2025"
- description: "Added new pricing document (cennik_2025.pdf) to knowledge base. Chatbot now uses updated Q1 2025 prices."

# Metadata
- severity: "major" | "minor" | "patch"
- affected_areas: ["knowledge_base", "pricing"]
- related_upload_id: "upload_20251217_abc123"  # Optional FK

# Visual elements
- emoji: "💰"  # For visual categorization
- tags: ["pricing", "knowledge-base"]
```

#### Admin API Endpoints

```python
# Get changelog for client
GET /clients/{client_id}/changelog?limit=50
  Response: [
    {
      "change_id": "change_20251217_103045",
      "created_at": "2025-12-17T10:30:45Z",
      "change_type": "kb_update",
      "title": "Updated pricing information for 2025",
      "description": "Added new pricing document...",
      "severity": "major",
      "emoji": "💰"
    },
    ...
  ]

# Create changelog entry (platform team)
POST /clients/{client_id}/changelog
  Body: {
    "change_type": "kb_update",
    "title": "Updated pricing information",
    "description": "Full description...",
    "severity": "major",
    "tags": ["pricing"]
  }

# Owner: Get all changes across all clients
GET /admin/changelog?days=7
  # Recent changes across platform
```

**Automatic changelog generation:**
```python
# Triggered when KB upload is completed
def auto_create_changelog_entry(client_id: str, upload: dict):
    changelog_table.put_item(Item={
        "client_id": client_id,
        "change_id": f"change_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": "system",
        "change_type": "kb_update",
        "title": f"Knowledge base updated: {upload['file_name']}",
        "description": upload['review_notes'],
        "severity": "minor",
        "emoji": "📚",
        "tags": ["knowledge-base"],
        "related_upload_id": upload['upload_id']
    })

# Triggered when A/B test completes
def auto_create_changelog_for_ab_test(client_id: str, test: dict):
    changelog_table.put_item(Item={
        "client_id": client_id,
        "change_id": f"change_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": "system",
        "change_type": "personality_change",
        "title": f"Personality updated: {test['winner_variant_name']} is now default",
        "description": f"A/B test completed. Winner: {test['winner_variant_name']} with {test['winner_conversion_rate']}% conversion rate.",
        "severity": "major",
        "emoji": "🎭",
        "tags": ["personality", "ab-test"]
    })
```

#### Frontend UI

**Changelog Page:** `/app/(dashboard)/changelog/page.tsx`
```typescript
// Timeline view (like GitHub activity feed)
<div className="space-y-4">
  {changelog.map(entry => (
    <div className="flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-lg">
          {entry.emoji}
        </div>
        <div className="w-0.5 h-full bg-border mt-2" />
      </div>

      {/* Change card */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{entry.title}</h3>
              <p className="text-sm text-muted-foreground">
                {formatDate(entry.created_at)} • {entry.change_type}
              </p>
            </div>
            <Badge variant={
              entry.severity === 'major' ? 'default' :
              entry.severity === 'minor' ? 'secondary' : 'outline'
            }>
              {entry.severity}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{entry.description}</p>
          {entry.tags && (
            <div className="flex gap-2 mt-3">
              {entry.tags.map(tag => (
                <Badge variant="outline" key={tag}>#{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  ))}
</div>

// Filter by change type
<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">All Changes</TabsTrigger>
    <TabsTrigger value="kb_update">📚 Knowledge Base</TabsTrigger>
    <TabsTrigger value="personality_change">🎭 Personality</TabsTrigger>
    <TabsTrigger value="feature_enabled">✨ Features</TabsTrigger>
  </TabsList>
</Tabs>
```

**Dashboard - Recent Changes Widget:**
```typescript
<Card>
  <CardHeader>
    <h3 className="flex items-center gap-2">
      📋 Recent Updates
      <Badge>{recentChanges.length}</Badge>
    </h3>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      {recentChanges.slice(0, 3).map(change => (
        <div className="flex items-start gap-3 text-sm">
          <span className="text-lg">{change.emoji}</span>
          <div className="flex-1">
            <div className="font-medium">{change.title}</div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(change.created_at)} ago
            </div>
          </div>
        </div>
      ))}
    </div>
    <Button variant="ghost" size="sm" className="w-full mt-3">
      View All Changes →
    </Button>
  </CardContent>
</Card>
```

**Benefits:**
- Transparency - klient widzi co się dzieje z jego chatbotem
- Audit trail - historia wszystkich zmian
- Accountability - kto i kiedy coś zmienił
- Communication - eliminuje potrzebę statusowych emaili

---

## 13. IMPLEMENTATION PRIORITY (Advanced Features)

### Phase 1: Quick Wins (1-2 tygodnie)
1. **Changelog** - najłatwiejsze, największy impact na customer experience
2. **KB Upload** - streamlines workflow, reduces support burden

### Phase 2: Analytics Enhancements (2-3 tygodnie)
3. **Sentiment Analysis** - real-time mood tracking
4. **Trending Topics** - early warning system

### Phase 3: Optimization (3-4 tygodnie)
5. **A/B Testing** - data-driven personality optimization

**Total for all 5 features: ~8-10 tygodni**

---

## 14. TECH STACK ADDITIONS (Advanced Features)

**New dependencies:**
```bash
# Backend (Lambda)
pip install PyPDF2          # PDF text extraction
pip install python-docx     # DOCX parsing
pip install textract        # Generic document extraction (optional)

# Frontend
npm install react-day-picker date-fns  # Date range picker (już masz date-fns)
npm install recharts/funnel            # Funnel charts (dla A/B testing)
npm install react-dropzone             # File upload UI
```

**New AWS Services:**
- SNS Topics (notifications dla spikes, AB test completion)
- EventBridge Rules (hourly topic spike detection, sentiment aggregation)
- S3 Lifecycle Policies (auto-cleanup old uploads after 90 days)

**Cost estimation (advanced features):**
- SNS: $0.50/month (~1000 notifications)
- EventBridge: FREE (included in free tier)
- S3 storage: $1/month (~20GB uploads)
- Additional Lambda executions: $2/month
- **Total: ~$3.50/month** for advanced features

---

## 15. ADVANCED FEATURES SCHEMA SUMMARY

**New DynamoDB Tables:**
1. `platform_ab_tests` - A/B testing experiments
2. `platform_kb_uploads` - Knowledge base upload queue
3. `platform_changelog` - Update history

**Modified Tables:**
- `platform_analytics_events` - dodaj pola:
  - `metadata.ab_test_id`
  - `metadata.variant_assignment`
  - `metadata.sentiment`
  - `metadata.sentiment_score`
  - `metadata.topic`

**Total storage overhead:**
- ~500 KB/month per client (all advanced features combined)
- Negligible cost increase (~$0.01/client/month)

---

# 🚧 PROJEKT TYMCZASOWY - AKTUALNY (2026-01-06)

## 💡 O CO CHODZI? (Concept Overview)

### **Problem:**
Właściciele stron z chatbotem **nie wiedzą** o co użytkownicy najczęściej pytają. Nie widzą:
- Jakie informacje są trudne do znalezienia na stronie
- O co klienci pytają wielokrotnie (= content gap na stronie)
- Czy użytkownicy chcą kupić czy tylko się informują
- Gdzie chatbot nie umie dobrze odpowiedzieć (luki w knowledge base)

### **Rozwiązanie: Trending Questions/Topics**
System który **automatycznie analizuje** pytania zadawane chatbotowi i pokazuje w admin panelu:

```
📊 Top Pytania (ostatnie 14 dni):

1. 💰 Cennik (87 razy)
   "Ile kosztuje?", "Jaka cena?", "Cennik?"
   🎯 78% chce kupić, 22% tylko pyta
   💡 Insight: Ceny są trudne do znalezienia

2. 🕐 Godziny otwarcia (64 razy)
   "Kiedy jesteście otwarci?", "O której?"
   🎯 100% szuka info
   💡 Insight: Godziny nie są widoczne na stronie

3. 🚗 Parking (43 razy)
   "Czy jest parking?", "Gdzie zaparkować?"
   💡 Insight: Brak informacji o parkingu
```

### **Co to daje?**
✅ **Data-driven insights** - wiesz co poprawić na stronie (nie zgadywanie)
✅ **Wykrywanie braków** - widzisz gdzie chatbot nie umie odpowiedzieć
✅ **Intent analysis** - wiesz czy ludzie chcą kupić czy tylko szukają info
✅ **Trends** - widzisz czy pytania rosną/spadają w czasie
✅ **Auto-filtering** - AI pomija śmieci (hej, spam, przekleństwa)

### **Jak to działa?**
1. **Chatbot zbiera** pytania użytkowników (automatycznie, w tle)
2. **AI analizuje** (raz dziennie) - grupuje podobne pytania
3. **Admin panel pokazuje** top pytania + insights + luki w KB
4. **Owner widzi** co poprawić na stronie / w chatbocie

### **Koszt:** ~$0.60/miesiąc (Claude Haiku analysis)

---

## ⚠️ UWAGA
**Gdy wszystkie checkboxy poniżej będą odznaczone ✅ = projekt zakończony.**
**Wtedy należy:**
1. Zapytać Dominika czy skompresować tę sekcję
2. Przenieść do archiwum lub usunąć
3. Zaktualizować main plan

---

## 📋 MVP FEATURES - DO ZREALIZOWANIA

### ✅ Zrealizowane (MVP Base)
- [x] Backend Admin API deployed (Lambda)
- [x] Frontend Admin Panel deployed (Amplify)
- [x] AWS Cognito Auth (user: jakub@stride-services.pl)
- [x] Dashboard (stats cards + charts)
- [x] Conversations page (lista + details)
- [x] Appointments page (lista + filters)
- [x] Platform Analytics integration (chatbot → DynamoDB)
- [x] DynamoDB tables: `clients_registry`, `platform_analytics_events`

---

## 🔥 TRENDING QUESTIONS/TOPICS - Basic Package ($0.60/month)

**Status:** 🚧 W trakcie implementacji (2026-01-06)

### **Cel:**
Auto-discover najczęściej zadawane pytania przez użytkowników chatbota + wykryj luki w knowledge base + intent analysis.

### **Funkcjonalność:**
- ✅ Grupowanie podobnych pytań (AI clustering)
- ✅ Top questions ranking (z smart threshold - tylko znaczące)
- ✅ Gaps detection (heuristic - pytania bez dobrej odpowiedzi)
- ✅ Intent analysis (keyword-based: buying/comparing/info)
- ✅ Trend detection (czy pytania rosną/spadają)
- ❌ ~~Sentiment analysis~~ (wyrzucone, niepotrzebne)

### **Tech Stack:**
- Lambda (scheduled daily): AI analysis + pre-filtering
- DynamoDB table: `platform_trending_topics`
- Claude Haiku dla clustering pytań
- Frontend: `/insights` lub `/trending-questions` page

### **Cost:** ~$0.60/month
- Daily AI analysis: $0.02/day
- Weekly full re-analysis: $0.10/week

---

### **Backend Tasks:**

#### 1. Pre-filtering (local, free)
- [x] Stwórz funkcję `filter_junk_messages()` 
  - [x] Filter: powitania (hej, cześć, hello)
  - [x] Filter: single-word junk (jak?, co?, ok?)
  - [x] Filter: przekleństwa
  - [x] Filter: losowe znaki (>30% non-alphanumeric)
  - [x] Filter: za krótkie (<5 chars)

#### 2. DynamoDB Schema
- [x] Create table: `platform_trending_topics`
  ```
  PK: client_id (String)
  SK: topic_id (String)
  
  Attributes:
  - topic_name: "Pricing"
  - question_examples: ["ile kosztuje?", "jaka cena?"]
  - count: 87
  - trend: "up" | "down" | "stable"
  - intent_breakdown: {buying: 78%, info: 22%}
  - last_updated: timestamp
  - period: "2026-01-01_to_2026-01-14" (14 days)
  ```

#### 3. Lambda - Daily Analysis
- [x] Create Lambda: `trending-topics-analyzer`
  - [x] Trigger: EventBridge (cron: daily at 2 AM)
  - [x] Load conversations from last 24h
  - [x] Pre-filter junk messages
  - [x] Send clean questions to Claude Haiku for grouping
  - [x] Save topics to `platform_trending_topics`
  - [x] Update trends (compare with previous day)

#### 4. Lambda - Weekly Full Re-analysis
- [ ] Create Lambda: `trending-topics-full-reanalysis`
  - [ ] Trigger: EventBridge (cron: weekly Sunday 3 AM)
  - [ ] Load ALL conversations from last 14 days
  - [ ] Full re-clustering (refresh topics)
  - [ ] Detect new topics, archive old topics

#### 5. Gaps Detection (Heuristic)
- [x] Add function: `detect_gap(conversation)`
  - [x] Indicator 1: Bot says "nie wiem", "nie jestem pewien"
  - [x] Indicator 2: Bot response < 50 chars
  - [x] Indicator 3: Bot escalates to human
  - [x] Save gaps to separate field in topics table

#### 6. Intent Analysis (Keyword-based)
- [x] Add function: `detect_intent(message)`
  - [x] Buying intent: "kupić", "zamówić", "ile kosztuje", "cena"
  - [x] Comparing: "różnica", "porównaj", "lepszy", "vs"
  - [x] Info seeking: default
  - [x] Track intent distribution per topic

#### 7. Smart Threshold Algorithm
- [x] Add function: `get_significant_topics(topics)`
  - [x] Sort topics by count DESC
  - [x] Find biggest gap (drop ratio >= 2.5x)
  - [x] Return only top topics above gap
  - [x] Max 10 topics, min 3 topics

#### 8. Admin API Endpoints
- [x] `GET /clients/{client_id}/trending-topics`
  - [x] Query `platform_trending_topics` for client
  - [x] Apply smart threshold
  - [x] Return JSON with topics + gaps + intent breakdown
- [x] `GET /clients/{client_id}/trending-topics/gaps`
  - [x] Return only gaps (knowledge base holes)
- [x] `POST /clients/{client_id}/trending-topics/analyze`
  - [x] Manual trigger for on-demand analysis

---

### **Frontend Tasks:**

#### 9. Trending Questions Page
- [x] Create page: `/app/(dashboard)/insights/page.tsx`
  - [x] Header: "Trending Questions (Last 14 days)"
  - [x] Stats summary cards:
    - [x] Total unique questions
    - [x] Top topic count
    - [x] Gaps detected count
  - [x] Main section: Topics list
    - [x] Topic card with:
      - [x] Icon + topic name
      - [x] Question count
      - [x] Example questions (3 max)
      - [x] Progress bar (% of total)
      - [x] Trend indicator (↗️ up, ↘️ down, → stable)
  - [x] Gaps section:
    - [x] List of questions without good answers
    - [x] Bot's response preview
    - [ ] "Add to KB" suggestion button (future feature)


#### 9.3 Smart Insights & Categories (New Feature)
- [x] Backend: Universal Smart Insight generation (AI hints)
- [x] Backend: Topic Categorization (Pricing, Features, etc.)
- [x] Frontend: Category Pie Chart (Weekly view)
- [x] Frontend: Top Mover Card (Weekly view)
- [x] Frontend: Smart Insight Card (Daily view)

#### 10. API Integration
- [x] Create API function: `getTrendingTopics(clientId)`
- [x] Create API function: `getGaps(clientId)`
- [x] Add types to `lib/types.ts`

#### 11. UI Components
- [x] Create component: `TrendingTopicCard`
  - [x] Display topic with examples
  - [x] Progress bar (% of total questions)
  - [x] Trend badge
- [x] Create component: `GapCard`
  - [x] Question + bot's poor response
  - [x] "Why gap?" explanation
  - [x] Suggestion CTA

#### 12. Navigation
- [x] Add to sidebar: "Insights" link with 🔥 icon

---

### **Testing & Deployment:**

#### 13. Backend Testing
- [x] Test pre-filtering with mock data
- [x] Test AI clustering (send 50 sample questions)
- [x] Test gaps detection heuristic
- [x] Test intent keywords
- [x] Test smart threshold algorithm
- [x] Verify DynamoDB writes
- [x] Test EventBridge triggers (manual invoke)

#### 14. Frontend Testing
- [x] Test API integration
- [x] Test loading states
- [x] Test empty states (no topics yet)
- [x] Test responsive layout
- [x] Test charts rendering

#### 15. Deploy
- [x] Deploy backend Lambda (ZIPs created)
- [ ] Create EventBridge rules (daily + weekly) - **USER ACTION REQUIRED**
- [x] Deploy frontend (git push → Amplify auto-deploy)
- [ ] Test end-to-end in production

#### 16. Cost Monitoring
- [ ] Monitor Lambda execution costs
- [ ] Monitor Bedrock API costs
- [ ] Verify cost stays under $1/month

---

## 📈 ANALYTICS PAGE - Extended Dashboard

**Status:** ⏸️ Następny w kolejce (po Trending Questions)

### **Cel:**
Rozszerzona analityka - więcej szczegółów niż podstawowy dashboard.

### Tasks:
- [ ] Backend: Extend `/stats` endpoint with more breakdowns
- [ ] Frontend: Create `/analytics` page
  - [ ] Date range picker
  - [ ] Hourly/daily/weekly breakdown charts
  - [ ] Cost breakdown szczegółowy
  - [ ] Filter by event type
  - [ ] Export to CSV (optional)

**Czas:** 2-3 dni

---

## 🎭 PERSONALITY TOURNAMENT - A/B Testing

**Status:** ⏸️ Do zrobienia później (po Analytics)

### **Cel:**
A/B test personality chatbota, auto-select best performer.

### Tasks:
- [ ] Backend: `platform_personality_variants` table
- [ ] Backend: A/B assignment logic
- [ ] Backend: Conversion tracking per variant
- [ ] Chatbot: Modify system prompt based on variant
- [ ] Frontend: Tournament UI
- [ ] Frontend: Variant editor
- [ ] Frontend: Results dashboard

**Czas:** 5-7 dni

---

## ✅ ZAKOŃCZENIE PROJEKTU

**Gdy wszystkie checkboxy powyżej są ✅:**

1. **Zapytaj Dominika:**
   - "Wszystkie MVP features zrobione! ✅"
   - "Czy skompresować tę sekcję do archiwum?"
   - "Czy przenieść do osobnego pliku 'completed-projects.md'?"
   - "Czy całkowicie usunąć z main planu?"

2. **Cleanup:**
   - Przenieś sekcję do archiwum
   - Zaktualizuj main plan z linkami do zrealizowanych features
   - Dodaj metryki sukcesu (cost, usage, feedback)

---

**Data rozpoczęcia:** 2026-01-06
**Szacowany czas:** ~10-12 dni (Trending Questions: 3-4 dni, Analytics: 2-3 dni, Personality: 5-7 dni)
**Budget:** $0.60-1.50/month operational cost

