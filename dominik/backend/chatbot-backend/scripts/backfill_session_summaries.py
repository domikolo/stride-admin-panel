#!/usr/bin/env python3
"""
Backfill script for session_summaries table.

This script scans all messages in Conversations-stride table,
groups them by session_id, and creates summary items in
the session_summaries table.

Usage:
    python3 backfill_session_summaries.py
"""

import boto3
from collections import defaultdict
from decimal import Decimal

# Initialize DynamoDB resource
dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
conversations_table = dynamodb.Table("Conversations-stride")
summaries_table = dynamodb.Table("session_summaries")

TTL_SECONDS = 14 * 24 * 3600  # 14 days


def backfill_session_summaries():
    """
    Scan all messages from Conversations-stride and create session summaries.
    """
    print("=" * 60)
    print("Starting backfill of session_summaries table")
    print("=" * 60)

    # Scan all messages
    print("\n[1/4] Scanning Conversations-stride table...")
    response = conversations_table.scan()
    items = response.get("Items", [])

    # Handle pagination if there are more items
    while "LastEvaluatedKey" in response:
        print(f"   Scanned {len(items)} items so far, continuing...")
        response = conversations_table.scan(
            ExclusiveStartKey=response["LastEvaluatedKey"]
        )
        items.extend(response.get("Items", []))

    print(f"   ✓ Scanned {len(items)} total messages")

    # Group by session_id
    print("\n[2/4] Grouping messages by session_id...")
    sessions = defaultdict(list)
    for item in items:
        session_id = item.get("session_id")
        if session_id:
            sessions[session_id].append(item)

    print(f"   ✓ Found {len(sessions)} unique sessions")

    # Create summary for each session
    print("\n[3/4] Creating session summaries...")
    success_count = 0
    error_count = 0

    for idx, (session_id, messages) in enumerate(sessions.items(), 1):
        try:
            # Sort messages by timestamp
            messages.sort(key=lambda x: int(x.get("timestamp", 0)))

            first_msg = messages[0]
            last_msg = messages[-1]

            # Find first user message for preview
            first_user_msg = next(
                (m for m in messages if m.get("role") == "user"),
                None
            )
            preview = (
                first_user_msg.get("text", "")[:100]
                if first_user_msg
                else ""
            )

            # Get timestamps
            first_timestamp = int(first_msg.get("timestamp", 0))
            last_timestamp = int(last_msg.get("timestamp", 0))

            # Create summary item
            summary_item = {
                "session_id": session_id,
                "SK": "SUMMARY",
                "client_id": "stride-services",
                "conversation_start": first_timestamp,
                "conversation_end": last_timestamp,
                "message_count": len(messages),
                "first_message_preview": preview,
                "last_activity": last_timestamp,
                "status": "completed",
                "ttl": last_timestamp + TTL_SECONDS,
            }

            # Put item into session_summaries table
            summaries_table.put_item(Item=summary_item)

            success_count += 1

            # Progress indicator
            if idx % 10 == 0:
                print(f"   Processed {idx}/{len(sessions)} sessions...")

        except Exception as e:
            error_count += 1
            print(f"   ✗ Error processing session {session_id}: {e}")

    print(f"\n   ✓ Created {success_count} session summaries")
    if error_count > 0:
        print(f"   ✗ Failed: {error_count} sessions")

    # Summary
    print("\n[4/4] Backfill complete!")
    print("=" * 60)
    print(f"Total sessions: {len(sessions)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {error_count}")
    print("=" * 60)

    # Verify
    print("\n[Optional] Verifying session_summaries table...")
    verify_response = summaries_table.scan(
        Select="COUNT"
    )
    count = verify_response.get("Count", 0)
    print(f"   Session summaries table now has {count} items")

    return success_count, error_count


if __name__ == "__main__":
    try:
        success, errors = backfill_session_summaries()
        exit(0 if errors == 0 else 1)
    except KeyboardInterrupt:
        print("\n\nBackfill interrupted by user.")
        exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
