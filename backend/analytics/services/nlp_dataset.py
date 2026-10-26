"""Candidate data contracts and audit tooling. Never trains a production model."""
import hashlib
import importlib.util
import json
import re
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from .nlp_intent_model import ALLOWED_INTENTS, TRAINING_DATA_PATH
from .nlp_query import normalize_question, SUPPORTED_INTENTS

ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = ROOT / "data/ask_smartlivestock_candidates.json"
SOURCE_PATH = ROOT / "data/nlp_candidate_source.py"
REPORT_PATH = ROOT / "data/nlp_expansion_results.json"
HANDLERS = {
    "population_summary": "_population_results", "production_trend": "_production_results",
    "production_breakdown": "_production_results", "disease_by_barangay": "_disease_results",
    "mortality_comparison": "_mortality_results", "pending_reviews": "review_workload_summary",
    "farmer_livestock_count": "_farmer_livestock_count",
}
DEFAULT_ACTIVITY_PERIOD = ("2025-11-01", "2026-10-26")
TEST_PERIODS = {
    "production_trend": [
        DEFAULT_ACTIVITY_PERIOD, DEFAULT_ACTIVITY_PERIOD, ("2025-01-01", "2025-12-31"),
        ("2026-05-01", "2026-10-26"), ("2026-01-01", "2026-10-26"),
        DEFAULT_ACTIVITY_PERIOD, ("2026-10-01", "2026-10-26"), ("2026-02-01", "2026-04-30"),
        ("2026-04-01", "2026-06-30"), ("2026-09-01", "2026-09-30"),
    ],
    "production_breakdown": [
        DEFAULT_ACTIVITY_PERIOD, DEFAULT_ACTIVITY_PERIOD, DEFAULT_ACTIVITY_PERIOD,
        ("2026-01-01", "2026-10-26"), ("2025-01-01", "2025-12-31"),
        ("2026-07-01", "2026-09-30"), ("2026-08-01", "2026-10-26"),
        DEFAULT_ACTIVITY_PERIOD, ("2026-10-01", "2026-10-26"), ("2026-01-01", "2026-05-31"),
    ],
    "disease_by_barangay": [
        DEFAULT_ACTIVITY_PERIOD, DEFAULT_ACTIVITY_PERIOD, ("2026-01-01", "2026-10-26"),
        ("2025-01-01", "2025-12-31"), ("2026-07-01", "2026-09-30"),
        DEFAULT_ACTIVITY_PERIOD, ("2026-08-01", "2026-10-26"), ("2025-01-01", "2025-12-31"),
        ("2026-10-01", "2026-10-26"), ("2026-02-01", "2026-04-30"),
    ],
    "mortality_comparison": [
        DEFAULT_ACTIVITY_PERIOD, ("2026-01-01", "2026-10-26"), DEFAULT_ACTIVITY_PERIOD,
        ("2026-04-01", "2026-06-30"), DEFAULT_ACTIVITY_PERIOD, ("2026-08-01", "2026-10-26"),
        ("2025-01-01", "2025-12-31"), ("2026-10-01", "2026-10-26"),
        ("2026-02-01", "2026-04-30"), ("2026-07-01", "2026-09-30"),
    ],
}
LANGUAGES = {"en", "tl", "tl_en"}
SPLITS = ("train", "validation", "test")
ROLES = {"MAO", "ADMIN", "SIBAT", "CBAT", "FARMER", "AUCTION", "SLAUGHTERHOUSESTAFF"}

# Independently declared expectations for the held-out scenarios. None means
# no requested entity; parser defaults are documented and evaluated explicitly.
TEST_ENTITIES = {
    "population_summary": [
        {"species": "Cattle"}, {"group_by": "barangay"}, {"species": "Goat"},
        {"species": "Carabao"}, {"species": "Chicken"}, {"species": "Sheep"},
        {"species": "Swine"}, {"barangay": "Banaba Ibaba", "barangay_id": 2},
        {"group_by": "species"}, {"species": "Cattle", "barangay": "San Roque", "barangay_id": 1},
    ],
    "production_trend": [
        {"production_type": "MILK"}, {"production_type": "MEAT"},
        {"production_type": "MILK"}, {"production_type": "EGGS"},
        {"production_type": "WOOL"},
        {"production_type": "MILK", "barangay": "San Roque", "barangay_id": 1},
        {"production_type": "MILK", "species": "Cattle"},
        {"production_type": "MEAT"}, {"production_type": "MILK"}, {"production_type": "MILK"},
    ],
    "production_breakdown": [
        {"production_type": "MILK", "group_by": "barangay"}, {"group_by": "production_type"},
        {"production_type": "MEAT", "group_by": "species"},
        {"production_type": "EGGS", "group_by": "barangay"},
        {"group_by": "production_type"},
        {"production_type": "MILK", "group_by": "species"},
        {"group_by": "production_type"},
        {"group_by": "production_type", "barangay": "San Roque", "barangay_id": 1},
        {"production_type": "WOOL", "group_by": "barangay"}, {"group_by": "production_type"},
    ],
    "disease_by_barangay": [
        {}, {}, {}, {"species": "Cattle"}, {}, {"species": "Goat"}, {}, {}, {}, {},
    ],
    "mortality_comparison": [
        {}, {}, {"species": "Goat"}, {}, {"species": "Cattle"}, {}, {}, {}, {}, {},
    ],
    "pending_reviews": [{"review_domain": v} for v in (
        None, "inventory", "mortality", "calving", None, "production",
        "ownership_transfers", "inspection_clearances", "disease", "sales")],
    "farmer_livestock_count": [
        {"species": "Cattle"}, {"species": "Goat"}, {"species": "Sheep"}, {"species": "Carabao"},
        {"species": "Cattle", "approval_status": "PENDING"},
        {"species": "Goat", "approval_status": "VERIFIED"},
        {"species": "Chicken", "approval_status": "APPROVED"}, {"species": "Cattle"},
        {"species": "Swine"}, {"species": "Duck"},
    ],
}
CLARIFICATIONS = [
    "Which production output should I trend: milk, meat, eggs or wool?",
    "Please ask about one metric at a time: production, disease cases, or mortality.",
    "Which production output should I trend: milk, meat, eggs or wool?",
    "Please ask about one livestock type at a time.",
    "The requested year is in the future.",
    "The population query is a current approved-active snapshot; historical population totals are not available through this query.",
    "Please ask about one barangay at a time, or request a comparison by barangay.",
    "Should I group recorded deaths by barangay?",
    "Please ask about one production output at a time; their units differ.",
    "Livestock registrations do not use a REJECTED status. Ask for approved, pending, verified, or subject-to-revision records.",
]


def build_corpus():
    spec = importlib.util.spec_from_file_location("nlp_candidate_source", SOURCE_PATH)
    source = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(source)
    rows = []
    for intent, sections in source.FAMILIES.items():
        sections_by_split = sections.strip().split("\n---\n")
        sections_by_split[0] = "\n".join((sections_by_split[0].strip(), source.TRAINING_SUPPLEMENTS[intent].strip()))
        for split, section in zip(SPLITS, sections_by_split, strict=True):
            for index, line in enumerate(section.strip().splitlines(), 1):
                family = f"{intent}.{split}.{index:02d}"
                # Stable IDs survive adding another family earlier in a split.
                english = line.split("|", 1)[0].strip()
                slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", english).encode("ascii", "ignore").decode().lower()).strip("-")[:36]
                family = f"{intent}.{split}.{slug}-{hashlib.sha1(english.encode()).hexdigest()[:8]}"
                for language, utterance in zip(("en", "tl", "tl_en"), line.split("|"), strict=True):
                    entities = {}
                    if split == "test" and intent in HANDLERS:
                        entities = {"species": None, "barangay": None, "barangay_id": None,
                                    "production_type": None, "group_by": None}
                        if intent in {"production_trend", "production_breakdown", "disease_by_barangay", "mortality_comparison"}:
                            expected_start, expected_end = TEST_PERIODS[intent][index - 1]
                            entities.update({"period.start": expected_start, "period.end": expected_end})
                        else:
                            entities["period"] = None
                        if intent in {"disease_by_barangay", "mortality_comparison"}:
                            entities["group_by"] = "barangay"
                        entities.update(TEST_ENTITIES[intent][index - 1])
                    behavior = "answer" if intent in HANDLERS else intent
                    adversarial = intent == "unsupported" and (
                        (split == "train" and index >= 12) or
                        (split == "validation" and index == 3) or (split == "test" and index >= 7))
                    rows.append({
                        "example_id": f"{family}.{language}", "utterance": utterance.strip(),
                        "intent": intent, "language": language, "role": "MAO",
                        "entities": entities,
                        "expected_filters": {"record_status": "APPROVED"} if intent in HANDLERS and intent != "pending_reviews" else {},
                        "expected_behavior": behavior,
                        "expected_clarification": (CLARIFICATIONS[index - 1] if split == "test" else
                            "Ask for the missing or unsupported metric, entity, grouping, unit or period; execute nothing.") if intent == "clarification" else None,
                        "expected_query_handler": HANDLERS.get(intent),
                        "difficulty": "adversarial" if adversarial else "hard" if intent == "clarification" else "medium" if language != "en" else "easy",
                        "source_type": "generated_candidate", "review_status": "candidate",
                        "split": split, "split_group": family,
                        "notes": "Synthetic wording and names. Proposed label, not human-reviewed ground truth."
                    })
    return {"schema_version": 1, "version": source.VERSION, "generation_method": source.METHOD,
            "evaluation_date": "2026-10-26", "timezone": "Asia/Manila", "examples": rows}


def load_corpus():
    return json.loads(CORPUS_PATH.read_text(encoding="utf-8"))


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def classifier_rows(rows):
    return [{"question": row["utterance"], "intent": row["intent"]} for row in rows]


def audit_corpus(data, *, compare_legacy=True):
    """Fail invalid contracts/leakage; flag likely near duplicates for human review.

    Surface similarity is a triage tool, not proof of semantic independence.
    No spell-correction of locations/names or automatic relabeling takes place.
    """
    errors, near = [], []
    seen_ids, seen_text, families = set(), {}, {}
    counts = {split: {key: Counter() for key in ("intent", "language", "difficulty", "review_status", "expected_behavior")}
              for split in SPLITS}
    rows = data.get("examples", [])
    for row in rows:
        identifier, text = row.get("example_id"), row.get("utterance", "")
        if not isinstance(identifier, str) or identifier in seen_ids:
            errors.append(f"Missing/duplicate example ID: {identifier}")
        seen_ids.add(identifier)
        intent, split, language = row.get("intent"), row.get("split"), row.get("language")
        if intent not in ALLOWED_INTENTS or split not in SPLITS or language not in LANGUAGES:
            errors.append(f"Invalid intent/split/language: {identifier}")
            continue
        if not isinstance(text, str) or not text.strip() or len(text) > 500:
            errors.append(f"Invalid utterance: {identifier}")
            continue
        if row.get("role") not in ROLES or row.get("difficulty") not in {"easy", "medium", "hard", "adversarial"}:
            errors.append(f"Invalid role/difficulty: {identifier}")
        if row.get("source_type") not in {"generated_candidate", "manually_authored", "reviewed_paraphrase", "approved_real_world"} or row.get("review_status") not in {"candidate", "accepted", "rejected"}:
            errors.append(f"Invalid provenance/review status: {identifier}")
        expected = "answer" if intent in SUPPORTED_INTENTS else intent
        if row.get("expected_behavior") != expected or row.get("expected_query_handler") != HANDLERS.get(intent):
            errors.append(f"Intent/behavior/handler conflict: {identifier}")
        if intent == "clarification" and not row.get("expected_clarification"):
            errors.append(f"Missing clarification expectation: {identifier}")
        if not isinstance(row.get("entities"), dict) or not isinstance(row.get("expected_filters"), dict):
            errors.append(f"Invalid entity/filter contract: {identifier}")
        normalized = normalize_question(text)
        if normalized in seen_text:
            previous = seen_text[normalized]
            kind = "conflicting labels" if previous["intent"] != intent else "normalized duplicate"
            errors.append(f"{kind}: {previous['example_id']} / {identifier}")
        seen_text[normalized] = row
        family = row.get("split_group")
        if not family:
            errors.append(f"Missing split_group: {identifier}")
        if family in families and families[family] != split:
            errors.append(f"Family leakage: {family}")
        families[family] = split
        for key in counts[split]:
            counts[split][key][row[key]] += 1
    for split in SPLITS:
        missing = ALLOWED_INTENTS - set(counts[split]["intent"])
        if missing:
            errors.append(f"{split} missing labels: {sorted(missing)}")
    # Guard original regression and production training as well as this corpus.
    legacy = {}
    if compare_legacy:
        for path, split in ((TRAINING_DATA_PATH, "legacy_train"), (ROOT / "tests/data/ask_smartlivestock_eval.json", "legacy_regression")):
            for row in json.loads(path.read_text(encoding="utf-8")):
                legacy[normalize_question(row["question"])] = split
        multilingual = json.loads((ROOT / "data/ask_smartlivestock_intent_multilingual.json").read_text(encoding="utf-8"))
        for group in multilingual["groups"]:
            for row in group["examples"]:
                legacy[normalize_question(row["question"])] = f"multilingual_{group['split']}"
        for normalized, row in seen_text.items():
            if normalized in legacy:
                errors.append(f"Legacy overlap ({legacy[normalized]}): {row['example_id']}")
    # Only same-language comparisons; repeated function words alone are not
    # semantic leakage. High similarity across splits needs source review.
    by_language = defaultdict(list)
    for row in rows:
        if isinstance(row.get("utterance"), str):
            by_language[row.get("language")].append(row)
    for bucket in by_language.values():
        for i, left in enumerate(bucket):
            a = normalize_question(left["utterance"])
            for right in bucket[i + 1:]:
                if left["split_group"] == right["split_group"]:
                    continue
                b = normalize_question(right["utterance"])
                if abs(len(a) - len(b)) > max(len(a), len(b)) * .2:
                    continue
                score = SequenceMatcher(None, a, b, autojunk=False).ratio()
                if score >= .88:
                    near.append({"left": left["example_id"], "right": right["example_id"],
                                 "similarity": round(score, 3), "cross_split": left["split"] != right["split"],
                                 "label_conflict": left["intent"] != right["intent"]})
    for pair in near:
        if pair["cross_split"]:
            errors.append(f"Likely near-duplicate crosses splits; revise or group together: {pair['left']} / {pair['right']}")
    return {"version": data.get("version"), "sha256": fingerprint(data), "total": len(rows),
            "errors": errors, "near_duplicates_for_review": near, "distribution": counts,
            "group_counts": dict(Counter(families.values())),
            "training_target_shortfall": {intent: max(0, 100 - counts['train']['intent'][intent]) for intent in sorted(ALLOWED_INTENTS)},
            "limitations": "AI-authored proposed labels, not human reviewed. Near-duplicate detection cannot prove semantic independence. Candidate test set is developmental; original regression remains separate."}
