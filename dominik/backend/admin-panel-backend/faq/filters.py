"""
Pre-filtering junk messages - local, free processing.

Filters out:
- Greetings (hej, cześć, hello)
- Single-word junk (ok, nie, tak, ?)
- Profanity
- Too short messages (<5 chars)
- High non-alphanumeric ratio (>30%)
"""

import re
from typing import List, Tuple

# Polish & English greetings
GREETINGS = {
    "hej", "cześć", "czesc", "witam", "witaj", "dzień dobry", "dzien dobry",
    "dobry wieczór", "dobry wieczor", "siema", "elo", "yo", "hejka",
    "hello", "hi", "hey", "good morning", "good evening", "howdy",
    "cześć!", "hej!", "siema!", "witam!", "hello!", "hi!"
}

# Single-word junk responses
JUNK_WORDS = {
    "ok", "okay", "no", "nie", "tak", "dobrze", "dzięki", "dzieki", "dziekuje",
    "dziękuję", "thanks", "thx", "super", "git", "spoko", "okej", "oki",
    "?", "??", "???", "!", "!!", "...", "hmm", "hm", "ee", "eee", "aa", "aaa",
    "co", "co?", "jak", "jak?", "kiedy", "kiedy?", "gdzie", "gdzie?",
    "a", "i", "o", "e", "u", "y", "w", "z", "na", "do", "po", "za"
}

# Polish profanity (partial list, add more as needed)
PROFANITY = {
    "kurwa", "kurde", "cholera", "do diabła", "do cholery", "pierdol", 
    "pierdole", "chuj", "dupa", "gówno", "gowno", "skurwysyn", "debil",
    "idiota", "kretyn", "fuck", "shit", "damn", "bitch", "ass"
}

# Minimum message length
MIN_LENGTH = 5

# Maximum non-alphanumeric ratio
MAX_NON_ALPHA_RATIO = 0.3


def is_greeting(message: str) -> bool:
    """Check if message is a greeting."""
    normalized = message.lower().strip().rstrip("!?.")
    return normalized in GREETINGS


def is_junk_word(message: str) -> bool:
    """Check if message is a single junk word."""
    normalized = message.lower().strip().rstrip("!?.")
    return normalized in JUNK_WORDS


def contains_profanity(message: str) -> bool:
    """Check if message contains profanity."""
    lower_msg = message.lower()
    return any(word in lower_msg for word in PROFANITY)


def is_too_short(message: str) -> bool:
    """Check if message is too short to be meaningful."""
    # Remove whitespace and punctuation for length check
    clean = re.sub(r'[^\w]', '', message)
    return len(clean) < MIN_LENGTH


def has_high_non_alpha_ratio(message: str) -> bool:
    """Check if message has too many non-alphanumeric characters."""
    if len(message) == 0:
        return True
    
    alpha_count = sum(1 for c in message if c.isalnum() or c.isspace())
    ratio = 1 - (alpha_count / len(message))
    return ratio > MAX_NON_ALPHA_RATIO


def filter_junk_messages(messages: List[str]) -> Tuple[List[str], dict]:
    """
    Filter out junk messages from a list.
    
    Args:
        messages: List of user messages
        
    Returns:
        Tuple of (clean_messages, filter_stats)
        
    Example:
        >>> clean, stats = filter_junk_messages(["hej", "ile kosztuje?", "ok"])
        >>> print(clean)
        ["ile kosztuje?"]
        >>> print(stats)
        {"total": 3, "filtered": 2, "greetings": 1, "junk_words": 1, ...}
    """
    clean_messages = []
    stats = {
        "total": len(messages),
        "filtered": 0,
        "greetings": 0,
        "junk_words": 0,
        "profanity": 0,
        "too_short": 0,
        "high_non_alpha": 0
    }
    
    for msg in messages:
        if not msg or not isinstance(msg, str):
            stats["filtered"] += 1
            continue
            
        msg = msg.strip()
        
        if is_greeting(msg):
            stats["greetings"] += 1
            stats["filtered"] += 1
            continue
            
        if is_junk_word(msg):
            stats["junk_words"] += 1
            stats["filtered"] += 1
            continue
            
        if contains_profanity(msg):
            stats["profanity"] += 1
            stats["filtered"] += 1
            continue
            
        if is_too_short(msg):
            stats["too_short"] += 1
            stats["filtered"] += 1
            continue
            
        if has_high_non_alpha_ratio(msg):
            stats["high_non_alpha"] += 1
            stats["filtered"] += 1
            continue
        
        # Message passed all filters
        clean_messages.append(msg)
    
    return clean_messages, stats


# Quick test
if __name__ == "__main__":
    test_messages = [
        "hej",
        "cześć!",
        "Ile kosztuje wasza usługa?",
        "ok",
        "???",
        "kurwa",
        "a",
        "Czy możecie pomóc z integracją API?",
        "!@#$%^&*()",
        "Jakie są godziny otwarcia?",
        "siema",
        "dzięki za pomoc",
    ]
    
    clean, stats = filter_junk_messages(test_messages)
    print("Clean messages:", clean)
    print("Stats:", stats)
