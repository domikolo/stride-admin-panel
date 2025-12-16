"""
AWS Cognito JWT Verification

Weryfikuje JWT tokeny z Cognito User Pool
"""

import json
import time
import urllib.request
from jose import jwk, jwt
from jose.utils import base64url_decode
from typing import Dict, Optional

# Cognito User Pool configuration
REGION = "eu-central-1"
USER_POOL_ID = "eu-central-1_foqQPqZsC"
APP_CLIENT_ID = "2tkv1rheoufn1c19cf8mppdmus"

# Cognito public keys URL
KEYS_URL = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"

# Cache for public keys
_keys_cache = None
_keys_cache_time = 0
CACHE_TTL = 3600  # 1 hour


def get_public_keys():
    """Pobierz publiczne klucze Cognito (z cache)"""
    global _keys_cache, _keys_cache_time

    now = time.time()
    if _keys_cache and (now - _keys_cache_time) < CACHE_TTL:
        return _keys_cache

    # Fetch keys from Cognito
    with urllib.request.urlopen(KEYS_URL) as f:
        response = f.read()

    keys = json.loads(response.decode('utf-8'))['keys']
    _keys_cache = keys
    _keys_cache_time = now

    return keys


def verify_jwt_token(token: str) -> Optional[Dict]:
    """
    Weryfikuj JWT token z Cognito

    Returns:
        Dict z claims użytkownika jeśli token jest valid, None jeśli invalid
    """

    try:
        # Get the kid from the headers prior to verification
        headers = jwt.get_unverified_headers(token)
        kid = headers['kid']

        # Search for the kid in the downloaded public keys
        keys = get_public_keys()
        key_index = -1
        for i in range(len(keys)):
            if kid == keys[i]['kid']:
                key_index = i
                break

        if key_index == -1:
            print('Public key not found in jwks.json')
            return None

        # Construct the public key
        public_key = jwk.construct(keys[key_index])

        # Get the last two sections of the token (message and signature)
        message, encoded_signature = str(token).rsplit('.', 1)

        # Decode the signature
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))

        # Verify the signature
        if not public_key.verify(message.encode("utf8"), decoded_signature):
            print('Signature verification failed')
            return None

        print('Signature successfully verified')

        # Verify token claims
        claims = jwt.get_unverified_claims(token)

        # Verify the token expiration
        if time.time() > claims['exp']:
            print('Token is expired')
            return None

        # Verify the audience (client_id)
        if claims['aud'] != APP_CLIENT_ID and claims.get('client_id') != APP_CLIENT_ID:
            print('Token was not issued for this audience')
            return None

        # Token is valid!
        print(f"Token valid for user: {claims.get('email')}")
        return claims

    except Exception as e:
        print(f"Token verification error: {e}")
        return None


def get_user_role(user: Dict) -> str:
    """
    Pobierz rolę użytkownika z claims

    Returns:
        "owner" | "client"
    """

    # Check custom:role attribute
    role = user.get("custom:role", "client")

    # Check if user is in "owners" group
    groups = user.get("cognito:groups", [])
    if "owners" in groups:
        return "owner"

    return role


def get_user_client_id(user: Dict) -> Optional[str]:
    """
    Pobierz client_id użytkownika z claims

    Returns:
        client_id lub None jeśli owner
    """
    return user.get("custom:client_id")
