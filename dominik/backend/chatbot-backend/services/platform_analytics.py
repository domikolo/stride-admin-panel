"""
Shared Analytics SDK - każdy chatbot klienta używa tego do wysyłania analytics
do centralnej platform_analytics_events table.
"""

import boto3
import uuid
import time
from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional

# SHARED table dla całej platformy
PLATFORM_ANALYTICS_TABLE = "platform_analytics_events"

analytics_table = boto3.resource("dynamodb").Table(PLATFORM_ANALYTICS_TABLE)


def convert_floats_to_decimal(obj):
    """Convert all float values in a dict/list to Decimal for DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    return obj

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

    # Convert floats to Decimal for DynamoDB
    clean_metadata = convert_floats_to_decimal(metadata or {})

    item = {
        "client_id": client_id,
        "event_timestamp": timestamp,
        "event_id": event_id,
        "session_id": session_id,
        "event_type": event_type,
        "metadata": clean_metadata,
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
