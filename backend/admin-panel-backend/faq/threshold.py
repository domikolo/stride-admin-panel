"""
Smart Threshold Algorithm - select significant topics.

Finds the natural cut-off point in topic rankings:
1. Sort topics by count DESC
2. Find biggest gap (drop ratio >= 2.5x)
3. Return only top topics above gap
4. Constraints: min 3, max 10 topics
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ThresholdResult:
    significant_topics: List[Dict[str, Any]]
    cutoff_index: int
    cutoff_ratio: float
    total_topics: int


# Minimum drop ratio to consider as significant gap
MIN_DROP_RATIO = 2.5

# Min/max topics constraints
MIN_TOPICS = 3
MAX_TOPICS = 10


def find_biggest_drop(counts: List[int]) -> tuple[int, float]:
    """
    Find the index of the biggest drop in a sorted (DESC) list of counts.
    
    Returns:
        Tuple of (index after drop, drop ratio)
    """
    if len(counts) <= 1:
        return len(counts), 1.0
    
    max_ratio = 1.0
    max_ratio_index = len(counts)
    
    for i in range(len(counts) - 1):
        if counts[i + 1] > 0:
            ratio = counts[i] / counts[i + 1]
            if ratio > max_ratio:
                max_ratio = ratio
                max_ratio_index = i + 1  # Index after the drop
    
    return max_ratio_index, max_ratio


def get_significant_topics(
    topics: List[Dict[str, Any]],
    count_key: str = "count"
) -> ThresholdResult:
    """
    Select only significant topics based on smart threshold.
    
    Algorithm:
    1. Sort by count DESC
    2. Find biggest drop (ratio >= 2.5x)
    3. Cut at that point
    4. Apply min/max constraints
    
    Args:
        topics: List of topic dicts, each with a 'count' field
        count_key: Key name for count field (default: "count")
        
    Returns:
        ThresholdResult with significant topics
        
    Example:
        >>> topics = [
        ...     {"name": "Pricing", "count": 87},
        ...     {"name": "Hours", "count": 64},
        ...     {"name": "Parking", "count": 43},
        ...     {"name": "WiFi", "count": 5},    # <-- big drop here
        ...     {"name": "Dogs", "count": 3},
        ... ]
        >>> result = get_significant_topics(topics)
        >>> len(result.significant_topics)
        3  # Only Pricing, Hours, Parking
    """
    if not topics:
        return ThresholdResult(
            significant_topics=[],
            cutoff_index=0,
            cutoff_ratio=1.0,
            total_topics=0
        )
    
    # Sort by count DESC
    sorted_topics = sorted(topics, key=lambda t: t.get(count_key, 0), reverse=True)
    counts = [t.get(count_key, 0) for t in sorted_topics]
    
    # Find biggest drop
    cutoff_index, cutoff_ratio = find_biggest_drop(counts)
    
    # Only cut if ratio is significant enough
    if cutoff_ratio < MIN_DROP_RATIO:
        cutoff_index = len(sorted_topics)
    
    # Apply constraints
    if cutoff_index < MIN_TOPICS:
        cutoff_index = min(MIN_TOPICS, len(sorted_topics))
    
    if cutoff_index > MAX_TOPICS:
        cutoff_index = MAX_TOPICS
    
    significant = sorted_topics[:cutoff_index]
    
    return ThresholdResult(
        significant_topics=significant,
        cutoff_index=cutoff_index,
        cutoff_ratio=cutoff_ratio,
        total_topics=len(sorted_topics)
    )


def add_rank_numbers(topics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Add rank numbers to topics (1-indexed)."""
    return [
        {**topic, "rank": i + 1}
        for i, topic in enumerate(topics)
    ]


# Quick test
if __name__ == "__main__":
    test_topics = [
        {"name": "Cennik", "count": 87},
        {"name": "Godziny otwarcia", "count": 64},
        {"name": "Parking", "count": 43},
        {"name": "Lokalizacja", "count": 38},
        {"name": "WiFi", "count": 5},      # Big drop: 38 -> 5 (7.6x ratio)
        {"name": "Psy dozwolone", "count": 3},
        {"name": "Wino", "count": 2},
        {"name": "Muzyka", "count": 1},
    ]
    
    result = get_significant_topics(test_topics)
    
    print(f"Total topics: {result.total_topics}")
    print(f"Cutoff at index: {result.cutoff_index}")
    print(f"Drop ratio: {result.cutoff_ratio:.1f}x")
    print(f"\nSignificant topics ({len(result.significant_topics)}):")
    
    for topic in add_rank_numbers(result.significant_topics):
        print(f"  #{topic['rank']}: {topic['name']} ({topic['count']} mentions)")
