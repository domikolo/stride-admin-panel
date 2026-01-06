"""
Trending Topics Analyzer - Main Lambda Handler

Scheduled to run daily at 2 AM (EventBridge cron).
Analyzes conversations from the last 24 hours and updates trending topics.
"""

import os
import json
import boto3
import uuid
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Tuple

# Import local modules (same directory in Lambda)
from filters import filter_junk_messages
from intent import detect_intent, get_intent_breakdown_percent, IntentType
from gaps import detect_gap, analyze_gaps, GapResult
from threshold import get_significant_topics
from clustering import cluster_questions, ClusteringResult
from insights import generate_smart_insight


# DynamoDB tables
dynamodb = boto3.resource("dynamodb")
analytics_table = dynamodb.Table("platform_analytics_events")
topics_table = dynamodb.Table("platform_trending_topics")

# Conversations table - for Stride Services
CONVERSATIONS_TABLE_NAME = os.environ.get("CONVERSATIONS_TABLE", "Conversations-stride")
conversations_table = dynamodb.Table(CONVERSATIONS_TABLE_NAME)

# Default client ID
DEFAULT_CLIENT_ID = os.environ.get("CLIENT_ID", "stride-services")

# Analysis periods
ANALYSIS_HOURS = 24
FULL_ANALYSIS_DAYS = 14

# Period types
PERIOD_DAILY = "daily"
PERIOD_WEEKLY = "weekly"


def get_recent_analytics_events(client_id: str, hours: int = ANALYSIS_HOURS) -> List[Dict[str, Any]]:
    """Get analytics events from the last N hours."""
    now = datetime.utcnow()
    start_time = (now - timedelta(hours=hours)).isoformat() + "Z"
    
    try:
        response = analytics_table.query(
            KeyConditionExpression="client_id = :cid AND event_timestamp >= :start",
            ExpressionAttributeValues={
                ":cid": client_id,
                ":start": start_time,
            },
            Limit=1000
        )
        return response.get("Items", [])
    except Exception as e:
        print(f"Error querying analytics events: {e}")
        return []


def get_session_conversations(session_ids: List[str]) -> Dict[str, List[Dict]]:
    """Get full conversation history for given session IDs."""
    conversations = {}
    
    for session_id in session_ids[:100]:
        try:
            response = conversations_table.query(
                KeyConditionExpression="session_id = :sid",
                ExpressionAttributeValues={":sid": session_id},
                ScanIndexForward=True
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
    """Extract question-answer pairs for gap detection."""
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
        
        topic_messages = []
        for msg in all_messages:
            lower_msg = msg.lower()
            for example in examples:
                if example.lower() in lower_msg or lower_msg in example.lower():
                    topic_messages.append(msg)
                    break
        
        if not topic_messages:
            topic_messages = examples
        
        intent_breakdown = get_intent_breakdown_percent(topic_messages)
        topic["intent_breakdown"] = intent_breakdown
    
    return topics


def detect_trends(
    client_id: str,
    new_topics: List[Dict[str, Any]],
    period_type: str = PERIOD_DAILY
) -> List[Dict[str, Any]]:
    """Compare new topics with previous period to detect trends."""
    composite_key = f"{client_id}#{period_type}"
    try:
        response = topics_table.query(
            KeyConditionExpression="client_id = :cid",
            ExpressionAttributeValues={":cid": composite_key}
        )
        # Convert Decimal to int for comparison
        old_topics = {t["topic_name"]: int(t.get("count", 0)) for t in response.get("Items", [])}
    except Exception as e:
        print(f"Error getting previous topics: {e}")
        old_topics = {}
    
    for topic in new_topics:
        name = topic["topic_name"]
        new_count = int(topic["count"])
        
        if name not in old_topics:
            topic["trend"] = "new"
        else:
            old_count = old_topics[name]
            if new_count > old_count * 1.2:
                topic["trend"] = "up"
            elif new_count < old_count * 0.8:
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
        
        is_gap = False
        gap_reason = ""
        
        for example in examples:
            if example.lower() in gap_questions:
                is_gap = True
                for g in gaps:
                    if g.user_question.lower() == example.lower():
                        gap_reason = g.reason
                        break
                break
        
        topic["is_gap"] = is_gap
        topic["gap_reason"] = gap_reason
    
    return topics


def save_topics(client_id: str, topics: List[Dict[str, Any]], period_type: str = PERIOD_DAILY) -> bool:
    """Save topics to DynamoDB with period type prefix."""
    now = datetime.utcnow()
    now_iso = now.isoformat() + "Z"
    ttl = int(time.time()) + (30 * 24 * 3600)
    
    # Period based on period_type
    if period_type == PERIOD_WEEKLY:
        period_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    else:
        period_start = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    period_end = now.strftime("%Y-%m-%d")
    
    # Composite key: client_id#period_type
    composite_key = f"{client_id}#{period_type}"
    
    try:
        # Delete old topics for this client+period
        old_response = topics_table.query(
            KeyConditionExpression="client_id = :cid",
            ExpressionAttributeValues={":cid": composite_key}
        )
        
        with topics_table.batch_writer() as batch:
            # Delete old
            for old_topic in old_response.get("Items", []):
                batch.delete_item(Key={
                    "client_id": composite_key,
                    "topic_id": old_topic["topic_id"]
                })
            
            # Write new
            for i, topic in enumerate(topics):
                topic_id = f"topic_{i+1}_{uuid.uuid4().hex[:8]}"
                
                intent = topic.get("intent_breakdown", {})
                intent_decimal = {
                    k: Decimal(str(v)) for k, v in intent.items()
                }
                
                batch.put_item(Item={
                    "client_id": composite_key,
                    "topic_id": topic_id,
                    "topic_name": topic["topic_name"],
                    "question_examples": topic.get("question_examples", []),
                    "count": topic["count"],
                    "trend": topic.get("trend", "stable"),
                    "intent_breakdown": intent_decimal,
                    "intent_breakdown": intent_decimal,
                    "is_gap": topic.get("is_gap", False),
                    "gap_reason": topic.get("gap_reason", ""),
                    "category": topic.get("category", "other"),
                    "smart_insight": topic.get("smart_insight", ""),
                    "last_updated": now_iso,
                    "period_type": period_type,
                    "period_start": period_start,
                    "period_end": period_end,
                    "ttl": ttl,
                    "rank": i + 1,
                })
        
        print(f"Saved {len(topics)} topics for {composite_key}")
        return True
        
    except Exception as e:
        print(f"Error saving topics: {e}")
        return False


def analyze_client(client_id: str, hours: int = ANALYSIS_HOURS, period_type: str = PERIOD_DAILY) -> Dict[str, Any]:
    """Run full analysis for a single client."""
    print(f"Starting analysis for {client_id} (last {hours} hours, period: {period_type})")
    
    # Step 1: Get analytics events
    events = get_recent_analytics_events(client_id, hours)
    session_ids = list(set(e.get("session_id") for e in events if e.get("session_id")))
    print(f"Found {len(events)} events from {len(session_ids)} sessions")
    
    if not session_ids:
        return {"status": "no_data", "message": "No sessions found", "period_type": period_type}
    
    # Step 2: Get full conversations
    conversations = get_session_conversations(session_ids)
    
    # Step 3: Extract messages
    all_messages = extract_user_messages(conversations)
    print(f"Extracted {len(all_messages)} user messages")
    
    # Step 4: Pre-filter junk
    clean_messages, filter_stats = filter_junk_messages(all_messages)
    print(f"After filtering: {len(clean_messages)} messages ({filter_stats['filtered']} filtered)")
    
    if not clean_messages:
        return {"status": "no_questions", "message": "All messages filtered as junk", "period_type": period_type}
    
    # Step 5: Extract Q&A pairs for gap detection (only for daily)
    gaps = []
    gap_stats = {}
    if period_type == PERIOD_DAILY:
        qa_pairs = extract_qa_pairs(conversations)
        gaps, gap_stats = analyze_gaps(qa_pairs)
        print(f"Detected {len(gaps)} knowledge gaps")
    
    # Step 6: Cluster questions with AI
    clustering_result = cluster_questions(clean_messages)
    
    if not clustering_result.success:
        return {
            "status": "clustering_failed",
            "message": clustering_result.error,
            "filter_stats": filter_stats,
            "period_type": period_type
        }
    
    print(f"AI clustered into {len(clustering_result.topics)} topics")
    
    # Step 7: Apply smart threshold
    threshold_result = get_significant_topics(clustering_result.topics)
    significant_topics = threshold_result.significant_topics
    print(f"Significant topics: {len(significant_topics)}")
    
    # Step 8: Enrich with intents
    significant_topics = enrich_topics_with_intent(significant_topics, clean_messages)
    
    # Step 9: Detect trends (compare with same period type)
    significant_topics = detect_trends(client_id, significant_topics, period_type)
    
    # Step 10: Mark gaps (only for daily)
    if period_type == PERIOD_DAILY:
        significant_topics = mark_topics_with_gaps(significant_topics, gaps)
        
        # Generate Smart Insight for #1 topic
        if significant_topics:
            top_topic = significant_topics[0]
            print(f"Generating smart insight for top topic: {top_topic['topic_name']}")
            insight = generate_smart_insight(top_topic["topic_name"], top_topic["question_examples"])
            top_topic["smart_insight"] = insight
            print(f"Insight: {insight}")
    else:
        # For weekly, no gaps marking
        for topic in significant_topics:
            topic["is_gap"] = False
            topic["gap_reason"] = ""
    
    # Step 11: Save to DynamoDB
    save_success = save_topics(client_id, significant_topics, period_type)
    
    return {
        "status": "success" if save_success else "save_failed",
        "client_id": client_id,
        "period_type": period_type,
        "total_messages": len(all_messages),
        "clean_messages": len(clean_messages),
        "topics_found": len(clustering_result.topics),
        "significant_topics": len(significant_topics),
        "gaps_detected": len(gaps) if period_type == PERIOD_DAILY else 0,
        "tokens_used": clustering_result.tokens_used,
        "filter_stats": filter_stats,
        "gap_stats": gap_stats if period_type == PERIOD_DAILY else {},
    }


def lambda_handler(event, context):
    """
    Lambda handler for scheduled analysis.
    
    Triggered by EventBridge:
    - Daily: cron(0 2 * * ? *) with {"hours": 24, "period_type": "daily"}
    - Weekly: cron(0 3 ? * SUN *) with {"hours": 168, "period_type": "weekly"}
    """
    print(f"Trending Topics Analyzer started at {datetime.utcnow().isoformat()}")
    print(f"Event: {json.dumps(event)}")
    
    # Get parameters
    client_id = event.get("client_id", DEFAULT_CLIENT_ID)
    hours = event.get("hours", ANALYSIS_HOURS)
    period_type = event.get("period_type", PERIOD_DAILY)
    
    # Run analysis
    result = analyze_client(client_id, hours, period_type)
    
    print(f"Analysis complete: {json.dumps(result, default=str)}")
    
    return {
        "statusCode": 200,
        "body": json.dumps(result, default=str)
    }
