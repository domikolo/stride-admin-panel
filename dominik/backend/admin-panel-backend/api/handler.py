"""
Admin Panel API Lambda Handler

Endpoints:
- GET /clients - Lista wszystkich klientów
- GET /clients/{client_id}/stats - Statystyki klienta
- GET /clients/{client_id}/conversations - Konwersacje klienta
- GET /clients/{client_id}/appointments - Spotkania klienta
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key
from typing import Dict, Any, Optional
from .auth import verify_jwt_token, get_user_role

# DynamoDB tables
dynamodb = boto3.resource("dynamodb")
clients_registry_table = dynamodb.Table("clients_registry")
analytics_events_table = dynamodb.Table("platform_analytics_events")


def lambda_handler(event, context):
    """Main Lambda handler with routing"""

    print(f"Event: {json.dumps(event)}")

    # CORS headers
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Content-Type": "application/json"
    }

    # Handle OPTIONS (CORS preflight)
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": headers,
            "body": ""
        }

    # Health check endpoint (no auth required)
    path = event.get("path", "")
    raw_path = event.get("rawPath", "")
    print(f"Path: {path}, RawPath: {raw_path}")

    if path in ["/health", "/"] or raw_path in ["/health", "/"]:
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "status": "healthy",
                "message": "Admin API is running",
                "timestamp": datetime.utcnow().isoformat(),
                "path_received": path or raw_path
            })
        }

    # Test endpoint - check DynamoDB connection (no auth)
    if path == "/test-db" or raw_path == "/test-db":
        try:
            # Test query clients_registry
            response = clients_registry_table.scan()
            clients = response.get("Items", [])

            # Test query analytics_events
            analytics_response = analytics_events_table.scan(Limit=5)
            events_count = len(analytics_response.get("Items", []))

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({
                    "status": "success",
                    "clients_found": len(clients),
                    "clients": [c.get("client_id") for c in clients],
                    "analytics_events_sample": events_count,
                    "message": "DynamoDB connection working!"
                })
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({
                    "status": "error",
                    "error": str(e),
                    "message": "DynamoDB connection failed"
                })
            }

    # Verify JWT token
    try:
        token = event.get("headers", {}).get("Authorization", "").replace("Bearer ", "")
        if not token:
            return error_response(401, "Missing authorization token", headers)

        user = verify_jwt_token(token)
        if not user:
            return error_response(401, "Invalid token", headers)

    except Exception as e:
        print(f"Auth error: {e}")
        return error_response(401, f"Authentication failed: {str(e)}", headers)

    # Route request
    path = event.get("path", "")
    method = event.get("httpMethod", "")

    try:
        if path == "/clients" and method == "GET":
            return get_clients(user, headers)

        elif path.startswith("/clients/") and path.endswith("/stats") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_stats(user, client_id, event.get("queryStringParameters", {}), headers)

        elif path.startswith("/clients/") and path.endswith("/conversations") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_conversations(user, client_id, event.get("queryStringParameters", {}), headers)

        elif path.startswith("/clients/") and path.endswith("/appointments") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_appointments(user, client_id, event.get("queryStringParameters", {}), headers)

        else:
            return error_response(404, "Endpoint not found", headers)

    except Exception as e:
        print(f"Handler error: {e}")
        return error_response(500, f"Internal server error: {str(e)}", headers)


def get_clients(user: Dict, headers: Dict) -> Dict:
    """GET /clients - Lista wszystkich klientów (tylko dla owners)"""

    if get_user_role(user) != "owner":
        return error_response(403, "Only owners can list all clients", headers)

    try:
        # Scan clients_registry table
        response = clients_registry_table.scan()
        clients = response.get("Items", [])

        # Format response
        clients_list = []
        for client in clients:
            clients_list.append({
                "client_id": client.get("client_id"),
                "company_name": client.get("company_name"),
                "status": client.get("status"),
                "created_at": client.get("created_at"),
                "lambda_function_name": client.get("lambda_function_name"),
                "total_conversations": client.get("total_conversations", 0)
            })

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "clients": clients_list,
                "count": len(clients_list)
            })
        }

    except Exception as e:
        print(f"Error getting clients: {e}")
        return error_response(500, f"Failed to get clients: {str(e)}", headers)


def get_client_stats(user: Dict, client_id: str, query_params: Dict, headers: Dict) -> Dict:
    """GET /clients/{client_id}/stats - Statystyki klienta"""

    # Check authorization
    user_role = get_user_role(user)
    user_client_id = user.get("custom:client_id")

    if user_role == "client" and user_client_id != client_id:
        return error_response(403, "You can only view your own stats", headers)

    try:
        # Get period from query params (default: last 30 days)
        period = query_params.get("period", "MONTHLY")

        # Calculate date range
        end_date = datetime.utcnow()
        if period == "DAILY":
            start_date = end_date - timedelta(days=1)
        elif period == "WEEKLY":
            start_date = end_date - timedelta(days=7)
        else:  # MONTHLY
            start_date = end_date - timedelta(days=30)

        start_timestamp = start_date.isoformat() + "Z"
        end_timestamp = end_date.isoformat() + "Z"

        # Query analytics events
        response = analytics_events_table.query(
            KeyConditionExpression=Key("client_id").eq(client_id) &
                                  Key("event_timestamp").between(start_timestamp, end_timestamp)
        )

        events = response.get("Items", [])

        # Calculate stats
        conversation_starts = [e for e in events if e["event_type"] == "conversation_start"]
        message_events = [e for e in events if e["event_type"] == "message_sent"]
        appointment_created_events = [e for e in events if e["event_type"] == "appointment_created"]
        appointment_verified_events = [e for e in events if e["event_type"] == "appointment_verified"]

        # Calculate total cost
        total_cost = sum(
            float(e.get("metadata", {}).get("bedrock_cost", 0))
            for e in message_events
        )

        # Calculate total tokens
        total_tokens_input = sum(
            int(e.get("metadata", {}).get("bedrock_tokens_input", 0))
            for e in message_events
        )
        total_tokens_output = sum(
            int(e.get("metadata", {}).get("bedrock_tokens_output", 0))
            for e in message_events
        )

        # Calculate conversion rate
        conversations_count = len(conversation_starts)
        appointments_created = len(appointment_created_events)
        appointments_verified = len(appointment_verified_events)

        conversion_rate = (appointments_created / conversations_count * 100) if conversations_count > 0 else 0
        verification_rate = (appointments_verified / appointments_created * 100) if appointments_created > 0 else 0

        stats = {
            "client_id": client_id,
            "period": period,
            "start_date": start_timestamp,
            "end_date": end_timestamp,
            "conversations_count": conversations_count,
            "messages_count": len(message_events),
            "appointments_created": appointments_created,
            "appointments_verified": appointments_verified,
            "conversion_rate": round(conversion_rate, 2),
            "verification_rate": round(verification_rate, 2),
            "total_cost_usd": round(total_cost, 4),
            "total_tokens": {
                "input": total_tokens_input,
                "output": total_tokens_output,
                "total": total_tokens_input + total_tokens_output
            }
        }

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps(stats)
        }

    except Exception as e:
        print(f"Error getting stats: {e}")
        return error_response(500, f"Failed to get stats: {str(e)}", headers)


def get_client_conversations(user: Dict, client_id: str, query_params: Dict, headers: Dict) -> Dict:
    """GET /clients/{client_id}/conversations - Konwersacje klienta"""

    # Check authorization
    user_role = get_user_role(user)
    user_client_id = user.get("custom:client_id")

    if user_role == "client" and user_client_id != client_id:
        return error_response(403, "You can only view your own conversations", headers)

    try:
        # Get client info from registry to find table name
        client_response = clients_registry_table.get_item(
            Key={"client_id": client_id, "SK": "PROFILE"}
        )

        if "Item" not in client_response:
            return error_response(404, "Client not found", headers)

        client = client_response["Item"]

        # For stride-services (MVP), use existing table
        if client_id == "stride-services":
            conversations_table_name = "conversations"
        else:
            # For future clients
            tables_prefix = client.get("tables_prefix", client_id)
            conversations_table_name = f"{tables_prefix}-conversations"

        conversations_table = dynamodb.Table(conversations_table_name)

        # Scan conversations (paginated)
        limit = int(query_params.get("limit", 50))

        # Get unique sessions
        response = conversations_table.scan(Limit=limit)
        items = response.get("Items", [])

        # Group by session_id
        sessions = {}
        for item in items:
            session_id = item.get("session_id")
            if session_id not in sessions:
                sessions[session_id] = []
            sessions[session_id].append({
                "timestamp": item.get("timestamp"),
                "role": item.get("role"),
                "text": item.get("text")
            })

        # Format response
        conversations = []
        for session_id, messages in sessions.items():
            # Sort messages by timestamp
            messages.sort(key=lambda x: x["timestamp"])

            conversations.append({
                "session_id": session_id,
                "messages_count": len(messages),
                "first_message": messages[0]["timestamp"] if messages else None,
                "last_message": messages[-1]["timestamp"] if messages else None,
                "preview": messages[0]["text"][:100] if messages else ""
            })

        # Sort by last message
        conversations.sort(key=lambda x: x["last_message"] or "", reverse=True)

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "conversations": conversations[:limit],
                "count": len(conversations)
            })
        }

    except Exception as e:
        print(f"Error getting conversations: {e}")
        return error_response(500, f"Failed to get conversations: {str(e)}", headers)


def get_client_appointments(user: Dict, client_id: str, query_params: Dict, headers: Dict) -> Dict:
    """GET /clients/{client_id}/appointments - Spotkania klienta"""

    # Check authorization
    user_role = get_user_role(user)
    user_client_id = user.get("custom:client_id")

    if user_role == "client" and user_client_id != client_id:
        return error_response(403, "You can only view your own appointments", headers)

    try:
        # Get client info from registry to find table name
        client_response = clients_registry_table.get_item(
            Key={"client_id": client_id, "SK": "PROFILE"}
        )

        if "Item" not in client_response:
            return error_response(404, "Client not found", headers)

        client = client_response["Item"]

        # For stride-services (MVP), use existing table
        if client_id == "stride-services":
            appointments_table_name = "appointments"
        else:
            # For future clients
            tables_prefix = client.get("tables_prefix", client_id)
            appointments_table_name = f"{tables_prefix}-appointments"

        appointments_table = dynamodb.Table(appointments_table_name)

        # Scan appointments (paginated)
        limit = int(query_params.get("limit", 50))
        status_filter = query_params.get("status")  # pending, verified, cancelled

        response = appointments_table.scan(Limit=limit * 2)  # Get more for filtering
        items = response.get("Items", [])

        # Filter by status if provided
        if status_filter:
            items = [item for item in items if item.get("status") == status_filter]

        # Format response
        appointments = []
        for item in items[:limit]:
            appointments.append({
                "appointment_id": item.get("appointment_id"),
                "session_id": item.get("session_id"),
                "datetime": item.get("datetime"),
                "status": item.get("status"),
                "contact_info": item.get("contact_info"),
                "created_at": item.get("created_at"),
                "verified_at": item.get("verified_at"),
                "google_event_id": item.get("google_event_id")
            })

        # Sort by datetime
        appointments.sort(key=lambda x: x.get("datetime", ""), reverse=True)

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "appointments": appointments,
                "count": len(appointments)
            })
        }

    except Exception as e:
        print(f"Error getting appointments: {e}")
        return error_response(500, f"Failed to get appointments: {str(e)}", headers)


def error_response(status_code: int, message: str, headers: Dict) -> Dict:
    """Helper function to return error response"""
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps({"error": message})
    }
