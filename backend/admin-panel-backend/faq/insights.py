"""
Smart Insights Generator using Claude Haiku.
"""

import json
import boto3
from typing import List, Dict, Any, Optional

# Bedrock client
bedrock = boto3.client("bedrock-runtime", region_name="eu-central-1")

# Model configuration
MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
MAX_TOKENS = 1000

def generate_smart_insight(topic_name: str, examples: List[str]) -> str:
    """
    Generate a concise business insight for a trending topic.
    
    Args:
        topic_name: The name of the topic
        examples: List of user questions
        
    Returns:
        A 1-sentence insight string
    """
    if not topic_name or not examples:
        return ""
        
    examples_text = "\n".join(f"- {ex}" for ex in examples[:5])
    
    prompt = f"""Analizujesz najpopularniejszy temat pytań do chatbota w firmie usługowej.
Temat: "{topic_name}"

Przykładowe pytania użytkowników:
{examples_text}

Zadanie:
Napisz JEDNO zdanie (max 20 słów) z obserwacją/poradą biznesową.
Skup się na tym, CZEGO brakuje użytkownikom lub co jest dla nich niejasne.
NIE sugeruj konkretnych zmian w UI (np. "dodaj przycisk"), tylko wskaż problem informacyjny.

Przykłady dobrych insightów:
- "Użytkownicy często pytają o cennik, co sugeruje, że koszty są kluczowym czynnikiem decyzyjnym na tym etapie."
- "Wiele pytań o integracje wskazuje, że dokumentacja techniczna może być zbyt ogólna dla deweloperów."
- "Pytania o godziny otwarcia w weekend sugerują potencjał na rozszerzenie dostępności usług."

Twój insight:"""

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
                "temperature": 0.5,
            })
        )
        
        response_body = json.loads(response["body"].read())
        insight = response_body["content"][0]["text"].strip()
        
        # Cleanup quotes if present
        if insight.startswith('"') and insight.endswith('"'):
            insight = insight[1:-1]
            
        return insight
        
    except Exception as e:
        print(f"Error generating smart insight: {e}")
        return ""
