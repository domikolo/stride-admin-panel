"""
Notification service for sending SMS and Email notifications.
Includes input validation and retry logic.
"""

import logging
from datetime import datetime
from typing import Optional, Dict

from config import sns, ses, SNS_TOPIC_ARN, SES_FROM_EMAIL
from utils.validation import validate_email, validate_phone, normalize_phone
from utils.retry import retry_with_backoff

logger = logging.getLogger(__name__)

# =============================================================================
# SMS NOTIFICATIONS
# =============================================================================

def send_verification_sms(phone: str, verification_code: str) -> bool:
    """Send verification code via SMS using SNS.

    Validates phone number format before sending to prevent
    failed sends and unnecessary AWS costs.

    Args:
        phone: Phone number to send SMS to
        verification_code: 6-digit verification code

    Returns:
        True if SMS sent successfully, False otherwise

    Example:
        >>> send_verification_sms("+48728381170", "123456")
        True
    """
    # Validate and normalize phone number
    normalized_phone = normalize_phone(phone)

    if not normalized_phone:
        logger.error(
            f"Invalid phone number format: {phone}",
            extra={"phone": phone, "validation_failed": True}
        )
        return False

    if not SNS_TOPIC_ARN:
        logger.warning("SNS_TOPIC_ARN not configured, skipping SMS")
        return False

    logger.info(
        f"Sending SMS to: {normalized_phone}",
        extra={"phone": normalized_phone}
    )

    message = f"Stride Services - Kod weryfikacyjny spotkania: {verification_code}. Kod ważny przez 5 minut."

    def _send_sms():
        # Use direct SMS instead of topic for verification messages
        return sns.publish(
            PhoneNumber=normalized_phone,
            Message=message,
            MessageAttributes={
                'AWS.SNS.SMS.SMSType': {
                    'DataType': 'String',
                    'StringValue': 'Transactional'  # Higher priority than Promotional
                }
            }
        )

    try:
        response = retry_with_backoff(_send_sms)
        message_id = response.get('MessageId')

        logger.info(
            f"SMS sent successfully - MessageId: {message_id}",
            extra={"phone": normalized_phone, "message_id": message_id}
        )
        return True

    except Exception as e:
        logger.error(
            f"Failed to send SMS to {normalized_phone}: {e}",
            exc_info=True,
            extra={"phone": normalized_phone}
        )
        return False


# =============================================================================
# EMAIL NOTIFICATIONS
# =============================================================================

def send_verification_email(email: str, verification_code: str) -> bool:
    """Send verification code via email using SES.

    Validates email format before sending.

    Args:
        email: Email address to send verification to
        verification_code: 6-digit verification code

    Returns:
        True if email sent successfully, False otherwise

    Example:
        >>> send_verification_email("user@example.com", "123456")
        True
    """
    # Validate email format
    if not validate_email(email):
        logger.error(
            f"Invalid email format: {email}",
            extra={"email": email, "validation_failed": True}
        )
        return False

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

    try:
        response = retry_with_backoff(_send_email)
        message_id = response.get('MessageId')

        logger.info(
            f"Verification email sent successfully: {message_id}",
            extra={"email": email, "message_id": message_id}
        )
        return True

    except Exception as e:
        logger.error(
            f"Failed to send verification email to {email}: {e}",
            exc_info=True,
            extra={"email": email}
        )
        return False


def send_appointment_confirmation(email: str, appointment_details: Dict) -> bool:
    """Send appointment confirmation email.

    Args:
        email: Email address to send confirmation to
        appointment_details: Dict with appointment info (datetime, contact_info, appointment_id)

    Returns:
        True if email sent successfully, False otherwise

    Example:
        >>> details = {
        >>>     "datetime": "2025-01-15T10:00:00",
        >>>     "contact_info": "user@example.com",
        >>>     "appointment_id": "abc-123"
        >>> }
        >>> send_appointment_confirmation("user@example.com", details)
        True
    """
    # Validate email format
    if not validate_email(email):
        logger.error(
            f"Invalid email format for confirmation: {email}",
            extra={"email": email}
        )
        return False

    if not SES_FROM_EMAIL:
        logger.warning("SES_FROM_EMAIL not configured, skipping confirmation email")
        return False

    # Format datetime for display
    try:
        appointment_time = datetime.fromisoformat(appointment_details['datetime'])
        formatted_date = appointment_time.strftime("%d.%m.%Y")
        formatted_time = appointment_time.strftime("%H:%M")
    except (ValueError, KeyError) as e:
        logger.error(f"Invalid datetime in appointment details: {e}")
        return False

    subject = "Stride Services - Potwierdzenie spotkania"
    body = f"""
Spotkanie zostało pomyślnie zarezerwowane!

SZCZEGÓŁY SPOTKANIA:
Data: {formatted_date}
Godzina: {formatted_time}
Czas trwania: 1 godzina
Typ: Konsultacja biznesowa

KONTAKT:
Email: {appointment_details.get('contact_info', 'N/A')}
ID spotkania: {appointment_details.get('appointment_id', 'N/A')}

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

    try:
        response = retry_with_backoff(_send_confirmation)
        message_id = response.get('MessageId')

        logger.info(
            f"Confirmation email sent successfully: {message_id}",
            extra={"email": email, "message_id": message_id}
        )
        return True

    except Exception as e:
        logger.error(
            f"Failed to send confirmation email to {email}: {e}",
            exc_info=True,
            extra={"email": email}
        )
        return False


# =============================================================================
# NOTIFICATION HELPERS
# =============================================================================

def send_verification_code(
    contact_info: str,
    contact_type: str,
    verification_code: str
) -> bool:
    """Send verification code via email or SMS based on contact type.

    Args:
        contact_info: Email or phone number
        contact_type: 'email' or 'phone'
        verification_code: Code to send

    Returns:
        True if sent successfully, False otherwise

    Example:
        >>> send_verification_code("user@example.com", "email", "123456")
        True
    """
    if contact_type == "email":
        return send_verification_email(contact_info, verification_code)
    elif contact_type == "phone":
        return send_verification_sms(contact_info, verification_code)
    else:
        logger.error(f"Unknown contact type: {contact_type}")
        return False
