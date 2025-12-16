"""
Retry utilities with exponential backoff for AWS service calls.
"""

import time
import random
import logging
from typing import Callable, TypeVar, Any
from botocore.exceptions import BotoCoreError, ClientError

from config import RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY, RETRY_JITTER_MAX

logger = logging.getLogger(__name__)

T = TypeVar('T')

# =============================================================================
# RETRY LOGIC
# =============================================================================

def retry_with_backoff(
    func: Callable[[], T],
    max_retries: int = RETRY_MAX_ATTEMPTS,
    base_delay: float = RETRY_BASE_DELAY,
    jitter_max: float = RETRY_JITTER_MAX,
    retryable_errors: tuple = (BotoCoreError, ClientError)
) -> T:
    """Retry function with exponential backoff for AWS service calls.

    Implements exponential backoff with jitter to avoid thundering herd problem.
    Only retries on transient/retryable errors.

    Args:
        func: Function to retry (must raise BotoCoreError/ClientError on failure)
        max_retries: Maximum number of retry attempts (default: 3)
        base_delay: Base delay in seconds, doubled with each retry (default: 0.1)
        jitter_max: Maximum jitter to add to delay (default: 0.1)
        retryable_errors: Tuple of exception types to retry on

    Returns:
        Function result on success

    Raises:
        Original exception after max retries exceeded or on non-retryable error

    Examples:
        >>> result = retry_with_backoff(lambda: s3.get_object(Bucket=b, Key=k))
        >>> # Retries up to 3 times on transient AWS errors

    Implementation notes:
        - Delay formula: base_delay * (2 ** attempt) + random(0, jitter_max)
        - Attempt 0: 0.1s + jitter
        - Attempt 1: 0.2s + jitter
        - Attempt 2: 0.4s + jitter
    """
    for attempt in range(max_retries):
        try:
            return func()

        except retryable_errors as e:
            # Last attempt - raise the error
            if attempt == max_retries - 1:
                logger.error(
                    f"Max retries ({max_retries}) exceeded for {func.__name__ if hasattr(func, '__name__') else 'function'}",
                    exc_info=True
                )
                raise e

            # Check if error is retryable
            if not _is_retryable_error(e):
                logger.warning(
                    f"Non-retryable error encountered: {type(e).__name__}: {str(e)}"
                )
                raise e

            # Calculate delay with exponential backoff + jitter
            delay = base_delay * (2 ** attempt) + random.uniform(0, jitter_max)

            logger.info(
                f"Retrying after {delay:.2f}s (attempt {attempt + 1}/{max_retries}) "
                f"due to {type(e).__name__}: {str(e)}"
            )

            time.sleep(delay)

        except Exception as e:
            # Unexpected error - don't retry, re-raise immediately
            logger.error(
                f"Unexpected error in retry_with_backoff: {type(e).__name__}: {str(e)}",
                exc_info=True
            )
            raise e

    # This should never be reached, but added for type safety
    raise RuntimeError("retry_with_backoff exited without returning or raising")


def _is_retryable_error(error: Exception) -> bool:
    """Determine if an AWS error is retryable.

    Retryable errors include:
    - 5xx server errors
    - Throttling/rate limit errors
    - Service unavailable errors
    - Timeout errors

    Non-retryable errors include:
    - 4xx client errors (except throttling)
    - Validation errors
    - Access denied

    Args:
        error: Exception to check

    Returns:
        True if error should be retried, False otherwise
    """
    # If it's a ClientError, check the error code
    if isinstance(error, ClientError):
        error_code = error.response.get('Error', {}).get('Code', '')
        http_status = error.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 0)

        # Retryable error codes
        retryable_codes = [
            'Throttling',
            'ThrottlingException',
            'RequestLimitExceeded',
            'ServiceUnavailable',
            'InternalError',
            'InternalServerError',
            'RequestTimeout',
            'RequestTimeoutException',
            'PriorRequestNotComplete',
            'SlowDown'  # S3
        ]

        # Check error code
        if any(code in error_code for code in retryable_codes):
            return True

        # Check HTTP status code (5xx are retryable)
        if http_status >= 500:
            return True

        # 4xx errors are generally not retryable (except throttling, which is handled above)
        if 400 <= http_status < 500:
            return False

    # BotoCoreError (connection errors, etc.) are generally retryable
    if isinstance(error, BotoCoreError):
        return True

    # Unknown errors - don't retry by default
    return False


# =============================================================================
# RETRY DECORATORS (Optional - for convenience)
# =============================================================================

def with_retry(
    max_retries: int = RETRY_MAX_ATTEMPTS,
    base_delay: float = RETRY_BASE_DELAY
):
    """Decorator to add retry logic to a function.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds

    Example:
        >>> @with_retry(max_retries=3)
        >>> def get_from_s3(bucket, key):
        >>>     return s3.get_object(Bucket=bucket, Key=key)
    """
    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            return retry_with_backoff(
                lambda: func(*args, **kwargs),
                max_retries=max_retries,
                base_delay=base_delay
            )
        return wrapper
    return decorator
