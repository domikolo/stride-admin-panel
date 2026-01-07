"""
Validation and sanitization utilities for user input.
"""

import re
import html
from typing import Optional

# =============================================================================
# REGEX PATTERNS
# =============================================================================

# Email validation (basic RFC 5322 compliance)
EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

# Phone validation (E.164 international format)
# Allows: +48123456789, +1234567890 (1-15 digits after optional +)
PHONE_REGEX = re.compile(
    r'^\+?[1-9]\d{1,14}$'
)

# Session ID validation (alphanumeric, dash, underscore)
SESSION_ID_REGEX = re.compile(
    r'^[a-zA-Z0-9_-]+$'
)

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def validate_email(email: str) -> bool:
    """Validate email address format.

    Args:
        email: Email address string to validate

    Returns:
        True if email format is valid, False otherwise

    Examples:
        >>> validate_email("user@example.com")
        True
        >>> validate_email("invalid@")
        False
    """
    if not email or not isinstance(email, str):
        return False

    # Strip whitespace
    email = email.strip()

    # Check length (RFC 5321: max 254 chars)
    if len(email) > 254:
        return False

    return bool(EMAIL_REGEX.match(email))


def validate_phone(phone: str) -> bool:
    """Validate phone number in international E.164 format.

    Args:
        phone: Phone number string to validate

    Returns:
        True if phone format is valid, False otherwise

    Examples:
        >>> validate_phone("+48123456789")
        True
        >>> validate_phone("123")
        False
    """
    if not phone or not isinstance(phone, str):
        return False

    # Strip whitespace and common separators
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    return bool(PHONE_REGEX.match(phone))


def normalize_phone(phone: str, default_country_code: str = "+48") -> Optional[str]:
    """Normalize phone number to E.164 format.

    Args:
        phone: Phone number to normalize
        default_country_code: Default country code if not provided (default: +48 for Poland)

    Returns:
        Normalized phone number in E.164 format, or None if invalid

    Examples:
        >>> normalize_phone("728381170")
        "+48728381170"
        >>> normalize_phone("+48 728 381 170")
        "+48728381170"
    """
    if not phone:
        return None

    # Clean phone number
    clean_phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Add country code if missing
    if not clean_phone.startswith('+'):
        if clean_phone.startswith('00'):
            clean_phone = '+' + clean_phone[2:]
        elif clean_phone.startswith('0'):
            # Remove leading 0 and add default country code
            clean_phone = default_country_code + clean_phone[1:]
        elif clean_phone.startswith('48'):
            # Assume Polish number without +
            clean_phone = '+' + clean_phone
        else:
            # Add default country code
            clean_phone = default_country_code + clean_phone

    # Validate final format
    if validate_phone(clean_phone):
        return clean_phone

    return None


def validate_session_id(session_id: str, max_length: int = 50) -> bool:
    """Validate session ID format.

    Args:
        session_id: Session ID to validate
        max_length: Maximum allowed length

    Returns:
        True if session ID is valid, False otherwise

    Examples:
        >>> validate_session_id("user-123_abc")
        True
        >>> validate_session_id("invalid@session")
        False
    """
    if not session_id or not isinstance(session_id, str):
        return False

    if len(session_id) > max_length or len(session_id) < 1:
        return False

    return bool(SESSION_ID_REGEX.match(session_id))


# =============================================================================
# SANITIZATION FUNCTIONS
# =============================================================================

def sanitize_input(text: str) -> str:
    """Sanitize user input by removing/escaping potentially harmful characters.

    Performs the following sanitization:
    - Removes null bytes and control characters (except newlines and tabs)
    - Escapes HTML entities to prevent XSS
    - Removes excessive whitespace

    Args:
        text: Raw user input string

    Returns:
        Sanitized text safe for processing

    Examples:
        >>> sanitize_input("Hello <script>alert(1)</script> world!")
        "Hello &lt;script&gt;alert(1)&lt;/script&gt; world!"
        >>> sanitize_input("Test\\x00null\\nbyte")
        "Test nullbyte"
    """
    if not text:
        return ""

    # Remove null bytes and control characters (except newlines and tabs)
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')

    # Escape HTML entities to prevent XSS
    text = html.escape(text)

    # Remove excessive whitespace (collapse multiple spaces into one)
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def sanitize_query(query: str, max_length: int = 2000) -> Optional[str]:
    """Sanitize and validate user query.

    Args:
        query: User query to sanitize
        max_length: Maximum allowed query length

    Returns:
        Sanitized query or None if invalid/too long

    Examples:
        >>> sanitize_query("  How can I help?  ")
        "How can I help?"
    """
    if not query:
        return None

    # Sanitize input
    clean_query = sanitize_input(query)

    # Check length
    if len(clean_query) > max_length:
        return None

    if len(clean_query) == 0:
        return None

    return clean_query


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

def is_valid_contact(contact_info: str, contact_type: str) -> bool:
    """Validate contact information based on type.

    Args:
        contact_info: Contact information (email or phone)
        contact_type: Type of contact ('email' or 'phone')

    Returns:
        True if contact information is valid for the given type

    Examples:
        >>> is_valid_contact("user@example.com", "email")
        True
        >>> is_valid_contact("+48123456789", "phone")
        True
        >>> is_valid_contact("invalid", "email")
        False
    """
    if contact_type == "email":
        return validate_email(contact_info)
    elif contact_type == "phone":
        normalized = normalize_phone(contact_info)
        return normalized is not None
    else:
        return False


def get_contact_type(contact_info: str) -> Optional[str]:
    """Auto-detect contact type (email or phone).

    Args:
        contact_info: Contact information to analyze

    Returns:
        'email', 'phone', or None if unable to determine

    Examples:
        >>> get_contact_type("user@example.com")
        'email'
        >>> get_contact_type("+48123456789")
        'phone'
        >>> get_contact_type("invalid")
        None
    """
    if validate_email(contact_info):
        return "email"
    elif normalize_phone(contact_info) is not None:
        return "phone"
    else:
        return None
