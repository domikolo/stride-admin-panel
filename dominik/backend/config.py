"""
Configuration module for chatbot Lambda function.
Contains all constants, environment variables, and AWS client configurations.
"""

import os
import boto3
from botocore.config import Config
import logging

# Setup logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

# AWS Configuration
REGION = os.environ.get("REGION", "eu-central-1")

# S3 Knowledge Base
S3_BUCKET = os.environ["KB_BUCKET"]
S3_PREFIX = os.environ.get("KB_PREFIX", "")

# Claude/Bedrock Model
CLAUDE_MODEL_ID = os.environ.get(
    "CLAUDE_MODEL_ID",
    "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
)

# DynamoDB Tables
CONV_TABLE_NAME = os.environ["CONVERSATIONS_TABLE"]
APPOINTMENTS_TABLE = os.environ.get("APPOINTMENTS_TABLE", "appointments")

# Google Calendar Integration
GOOGLE_CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "")
GOOGLE_SERVICE_ACCOUNT_KEY = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY", "{}")

# Notification Services
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
SES_FROM_EMAIL = os.environ.get("SES_FROM_EMAIL", "")

# =============================================================================
# APPLICATION CONSTANTS
# =============================================================================

# TTL & Timeouts
TTL_SECONDS = int(os.environ.get("TTL_SECONDS", str(14 * 24 * 3600)))  # 14 days
APPOINTMENT_PENDING_TTL_SECONDS = 86400  # 24 hours

# Request Limits
MAX_QUERY_LENGTH = int(os.environ.get("MAX_QUERY_LENGTH", "2000"))
MAX_HISTORY_MESSAGES = int(os.environ.get("MAX_HISTORY_MESSAGES", "6"))
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "1024"))
SESSION_ID_MAX_LENGTH = int(os.environ.get("SESSION_ID_MAX_LENGTH", "50"))

# Rate Limiting
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "10"))

# Bedrock Settings
BEDROCK_TEMPERATURE = float(os.environ.get("BEDROCK_TEMPERATURE", "0.0"))

# Service Timeouts (seconds)
S3_TIMEOUT = int(os.environ.get("S3_TIMEOUT", "10"))
BEDROCK_TIMEOUT = int(os.environ.get("BEDROCK_TIMEOUT", "30"))
DYNAMODB_TIMEOUT = int(os.environ.get("DYNAMODB_TIMEOUT", "5"))

# Cache Settings
KB_CACHE_TTL = 300  # 5 minutes

# Retry Settings
RETRY_MAX_ATTEMPTS = 3
RETRY_BASE_DELAY = 0.1
RETRY_JITTER_MAX = 0.1

# Calendar Settings
MAX_AVAILABLE_SLOTS = 20

# Verification Code
VERIFICATION_CODE_LENGTH = 6

# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PROMPT_TEMPLATE = """Jesteś chatbotem Stride-Services, firmy specjalizującej się w tworzeniu spersonalizowanych chatbotów AI dla firm usługowych. Twoim celem jest odpowiadanie na pytania potencjalnych klientów w sposób profesjonalny, ale przystępny i przyjazny, jak „kulturalny ziomek".

Używaj języka prostego, klarownego, z nutą entuzjazmu dla AI jako przyszłości biznesu. Bazuj na dostarczonej bazie wiedzy (KB), która zawiera informacje o firmie, usługach, procesie współpracy, kosztach, korzyściach, przykładach i sposobach kontaktu.

WAŻNE - WYKRYWANIE INTENT SPOTKAŃ:
Jeśli użytkownik wyraża chęć umówienia się na spotkanie, konsultację, rozmowę lub wizytę, odpowiedz naturalnie ale DODAJ na końcu swojej odpowiedzi dokładnie ten marker: [APPOINTMENT_INTENT]

Przykłady kiedy dodać marker:
- "Chciałbym umówić się na spotkanie"
- "Czy moglibyśmy się spotkać?"
- "Potrzebuję konsultacji"
- "Chcę porozmawiać o współpracy"
- "Umówmy się na rozmowę"

NIE dodawaj markera gdy:
- Pytają o godziny pracy, adres, telefon, ceny
- Proszą o informacje bez wyrażania chęci spotkania
- Zadają pytania techniczne

ZASADY ODPOWIEDZI:
1. Odpowiadaj zwięźle, ale uwzględniając wszystkie kluczowe treści, dostosowując się do pytania
2. Podkreślaj personalizację, jakość i korzyści płynące z AI
3. Jeśli pytanie dotyczy demo lub portfolio, wspomnij o możliwości stworzenia prototypu w tydzień po rozmowie na Zoomie
4. W razie pytań o ceny, podaj widełki (budowa od 1600 zł, utrzymanie od 800 zł/miesiąc) i wspomnij o ofercie dla pierwszego klienta (pierwszy miesiąc pracy chatbota za darmo po opłaceniu budowy)
5. Zachęcaj do kontaktu w razie dodatkowych pytań
6. Jeśli pytanie jest niejasne, poproś o doprecyzowanie w uprzejmy sposób
7. Jeśli klient prosi o spotkanie, odpowiedz entuzjastycznie i dodaj marker [APPOINTMENT_INTENT]

KONTAKT: e-mail: jakub@stride-services.com, telefony: Dominik +48 728381170, Jakub +48 785226886"""

# =============================================================================
# AWS CLIENT CONFIGURATIONS
# =============================================================================

# S3 Configuration
s3_config = Config(
    region_name=REGION,
    connect_timeout=5,
    read_timeout=S3_TIMEOUT,
    retries={'max_attempts': 0}  # Use custom retry logic
)

# Bedrock Configuration
bedrock_config = Config(
    region_name=REGION,
    connect_timeout=5,
    read_timeout=BEDROCK_TIMEOUT,
    retries={'max_attempts': 0}
)

# DynamoDB Configuration
ddb_config = Config(
    region_name=REGION,
    connect_timeout=5,
    read_timeout=DYNAMODB_TIMEOUT,
    retries={'max_attempts': 0}
)

# =============================================================================
# AWS CLIENTS (Initialized once at module load)
# =============================================================================

s3 = boto3.client("s3", config=s3_config)
bedrock = boto3.client("bedrock-runtime", config=bedrock_config)
dynamodb_resource = boto3.resource("dynamodb", config=ddb_config)

# DynamoDB Tables
conversations_table = dynamodb_resource.Table(CONV_TABLE_NAME)
appointments_table = dynamodb_resource.Table(APPOINTMENTS_TABLE)

# Notification Clients
sns = boto3.client("sns", config=ddb_config)
ses = boto3.client("ses", config=ddb_config)

# CloudWatch (for custom metrics - optional)
try:
    cloudwatch = boto3.client("cloudwatch", region_name=REGION)
except Exception as e:
    logger.warning(f"CloudWatch client initialization failed: {e}")
    cloudwatch = None

# Log configuration status
logger.info("Configuration loaded successfully")
logger.info(f"Region: {REGION}")
logger.info(f"Model: {CLAUDE_MODEL_ID}")
logger.info(f"Conversations Table: {CONV_TABLE_NAME}")
logger.info(f"Appointments Table: {APPOINTMENTS_TABLE}")
