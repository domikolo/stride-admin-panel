"""
Trending Topics Analyzer - Main Lambda Handler

Scheduled to run daily at 2 AM (EventBridge cron).
Analyzes conversations from the last 24 hours and updates trending topics.

Flow:
1. Load conversations from platform_analytics_events (last 24h)
2. Extract user messages
3. Pre-filter junk
4. Detect intents
5. Detect gaps
6. Cluster with AI
7. Apply smart threshold
8. Save to platform_trending_topics
9. Update trends (compare with previous)
"""

import os
import json
import boto3
import uuid
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Tuple

# Import local modules
from .filters import filter_junk_messages
from .intent import detect_intent, get_intent_breakdown_percent, IntentType
from .gaps import detect_gap, GapResult
from .threshold import get_significant_topics
from .clustering import cluster_questions, ClusteringResult


# DynamoDB tables
dynamodb = boto3.resource("dynamodb")
analytics_table = dynamodb.Table("platform_analytics_events")
topics_table = dynamodb.Table("platform_trending_topics")
conversations_table_name = os.environ.get("CONVERSATIONS_TABLE", "stride-chatbot-conversations-prod")
conversations_table = dynamodb.Table(conversations_table_name)

# Default client ID (for Stride Services chatbot)
DEFAULT_CLIENT_ID = os.environ.get("CLIENT_ID", "stride-services")

# Analysis period
ANALYSIS_HOURS = 24
FULL_ANALYSIS_DAYS = 14


def get_recent_analytics_events(
    client_id: str,
    hours: int = ANALYSIS_HOURS
) -> List[Dict[str, Any]]:
    """
    Get analytics events from the last N hours.
    
    Returns events where event_type = 'message_sent'
    """
    now = datetime.utcnow()
    start_time = (now - timedelta(hours=hours)).isoformat() + "Z"
    
    try:
        response = analytics_table.query(
            KeyConditionExpression="client_id = :cid AND event_timestamp >= :start",
            ExpressionAttributeValues={
                ":cid": client_id,
                ":start": start_time,
            },
            Limit=1000  # Max events per query
        )
        return response.get("Items", [])
    except Exception as e:
        print(f"Error querying analytics events: {e}")
        return []


def get_session_conversations(session_ids: List[str]) -> Dict[str, List[Dict]]:
    """
    Get full conversation history for given session IDs.
    
    Returns dict: {session_id: [messages...]}
    """
    conversations = {}
    
    for session_id in session_ids[:100]:  # Limit to 100 sessions
        try:
            response = conversations_table.query(
                KeyConditionExpression="session_id = :sid",
                ExpressionAttributeValues={":sid": session_id},
                ScanIndexForward=True  # Oldest first
            )
            conversations[session_id] = response.get("Items", [])
        except Exception as e:
            print(f"Error getting conversation {session_id}: {e}")
            conversations[session_id] = []
    
    return conversations


def extract_user_messages(conversations: Dict[str, List[Dict]]) -> List[str]:
    """Extract all user messages from conversations."""
    messages = []
    for session_id, msgs in conversations.items():
        for msg in msgs:
            if msg.get("role") == "user":
                text = msg.get("text", "").strip()
                if text:
                    messages.append(text)
    return messages


def extract_qa_pairs(conversations: Dict[str, List[Dict]]) -> List[Tuple[str, str]]:
    """
    Extract question-answer pairs for gap detection.
    
    Returns list of (user_question, bot_response) tuples.
    """
    pairs = []
    for session_id, msgs in conversations.items():
        for i, msg in enumerate(msgs):
            if msg.get("role") == "user" and i + 1 < len(msgs):
                next_msg = msgs[i + 1]
                if next_msg.get("role") == "assistant":
                    user_q = msg.get("text", "").strip()
                    bot_r = next_msg.get("text", "").strip()
                    if user_q and bot_r:
                        pairs.append((user_q, bot_r))
    return pairs


def enrich_topics_with_intent(
    topics: List[Dict[str, Any]],
    all_messages: List[str]
) -> List[Dict[str, Any]]:
    """Add intent breakdown to each topic based on example questions."""
    for topic in topics:
        examples = topic.get("question_examples", [])
        
        # Find all messages matching this topic's examples
        topic_messages = []
        for msg in all_messages:
            lower_msg = msg.lower()
            for example in examples:
                if example.lower() in lower_msg or lower_msg in example.lower():
                    topic_messages.append(msg)
                    break
        
        # If no matches found, use examples themselves
        if not topic_messages:
            topic_messages = examples
        
        # Get intent breakdown
        intent_breakdown = get_intent_breakdown_percent(topic_messages)
        topic["intent_breakdown"] = intent_breakdown
    
    return topics


def detect_trends(
    client_id: str,
    new_topics: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Compare new topics with previous day to detect trends.
    
    Trend values: "up", "down", "stable", "new"
    """
    # Get yesterday's topics
    try:
        response = topics_table.query(
            KeyConditionExpression="client_id = :cid",
            ExpressionAttributeValues={":cid": client_id}
        )
        old_topics = {t["topic_name"]: t.get("count", 0) for t in response.get("Items", [])}
    except Exception as e:
        print(f"Error getting previous topics: {e}")
        old_topics = {}
    
    # Compare and set trends
    for topic in new_topics:
        name = topic["topic_name"]
        new_count = topic["count"]
        
        if name not in old_topics:
            topic["trend"] = "new"
        else:
            old_count = old_topics[name]
            if new_count > old_count * 1.2:  # 20% increase
                topic["trend"] = "up"
            elif new_count < old_count * 0.8:  # 20% decrease
                topic["trend"] = "down"
            else:
                topic["trend"] = "stable"
    
    return new_topics


def mark_topics_with_gaps(
    topics: List[Dict[str, Any]],
    gaps: List[GapResult]
) -> List[Dict[str, Any]]:
    """Mark topics that have associated gaps."""
    gap_questions = {g.user_question.lower() for g in gaps}
    
    for topic in topics:
        examples = topic.get("question_examples", [])
        
        # Check if any example matches a gap
        is_gap = False
        gap_reason = ""
        
        for example in examples:
            if example.lower() in gap_questions:
                is_gap = True
                # Find the matching gap
                for g in gaps:
                    if g.user_question.lower() == example.lower():
                        gap_reason = g.reason
                        break
                break
        
        topic["is_gap"] = is_gap
        topic["gap_reason"] = gap_reason
    
    return topics


def save_topics(client_id: str, topics: List[Dict[str, Any]]) -> bool:
    """Save topics to DynamoDB."""
    now = datetime.utcnow()
    now_iso = now.isoformat() + "Z"
    ttl = int(time.time()) + (30 * 24 * 3600)  # 30 days
    
    period_start = (now - timedelta(days=14)).strftime("%Y-%m-%d")
    period_end = now.strftime("%Y-%m-%d")
    
    try:
        # Delete old topics for this client
        old_response = topics_table.query(
            KeyConditionExpression="client_id = :cid",
            ExpressionAttributeValues={":cid": client_id}
        )
        
        with topics_table.batch_writer() as batch:
            # Delete old
            for old_topic in old_response.get("Items", []):
                batch.delete_item(Key={
                    "client_id": client_id,
                    "topic_id": old_topic["topic_id"]
                })
            
            # Write new
            for i, topic in enumerate(topics):
                topic_id = f"topic_{i+1}_{uuid.uuid4().hex[:8]}"
                
                # Convert floats to Decimal for DynamoDB
                intent = topic.get("intent_breakdown", {})
                intent_decimal = {
                    k: Decimal(str(v)) for k, v in intent.items()
                }
                
                batch.put_item(Item={
                    "client_id": client_id,
                    "topic_id": topic_id,
                    "topic_name": topic["topic_name"],
                    "question_examples": topic.get("question_examples", []),
                    "count": topic["count"],
                    "trend": topic.get("trend", "stable"),
                    "intent_breakdown": intent_decimal,
                    "is_gap": topic.get("is_gap", False),
                    "gap_reason": topic.get("gap_reason", ""),
                    "last_updated": now_iso,
                    "period_start": period_start,
                    "period_end": period_end,
                    "ttl": ttl,
                    "rank": i + 1,
                })
        
        print(f"Saved {len(topics)} topics for {client_id}")
        return True
        
    except Exception as e:
        print(f"Error saving topics: {e}")
        return False


def analyze_client(client_id: str, hours: int = ANALYSIS_HOURS) -> Dict[str, Any]:
    """
    Run full analysis for a single client.
    
    Returns analysis summary.
    """
    print(f"Starting analysis for {client_id} (last {hours} hours)")
    
    # Step 1: Get analytics events
    events = get_recent_analytics_events(client_id, hours)
    session_ids = list(set(e.get("session_id") for e in events if e.get("session_id")))
    print(f"Found {len(events)} events from {len(session_ids)} sessions")
    
    if not session_ids:
        return {"status": "no_data", "message": "No sessions found"}
    
    # Step 2: Get full conversations
    conversations = get_session_conversations(session_ids)
    
    # Step 3: Extract messages
    all_messages = extract_user_messages(conversations)
    print(f"Extracted {len(all_messages)} user messages")
    
    # Step 4: Pre-filter junk
    clean_messages, filter_stats = filter_junk_messages(all_messages)
    print(f"After filtering: {len(clean_messages)} messages ({filter_stats['filtered']} filtered)")
    
    if not clean_messages:
        return {"status": "no_questions", "message": "All messages filtered as junk"}
    
    # Step 5: Extract Q&A pairs for gap detection
    qa_pairs = extract_qa_pairs(conversations)
    
    # Step 6: Detect gaps
    from .gaps import analyze_gaps
    gaps, gap_stats = analyze_gaps(qa_pairs)
    print(f"Detected {len(gaps)} knowledge gaps")
    
    # Step 7: Cluster questions with AI
    clustering_result = cluster_questions(clean_messages)
    
    if not clustering_result.success:
        return {
            "status": "clustering_failed",
            "message": clustering_result.error,
            "filter_stats": filter_stats
        }
    
    print(f"AI clustered into {len(clustering_result.topics)} topics")
    
    # Step 8: Apply smart threshold
    threshold_result = get_significant_topics(clustering_result.topics)
    significant_topics = threshold_result.significant_topics
    print(f"Significant topics: {len(significant_topics)}")
    
    # Step 9: Enrich with intents
    significant_topics = enrich_topics_with_intent(significant_topics, clean_messages)
    
    # Step 10: Detect trends
    significant_topics = detect_trends(client_id, significant_topics)
    
    # Step 11: Mark gaps
    significant_topics = mark_topics_with_gaps(significant_topics, gaps)
    
    # Step 12: Save to DynamoDB
    save_success = save_topics(client_id, significant_topics)
    
    return {
        "status": "success" if save_success else "save_failed",
        "client_id": client_id,
        "total_messages": len(all_messages),
        "clean_messages": len(clean_messages),
        "topics_found": len(clustering_result.topics),
        "significant_topics": len(significant_topics),
        "gaps_detected": len(gaps),
        "tokens_used": clustering_result.tokens_used,
        "filter_stats": filter_stats,
        "gap_stats": gap_stats,
    }


def lambda_handler(event, context):
    """
    Lambda handler for scheduled analysis.
    
    Triggered by EventBridge: cron(0 2 * * ? *)  (daily 2 AM UTC)
    
    Can also be invoked manually with:
    {
        "client_id": "stride-services",
        "hours": 24
    }
    """
    print(f"Trending Topics Analyzer started at {datetime.utcnow().isoformat()}")
    
    # Get parameters
    client_id = event.get("client_id", DEFAULT_CLIENT_ID)
    hours = event.get("hours", ANALYSIS_HOURS)
    
    # Run analysis
    result = analyze_client(client_id, hours)
    
    print(f"Analysis complete: {json.dumps(result, default=str)}")
    
    return {
        "statusCode": 200,
        "body": json.dumps(result, default=str)
    }


# For local testing
if __name__ == "__main__":
    # Mock event for testing
    test_event = {
        "client_id": "stride-services",
        "hours": 24
    }
    
    print("Running local test...")
    # Uncomment to test (requires AWS credentials):
    # result = lambda_handler(test_event, None)
    # print(result)
