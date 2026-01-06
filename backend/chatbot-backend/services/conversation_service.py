"""
Conversation service for managing chat history in DynamoDB.
Handles message storage, retrieval, and rate limiting.
"""

import logging
import time
from typing import List, Dict, Optional
from boto3.dynamodb.conditions import Key

from config import (
    conversations_table,
    TTL_SECONDS,
    MAX_HISTORY_MESSAGES,
    RATE_LIMIT_PER_MINUTE
)
from utils.retry import retry_with_backoff

logger = logging.getLogger(__name__)

# =============================================================================
# MESSAGE STORAGE
# =============================================================================

def save_message(
    session_id: str,
    role: str,
    text: str,
    base_ts: Optional[int] = None
) -> bool:
    """Save a single message to DynamoDB with automatic TTL cleanup.

    Args:
        session_id: Unique session identifier
        role: Message role ('user' or 'assistant')
        text: Message content
        base_ts: Unix timestamp for message ordering (default: current time)

    Returns:
        True if saved successfully, False otherwise

    Note:
        The timestamp sort key is stored as a string to avoid potential
        number precision issues with large integers in DynamoDB.

    Example:
        >>> save_message("session123", "user", "Hello", 1640995200)
        True
    """
    if base_ts is None:
        base_ts = int(time.time())

    item = {
        "session_id": session_id,
        "timestamp": str(base_ts),
        "role": role,
        "text": text,
        "ttl": base_ts + TTL_SECONDS,
    }

    def _put_item():
        return conversations_table.put_item(Item=item)

    try:
        retry_with_backoff(_put_item)
        logger.debug(f"Saved {role} message for session {session_id}")
        return True

    except Exception as e:
        logger.error(
            f"Failed to save message for session {session_id}: {e}",
            exc_info=True,
            extra={"session_id": session_id, "role": role}
        )
        return False


def save_conversation_turn(
    session_id: str,
    user_message: str,
    assistant_message: str,
    base_ts: Optional[int] = None
) -> bool:
    """Save both user and assistant messages as a conversation turn.

    Args:
        session_id: Unique session identifier
        user_message: User's message
        assistant_message: Assistant's response
        base_ts: Base timestamp (default: current time)

    Returns:
        True if both messages saved successfully, False otherwise

    Example:
        >>> save_conversation_turn("session123", "Hello", "Hi there!")
        True
    """
    if base_ts is None:
        base_ts = int(time.time())

    # Save user message
    user_saved = save_message(session_id, "user", user_message, base_ts)

    # Save assistant message (timestamp + 1 to maintain order)
    assistant_saved = save_message(session_id, "assistant", assistant_message, base_ts + 1)

    return user_saved and assistant_saved


# =============================================================================
# MESSAGE RETRIEVAL
# =============================================================================

def get_recent_messages(
    session_id: str,
    limit: int = MAX_HISTORY_MESSAGES
) -> List[Dict[str, str]]:
    """Fetch the most recent messages from DynamoDB for a session.

    Args:
        session_id: Unique session identifier
        limit: Maximum number of messages to retrieve

    Returns:
        List of message dicts with 'role' and 'content' keys,
        sorted chronologically (oldest first)

    Example:
        >>> messages = get_recent_messages("session123", 10)
        >>> # Returns: [{"role": "user", "content": "Hello"}, ...]
    """
    def _query():
        return conversations_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            ScanIndexForward=False,  # Descending order by timestamp
            Limit=limit,
        )

    try:
        response = retry_with_backoff(_query)
        items = response.get("Items", [])

        # Sort chronologically (oldest first) for conversation context
        items.sort(key=lambda i: int(i.get("timestamp", "0")))

        # Convert to expected format for Bedrock API
        messages = [
            {
                "role": item.get("role", "user"),
                "content": item.get("text", "")
            }
            for item in items
        ]

        logger.debug(
            f"Retrieved {len(messages)} messages for session {session_id}",
            extra={"session_id": session_id, "message_count": len(messages)}
        )

        return messages

    except Exception as e:
        logger.error(
            f"Failed to fetch history for session {session_id}: {e}",
            exc_info=True,
            extra={"session_id": session_id}
        )
        # Return empty list on error (graceful degradation)
        return []


# =============================================================================
# RATE LIMITING
# =============================================================================

def check_rate_limit(session_id: str) -> bool:
    """Check if session is within configured rate limit.

    Queries DynamoDB to count messages from the session in the last minute.

    Args:
        session_id: Unique session identifier

    Returns:
        True if session is within rate limit, False if exceeded

    Example:
        >>> if not check_rate_limit("session123"):
        >>>     return rate_limit_error_response()
    """
    current_time = int(time.time())
    minute_window = current_time - 60

    def _query_rate_limit():
        return conversations_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id) & Key("timestamp").gt(str(minute_window)),
            FilterExpression="attribute_exists(#role)",
            ExpressionAttributeNames={"#role": "role"},
            Select="COUNT"
        )

    try:
        response = retry_with_backoff(_query_rate_limit)
        request_count = response.get("Count", 0)

        is_within_limit = request_count < RATE_LIMIT_PER_MINUTE

        if not is_within_limit:
            logger.warning(
                f"Rate limit exceeded for session {session_id}: {request_count} requests in last minute",
                extra={
                    "session_id": session_id,
                    "request_count": request_count,
                    "limit": RATE_LIMIT_PER_MINUTE
                }
            )

        return is_within_limit

    except Exception as e:
        logger.error(
            f"Rate limit check failed for session {session_id}: {e}",
            exc_info=True,
            extra={"session_id": session_id}
        )
        # On error, allow request (fail open for better UX)
        return True


# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

def get_session_message_count(session_id: str) -> int:
    """Get total number of messages for a session.

    Args:
        session_id: Unique session identifier

    Returns:
        Number of messages in the session
    """
    def _query_count():
        return conversations_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            Select="COUNT"
        )

    try:
        response = retry_with_backoff(_query_count)
        return response.get("Count", 0)

    except Exception as e:
        logger.error(
            f"Failed to get message count for session {session_id}: {e}",
            exc_info=True
        )
        return 0


def clear_session_history(session_id: str) -> bool:
    """Clear all messages for a session (for testing/debugging).

    WARNING: This permanently deletes all messages for the session.

    Args:
        session_id: Unique session identifier

    Returns:
        True if successful, False otherwise
    """
    try:
        # Query all items for the session
        def _query_all():
            return conversations_table.query(
                KeyConditionExpression=Key("session_id").eq(session_id)
            )

        response = retry_with_backoff(_query_all)
        items = response.get("Items", [])

        # Delete each item
        for item in items:
            def _delete_item():
                return conversations_table.delete_item(
                    Key={
                        "session_id": item["session_id"],
                        "timestamp": item["timestamp"]
                    }
                )

            retry_with_backoff(_delete_item)

        logger.info(f"Cleared {len(items)} messages for session {session_id}")
        return True

    except Exception as e:
        logger.error(
            f"Failed to clear session history for {session_id}: {e}",
            exc_info=True
        )
        return False
