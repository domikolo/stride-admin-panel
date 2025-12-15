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
- [ ] FAQ generator Lambda (Claude analysis)
- [ ] FAQ page w client panel
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
9. ⏭️ **AWS Cognito setup** (auth dla admin panel)
10. ⏭️ **Admin API Lambda** (`/admin-panel-backend/`)
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
