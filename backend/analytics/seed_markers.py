"""
Deterministic Seed Markers for SmartLivestock Synthetic Analytics Test Datasets.

CRITICAL SAFETY RULES:
1. Every generated synthetic record carries one of these unique deterministic markers.
2. Seed cleaning (--clean) ONLY queries records containing these exact markers.
3. Real farmer data, inventory, production, and accounts are NEVER deleted or modified.
"""

SEED_MARKER_PRODUCTION_V2 = "AI_SEED::ANALYTICS_TEST::PRODUCTION::V2"
SEED_MARKER_PRODUCTION_LEGACY = "AI_SEED::PREDICTIVE_ANALYTICS::V1"
SEED_MARKER_CALVING = "AI_SEED::ANALYTICS_TEST::CALVING::V1"
SEED_MARKER_DISEASE = "AI_SEED::ANALYTICS_TEST::DISEASE::V1"
SEED_MARKER_MORTALITY = "AI_SEED::ANALYTICS_TEST::MORTALITY::V1"
SEED_MARKER_INSPECTION = "AI_SEED::ANALYTICS_TEST::INSPECTION::V1"
