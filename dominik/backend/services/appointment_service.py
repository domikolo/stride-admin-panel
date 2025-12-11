"""
Appointment service for managing appointment bookings in DynamoDB.

IMPORTANT: This service is designed for the OPTIMIZED table schema:
    Partition Key: appointment_id (String)
    Sort Key: created_at (Number)

This schema allows efficient get_item() operations instead of expensive scan().
If your table still uses the old schema, see backend/plan.md for migration instructions.
"""

import time
import random
import uuid
import logging
from typing import Optional, Dict

from config import (
    appointments_table,
    VERIFICATION_CODE_LENGTH,
    APPOINTMENT_PENDING_TTL_SECONDS
)
from utils.retry import retry_with_backoff
from utils.validation import is_valid_contact
from services.calendar_service import create_calendar_event
from services.notification_service import send_verification_code

logger = logging.getLogger(__name__)

# =============================================================================
# VERIFICATION CODE GENERATION
# =============================================================================

def generate_verification_code() -> str:
    """Generate a random 6-digit verification code.

    Returns:
        6-digit numeric string

    Example:
        >>> code = generate_verification_code()
        >>> # Returns: "123456"
    """
    return ''.join([str(random.randint(0, 9)) for _ in range(VERIFICATION_CODE_LENGTH)])


# =============================================================================
# APPOINTMENT CREATION
# =============================================================================

def create_appointment(
    session_id: str,
    datetime_str: str,
    contact_info: str,
    contact_type: str
) -> Optional[Dict[str, str]]:
    """Create a pending appointment in DynamoDB.

    Args:
        session_id: User session identifier
        datetime_str: ISO datetime string for the appointment
        contact_info: Email or phone number for verification
        contact_type: 'email' or 'phone'

    Returns:
        Dict with appointment_id and verification_code, None on failure

    Example:
        >>> result = create_appointment(
        >>>     "session123",
        >>>     "2025-01-15T10:00:00",
        >>>     "user@example.com",
        >>>     "email"
        >>> )
        >>> # Returns: {"appointment_id": "abc-123", "verification_code": "123456"}
    """
    # Validate contact info
    if not is_valid_contact(contact_info, contact_type):
        logger.error(
            f"Invalid contact info for appointment: {contact_info} ({contact_type})",
            extra={"contact_type": contact_type, "validation_failed": True}
        )
        return None

    try:
        appointment_id = str(uuid.uuid4())
        verification_code = generate_verification_code()
        current_time = int(time.time())

        item = {
            'appointment_id': appointment_id,  # Partition Key
            'created_at': current_time,        # Sort Key
            'session_id': session_id,
            'datetime': datetime_str,
            'contact_info': contact_info,
            'contact_type': contact_type,
            'verification_code': verification_code,
            'status': 'pending',
            'ttl': current_time + APPOINTMENT_PENDING_TTL_SECONDS  # Auto-delete after 24h
        }

        def _put_appointment():
            return appointments_table.put_item(Item=item)

        retry_with_backoff(_put_appointment)

        logger.info(
            f"Appointment created: {appointment_id}",
            extra={
                "appointment_id": appointment_id,
                "session_id": session_id,
                "datetime": datetime_str,
                "contact_type": contact_type
            }
        )

        return {
            'appointment_id': appointment_id,
            'verification_code': verification_code
        }

    except Exception as e:
        logger.error(
            f"Failed to create appointment: {e}",
            exc_info=True,
            extra={"session_id": session_id}
        )
        return None


# =============================================================================
# APPOINTMENT RETRIEVAL (OPTIMIZED - uses get_item)
# =============================================================================

def get_appointment_by_id(appointment_id: str, session_id: str) -> Optional[Dict]:
    """Get appointment details by ID using efficient get_item().

    Table schema:
        Partition Key: appointment_id
        Sort Key: session_id

    Args:
        appointment_id: Unique appointment identifier
        session_id: Session identifier (required for composite key)

    Returns:
        Appointment dict or None if not found

    Example:
        >>> appt = get_appointment_by_id("abc-123", "session456")
        >>> if appt:
        >>>     print(f"Status: {appt['status']}")
    """
    try:
        def _get_appointment():
            return appointments_table.get_item(
                Key={
                    'appointment_id': appointment_id,
                    'session_id': session_id
                }
            )

        response = retry_with_backoff(_get_appointment)
        item = response.get('Item')

        if item:
            logger.debug(
                f"Retrieved appointment: {appointment_id}",
                extra={"appointment_id": appointment_id, "status": item.get('status')}
            )
        else:
            logger.warning(
                f"Appointment not found: {appointment_id}",
                extra={"appointment_id": appointment_id}
            )

        return item

    except Exception as e:
        logger.error(
            f"Failed to get appointment {appointment_id}: {e}",
            exc_info=True,
            extra={"appointment_id": appointment_id}
        )
        return None


# =============================================================================
# APPOINTMENT VERIFICATION
# =============================================================================

def verify_appointment(appointment_id: str, verification_code: str, session_id: str) -> bool:
    """Verify appointment code and create Google Calendar event.

    Args:
        appointment_id: Unique appointment identifier
        verification_code: 6-digit verification code
        session_id: Session identifier (required for composite key)

    Returns:
        True if verification successful and event created, False otherwise

    Example:
        >>> if verify_appointment("abc-123", "123456", "session456"):
        >>>     print("Appointment verified!")
    """
    try:
        # Get appointment (using efficient get_item!)
        appointment = get_appointment_by_id(appointment_id, session_id)

        if not appointment:
            logger.warning(
                f"Appointment not found for verification: {appointment_id}",
                extra={"appointment_id": appointment_id}
            )
            return False

        # Verify code
        if appointment.get('verification_code') != verification_code:
            logger.warning(
                f"Invalid verification code for appointment: {appointment_id}",
                extra={"appointment_id": appointment_id}
            )
            return False

        # Check status
        if appointment.get('status') != 'pending':
            logger.warning(
                f"Appointment not in pending status: {appointment_id} (status: {appointment.get('status')})",
                extra={"appointment_id": appointment_id, "status": appointment.get('status')}
            )
            return False

        # Create Google Calendar event
        event_id = create_calendar_event(
            appointment['datetime'],
            appointment['contact_info'],
            appointment_id
        )

        # Update appointment status (even if calendar event creation failed)
        def _update_appointment():
            update_expr = 'SET #status = :status, verified_at = :verified_at'
            expr_values = {
                ':status': 'verified',
                ':verified_at': int(time.time())
            }

            # Add event_id if calendar creation succeeded
            if event_id:
                update_expr += ', google_event_id = :event_id'
                expr_values[':event_id'] = event_id

            return appointments_table.update_item(
                Key={
                    'appointment_id': appointment_id,
                    'session_id': session_id
                },
                UpdateExpression=update_expr,
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues=expr_values
            )

        retry_with_backoff(_update_appointment)

        logger.info(
            f"Appointment verified successfully: {appointment_id}",
            extra={
                "appointment_id": appointment_id,
                "calendar_event_created": event_id is not None
            }
        )

        return True

    except Exception as e:
        logger.error(
            f"Failed to verify appointment {appointment_id}: {e}",
            exc_info=True,
            extra={"appointment_id": appointment_id}
        )
        return False


# =============================================================================
# APPOINTMENT BOOKING WORKFLOW
# =============================================================================

def book_appointment(
    session_id: str,
    datetime_str: str,
    contact_info: str,
    contact_type: str
) -> Optional[Dict[str, str]]:
    """Complete appointment booking workflow: create appointment and send verification.

    This is a convenience function that combines create_appointment and
    send_verification_code.

    Args:
        session_id: User session identifier
        datetime_str: ISO datetime string
        contact_info: Email or phone
        contact_type: 'email' or 'phone'

    Returns:
        Dict with appointment_id, or None on failure

    Example:
        >>> result = book_appointment(
        >>>     "session123",
        >>>     "2025-01-15T10:00:00",
        >>>     "user@example.com",
        >>>     "email"
        >>> )
        >>> if result:
        >>>     print(f"Appointment booked: {result['appointment_id']}")
    """
    # Create appointment
    appointment_data = create_appointment(session_id, datetime_str, contact_info, contact_type)

    if not appointment_data:
        logger.error("Failed to create appointment")
        return None

    appointment_id = appointment_data['appointment_id']
    verification_code = appointment_data['verification_code']

    # Send verification code
    send_success = send_verification_code(contact_info, contact_type, verification_code)

    if not send_success:
        logger.warning(
            f"Failed to send verification code for appointment {appointment_id}",
            extra={"appointment_id": appointment_id}
        )
        # Note: We still return the appointment_id even if sending failed
        # The user might be able to retry or contact support

    return {
        'appointment_id': appointment_id,
        'verification_sent': send_success
    }


# =============================================================================
# APPOINTMENT STATUS
# =============================================================================

def get_appointment_status(appointment_id: str, session_id: str) -> Optional[str]:
    """Get the status of an appointment.

    Args:
        appointment_id: Unique appointment identifier
        session_id: Session identifier (required for composite key)

    Returns:
        Status string ('pending', 'verified', etc.) or None if not found

    Example:
        >>> status = get_appointment_status("abc-123", "session456")
        >>> # Returns: "verified"
    """
    appointment = get_appointment_by_id(appointment_id, session_id)
    return appointment.get('status') if appointment else None
