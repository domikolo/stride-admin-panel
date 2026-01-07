"""
Google Calendar service for managing appointments and availability.
Handles calendar authentication, slot availability, and event creation.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from config import GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY, MAX_AVAILABLE_SLOTS

logger = logging.getLogger(__name__)

# =============================================================================
# GOOGLE CALENDAR CLIENT INITIALIZATION
# =============================================================================

def get_calendar_service():
    """Create and return Google Calendar API service object.

    Returns:
        Google Calendar service object or None if initialization fails

    Note:
        This function handles optional imports gracefully. If Google libraries
        are not available, it logs a warning and returns None.
    """
    try:
        # Try to import required modules
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError as e:
            logger.error(f"Failed to import Google libraries: {e}")
            logger.info("Make sure google-auth and google-api-python-client are installed")
            return None

        # Check if we have the required environment variables
        if not GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY == "{}":
            logger.error("GOOGLE_SERVICE_ACCOUNT_KEY not configured")
            return None

        if not GOOGLE_CALENDAR_ID:
            logger.error("GOOGLE_CALENDAR_ID not configured")
            return None

        logger.info("Creating Google Calendar service...")

        # Parse the service account credentials
        credentials_info = json.loads(GOOGLE_SERVICE_ACCOUNT_KEY)
        logger.info(f"Using service account for project: {credentials_info.get('project_id', 'unknown')}")

        # Create credentials object
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info,
            scopes=['https://www.googleapis.com/auth/calendar']
        )
        logger.info("Service account credentials created successfully")

        # Build the service
        service = build('calendar', 'v3', credentials=credentials)
        logger.info("Google Calendar service created successfully")

        return service

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY: {e}")
        return None

    except Exception as e:
        logger.error(f"Calendar service initialization failed: {e}", exc_info=True)
        return None


# =============================================================================
# AVAILABILITY CHECKING
# =============================================================================

def get_available_slots(date_start: str, date_end: str) -> List[str]:
    """Get available appointment slots for date range.

    Queries Google Calendar freebusy API to find available slots,
    excluding weekends and existing appointments.

    Args:
        date_start: ISO date string (YYYY-MM-DD)
        date_end: ISO date string (YYYY-MM-DD)

    Returns:
        List of available datetime slots in ISO format (limited to MAX_AVAILABLE_SLOTS)

    Example:
        >>> slots = get_available_slots("2025-01-15", "2025-01-29")
        >>> # Returns: ["2025-01-15T10:00:00", "2025-01-15T10:30:00", ...]
    """
    try:
        service = get_calendar_service()
        if not service:
            logger.warning("Calendar service unavailable, using fallback slots")
            return generate_fallback_slots(date_start, date_end)

        # Convert dates to datetime objects
        start_date = datetime.fromisoformat(date_start)
        end_date = datetime.fromisoformat(date_end)

        # Query busy times from Google Calendar
        freebusy_query = {
            'timeMin': start_date.replace(hour=9, minute=0).isoformat() + 'Z',
            'timeMax': end_date.replace(hour=17, minute=0).isoformat() + 'Z',
            'items': [{'id': GOOGLE_CALENDAR_ID}]
        }

        logger.info(f"Querying calendar availability from {date_start} to {date_end}")
        freebusy_result = service.freebusy().query(body=freebusy_query).execute()
        busy_periods = freebusy_result.get('calendars', {}).get(GOOGLE_CALENDAR_ID, {}).get('busy', [])

        logger.info(f"Found {len(busy_periods)} busy periods")

        # Generate available slots (9 AM - 5 PM, 30min intervals)
        available_slots = []
        current_date = start_date

        while current_date <= end_date:
            # Skip weekends
            if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                current_date += timedelta(days=1)
                continue

            # Generate time slots for this day (9 AM - 5 PM, 30min intervals)
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

        # Limit to MAX_AVAILABLE_SLOTS
        limited_slots = available_slots[:MAX_AVAILABLE_SLOTS]

        logger.info(f"Generated {len(limited_slots)} available slots (limited from {len(available_slots)} total)")
        return limited_slots

    except Exception as e:
        logger.error(f"Failed to get available slots: {e}", exc_info=True)
        return generate_fallback_slots(date_start, date_end)


def generate_fallback_slots(date_start: str, date_end: str) -> List[str]:
    """Generate fallback available slots when Google Calendar is unavailable.

    Provides a reasonable set of default slots for booking even when
    the calendar integration is not working.

    Args:
        date_start: ISO date string (YYYY-MM-DD)
        date_end: ISO date string (YYYY-MM-DD)

    Returns:
        List of datetime slots in ISO format

    Example:
        >>> slots = generate_fallback_slots("2025-01-15", "2025-01-20")
        >>> # Returns: ["2025-01-15T10:00:00", "2025-01-15T14:00:00", ...]
    """
    available_slots = []
    start_date = datetime.fromisoformat(date_start)
    end_date = datetime.fromisoformat(date_end)

    current_date = start_date
    while current_date <= end_date and len(available_slots) < 10:
        # Skip weekends
        if current_date.weekday() < 5:  # Monday = 0, Friday = 4
            # Add a few standard slots for each weekday
            for hour in [10, 14, 16]:
                slot_time = current_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                available_slots.append(slot_time.isoformat())

        current_date += timedelta(days=1)

    logger.info(f"Generated {len(available_slots)} fallback slots")
    return available_slots


# =============================================================================
# EVENT CREATION
# =============================================================================

def create_calendar_event(
    datetime_str: str,
    contact_info: str,
    appointment_id: str
) -> Optional[str]:
    """Create an event in Google Calendar.

    Args:
        datetime_str: ISO datetime string for the appointment
        contact_info: Customer contact information
        appointment_id: Unique appointment identifier

    Returns:
        Google Calendar event ID or None on failure

    Example:
        >>> event_id = create_calendar_event(
        >>>     "2025-01-15T10:00:00",
        >>>     "user@example.com",
        >>>     "appt-123"
        >>> )
        >>> # Returns: "abc123eventid" or None
    """
    try:
        service = get_calendar_service()
        if not service:
            logger.warning("Calendar service unavailable, cannot create event")
            return None

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

        logger.info(f"Creating calendar event for appointment {appointment_id} at {datetime_str}")
        result = service.events().insert(calendarId=GOOGLE_CALENDAR_ID, body=event).execute()
        event_id = result.get('id', '')

        logger.info(f"Calendar event created successfully: {event_id}")
        return event_id

    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}", exc_info=True)
        return None


# =============================================================================
# TESTING & DIAGNOSTICS
# =============================================================================

def test_google_calendar_connection() -> bool:
    """Test Google Calendar API connection and basic functionality.

    Returns:
        True if connection successful, False otherwise

    Example:
        >>> if test_google_calendar_connection():
        >>>     print("Calendar integration working!")
    """
    try:
        logger.info("Testing Google Calendar connection...")

        service = get_calendar_service()
        if not service:
            logger.error("Failed to get calendar service")
            return False

        # Test basic calendar access
        calendar_info = service.calendars().get(calendarId=GOOGLE_CALENDAR_ID).execute()
        logger.info(f"Successfully connected to calendar: {calendar_info.get('summary', 'Unknown')}")

        # Test freebusy query (basic functionality test)
        now = datetime.utcnow()
        tomorrow = now + timedelta(days=1)

        freebusy_query = {
            'timeMin': now.isoformat() + 'Z',
            'timeMax': tomorrow.isoformat() + 'Z',
            'items': [{'id': GOOGLE_CALENDAR_ID}]
        }

        freebusy_result = service.freebusy().query(body=freebusy_query).execute()
        logger.info("Freebusy query successful")

        return True

    except Exception as e:
        logger.error(f"Google Calendar connection test failed: {e}", exc_info=True)
        return False
