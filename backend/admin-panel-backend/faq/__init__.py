"""
Trending Questions / FAQ Module

Auto-discover najczęściej zadawane pytania przez użytkowników chatbota.
"""

from .filters import filter_junk_messages
from .intent import detect_intent, IntentType
from .gaps import detect_gap, GapIndicator
from .threshold import get_significant_topics
from .clustering import cluster_questions

__all__ = [
    "filter_junk_messages",
    "detect_intent",
    "IntentType", 
    "detect_gap",
    "GapIndicator",
    "get_significant_topics",
    "cluster_questions",
]
