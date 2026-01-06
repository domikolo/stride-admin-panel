"""
Intent Detection - keyword-based analysis.

Detects user intent from message:
- BUYING: User wants to purchase/order
- COMPARING: User is comparing options
- INFO_SEEKING: User just wants information (default)
"""

from enum import Enum
from typing import Dict, List, Tuple


class IntentType(Enum):
    BUYING = "buying"
    COMPARING = "comparing"
    INFO_SEEKING = "info_seeking"


# Keywords indicating buying intent (Polish & English)
BUYING_KEYWORDS = [
    # Polish
    "kupić", "kupię", "chcę kupić", "zamówić", "zamawiam", "zamówienie",
    "ile kosztuje", "jaka cena", "cennik", "cena", "ceny", "koszt", "kosztuje",
    "oferta", "promocja", "rabat", "zniżka", "płatność", "płacić", "zapłacić",
    "faktura", "rachunek", "abonament", "subskrypcja", "pakiet",
    "kup", "zakup", "zakupić", "nabyć", "wziąć",
    # English
    "buy", "purchase", "order", "price", "pricing", "cost", "how much",
    "offer", "discount", "payment", "pay", "subscribe", "subscription",
]

# Keywords indicating comparing intent
COMPARING_KEYWORDS = [
    # Polish
    "różnica", "różnice", "porównaj", "porównanie", "lepszy", "lepsze",
    "gorszy", "vs", "versus", "alternatywa", "alternatywnie", "zamiast",
    "konkurencja", "inni", "inne opcje", "podobne", "wybrać", "wybór",
    "który", "która", "które", "jaki", "jaka", "jakie",
    "zalety", "wady", "pros", "cons",
    # English
    "difference", "compare", "comparison", "better", "worse", "vs",
    "alternative", "instead", "competitor", "other options", "similar",
    "which", "choose", "choice", "pros", "cons", "advantages", "disadvantages",
]


def detect_intent(message: str) -> Tuple[IntentType, float]:
    """
    Detect intent from a message using keyword matching.
    
    Args:
        message: User message text
        
    Returns:
        Tuple of (IntentType, confidence_score)
        Confidence: 0.0-1.0 based on keyword matches
        
    Example:
        >>> intent, conf = detect_intent("Ile kosztuje wasza usługa?")
        >>> print(intent, conf)
        IntentType.BUYING 0.8
    """
    if not message:
        return IntentType.INFO_SEEKING, 0.5
    
    lower_msg = message.lower()
    
    # Count keyword matches
    buying_matches = sum(1 for kw in BUYING_KEYWORDS if kw in lower_msg)
    comparing_matches = sum(1 for kw in COMPARING_KEYWORDS if kw in lower_msg)
    
    # Determine intent based on matches
    if buying_matches > 0 and buying_matches >= comparing_matches:
        # More buying keywords
        confidence = min(0.5 + (buying_matches * 0.15), 1.0)
        return IntentType.BUYING, confidence
    
    elif comparing_matches > 0:
        # More comparing keywords
        confidence = min(0.5 + (comparing_matches * 0.15), 1.0)
        return IntentType.COMPARING, confidence
    
    else:
        # Default: info seeking
        return IntentType.INFO_SEEKING, 0.5


def analyze_intents(messages: List[str]) -> Dict[str, int]:
    """
    Analyze intent distribution across multiple messages.
    
    Args:
        messages: List of user messages
        
    Returns:
        Dict with intent counts, e.g. {"buying": 15, "comparing": 3, "info_seeking": 82}
    """
    counts = {
        IntentType.BUYING.value: 0,
        IntentType.COMPARING.value: 0,
        IntentType.INFO_SEEKING.value: 0,
    }
    
    for msg in messages:
        intent, _ = detect_intent(msg)
        counts[intent.value] += 1
    
    return counts


def get_intent_breakdown_percent(messages: List[str]) -> Dict[str, float]:
    """
    Get intent breakdown as percentages.
    
    Args:
        messages: List of user messages
        
    Returns:
        Dict with intent percentages, e.g. {"buying": 15.0, "comparing": 3.0, "info_seeking": 82.0}
    """
    if not messages:
        return {"buying": 0.0, "comparing": 0.0, "info_seeking": 100.0}
    
    counts = analyze_intents(messages)
    total = len(messages)
    
    return {
        intent: round((count / total) * 100, 1)
        for intent, count in counts.items()
    }


# Quick test
if __name__ == "__main__":
    test_messages = [
        "Ile kosztuje wasza usługa?",
        "Jaka jest różnica między pakietem basic a pro?",
        "Jakie są godziny otwarcia?",
        "Chcę kupić subskrypcję",
        "Czy macie jakieś promocje?",
        "Gdzie was znajdę?",
        "Który plan polecacie?",
    ]
    
    for msg in test_messages:
        intent, conf = detect_intent(msg)
        print(f"{intent.value:15} ({conf:.2f}): {msg}")
    
    print("\nBreakdown:", get_intent_breakdown_percent(test_messages))
