"""
Gap Detection - heuristic-based analysis.

Detects knowledge base gaps by analyzing bot responses:
- Bot says "nie wiem", "nie mam informacji"
- Bot response is too short (<50 chars)
- Bot suggests human contact
"""

from enum import Enum
from typing import Optional, Tuple, List
from dataclasses import dataclass


class GapIndicator(Enum):
    NO_GAP = "no_gap"
    DONT_KNOW = "dont_know"           # Bot said "nie wiem"
    SHORT_RESPONSE = "short_response"  # Response too short
    HUMAN_ESCALATION = "human_escalation"  # Bot suggested human contact


@dataclass
class GapResult:
    is_gap: bool
    indicator: GapIndicator
    reason: str
    user_question: str
    bot_response: str


# Phrases indicating bot doesn't know
DONT_KNOW_PHRASES = [
    # Polish
    "nie wiem", "nie jestem pewien", "nie jestem pewna", 
    "nie mam informacji", "nie posiadam informacji",
    "nie mogę odpowiedzieć", "nie moge odpowiedziec",
    "nie znam odpowiedzi", "brak informacji",
    "niestety nie wiem", "niestety nie mam",
    "nie jestem w stanie", "nie potrafię odpowiedzieć",
    "przepraszam, ale nie wiem", "przepraszam, nie mam",
    # English
    "i don't know", "i do not know", "i'm not sure", "i am not sure",
    "i don't have information", "i cannot answer", "i can't answer",
    "sorry, i don't know", "unfortunately i don't know",
]

# Phrases suggesting human escalation
HUMAN_ESCALATION_PHRASES = [
    # Polish
    "skontaktuj się", "zadzwoń", "napisz na", "wyślij email",
    "skontaktuj się z nami", "zadzwoń do nas", "napisz do nas",
    "proponuję kontakt", "polecam kontakt", "najlepiej zadzwonić",
    "lepiej porozmawiać", "porozmawiaj z", "skonsultuj z",
    "nasz konsultant", "nasz zespół", "nasi specjaliści",
    "umów rozmowę", "umów spotkanie", "umów się z",
    # English
    "contact us", "call us", "email us", "reach out",
    "speak to", "talk to", "consult with", "our team",
    "schedule a call", "book a meeting",
]

# Minimum response length to be considered meaningful
MIN_RESPONSE_LENGTH = 50


def detect_gap(
    user_question: str, 
    bot_response: str
) -> GapResult:
    """
    Detect if a conversation indicates a knowledge base gap.
    
    Args:
        user_question: User's original question
        bot_response: Bot's response to the question
        
    Returns:
        GapResult with gap details
        
    Example:
        >>> result = detect_gap("Czy macie parking?", "Nie wiem, nie mam tej informacji.")
        >>> print(result.is_gap, result.indicator)
        True GapIndicator.DONT_KNOW
    """
    if not bot_response:
        return GapResult(
            is_gap=True,
            indicator=GapIndicator.SHORT_RESPONSE,
            reason="Empty response",
            user_question=user_question,
            bot_response=""
        )
    
    lower_response = bot_response.lower()
    
    # Check for "don't know" phrases
    for phrase in DONT_KNOW_PHRASES:
        if phrase in lower_response:
            return GapResult(
                is_gap=True,
                indicator=GapIndicator.DONT_KNOW,
                reason=f"Bot używa frazy: '{phrase}'",
                user_question=user_question,
                bot_response=bot_response[:200]
            )
    
    # Check for human escalation phrases (this is a softer signal)
    for phrase in HUMAN_ESCALATION_PHRASES:
        if phrase in lower_response:
            return GapResult(
                is_gap=True,
                indicator=GapIndicator.HUMAN_ESCALATION,
                reason=f"Bot sugeruje kontakt z człowiekiem: '{phrase}'",
                user_question=user_question,
                bot_response=bot_response[:200]
            )
    
    # Check response length
    if len(bot_response.strip()) < MIN_RESPONSE_LENGTH:
        return GapResult(
            is_gap=True,
            indicator=GapIndicator.SHORT_RESPONSE,
            reason=f"Krótka odpowiedź ({len(bot_response)} znaków)",
            user_question=user_question,
            bot_response=bot_response
        )
    
    # No gap detected
    return GapResult(
        is_gap=False,
        indicator=GapIndicator.NO_GAP,
        reason="",
        user_question=user_question,
        bot_response=bot_response[:200]
    )


def analyze_gaps(
    conversations: List[Tuple[str, str]]
) -> Tuple[List[GapResult], dict]:
    """
    Analyze multiple conversations for gaps.
    
    Args:
        conversations: List of (user_question, bot_response) tuples
        
    Returns:
        Tuple of (gaps_list, stats)
    """
    gaps = []
    stats = {
        "total": len(conversations),
        "gaps": 0,
        "dont_know": 0,
        "short_response": 0,
        "human_escalation": 0,
    }
    
    for user_q, bot_r in conversations:
        result = detect_gap(user_q, bot_r)
        
        if result.is_gap:
            gaps.append(result)
            stats["gaps"] += 1
            
            if result.indicator == GapIndicator.DONT_KNOW:
                stats["dont_know"] += 1
            elif result.indicator == GapIndicator.SHORT_RESPONSE:
                stats["short_response"] += 1
            elif result.indicator == GapIndicator.HUMAN_ESCALATION:
                stats["human_escalation"] += 1
    
    return gaps, stats


# Quick test
if __name__ == "__main__":
    test_conversations = [
        ("Czy macie parking?", "Nie wiem, nie mam tej informacji w mojej bazie wiedzy."),
        ("Ile kosztuje usługa?", "Nasze ceny zaczynają się od 1600 zł miesięcznie za pakiet podstawowy. W tej cenie otrzymujesz pełne wsparcie techniczne i dostęp do wszystkich funkcji."),
        ("Jak się z wami skontaktować?", "Zadzwoń do nas pod numer 123-456-789."),
        ("Co to jest AI?", "Tak."),  # Too short
        ("Jakie są godziny?", "Najlepiej skontaktuj się z nami bezpośrednio, żeby poznać aktualne godziny otwarcia."),
    ]
    
    gaps, stats = analyze_gaps(test_conversations)
    
    print("Stats:", stats)
    print("\nDetected gaps:")
    for gap in gaps:
        print(f"  [{gap.indicator.value}] Q: {gap.user_question[:50]}...")
        print(f"    Reason: {gap.reason}")
