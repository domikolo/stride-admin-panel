"""
Backfill Lambda - one-time execution
Wypełnia session_summaries dla istniejących konwersacji
"""

import boto3
from collections import defaultdict

dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
conversations_table = dynamodb.Table("Conversations-stride")
summaries_table = dynamodb.Table("session_summaries")

TTL_SECONDS = 14 * 24 * 3600  # 14 days


def lambda_handler(event, context):
    """Lambda handler for one-time backfill"""

    print("=" * 60)
    print("Starting backfill of session_summaries")
    print("=" * 60)

    # Scan all messages
    print("\n[1/3] Scanning Conversations-stride...")
    response = conversations_table.scan()
    items = response.get("Items", [])

    # Handle pagination
    while "LastEvaluatedKey" in response:
        print(f"   Continuing scan... ({len(items)} items so far)")
        response = conversations_table.scan(
            ExclusiveStartKey=response["LastEvaluatedKey"]
        )
        items.extend(response.get("Items", []))

    print(f"   ✓ Found {len(items)} messages")

    # Group by session_id
    print("\n[2/3] Grouping by session_id...")
    sessions = defaultdict(list)
    for item in items:
        session_id = item.get("session_id")
        if session_id:
            sessions[session_id].append(item)

    print(f"   ✓ Found {len(sessions)} unique sessions")

    # Create summaries
    print("\n[3/3] Creating summaries...")
    success = 0
    errors = 0

    for session_id, messages in sessions.items():
        try:
            # Sort by timestamp
            messages.sort(key=lambda x: int(x.get("timestamp", 0)))

            first_msg = messages[0]
            last_msg = messages[-1]

            # Find first user message
            first_user = next(
                (m for m in messages if m.get("role") == "user"),
                None
            )
            preview = first_user.get("text", "")[:100] if first_user else ""

            # Timestamps
            first_ts = int(first_msg.get("timestamp", 0))
            last_ts = int(last_msg.get("timestamp", 0))

            # Create summary
            summaries_table.put_item(Item={
                "session_id": session_id,
                "SK": "SUMMARY",
                "client_id": "stride-services",
                "conversation_start": first_ts,
                "conversation_end": last_ts,
                "message_count": len(messages),
                "first_message_preview": preview,
                "last_activity": last_ts,
                "status": "completed",
                "ttl": last_ts + TTL_SECONDS
            })

            success += 1

        except Exception as e:
            errors += 1
            print(f"   ✗ Error for {session_id}: {e}")

    print(f"   ✓ Created {success} summaries")
    if errors > 0:
        print(f"   ✗ Errors: {errors}")

    # Summary
    print("\n" + "=" * 60)
    print(f"COMPLETE: {success} sessions backfilled")
    print("=" * 60)

    return {
        "statusCode": 200,
        "body": {
            "total_messages": len(items),
            "total_sessions": len(sessions),
            "success": success,
            "errors": errors
        }
    }
