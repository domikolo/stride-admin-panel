"""
Admin Panel API Lambda Handler

Endpoints:
- GET /clients - Lista wszystkich klientów
- GET /clients/{client_id}/stats - Statystyki klienta
- GET /clients/{client_id}/conversations - Konwersacje klienta
- GET /clients/{client_id}/appointments - Spotkania klienta
- GET /clients/{client_id}/trending-topics - Trending questions/topics
- GET /clients/{client_id}/trending-topics/gaps - Knowledge base gaps
- POST /clients/{client_id}/trending-topics/analyze - Trigger manual analysis
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
trending_topics_table = dynamodb.Table("platform_trending_topics")


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

    # Get HTTP method (works for both REST API and HTTP API)
    http_method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")

    # Handle OPTIONS (CORS preflight)
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": headers,
            "body": ""
        }

    # Health check endpoint (no auth required)
    # HTTP API v2 uses rawPath, REST API uses path
    request_path = event.get("rawPath") or event.get("path", "")
    print(f"Request path: {request_path}")

    if request_path in ["/health", "/"]:
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "status": "healthy",
                "message": "Admin API is running",
                "timestamp": datetime.utcnow().isoformat(),
                "path_received": request_path
            })
        }

    # Test endpoint - check DynamoDB connection (no auth)
    if request_path == "/test-db":
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
        # HTTP API (v2) uses lowercase headers, REST API uses mixed case
        request_headers = event.get("headers", {})
        auth_header = request_headers.get("authorization") or request_headers.get("Authorization") or ""
        token = auth_header.replace("Bearer ", "").replace("bearer ", "")

        if not token:
            print(f"Missing token. Headers received: {list(request_headers.keys())}")
            return error_response(401, "Missing authorization token", headers)

        user = verify_jwt_token(token)
        if not user:
            return error_response(401, "Invalid token", headers)

    except Exception as e:
        print(f"Auth error: {e}")
        return error_response(401, f"Authentication failed: {str(e)}", headers)

    # Route request
    # HTTP API v2 uses rawPath, REST API uses path
    path = event.get("rawPath") or event.get("path", "")
    method = http_method

    print(f"Routing request: method={method}, path={path}")

    try:
        if path == "/clients" and method == "GET":
            return get_clients(user, headers)

        elif path.startswith("/clients/") and path.endswith("/stats") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_stats(user, client_id, event.get("queryStringParameters", {}), headers)

        elif path.startswith("/clients/") and path.endswith("/stats/daily") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_daily_stats(user, client_id, event.get("queryStringParameters", {}), headers)

        elif path.startswith("/clients/") and path.endswith("/conversations") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_conversations(user, client_id, event.get("queryStringParameters", {}), headers)

        elif path.startswith("/clients/") and path.endswith("/appointments") and method == "GET":
            client_id = path.split("/")[2]
            return get_client_appointments(user, client_id, event.get("queryStringParameters", {}), headers)

        elif "/conversations/" in path and method == "GET" and not path.endswith("/conversations"):
            # GET /clients/{client_id}/conversations/{session_id}
            parts = path.split("/")
            if len(parts) >= 5:
                client_id = parts[2]
                session_id = parts[4]
                return get_conversation_details(user, client_id, session_id, headers)

        # Trending Topics endpoints
        elif path.startswith("/clients/") and path.endswith("/trending-topics/gaps") and method == "GET":
            client_id = path.split("/")[2]
            return get_trending_topics_gaps(user, client_id, headers)

        elif path.startswith("/clients/") and path.endswith("/trending-topics/analyze") and method == "POST":
            client_id = path.split("/")[2]
            return trigger_trending_analysis(user, client_id, headers)

        elif path.startswith("/clients/") and path.endswith("/trending-topics") and method == "GET":
            client_id = path.split("/")[2]
            return get_trending_topics(user, client_id, event.get("queryStringParameters", {}), headers)

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


def get_client_daily_stats(user: Dict, client_id: str, query_params: Dict, headers: Dict) -> Dict:
    """GET /clients/{client_id}/stats/daily - Daily stats for charts"""

    # Check authorization
    user_role = get_user_role(user)
    user_client_id = user.get("custom:client_id")

    if user_role == "client" and user_client_id != client_id:
        return error_response(403, "You can only view your own stats", headers)

    try:
        # Get last 30 days
        days = int(query_params.get("days", 30))
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Query analytics events
        response = analytics_events_table.query(
            KeyConditionExpression=Key("client_id").eq(client_id) &
                                  Key("event_timestamp").between(
                                      start_date.isoformat() + "Z",
                                      end_date.isoformat() + "Z"
                                  )
        )

        events = response.get("Items", [])

        # Group by date
        daily_data = {}
        for event in events:
            timestamp = event.get("event_timestamp", "")
            event_date = timestamp[:10]  # YYYY-MM-DD
            event_type = event.get("event_type")

            if event_date not in daily_data:
                daily_data[event_date] = {
                    "date": event_date,
                    "conversations": 0,
                    "appointments": 0,
                    "messages": 0
                }

            if event_type == "conversation_start":
                daily_data[event_date]["conversations"] += 1
            elif event_type == "appointment_created":
                daily_data[event_date]["appointments"] += 1
            elif event_type == "message_sent":
                daily_data[event_date]["messages"] += 1

        # Convert to sorted list
        daily_stats = sorted(daily_data.values(), key=lambda x: x["date"])

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "client_id": client_id,
                "daily_stats": daily_stats,
                "count": len(daily_stats)
            })
        }

    except Exception as e:
        print(f"Error getting daily stats: {e}")
        return error_response(500, f"Failed to get daily stats: {str(e)}", headers)


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
            conversations_table_name = "Conversations-stride"
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
                "first_message": convert_timestamp_to_iso(messages[0]["timestamp"]) if messages else None,
                "last_message": convert_timestamp_to_iso(messages[-1]["timestamp"]) if messages else None,
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


def get_conversation_details(user: Dict, client_id: str, session_id: str, headers: Dict) -> Dict:
    """GET /clients/{client_id}/conversations/{session_id} - Szczegóły konwersacji"""

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
            conversations_table_name = "Conversations-stride"
        else:
            tables_prefix = client.get("tables_prefix", client_id)
            conversations_table_name = f"{tables_prefix}-conversations"

        conversations_table = dynamodb.Table(conversations_table_name)

        # Query messages for this session
        response = conversations_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id)
        )

        messages = response.get("Items", [])

        # Sort by timestamp
        messages.sort(key=lambda x: int(x.get("timestamp", 0)))

        # Format messages
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "timestamp": convert_timestamp_to_iso(msg.get("timestamp")),
                "role": msg.get("role"),
                "text": msg.get("text"),
            })

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "session_id": session_id,
                "messages": formatted_messages,
                "count": len(formatted_messages)
            })
        }

    except Exception as e:
        print(f"Error getting conversation details: {e}")
        return error_response(500, f"Failed to get conversation details: {str(e)}", headers)


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
                "datetime": item.get("datetime"),  # This should already be ISO string from chatbot
                "status": item.get("status"),
                "contact_info": item.get("contact_info"),
                "created_at": convert_timestamp_to_iso(item.get("created_at")),
                "verified_at": convert_timestamp_to_iso(item.get("verified_at")),
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


def convert_timestamp_to_iso(timestamp: Any) -> Optional[str]:
    """Convert Unix timestamp (string or int) to ISO 8601 string"""
    if not timestamp:
        return None
    try:
        # Handle both string and int timestamps
        ts_int = int(timestamp)
        return datetime.fromtimestamp(ts_int).isoformat() + "Z"
    except (ValueError, TypeError):
        # If already ISO string or invalid, return as is
        return str(timestamp) if timestamp else None


# =============================================================================
# TRENDING TOPICS ENDPOINTS
# =============================================================================

def get_trending_topics(user: Dict, client_id: str, query_params: Dict, headers: Dict) -> Dict:
    """GET /clients/{client_id}/trending-topics - Get trending questions/topics
    
    Query params:
        period: 'daily' (default) or 'weekly'
    """

    # Check authorization
    user_role = get_user_role(user)
    user_client_id = user.get("custom:client_id")

    if user_role == "client" and user_client_id != client_id:
        return error_response(403, "You can only view your own trending topics", headers)

    try:
        # Get period type from query params
        period_type = query_params.get("period", "daily") if query_params else "daily"
        if period_type not in ("daily", "weekly"):
            period_type = "daily"
        
        # Use composite key: client_id#period_type
        composite_key = f"{client_id}#{period_type}"
        
        # Query trending topics for this client + period
        response = trending_topics_table.query(
            KeyConditionExpression=Key("client_id").eq(composite_key)
        )

        topics = response.get("Items", [])

        # Sort by rank (or count if rank not present)
        topics.sort(key=lambda x: x.get("rank", x.get("count", 0)))

        # Format response
        formatted_topics = []
        for topic in topics:
            # Convert Decimal to float for JSON serialization
            intent = topic.get("intent_breakdown", {})
            intent_formatted = {
                k: float(v) if hasattr(v, '__float__') else v 
                for k, v in intent.items()
            }

            formatted_topics.append({
                "topic_id": topic.get("topic_id"),
                "topic_name": topic.get("topic_name"),
                "count": int(topic.get("count", 0)),
                "question_examples": topic.get("question_examples", []),
                "trend": topic.get("trend", "stable"),
                "intent_breakdown": intent_formatted,
                "is_gap": bool(topic.get("is_gap", False)),
                "gap_reason": topic.get("gap_reason", ""),
                "category": topic.get("category", "other"),
                "smart_insight": topic.get("smart_insight", ""),
                "rank": int(topic.get("rank", 0)),
            })

        # Calculate summary stats
        total_questions = sum(t["count"] for t in formatted_topics)
        gaps_count = sum(1 for t in formatted_topics if t["is_gap"])

        # Get period info from first topic
        period_start = topics[0].get("period_start") if topics else None
        period_end = topics[0].get("period_end") if topics else None
        last_updated = topics[0].get("last_updated") if topics else None

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "client_id": client_id,
                "period_type": period_type,
                "topics": formatted_topics,
                "summary": {
                    "total_topics": len(formatted_topics),
                    "total_questions": total_questions,
                    "gaps_count": gaps_count,
                },
                "period": {
                    "start": period_start,
                    "end": period_end,
                },
                "last_updated": last_updated,
            })
        }

    except Exception as e:
        print(f"Error getting trending topics: {e}")
        return error_response(500, f"Failed to get trending topics: {str(e)}", headers)


def get_trending_topics_gaps(user: Dict, client_id: str, headers: Dict) -> Dict:
    """GET /clients/{client_id}/trending-topics/gaps - Get knowledge base gaps
    
    Gaps are only tracked for daily analysis.
    """

    # Check authorization
    user_role = get_user_role(user)
    user_client_id = user.get("custom:client_id")

    if user_role == "client" and user_client_id != client_id:
        return error_response(403, "You can only view your own gaps", headers)

    try:
        # Gaps are only in daily data
        composite_key = f"{client_id}#daily"
        
        # Query trending topics for this client (daily)
        response = trending_topics_table.query(
            KeyConditionExpression=Key("client_id").eq(composite_key)
        )

        topics = response.get("Items", [])

        # Filter only gaps
        gaps = []
        for topic in topics:
            if topic.get("is_gap"):
                gaps.append({
                    "topic_id": topic.get("topic_id"),
                    "topic_name": topic.get("topic_name"),
                    "count": int(topic.get("count", 0)),
                    "question_examples": topic.get("question_examples", []),
                    "gap_reason": topic.get("gap_reason", ""),
                    "suggestion": f"Dodaj informacje o '{topic.get('topic_name')}' do bazy wiedzy chatbota."
                })

        # Sort by count (most asked gaps first)
        gaps.sort(key=lambda x: x["count"], reverse=True)

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "client_id": client_id,
                "gaps": gaps,
                "count": len(gaps),
                "message": f"Znaleziono {len(gaps)} luk w bazie wiedzy" if gaps else "Brak wykrytych luk w bazie wiedzy"
            })
        }

    except Exception as e:
        print(f"Error getting trending topics gaps: {e}")
        return error_response(500, f"Failed to get gaps: {str(e)}", headers)


def trigger_trending_analysis(user: Dict, client_id: str, headers: Dict) -> Dict:
    """POST /clients/{client_id}/trending-topics/analyze - Trigger manual analysis"""

    # Check authorization - only owners can trigger manual analysis
    user_role = get_user_role(user)

    if user_role != "owner":
        return error_response(403, "Only owners can trigger manual analysis", headers)

    try:
        # Get Lambda client
        lambda_client = boto3.client("lambda")

        # Invoke the analyzer Lambda asynchronously
        analyzer_function_name = os.environ.get(
            "TRENDING_ANALYZER_LAMBDA", 
            "trending-topics-analyzer"
        )

        payload = {
            "client_id": client_id,
            "hours": 24,  # Analyze last 24 hours
            "manual_trigger": True
        }

        response = lambda_client.invoke(
            FunctionName=analyzer_function_name,
            InvocationType="Event",  # Async invocation
            Payload=json.dumps(payload)
        )

        return {
            "statusCode": 202,  # Accepted
            "headers": headers,
            "body": json.dumps({
                "status": "accepted",
                "message": f"Analysis triggered for {client_id}. Results will be available in a few minutes.",
                "client_id": client_id
            })
        }

    except Exception as e:
        print(f"Error triggering analysis: {e}")
        return error_response(500, f"Failed to trigger analysis: {str(e)}", headers)


def error_response(status_code: int, message: str, headers: Dict) -> Dict:
    """Helper function to return error response"""
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps({"error": message})
    }

