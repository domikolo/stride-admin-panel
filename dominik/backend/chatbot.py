"""
Stride Services Chatbot - AWS Lambda Handler
Optimized and refactored version with modular architecture.

This is the main entry point for the Lambda function.
All business logic has been extracted to services/ and utils/ modules.

Handler: chatbot.lambda_handler
"""

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Application modules
from config import (
    S3_BUCKET,
    S3_PREFIX,
    MAX_QUERY_LENGTH,
    RATE_LIMIT_PER_MINUTE,
    SESSION_ID_MAX_LENGTH
)
from utils.validation import sanitize_query, validate_session_id
from services.conversation_service import (
    save_conversation_turn,
    get_recent_messages,
    check_rate_limit
)
from services.bedrock_service import (
    load_kb_from_s3,
    invoke_claude,
    check_appointment_intent,
    remove_appointment_marker
)
from services.appointment_service import book_appointment, verify_appointment, get_appointment_by_id
from services.calendar_service import get_available_slots
from services.notification_service import send_appointment_confirmation

# Setup logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# =============================================================================
# REQUEST PARSING & VALIDATION
# =============================================================================

def parse_request_body(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse request body from Lambda event.

    Handles both API Gateway (stringified JSON) and direct invocation formats.

    Args:
        event: Lambda event dict

    Returns:
        Parsed payload dict
    """
    payload = {}

    if "body" in event:
        body = event["body"]
        if isinstance(body, str):
            try:
                # Handle base64 encoded bodies
                if event.get("isBase64Encoded"):
                    import base64
                    body = base64.b64decode(body).decode("utf-8")
                payload = json.loads(body)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON body")
        elif isinstance(body, dict):
            payload = body
    else:
        # Direct invocation
        payload = event

    return payload


def validate_request(user_query: str, session_id: str, request_id: str) -> Optional[Dict]:
    """Validate user input and return error response if invalid.

    Args:
        user_query: User's question
        session_id: Session identifier
        request_id: Request ID for logging

    Returns:
        Error response dict if invalid, None if valid
    """
    # Check query exists
    if not user_query:
        logger.warning(
            "Missing query",
            extra={"request_id": request_id, "event_type": "validation_error"}
        )
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing 'query'"})
        }

    # Check query length
    if len(user_query) > MAX_QUERY_LENGTH:
        logger.warning(
            "Query too long",
            extra={
                "request_id": request_id,
                "event_type": "validation_error",
                "query_length": len(user_query)
            }
        )
        return {
            "statusCode": 400,
            "body": json.dumps({"error": f"Query too long (max {MAX_QUERY_LENGTH} characters)"})
        }

    # Validate session ID format
    if not validate_session_id(session_id, SESSION_ID_MAX_LENGTH):
        logger.warning(
            "Invalid session_id",
            extra={"request_id": request_id, "session_id": session_id}
        )
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid session_id format"})
        }

    return None


# =============================================================================
# APPOINTMENT REQUEST HANDLERS
# =============================================================================

def handle_appointment_booking(payload: Dict[str, Any], request_id: str) -> Optional[Dict]:
    """Handle appointment booking request (date/time selection).

    Expected payload format:
    {
        "action": "book_appointment",
        "session_id": "session123",
        "data": {
            "datetime": "2025-01-15T10:00:00",
            "contact_info": "user@example.com",
            "contact_type": "email"
        }
    }

    Args:
        payload: Request payload
        request_id: Request ID for logging

    Returns:
        HTTP response dict if this is an appointment booking request, None otherwise
    """
    if payload.get("action") != "book_appointment":
        return None

    try:
        session_id = payload.get("session_id", "unknown")
        data = payload.get("data", {})

        datetime_str = data.get("datetime")
        contact_info = data.get("contact_info")
        contact_type = data.get("contact_type")

        if not all([datetime_str, contact_info, contact_type]):
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Missing required fields"})
            }

        # Book appointment and send verification
        result = book_appointment(session_id, datetime_str, contact_info, contact_type)

        if not result:
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Failed to create appointment"})
            }

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "answer": f"Kod weryfikacyjny został wysłany na {contact_info}",
                "action_type": "request_verification",
                "appointment_id": result['appointment_id'],
                "verification_sent": result.get('verification_sent', False)
            })
        }

    except Exception as e:
        logger.error(f"Failed to handle appointment booking: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }


def handle_appointment_verification(payload: Dict[str, Any], request_id: str) -> Optional[Dict]:
    """Handle appointment verification request.

    Expected payload format:
    {
        "action": "verify_appointment",
        "data": {
            "appointment_id": "abc-123",
            "verification_code": "123456"
        }
    }

    Args:
        payload: Request payload
        request_id: Request ID for logging

    Returns:
        HTTP response dict if this is a verification request, None otherwise
    """
    if payload.get("action") != "verify_appointment":
        return None

    try:
        session_id = payload.get("session_id") or payload.get("conversation_id", "unknown")
        data = payload.get("data", {})
        appointment_id = data.get("appointment_id")
        verification_code = data.get("verification_code")

        if not all([appointment_id, verification_code]):
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Missing required fields"})
            }

        # Verify appointment
        verified = verify_appointment(appointment_id, verification_code, session_id)

        if verified:
            # Get appointment details for confirmation
            appointment = get_appointment_by_id(appointment_id, session_id)

            # Send confirmation email if email contact
            if appointment and appointment.get('contact_type') == 'email':
                send_appointment_confirmation(appointment['contact_info'], appointment)

            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "answer": "✅ Spotkanie zostało potwierdzone! Szczegóły zostały wysłane na podany adres.",
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
        logger.error(f"Failed to handle appointment verification: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }


# =============================================================================
# MAIN HANDLER
# =============================================================================

def lambda_handler(event, context):
    """Main AWS Lambda handler for chatbot requests.

    Args:
        event: Lambda event dict (from API Gateway or direct invocation)
        context: Lambda context object

    Returns:
        HTTP response dict with statusCode, headers, and body
    """
    request_id = context.aws_request_id if context else "unknown"
    start_time = time.time()

    logger.info(
        "Request started",
        extra={"request_id": request_id, "event_type": "request_start"}
    )

    # Parse request body
    payload = parse_request_body(event)

    # Check for appointment-specific actions first
    appointment_booking_response = handle_appointment_booking(payload, request_id)
    if appointment_booking_response:
        return appointment_booking_response

    appointment_verification_response = handle_appointment_verification(payload, request_id)
    if appointment_verification_response:
        return appointment_verification_response

    # Regular chat flow
    user_query = payload.get("query", "").strip()
    session_id = payload.get("conversation_id", "default")

    # Validate request
    validation_error = validate_request(user_query, session_id, request_id)
    if validation_error:
        return validation_error

    # Sanitize user input
    user_query = sanitize_query(user_query, MAX_QUERY_LENGTH)
    if not user_query:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid query after sanitization"})
        }

    logger.info(
        "Request validated",
        extra={
            "request_id": request_id,
            "session_id": session_id,
            "query_length": len(user_query),
            "event_type": "validation_success"
        }
    )

    # Check for appointment commands in query (from frontend)
    # Format: BOOK_APPOINTMENT:datetime,contact_info,contact_type
    if "BOOK_APPOINTMENT:" in user_query:
        try:
            parts = user_query.replace("BOOK_APPOINTMENT:", "").split(",")
            if len(parts) >= 3:
                datetime_str = parts[0].strip()
                contact_info = parts[1].strip()
                contact_type = parts[2].strip()

                # Book appointment
                result = book_appointment(session_id, datetime_str, contact_info, contact_type)

                if not result:
                    return {
                        "statusCode": 500,
                        "headers": {"Content-Type": "application/json"},
                        "body": json.dumps({"error": "Failed to create appointment"})
                    }

                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({
                        "answer": f"Kod weryfikacyjny został wysłany na {contact_info}",
                        "action_type": "request_verification",
                        "appointment_id": result['appointment_id'],
                        "verification_sent": result.get('verification_sent', False)
                    })
                }
        except Exception as e:
            logger.error(f"Failed to parse BOOK_APPOINTMENT command: {e}", exc_info=True)
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Invalid appointment booking format"})
            }

    # Format: VERIFY_APPOINTMENT:appointment_id,verification_code
    if "VERIFY_APPOINTMENT:" in user_query:
        try:
            parts = user_query.replace("VERIFY_APPOINTMENT:", "").split(",")
            if len(parts) >= 2:
                appointment_id = parts[0].strip()
                verification_code = parts[1].strip()

                # Verify appointment
                verified = verify_appointment(appointment_id, verification_code, session_id)

                if verified:
                    # Get appointment details for confirmation
                    appointment = get_appointment_by_id(appointment_id, session_id)

                    # Send confirmation email if email contact
                    if appointment and appointment.get('contact_type') == 'email':
                        send_appointment_confirmation(appointment['contact_info'], appointment)

                    return {
                        "statusCode": 200,
                        "headers": {"Content-Type": "application/json"},
                        "body": json.dumps({
                            "answer": "✅ Spotkanie zostało potwierdzone! Szczegóły zostały wysłane na podany adres.",
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
            logger.error(f"Failed to parse VERIFY_APPOINTMENT command: {e}", exc_info=True)
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Invalid verification format"})
            }

    # Check rate limit
    if not check_rate_limit(session_id):
        logger.warning(
            "Rate limit exceeded",
            extra={
                "request_id": request_id,
                "session_id": session_id,
                "event_type": "rate_limit_exceeded"
            }
        )
        return {
            "statusCode": 429,
            "body": json.dumps({
                "error": f"Rate limit exceeded (max {RATE_LIMIT_PER_MINUTE} requests per minute)"
            })
        }

    # Load context data
    load_start = time.time()

    # Load knowledge base (with caching!)
    kb_text = load_kb_from_s3(S3_BUCKET, S3_PREFIX)
    kb_load_time = time.time() - load_start

    if not kb_text:
        logger.warning(
            "KB not available",
            extra={"request_id": request_id, "kb_load_time": kb_load_time}
        )
        kb_text = "Knowledge base temporarily unavailable."

    # Fetch conversation history
    history_start = time.time()
    history_messages = get_recent_messages(session_id)
    history_load_time = time.time() - history_start

    # Invoke Claude model
    answer, bedrock_time = invoke_claude(
        user_query,
        kb_text,
        history_messages,
        session_id,
        request_id
    )

    # Check for appointment intent
    response_data = {}

    if check_appointment_intent(answer):
        # Remove marker from answer
        clean_answer = remove_appointment_marker(answer)
        response_data["answer"] = clean_answer

        # Get available slots for next 2 weeks
        today = datetime.now().date()
        end_date = today + timedelta(days=14)
        available_slots = get_available_slots(today.isoformat(), end_date.isoformat())

        response_data.update({
            "action_type": "show_calendar",
            "available_slots": available_slots,
            "appointment_id": None
        })

        logger.info(
            "Appointment intent detected",
            extra={
                "request_id": request_id,
                "session_id": session_id,
                "available_slots_count": len(available_slots)
            }
        )
    else:
        response_data["answer"] = answer

    # Save conversation to DynamoDB
    save_start = time.time()
    save_conversation_turn(session_id, user_query, response_data["answer"])
    save_time = time.time() - save_start

    # Log completion
    total_time = time.time() - start_time

    logger.info(
        "Request completed",
        extra={
            "request_id": request_id,
            "session_id": session_id,
            "event_type": "request_success",
            "total_time": total_time,
            "kb_load_time": kb_load_time,
            "history_load_time": history_load_time,
            "bedrock_time": bedrock_time,
            "save_time": save_time
        }
    )

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(response_data),
    }
