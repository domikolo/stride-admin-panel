"""
Question Clustering using Claude Haiku.

Groups similar questions into topics using AI.
Cost: ~$0.02/day for typical usage.
"""

import json
import boto3
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


# Bedrock client
bedrock = boto3.client("bedrock-runtime", region_name="eu-central-1")

# Model configuration
MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
MAX_TOKENS = 2000


@dataclass
class ClusteringResult:
    topics: List[Dict[str, Any]]
    raw_response: str
    tokens_used: int
    success: bool
    error: Optional[str] = None


def build_clustering_prompt(questions: List[str], max_topics: int = 15) -> str:
    """Build the prompt for Claude to cluster questions."""
    questions_text = "\n".join(f"- {q}" for q in questions)
    
    return f"""Zgrupuj poniższe pytania użytkowników chatbota w tematy (max {max_topics} tematów).

Dla każdego tematu podaj:
- topic_name: Krótka nazwa tematu (max 3 słowa, po polsku)
- category: Kategoria biznesowa (wybierz jedną z listy poniżej)
- question_examples: Lista 1-3 przykładowych pytań z tej grupy
- count: Ile pytań należy do tego tematu

Kategorie do wyboru:
1. "pricing" (Oferta / Cennik / Koszty)
2. "features" (Funkcje / Możliwości / Działanie)
3. "technical" (Integracje / Bezpieczeństwo / API / Techniczne)
4. "support" (Kontakt / Wsparcie / O firmie)
5. "other" (Inne / Powitanie / Off-topic)

WAŻNE:
- Grupuj podobne pytania razem (np. "ile kosztuje?" i "jaka cena?" = jeden temat "Cennik")
- Ignoruj pytania które nie pasują do żadnego tematu
- Sortuj tematy od najczęstszych do najrzadszych

Pytania:
{questions_text}

Odpowiedz TYLKO w formacie JSON (bez markdown):
[
  {{"topic_name": "Cennik", "category": "pricing", "question_examples": ["ile kosztuje?", "jaka cena?"], "count": 15}},
  {{"topic_name": "Godziny otwarcia", "category": "support", "question_examples": ["kiedy jesteście otwarci?"], "count": 8}}
]"""


def parse_claude_response(response_text: str) -> List[Dict[str, Any]]:
    """Parse Claude's JSON response into topics list."""
    # Clean up response - remove any markdown formatting
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        # Remove markdown code block
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1])
    
    try:
        topics = json.loads(cleaned)
        
        # Validate structure
        if not isinstance(topics, list):
            raise ValueError("Response is not a list")
        
        validated_topics = []
        for topic in topics:
            if isinstance(topic, dict) and "topic_name" in topic:
                validated_topics.append({
                    "topic_name": str(topic.get("topic_name", "Unknown")),
                    "category": str(topic.get("category", "other")),
                    "question_examples": topic.get("question_examples", [])[:3],
                    "count": int(topic.get("count", 1)),
                })
        
        return validated_topics
        
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Failed to parse Claude response: {e}")
        print(f"Response was: {response_text[:500]}")
        return []


def cluster_questions(
    questions: List[str],
    max_topics: int = 15
) -> ClusteringResult:
    """
    Cluster questions into topics using Claude Haiku.
    
    Args:
        questions: List of user questions (pre-filtered)
        max_topics: Maximum number of topics to generate
        
    Returns:
        ClusteringResult with topics and metadata
        
    Example:
        >>> result = cluster_questions([
        ...     "ile kosztuje?", "jaka cena?", "cennik?",
        ...     "kiedy otwarci?", "godziny pracy?"
        ... ])
        >>> print(result.topics)
        [{"topic_name": "Cennik", "count": 3, "category": "pricing", ...}, ...]
    """
    if not questions:
        return ClusteringResult(
            topics=[],
            raw_response="",
            tokens_used=0,
            success=True
        )
    
    # Deduplicate and limit questions
    unique_questions = list(set(questions))[:500]  # Max 500 unique questions per batch
    
    prompt = build_clustering_prompt(unique_questions, max_topics)
    
    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": MAX_TOKENS,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,  # Low temperature for consistency
            })
        )
        
        response_body = json.loads(response["body"].read())
        response_text = response_body["content"][0]["text"]
        
        # Get token usage
        usage = response_body.get("usage", {})
        tokens_used = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        
        # Parse topics
        topics = parse_claude_response(response_text)
        
        return ClusteringResult(
            topics=topics,
            raw_response=response_text,
            tokens_used=tokens_used,
            success=True
        )
        
    except Exception as e:
        print(f"Claude clustering failed: {e}")
        return ClusteringResult(
            topics=[],
            raw_response="",
            tokens_used=0,
            success=False,
            error=str(e)
        )


def estimate_cost(tokens_used: int) -> float:
    """
    Estimate cost for Haiku usage.
    
    Pricing (as of 2025):
    - Input: $0.00025 per 1K tokens
    - Output: $0.00125 per 1K tokens
    
    For simplicity, use blended rate of ~$0.0005 per 1K tokens.
    """
    return (tokens_used / 1000) * 0.0005
