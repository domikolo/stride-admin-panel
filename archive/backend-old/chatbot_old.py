import os
import json
import logging
import time
import base64
import re
import html
import random
import uuid
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from boto3.dynamodb.conditions import Key
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Debug Python path and available modules
import sys
logger.info(f"Python path: {sys.path}")

# Check what's available in site-packages or layers
try:
    import os
    layer_paths = [path for path in sys.path if 'opt' in path]
    logger.info(f"Layer paths found: {layer_paths}")
    
    for layer_path in layer_paths:
        try:
            contents = os.listdir(layer_path)
            logger.info(f"Contents of {layer_path}: {contents}")
        except:
            pass
except Exception as e:
    logger.error(f"Failed to check layer contents: {e}")

# Debug Google imports
try:
    from google.oauth2 import service_account
    logger.info("✅ Successfully imported google.oauth2.service_account")
except ImportError as e:
    logger.error(f"❌ Failed to import google.oauth2.service_account: {e}")

try:
    from googleapiclient.discovery import build
    logger.info("✅ Successfully imported googleapiclient.discovery.build")
except ImportError as e:
    logger.error(f"❌ Failed to import googleapiclient.discovery.build: {e}")

try:
    from googleapiclient import discovery
    logger.info("✅ Successfully imported googleapiclient.discovery")
except ImportError as e:
    logger.error(f"❌ Failed to import googleapiclient.discovery: {e}")

# Environment variables
REGION = os.environ.get("REGION", "eu-central-1")
S3_BUCKET = os.environ["KB_BUCKET"]
S3_PREFIX = os.environ.get("KB_PREFIX", "")
CLAUDE_MODEL_ID = os.environ.get(
    "CLAUDE_MODEL_ID",
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
)
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
CONV_TABLE_NAME = os.environ["CONVERSATIONS_TABLE"]
TTL_SECONDS = int(os.environ.get("TTL_SECONDS", str(14 * 24 * 3600)))

# Appointment booking environment variables
APPOINTMENTS_TABLE = os.environ.get("APPOINTMENTS_TABLE", "appointments")
GOOGLE_CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "")
GOOGLE_SERVICE_ACCOUNT_KEY = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY", "{}")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
SES_FROM_EMAIL = os.environ.get("SES_FROM_EMAIL", "")

# Configurable limits
MAX_QUERY_LENGTH = int(os.environ.get("MAX_QUERY_LENGTH", "2000"))
MAX_HISTORY_MESSAGES = int(os.environ.get("MAX_HISTORY_MESSAGES", "6"))
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "1024"))
BEDROCK_TEMPERATURE = float(os.environ.get("BEDROCK_TEMPERATURE", "0.0"))
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "10"))
SESSION_ID_MAX_LENGTH = int(os.environ.get("SESSION_ID_MAX_LENGTH", "50"))

# Timeout settings
S3_TIMEOUT = int(os.environ.get("S3_TIMEOUT", "10"))
BEDROCK_TIMEOUT = int(os.environ.get("BEDROCK_TIMEOUT", "30"))
DYNAMODB_TIMEOUT = int(os.environ.get("DYNAMODB_TIMEOUT", "5"))

# AWS clients with timeouts
from botocore.config import Config

s3_config = Config(
    region_name=REGION,
    connect_timeout=5,
    read_timeout=S3_TIMEOUT,
    retries={'max_attempts': 0}  # Disable built-in retries, use our own
)

bedrock_config = Config(
    region_name=REGION,
    connect_timeout=5,
    read_timeout=BEDROCK_TIMEOUT,
    retries={'max_attempts': 0}
)

ddb_config = Config(
    region_name=REGION,
    connect_timeout=5,
    read_timeout=DYNAMODB_TIMEOUT,
    retries={'max_attempts': 0}
)

s3 = boto3.client("s3", config=s3_config)
bedrock = boto3.client("bedrock-runtime", config=bedrock_config)
ddb = boto3.resource("dynamodb", config=ddb_config)
conv_table = ddb.Table(CONV_TABLE_NAME)

# Additional AWS clients for appointment booking
sns = boto3.client("sns", config=ddb_config)
ses = boto3.client("ses", config=ddb_config)
appointments_table = ddb.Table(APPOINTMENTS_TABLE)

# Log environment variables status (without exposing sensitive data)
logger.info("Environment variables status:")
logger.info(f"- APPOINTMENTS_TABLE: {'✅ SET' if APPOINTMENTS_TABLE else '❌ MISSING'}")
logger.info(f"- GOOGLE_CALENDAR_ID: {'✅ SET' if GOOGLE_CALENDAR_ID else '❌ MISSING'}")
logger.info(f"- GOOGLE_SERVICE_ACCOUNT_KEY: {'✅ SET' if GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SERVICE_ACCOUNT_KEY != '{}' else '❌ MISSING'}")
logger.info(f"- SNS_TOPIC_ARN: {'✅ SET' if SNS_TOPIC_ARN else '❌ MISSING'}")
logger.info(f"- SES_FROM_EMAIL: {'✅ SET' if SES_FROM_EMAIL else '❌ MISSING'}")


def load_kb_from_s3(bucket: str, prefix: str) -> str:
    """Load and concatenate all text files from an S3 bucket.
    
    Args:
        bucket: S3 bucket name containing knowledge base documents
        prefix: Optional S3 key prefix to filter documents
        
    Returns:
        Concatenated text content from all documents, empty string on failure
        
    Example:
        kb_text = load_kb_from_s3("my-kb-bucket", "docs/")
    """
    def _list_objects():
        paginator = s3.get_paginator("list_objects_v2")
        return paginator.paginate(Bucket=bucket, Prefix=prefix)
    
    try:
        pages = retry_with_backoff(_list_objects)
        parts = []
        for page in pages:
            for obj in page.get("Contents", []):
                key = obj["Key"]
                try:
                    def _get_object():
                        return s3.get_object(Bucket=bucket, Key=key)
                    
                    resp = retry_with_backoff(_get_object)
                    text = resp["Body"].read().decode("utf-8")
                    parts.append(f"--- Dokument: {key} ---\n{text}\n")
                except (BotoCoreError, ClientError) as e:
                    logger.error(f"Nie uda\u0142o si\u0119 pobra\u0107 {key}: {e}")
        return "\n".join(parts)
    except Exception as e:
        logger.error(f"Failed to load KB from S3: {e}")
        return ""


def save_message(session_id: str, role: str, text: str, base_ts: int) -> None:
    """Save a single message to DynamoDB with automatic TTL cleanup.

    Args:
        session_id: Unique session identifier  
        role: Message role ('user' or 'assistant')
        text: Message content
        base_ts: Unix timestamp for message ordering
        
    Note:
        The timestamp sort key is stored as a string to avoid potential
        number precision issues with large integers in DynamoDB.
        
    Example:
        save_message("session123", "user", "Hello", 1640995200)
    """
    item = {
        "session_id": session_id,
        "timestamp": str(base_ts),
        "role": role,
        "text": text,
        "ttl": base_ts + TTL_SECONDS,
    }
    
    def _put_item():
        return conv_table.put_item(Item=item)
    
    try:
        retry_with_backoff(_put_item)
    except Exception as e:
        logger.error(f"Failed to save message: {e}")


def get_recent_messages(session_id: str, limit: int = MAX_HISTORY_MESSAGES) -> list:
    """Fetch the most recent messages from DynamoDB for a session.
    
    Args:
        session_id: Unique session identifier
        limit: Maximum number of messages to retrieve
        
    Returns:
        List of message dicts with 'role' and 'content' keys, 
        sorted chronologically (oldest first)
        
    Example:
        messages = get_recent_messages("session123", 10)
        # Returns: [{"role": "user", "content": "Hello"}, ...]
    """
    def _query():
        return conv_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            ScanIndexForward=False,  # descending order by timestamp
            Limit=limit,
        )
    
    try:
        resp = retry_with_backoff(_query)
        items = resp.get("Items", [])
        # sort chronologically
        items.sort(key=lambda i: int(i.get("timestamp", "0")))
        return [
            {"role": itm.get("role", "user"), "content": itm.get("text", "")}
            for itm in items
        ]
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        return []


def retry_with_backoff(func, max_retries=3, base_delay=0.1):
    """Retry function with exponential backoff for AWS service calls.
    
    Args:
        func: Function to retry (must raise BotoCoreError/ClientError on failure)
        max_retries: Maximum number of retry attempts (default: 3)
        base_delay: Base delay in seconds, doubled with each retry (default: 0.1)
        
    Returns:
        Function result on success
        
    Raises:
        Original exception after max retries exceeded
        
    Example:
        result = retry_with_backoff(lambda: s3.get_object(Bucket=b, Key=k))
    """
    for attempt in range(max_retries):
        try:
            return func()
        except (BotoCoreError, ClientError) as e:
            if attempt == max_retries - 1:
                raise e
            
            # Check if it's a retryable error
            error_code = getattr(e.response.get('Error', {}), 'Code', '') if hasattr(e, 'response') else ''
            if error_code and not error_code.startswith(('5', 'Throttling', 'ServiceUnavailable')):
                raise e
            
            delay = base_delay * (2 ** attempt) + random.uniform(0, 0.1)
            logger.info(f"Retrying after {delay:.2f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(delay)
    

def sanitize_input(text: str) -> str:
    """Sanitize user input by removing/escaping potentially harmful characters.
    
    Args:
        text: Raw user input string
        
    Returns:
        Sanitized text safe for processing
        
    Example:
        clean = sanitize_input("Hello <script>alert(1)</script> world!")
        # Returns: "Hello &lt;script&gt;alert(1)&lt;/script&gt; world!"
    """
    # Remove null bytes and control characters (except newlines and tabs)
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
    # Escape HTML entities
    text = html.escape(text)
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def check_rate_limit(session_id: str) -> bool:
    """Check if session is within configured rate limit.
    
    Args:
        session_id: Unique session identifier
        
    Returns:
        True if session is within rate limit, False if exceeded
        
    Example:
        if not check_rate_limit("session123"):
            return rate_limit_error_response()
    """
    current_time = int(time.time())
    minute_window = current_time - 60
    
    def _query_rate_limit():
        return conv_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id) & Key("timestamp").gt(str(minute_window)),
            FilterExpression="attribute_exists(#role)",
            ExpressionAttributeNames={"#role": "role"},
            Select="COUNT"
        )
    
    try:
        resp = retry_with_backoff(_query_rate_limit)
        request_count = resp.get("Count", 0)
        return request_count < RATE_LIMIT_PER_MINUTE
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        return True  # Allow request if check fails


# =============================================================================
# GOOGLE CALENDAR API FUNCTIONS
# =============================================================================

def get_calendar_service():
    """Create and return Google Calendar API service object."""
    try:
        # Try to import required modules locally if not available globally
        try:
            if 'service_account' not in globals():
                from google.oauth2 import service_account as sa_module
                logger.info("✅ Imported service_account locally")
                service_account_ref = sa_module
            else:
                service_account_ref = service_account
                
            if 'build' not in globals():
                from googleapiclient.discovery import build as build_func
                logger.info("✅ Imported build locally") 
                build_ref = build_func
            else:
                build_ref = build
                
        except ImportError as e:
            logger.error(f"Failed to import Google libraries: {e}")
            return None
        
        # Check if we have the required environment variables
        if not GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY == "{}":
            logger.error("GOOGLE_SERVICE_ACCOUNT_KEY not configured")
            return None
            
        if not GOOGLE_CALENDAR_ID:
            logger.error("GOOGLE_CALENDAR_ID not configured")
            return None
        
        logger.info("Attempting to create Google Calendar service...")
        
        # Parse the service account credentials
        credentials_info = json.loads(GOOGLE_SERVICE_ACCOUNT_KEY)
        logger.info(f"Parsed credentials for project: {credentials_info.get('project_id', 'unknown')}")
        
        # Create credentials object
        credentials = service_account_ref.Credentials.from_service_account_info(
            credentials_info, 
            scopes=['https://www.googleapis.com/auth/calendar']
        )
        logger.info("✅ Service account credentials created successfully")
        
        # Build the service
        service = build_ref('calendar', 'v3', credentials=credentials)
        logger.info("✅ Google Calendar service created successfully")
        
        return service
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY: {e}")
        return None
    except Exception as e:
        logger.error(f"Calendar auth failed: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        return None


def get_available_slots(date_start: str, date_end: str) -> list:
    """Get available appointment slots for date range.
    
    Args:
        date_start: ISO date string (YYYY-MM-DD)
        date_end: ISO date string (YYYY-MM-DD)
        
    Returns:
        List of available datetime slots in ISO format
    """
    try:
        service = get_calendar_service()
        if not service:
            logger.warning("Calendar service unavailable, using fallback slots")
            return generate_fallback_slots(date_start, date_end)
        
        # Convert dates to datetime objects for the date range
        start_date = datetime.fromisoformat(date_start)
        end_date = datetime.fromisoformat(date_end)
        
        # Query busy times from Google Calendar
        freebusy_query = {
            'timeMin': start_date.replace(hour=9, minute=0).isoformat() + 'Z',
            'timeMax': end_date.replace(hour=17, minute=0).isoformat() + 'Z',
            'items': [{'id': GOOGLE_CALENDAR_ID}]
        }
        
        freebusy_result = service.freebusy().query(body=freebusy_query).execute()
        busy_periods = freebusy_result.get('calendars', {}).get(GOOGLE_CALENDAR_ID, {}).get('busy', [])
        
        # Generate available slots (9 AM - 5 PM, 30min intervals)
        available_slots = []
        current_date = start_date
        
        while current_date <= end_date:
            # Skip weekends
            if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                current_date += timedelta(days=1)
                continue
                
            # Generate time slots for this day (9 AM - 5 PM)
            for hour in range(9, 17):
                for minute in [0, 30]:
                    slot_time = current_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    
                    # Check if this slot conflicts with busy periods
                    slot_end = slot_time + timedelta(hours=1)
                    is_busy = False
                    
                    for busy_period in busy_periods:
                        busy_start = datetime.fromisoformat(busy_period['start'].replace('Z', '+00:00'))
                        busy_end = datetime.fromisoformat(busy_period['end'].replace('Z', '+00:00'))
                        
                        # Check for overlap
                        if slot_time < busy_end and slot_end > busy_start:
                            is_busy = True
                            break
                    
                    if not is_busy:
                        available_slots.append(slot_time.isoformat())
            
            current_date += timedelta(days=1)
        
        return available_slots[:20]  # Limit to 20 slots for performance
        
    except Exception as e:
        logger.error(f"Failed to get available slots: {e}")
        return generate_fallback_slots(date_start, date_end)


def generate_fallback_slots(date_start: str, date_end: str) -> list:
    """Generate fallback available slots when Google Calendar is unavailable."""
    available_slots = []
    start_date = datetime.fromisoformat(date_start)
    end_date = datetime.fromisoformat(date_end)
    
    current_date = start_date
    while current_date <= end_date and len(available_slots) < 10:
        # Skip weekends
        if current_date.weekday() < 5:  # Monday = 0, Friday = 4
            # Add a few random slots for each weekday
            for hour in [10, 14, 16]:
                slot_time = current_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                available_slots.append(slot_time.isoformat())
        
        current_date += timedelta(days=1)
    
    return available_slots


def create_calendar_event(datetime_str: str, contact_info: str, appointment_id: str) -> str:
    """Create an event in Google Calendar.
    
    Args:
        datetime_str: ISO datetime string for the appointment
        contact_info: Customer contact information
        appointment_id: Unique appointment identifier
        
    Returns:
        Google Calendar event ID or empty string on failure
    """
    try:
        service = get_calendar_service()
        if not service:
            logger.warning("Calendar service unavailable, cannot create event")
            return ""
        
        # Parse datetime and calculate end time (1 hour later)
        start_time = datetime.fromisoformat(datetime_str)
        end_time = start_time + timedelta(hours=1)
        
        event = {
            'summary': 'Spotkanie konsultacyjne - Stride Services',
            'description': f'Kontakt: {contact_info}\nID spotkania: {appointment_id}',
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': 'Europe/Warsaw'
            },
            'end': {
                'dateTime': end_time.isoformat(), 
                'timeZone': 'Europe/Warsaw'
            },
            'attendees': [],
            'reminders': {
                'useDefault': True
            }
        }
        
        result = service.events().insert(calendarId=GOOGLE_CALENDAR_ID, body=event).execute()
        event_id = result.get('id', '')
        
        logger.info(f"Calendar event created successfully: {event_id}")
        return event_id
        
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")
        return ""


def test_google_calendar_connection():
    """Test Google Calendar API connection and basic functionality."""
    try:
        logger.info("🧪 Testing Google Calendar connection...")
        
        service = get_calendar_service()
        if not service:
            logger.error("❌ Failed to get calendar service")
            return False
        
        # Test basic calendar access
        calendar_info = service.calendars().get(calendarId=GOOGLE_CALENDAR_ID).execute()
        logger.info(f"✅ Successfully connected to calendar: {calendar_info.get('summary', 'Unknown')}")
        
        # Test freebusy query (basic functionality test)
        import datetime as dt
        now = dt.datetime.utcnow()
        tomorrow = now + dt.timedelta(days=1)
        
        freebusy_query = {
            'timeMin': now.isoformat() + 'Z',
            'timeMax': tomorrow.isoformat() + 'Z',
            'items': [{'id': GOOGLE_CALENDAR_ID}]
        }
        
        freebusy_result = service.freebusy().query(body=freebusy_query).execute()
        logger.info("✅ Freebusy query successful")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Google Calendar connection test failed: {e}")
        return False


# =============================================================================
# APPOINTMENT MANAGEMENT FUNCTIONS  
# =============================================================================

def generate_verification_code() -> str:
    """Generate a 6-digit verification code."""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])


def create_appointment(session_id: str, datetime_str: str, contact_info: str, contact_type: str) -> dict:
    """Create a pending appointment in DynamoDB.
    
    Args:
        session_id: User session identifier
        datetime_str: ISO datetime string for the appointment
        contact_info: Email or phone number for verification
        contact_type: 'email' or 'phone'
        
    Returns:
        Dict with appointment_id and verification_code, empty dict on failure
    """
    try:
        appointment_id = str(uuid.uuid4())
        verification_code = generate_verification_code()
        
        item = {
            'appointment_id': appointment_id,
            'session_id': session_id,
            'datetime': datetime_str,
            'contact_info': contact_info,
            'contact_type': contact_type,
            'verification_code': verification_code,
            'status': 'pending',
            'created_at': int(time.time()),
            'ttl': int(time.time()) + 1440  # 24 hours TTL
        }
        
        def _put_appointment():
            return appointments_table.put_item(Item=item)
        
        retry_with_backoff(_put_appointment)
        
        logger.info(f"Appointment created: {appointment_id}")
        return {
            'appointment_id': appointment_id,
            'verification_code': verification_code
        }
        
    except Exception as e:
        logger.error(f"Failed to create appointment: {e}")
        return {}


def verify_appointment(appointment_id: str, verification_code: str) -> bool:
    """Verify appointment code and create Google Calendar event.
    
    Args:
        appointment_id: Unique appointment identifier
        verification_code: 6-digit verification code
        
    Returns:
        True if verification successful and event created, False otherwise
    """
    try:
        # Get appointment from DynamoDB
        def _get_appointment():
            return appointments_table.get_item(
                Key={
                    'appointment_id': appointment_id,
                    'session_id': session_id  # We'll need session_id as sort key
                }
            )
        
        # For now, scan by appointment_id since we don't have session_id here
        def _scan_appointment():
            return appointments_table.scan(
                FilterExpression="appointment_id = :aid",
                ExpressionAttributeValues={":aid": appointment_id}
            )
        
        response = retry_with_backoff(_scan_appointment)
        items = response.get('Items', [])
        
        if not items:
            logger.warning(f"Appointment not found: {appointment_id}")
            return False
        
        appointment = items[0]
        
        # Verify code and status
        if appointment.get('verification_code') != verification_code:
            logger.warning(f"Invalid verification code for appointment: {appointment_id}")
            return False
        
        if appointment.get('status') != 'pending':
            logger.warning(f"Appointment not in pending status: {appointment_id}")
            return False
        
        # Create Google Calendar event
        event_id = create_calendar_event(
            appointment['datetime'],
            appointment['contact_info'],
            appointment_id
        )
        
        if not event_id:
            logger.error(f"Failed to create calendar event for appointment: {appointment_id}")
            return False
        
        # Update appointment status
        def _update_appointment():
            return appointments_table.update_item(
                Key={
                    'appointment_id': appointment_id,
                    'session_id': appointment['session_id']
                },
                UpdateExpression='SET #status = :status, google_event_id = :event_id, verified_at = :verified_at',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'verified',
                    ':event_id': event_id,
                    ':verified_at': int(time.time())
                }
            )
        
        retry_with_backoff(_update_appointment)
        
        logger.info(f"Appointment verified successfully: {appointment_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to verify appointment: {e}")
        return False


def get_appointment_by_id(appointment_id: str) -> dict:
    """Get appointment details by ID.
    
    Args:
        appointment_id: Unique appointment identifier
        
    Returns:
        Appointment dict or empty dict if not found
    """
    try:
        def _scan_appointment():
            return appointments_table.scan(
                FilterExpression="appointment_id = :aid",
                ExpressionAttributeValues={":aid": appointment_id}
            )
        
        response = retry_with_backoff(_scan_appointment)
        items = response.get('Items', [])
        
        return items[0] if items else {}
        
    except Exception as e:
        logger.error(f"Failed to get appointment: {e}")
        return {}


# =============================================================================
# NOTIFICATION FUNCTIONS  
# =============================================================================

def send_verification_sms(phone: str, verification_code: str) -> bool:
    """Send verification code via SMS using SNS.
    
    Args:
        phone: Phone number to send SMS to
        verification_code: 6-digit verification code
        
    Returns:
        True if SMS sent successfully, False otherwise
    """
    try:
        if not SNS_TOPIC_ARN:
            logger.warning("SNS_TOPIC_ARN not configured, skipping SMS")
            return False
        
        # Clean and validate phone number
        clean_phone = phone.strip()
        logger.info(f"📱 Attempting to send SMS to: {clean_phone}")
        
        # Ensure proper international format
        if not clean_phone.startswith('+'):
            if clean_phone.startswith('48'):
                clean_phone = '+' + clean_phone
            elif clean_phone.startswith('0'):
                clean_phone = '+48' + clean_phone[1:]  # Remove leading 0, add +48
            else:
                clean_phone = '+48' + clean_phone  # Assume Polish number
        
        logger.info(f"📱 Formatted phone number: {clean_phone}")
        
        message = f"Stride Services - Kod weryfikacyjny spotkania: {verification_code}. Kod ważny przez 5 minut."
        logger.info(f"📱 SMS message: {message}")
        
        def _send_sms():
            # Use direct SMS instead of topic for verification messages
            return sns.publish(
                PhoneNumber=clean_phone,
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional'  # Higher priority than Promotional
                    }
                }
            )
        
        response = retry_with_backoff(_send_sms)
        message_id = response.get('MessageId')
        
        logger.info(f"✅ SMS sent successfully - MessageId: {message_id}")
        logger.info(f"✅ SMS response: {response}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send SMS to {phone}: {e}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        return False


def send_verification_email(email: str, verification_code: str) -> bool:
    """Send verification code via email using SES.
    
    Args:
        email: Email address to send verification to
        verification_code: 6-digit verification code
        
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        if not SES_FROM_EMAIL:
            logger.warning("SES_FROM_EMAIL not configured, skipping email")
            return False
        
        subject = "Stride Services - Kod weryfikacyjny spotkania"
        body = f"""
Dziękujemy za umówienie spotkania z Stride Services!

Twój kod weryfikacyjny: {verification_code}

Wprowadź ten kod w chatbocie aby potwierdzić spotkanie.
Kod jest ważny przez 5 minut.

--
Zespół Stride Services
        """.strip()
        
        def _send_email():
            return ses.send_email(
                Source=SES_FROM_EMAIL,
                Destination={'ToAddresses': [email]},
                Message={
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Text': {'Data': body, 'Charset': 'UTF-8'}}
                }
            )
        
        response = retry_with_backoff(_send_email)
        message_id = response.get('MessageId')
        
        logger.info(f"Email sent successfully: {message_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_appointment_confirmation(email: str, appointment_details: dict) -> bool:
    """Send appointment confirmation email.
    
    Args:
        email: Email address to send confirmation to
        appointment_details: Dict with appointment info
        
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        if not SES_FROM_EMAIL:
            logger.warning("SES_FROM_EMAIL not configured, skipping confirmation email")
            return False
        
        # Format datetime for display
        appointment_time = datetime.fromisoformat(appointment_details['datetime'])
        formatted_date = appointment_time.strftime("%d.%m.%Y")
        formatted_time = appointment_time.strftime("%H:%M")
        
        subject = "Stride Services - Potwierdzenie spotkania"
        body = f"""
Spotkanie zostało pomyślnie zarezerwowane!

SZCZEGÓŁY SPOTKANIA:
Data: {formatted_date}
Godzina: {formatted_time}
Czas trwania: 1 godzina
Typ: Konsultacja biznesowa

KONTAKT:
Email: {appointment_details['contact_info']}
ID spotkania: {appointment_details['appointment_id']}

Spotkanie zostało dodane do naszego kalendarza. Skontaktujemy się z Tobą w przypadku konieczności zmiany terminu.

--
Zespół Stride Services
        """.strip()
        
        def _send_confirmation():
            return ses.send_email(
                Source=SES_FROM_EMAIL,
                Destination={'ToAddresses': [email]},
                Message={
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Text': {'Data': body, 'Charset': 'UTF-8'}}
                }
            )
        
        response = retry_with_backoff(_send_confirmation)
        message_id = response.get('MessageId')
        
        logger.info(f"Confirmation email sent successfully: {message_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")
        return False


def validate_request(user_query: str, session_id: str, request_id: str) -> dict:
    """Validate user input and return error response if invalid, None if valid."""
    if not user_query:
        logger.warning("Missing query", extra={"request_id": request_id, "event_type": "validation_error"})
        return {"statusCode": 400, "body": json.dumps({"error": "Missing 'query'"})}
        
    if len(user_query) > MAX_QUERY_LENGTH:
        logger.warning("Query too long", extra={
            "request_id": request_id, 
            "event_type": "validation_error",
            "query_length": len(user_query)
        })
        return {"statusCode": 400, "body": json.dumps({"error": f"Query too long (max {MAX_QUERY_LENGTH} characters)"})}
    
    if not re.match(rf'^[a-zA-Z0-9_-]{{1,{SESSION_ID_MAX_LENGTH}}}$', session_id):
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid session_id format"})}
    
    return None


def parse_request_body(event) -> dict:
    """Parse request body from Lambda event."""
    payload = {}
    if "body" in event:
        body = event["body"]
        if isinstance(body, str):
            try:
                if event.get("isBase64Encoded"):
                    body = base64.b64decode(body).decode("utf-8")
                payload = json.loads(body)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON body")
        elif isinstance(body, dict):
            payload = body
    else:
        payload = event
    return payload


def load_context_data(session_id: str, request_id: str) -> tuple:
    """Load knowledge base and conversation history.
    
    Args:
        session_id: Unique session identifier
        request_id: Request ID for logging
        
    Returns:
        Tuple of (kb_text, history_messages, timings_dict)
    """
    timings = {}
    
    # Load knowledge base from S3 (graceful degradation)
    kb_load_start = time.time()
    kb_text = load_kb_from_s3(S3_BUCKET, S3_PREFIX)
    timings['kb_load_time'] = time.time() - kb_load_start
    
    if not kb_text:
        logger.warning("KB not available, continuing without knowledge base", extra={
            "request_id": request_id,
            "event_type": "kb_unavailable",
            "kb_load_time": timings['kb_load_time']
        })
        kb_text = "Knowledge base temporarily unavailable."
    else:
        logger.info("KB loaded successfully", extra={
            "request_id": request_id,
            "event_type": "kb_loaded",
            "kb_load_time": timings['kb_load_time'],
            "kb_size": len(kb_text)
        })

    # Fetch recent conversation history for context (graceful degradation)
    history_load_start = time.time()
    history_messages = get_recent_messages(session_id, limit=MAX_HISTORY_MESSAGES)
    timings['history_load_time'] = time.time() - history_load_start
    
    if not history_messages:
        logger.warning("History not available, continuing without context", extra={
            "request_id": request_id,
            "session_id": session_id,
            "event_type": "history_unavailable",
            "history_load_time": timings['history_load_time']
        })
    else:
        logger.info("History loaded successfully", extra={
            "request_id": request_id,
            "session_id": session_id,
            "event_type": "history_loaded",
            "history_load_time": timings['history_load_time'],
            "message_count": len(history_messages)
        })
    
    return kb_text, history_messages, timings


def invoke_claude_model(user_query: str, kb_text: str, history_messages: list, 
                       session_id: str, request_id: str) -> tuple:
    """Invoke Claude model via Bedrock and return response.
    
    Args:
        user_query: User's question
        kb_text: Knowledge base content  
        history_messages: Conversation history
        session_id: Session identifier
        request_id: Request ID for logging
        
    Returns:
        Tuple of (answer_text, bedrock_time)
    """
    # Build system prompt
    system_prompt = f"{SYSTEM_PROMPT_TEMPLATE}\n\nDokumenty (KB):\n{kb_text}\n"
    anthro_payload = {
        "system": system_prompt,
        "messages": history_messages + [{"role": "user", "content": user_query}],
        "max_tokens": MAX_TOKENS,
        "temperature": BEDROCK_TEMPERATURE,
        "anthropic_version": "bedrock-2023-05-31",
    }

    # Invoke Claude via Bedrock Runtime (graceful degradation)
    bedrock_start = time.time()
    answer_parts = []
    
    logger.info("Invoking Bedrock", extra={
        "request_id": request_id,
        "session_id": session_id,
        "event_type": "bedrock_start",
        "model_id": CLAUDE_MODEL_ID
    })
    
    try:
        def _invoke_bedrock():
            return bedrock.invoke_model_with_response_stream(
                modelId=CLAUDE_MODEL_ID,
                body=json.dumps(anthro_payload).encode("utf-8"),
                contentType="application/json",
                accept="application/json",
            )
        
        response = retry_with_backoff(_invoke_bedrock)
        for event in response.get("body", []):
            chunk = event.get("chunk")
            if not chunk:
                continue
            
            try:
                chunk_bytes = chunk.get("bytes", b"{}")
                if not chunk_bytes:
                    continue
                    
                data = json.loads(chunk_bytes)
                if data.get("type") == "content_block_delta":
                    text_delta = data.get("delta", {}).get("text", "")
                    if text_delta:
                        answer_parts.append(text_delta)
                elif data.get("type") == "error":
                    logger.error(f"Bedrock streaming error: {data}")
                    break
                    
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning(f"Malformed chunk received from Bedrock: {e}")
                continue  # Skip malformed chunks, continue with others
            except Exception as e:
                logger.error(f"Unexpected error processing Bedrock chunk: {e}")
                continue
                
        # If no content was received, provide fallback
        if not answer_parts:
            answer_parts.append("Przepraszam, nie otrzymałem odpowiedzi od systemu AI.")
            
    except Exception as e:
        bedrock_time = time.time() - bedrock_start
        logger.error("Bedrock error after retries", extra={
            "request_id": request_id,
            "session_id": session_id,
            "event_type": "bedrock_error",
            "bedrock_time": bedrock_time,
            "error": str(e)
        })
        answer_parts.append(
            "Przepraszam, serwis AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę."
        )

    bedrock_time = time.time() - bedrock_start
    answer = "".join(answer_parts).strip()
    
    logger.info("Bedrock response received", extra={
        "request_id": request_id,
        "session_id": session_id,
        "event_type": "bedrock_success",
        "bedrock_time": bedrock_time,
        "response_length": len(answer)
    })
    
    return answer, bedrock_time


# =============================================================================
# APPOINTMENT REQUEST HANDLER  
# =============================================================================

def handle_appointment_requests(user_query: str, session_id: str, request_id: str) -> dict:
    """Handle direct appointment booking requests (date selection, verification, etc.).
    
    Args:
        user_query: User's input
        session_id: Session identifier
        request_id: Request ID for logging
        
    Returns:
        Dict with HTTP response if appointment action handled, None otherwise
    """
    # This will handle direct API calls from frontend for:
    # 1. Booking appointment after date/time selection
    # 2. Verifying appointment codes
    # 3. Getting appointment status
    
    # For now, we'll implement this through URL path or specific query patterns
    # In a production setup, you might want separate Lambda endpoints
    
    # Example patterns to detect:
    if "BOOK_APPOINTMENT:" in user_query:
        # Format: BOOK_APPOINTMENT:datetime,contact_info,contact_type
        try:
            parts = user_query.replace("BOOK_APPOINTMENT:", "").split(",")
            if len(parts) >= 3:
                datetime_str, contact_info, contact_type = parts[0], parts[1], parts[2]
                
                # Create appointment
                appointment_data = create_appointment(session_id, datetime_str, contact_info, contact_type)
                if appointment_data:
                    # Send verification code
                    verification_code = appointment_data['verification_code']
                    if contact_type == 'email':
                        send_verification_email(contact_info, verification_code)
                    else:
                        send_verification_sms(contact_info, verification_code)
                    
                    return {
                        "statusCode": 200,
                        "headers": {"Content-Type": "application/json"},
                        "body": json.dumps({
                            "answer": f"Kod weryfikacyjny został wysłany na {contact_info}",
                            "action_type": "request_verification",
                            "appointment_id": appointment_data['appointment_id']
                        })
                    }
        except Exception as e:
            logger.error(f"Failed to book appointment: {e}")
    
    elif "VERIFY_APPOINTMENT:" in user_query:
        # Format: VERIFY_APPOINTMENT:appointment_id,verification_code
        try:
            parts = user_query.replace("VERIFY_APPOINTMENT:", "").split(",")
            if len(parts) >= 2:
                appointment_id, verification_code = parts[0], parts[1]
                
                # Verify appointment
                if verify_appointment(appointment_id, verification_code):
                    # Get appointment details for confirmation
                    appointment = get_appointment_by_id(appointment_id)
                    if appointment:
                        # Send confirmation email
                        if appointment['contact_type'] == 'email':
                            send_appointment_confirmation(appointment['contact_info'], appointment)
                        
                        return {
                            "statusCode": 200,
                            "headers": {"Content-Type": "application/json"},
                            "body": json.dumps({
                                "answer": "✅ Spotkanie zostało potwierdzone! Szczegóły zostały wysłane na podany adres email.",
                                "action_type": "confirmed",
                                "appointment_id": appointment_id
                            })
                        }
                else:
                    return {
                        "statusCode": 400,
                        "headers": {"Content-Type": "application/json"},
                        "body": json.dumps({
                            "answer": "❌ Nieprawidłowy kod weryfikacyjny lub spotkanie nie istnieje.",
                            "action_type": "error"
                        })
                    }
        except Exception as e:
            logger.error(f"Failed to verify appointment: {e}")
    
    return None  # No appointment action detected


def lambda_handler(event, context):
    """Entry point for AWS Lambda."""
    request_id = context.aws_request_id if context else "unknown"
    start_time = time.time()
    
    logger.info("Request started", extra={
        "request_id": request_id,
        "event_type": "request_start"
    })
    
    # Optional: Test Google Calendar connection on first request (remove in production)
    # if not hasattr(lambda_handler, 'calendar_tested'):
    #     lambda_handler.calendar_tested = True
    #     test_google_calendar_connection()

    # Parse request body
    payload = parse_request_body(event)
    user_query = payload.get("query", "").strip()
    session_id = payload.get("conversation_id", "default")
    
    # Validate request
    validation_error = validate_request(user_query, session_id, request_id)
    if validation_error:
        return validation_error
    
    # Sanitize user input
    user_query = sanitize_input(user_query)
    
    logger.info("Request validated", extra={
        "request_id": request_id,
        "session_id": session_id,
        "query_length": len(user_query),
        "event_type": "validation_success"
    })
    
    # Check rate limit
    if not check_rate_limit(session_id):
        logger.warning("Rate limit exceeded", extra={
            "request_id": request_id,
            "session_id": session_id,
            "event_type": "rate_limit_exceeded"
        })
        return {"statusCode": 429, "body": json.dumps({"error": f"Rate limit exceeded (max {RATE_LIMIT_PER_MINUTE} requests per minute)"})}

    # Load context data (KB and conversation history)
    kb_text, history_messages, load_timings = load_context_data(session_id, request_id)
    
    # Check for special appointment booking requests first
    appointment_action = handle_appointment_requests(user_query, session_id, request_id)
    if appointment_action:
        return appointment_action
    
    # Invoke Claude model
    answer, bedrock_time = invoke_claude_model(
        user_query, kb_text, history_messages, session_id, request_id
    )

    # Check if Claude detected appointment intent
    response_data = {"answer": answer}
    
    if "[APPOINTMENT_INTENT]" in answer:
        # Remove the marker from the user-facing answer
        clean_answer = answer.replace("[APPOINTMENT_INTENT]", "").strip()
        response_data["answer"] = clean_answer
        
        # Get available slots for the next 2 weeks
        today = datetime.now().date()
        end_date = today + timedelta(days=14)
        available_slots = get_available_slots(today.isoformat(), end_date.isoformat())
        
        response_data.update({
            "action_type": "show_calendar",
            "available_slots": available_slots,
            "appointment_id": None
        })
        
        logger.info("Appointment intent detected", extra={
            "request_id": request_id,
            "session_id": session_id,
            "event_type": "appointment_intent_detected",
            "available_slots_count": len(available_slots)
        })
    
    # Save conversation to DynamoDB
    save_start = time.time()
    now_ts = int(time.time())
    save_message(session_id, "user", user_query, now_ts)
    save_message(session_id, "assistant", response_data["answer"], now_ts + 1)
    save_time = time.time() - save_start
    
    total_time = time.time() - start_time
    
    logger.info("Request completed", extra={
        "request_id": request_id,
        "session_id": session_id,
        "event_type": "request_success",
        "total_time": total_time,
        "save_time": save_time,
        "kb_load_time": load_timings.get('kb_load_time', 0),
        "history_load_time": load_timings.get('history_load_time', 0),
        "bedrock_time": bedrock_time
    })

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(response_data),
    }