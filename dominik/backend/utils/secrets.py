"""
AWS Secrets Manager helper functions.
Handles retrieving secrets from AWS Secrets Manager with caching and error handling.
"""

import json
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Cache for secrets (persists across warm Lambda invocations)
_secrets_cache = {}


def get_secret(secret_name: str, region_name: str = "eu-central-1") -> dict:
    """
    Retrieve a secret from AWS Secrets Manager with caching.

    Args:
        secret_name: Name or ARN of the secret
        region_name: AWS region (default: eu-central-1)

    Returns:
        dict: Secret value parsed as JSON (if it's key/value pairs) or dict with 'SecretString' key

    Raises:
        Exception: If secret retrieval fails

    Note:
        Secrets are cached in memory between Lambda warm starts for performance.
    """
    # Check cache first
    if secret_name in _secrets_cache:
        logger.info(f"Using cached secret: {secret_name}")
        return _secrets_cache[secret_name]

    logger.info(f"Retrieving secret from Secrets Manager: {secret_name}")

    try:
        # Create a Secrets Manager client
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region_name
        )

        # Retrieve the secret
        response = client.get_secret_value(SecretId=secret_name)

        # Parse the secret
        if 'SecretString' in response:
            secret_string = response['SecretString']
            try:
                # Try to parse as JSON (for key/value secrets)
                secret_dict = json.loads(secret_string)
                logger.info(f"Successfully retrieved secret: {secret_name}")

                # Cache it
                _secrets_cache[secret_name] = secret_dict
                return secret_dict

            except json.JSONDecodeError:
                # If it's not JSON, return as string in a dict
                logger.info(f"Secret is plaintext (not JSON): {secret_name}")
                secret_dict = {'SecretString': secret_string}
                _secrets_cache[secret_name] = secret_dict
                return secret_dict
        else:
            # Binary secret (unlikely for our use case)
            logger.warning(f"Secret is binary: {secret_name}")
            secret_dict = {'SecretBinary': response['SecretBinary']}
            _secrets_cache[secret_name] = secret_dict
            return secret_dict

    except ClientError as e:
        error_code = e.response['Error']['Code']

        if error_code == 'ResourceNotFoundException':
            logger.error(f"Secret not found: {secret_name}")
            raise Exception(f"Secret '{secret_name}' not found in Secrets Manager")
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to secret: {secret_name}")
            raise Exception(f"Lambda does not have permission to access secret '{secret_name}'")
        elif error_code == 'InvalidRequestException':
            logger.error(f"Invalid request for secret: {secret_name}")
            raise Exception(f"Invalid request for secret '{secret_name}'")
        else:
            logger.error(f"Error retrieving secret {secret_name}: {e}")
            raise

    except Exception as e:
        logger.error(f"Unexpected error retrieving secret {secret_name}: {e}")
        raise


def get_secret_value(secret_name: str, key: str, region_name: str = "eu-central-1", fallback: str = None) -> str:
    """
    Get a specific key from a secret (for key/value secrets).

    Args:
        secret_name: Name of the secret
        key: Key name to retrieve from the secret
        region_name: AWS region (default: eu-central-1)
        fallback: Fallback value if key not found

    Returns:
        str: Value of the key, or fallback if not found

    Example:
        >>> creds = get_secret_value('chatbot/google-calendar', 'GOOGLE_SERVICE_ACCOUNT_KEY')
    """
    try:
        secret_dict = get_secret(secret_name, region_name)

        if key in secret_dict:
            return secret_dict[key]
        else:
            logger.warning(f"Key '{key}' not found in secret '{secret_name}'")
            if fallback is not None:
                logger.info(f"Using fallback value for key '{key}'")
                return fallback
            else:
                raise KeyError(f"Key '{key}' not found in secret '{secret_name}' and no fallback provided")

    except Exception as e:
        logger.error(f"Error getting secret value for key '{key}': {e}")
        if fallback is not None:
            logger.warning(f"Returning fallback value due to error")
            return fallback
        else:
            raise


def clear_secrets_cache():
    """Clear the secrets cache. Useful for testing."""
    global _secrets_cache
    _secrets_cache = {}
    logger.info("Secrets cache cleared")
