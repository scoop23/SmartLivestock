"""Rule-based, allowlisted questions over existing SmartLivestock analytics."""

import calendar
import re
import unicodedata
from datetime import date, timedelta

from django.db.models import Case, CharField, Count, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import Barangay, Farmer, LivestockInventory, LivestockType
from production.models import ProductionRecord
from production.serializer import allowed_production_types
from smartlivestock.workflows import role_name, scope_reviewer_queryset

from .population import official_inventory, population_summary
from .review_workload import review_workload_summary


MAX_QUESTION_LENGTH = 500
MAX_EXPLICIT_PERIOD_DAYS = 366 * 5
SUPPORTED_INTENTS = frozenset({
    "population_summary", "production_trend", "production_breakdown",
    "disease_by_barangay", "mortality_comparison", "pending_reviews",
    "farmer_livestock_count",
})

PRODUCTION_ALIASES = {
    "MILK": ("milk", "dairy", "gatas"),
    "MEAT": ("meat", "slaughter", "karne"),
    "EGGS": ("egg", "eggs", "itlog"),
    "WOOL": ("wool", "fleece", "lana"),
}
SPECIES_ALIASES = {
    "cattle": ("cattle", "cow", "cows", "baka", "bovine"),
    "carabao": ("carabao", "kalabaw", "buffalo", "buffaloes"),
    "goat": ("goat", "goats", "kambing", "caprine"),
    "sheep": ("sheep", "tupa", "ovine", "lamb", "ram"),
    "swine": ("swine", "pig", "pigs", "baboy", "hog", "porcine"),
    "poultry": ("poultry", "chicken", "chickens", "manok", "duck", "ducks", "itik", "hen", "layer"),
}
NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}


def normalize_question(value):
    """Normalize user wording without changing the meaning of ISO dates."""
    value = unicodedata.normalize("NFKC", value or "").casefold()
    value = re.sub(r"[^\w\s:-]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def tokenize_question(value):
    """Split normalized text without breaking ISO dates or hyphenated names.

    No stemming or stop-word removal: words such as 'last', 'not', and 'sa'
    help determine dates, negation and location in English/Taglish questions.
    This same tokenizer is used by the offline TF-IDF experiment.
    """
    return re.findall(r"\d{4}-\d{2}-\d{2}|[^\W_]+(?:-[^\W_]+)*", normalize_question(value))


def _contains(text, phrase):
    phrase = normalize_question(phrase)
    return bool(phrase and re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text))


def _month_start(today, months_back):
    index = today.year * 12 + today.month - 1 - months_back
    year, month_index = divmod(index, 12)
    return date(year, month_index + 1, 1)


def _date_period(start, end, label, selection):
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "label": label,
        "selection": selection,
    }


def _parse_period(text, today, intent):
    """Recognize explicit calendar periods and reject conflicting/invalid ranges."""
    matches = []
    unsupported_time = r"\b(?:yesterday|tomorrow|week|weeks|day|days|january|february|march|april|may|june|july|august|september|october|november|december|kahapon|linggo|since|until)\b"
    if re.search(unsupported_time, text) or (_contains(text, "today") and intent not in ("population_summary", "pending_reviews")):
        return None, "Use a supported calendar month, quarter, year, or an explicit YYYY-MM-DD date range."

    range_match = re.search(
        r"\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|and)\s+(\d{4}-\d{2}-\d{2})\b",
        text,
    )
    if range_match:
        try:
            start = date.fromisoformat(range_match.group(1))
            end = date.fromisoformat(range_match.group(2))
        except ValueError:
            return None, "Use valid dates in YYYY-MM-DD format."
        if end < start or end > today or (end - start).days > MAX_EXPLICIT_PERIOD_DAYS:
            return None, "Choose a date range ending today or earlier and no longer than five years."
        matches.append((start, end, "custom_range", "Custom date range"))

    if _contains(text, "this quarter") or _contains(text, "current quarter") or _contains(text, "ngayong quarter") or _contains(text, "quarter na ito"):
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        matches.append((date(today.year, quarter_start_month, 1), today, "current_quarter", "Current calendar quarter to date"))

    previous_quarter = _contains(text, "last quarter") or _contains(text, "previous quarter") or _contains(text, "nakaraang quarter")
    if previous_quarter:
        current_quarter_month = ((today.month - 1) // 3) * 3 + 1
        current_start = date(today.year, current_quarter_month, 1)
        previous_end = current_start - timedelta(days=1)
        previous_start_month = ((previous_end.month - 1) // 3) * 3 + 1
        matches.append((date(previous_end.year, previous_start_month, 1), previous_end, "previous_quarter", "Previous calendar quarter"))

    if any(_contains(text, phrase) for phrase in ("this month", "current month", "ngayong buwan")):
        matches.append((date(today.year, today.month, 1), today, "current_month", "Current month to date"))
    if any(_contains(text, phrase) for phrase in ("last month", "previous month", "nakaraang buwan")):
        previous_end = date(today.year, today.month, 1) - timedelta(days=1)
        matches.append((date(previous_end.year, previous_end.month, 1), previous_end, "previous_month", f"Calendar month {previous_end.year}-{previous_end.month:02d}"))

    month_count = re.search(
        r"\b(?:last|past|previous|nakaraang|huling)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:calendar\s+)?(?:months?|mos?|buwan)\b",
        text,
    )
    if month_count:
        count = int(month_count.group(1)) if month_count.group(1).isdigit() else NUMBER_WORDS[month_count.group(1)]
        if count < 1 or count > 24:
            return None, "The assistant supports periods from 1 to 24 calendar months."
        # "Last six months" means this calendar month and the five before it.
        start = _month_start(today, count - 1)
        matches.append((start, today, f"last_{count}_months", f"Last {count} calendar months to date"))

    if _contains(text, "this year") or _contains(text, "year to date") or _contains(text, "ngayong taon"):
        matches.append((date(today.year, 1, 1), today, "year_to_date", "Current year to date"))
    if _contains(text, "last year") or _contains(text, "previous year") or _contains(text, "nakaraang taon"):
        year = today.year - 1
        matches.append((date(year, 1, 1), date(year, 12, 31), "previous_year", f"Calendar year {year}"))

    quarter_year = re.search(r"\bq([1-4])\s+(20\d{2})\b", text)
    if quarter_year:
        quarter, year = int(quarter_year.group(1)), int(quarter_year.group(2))
        start = date(year, (quarter - 1) * 3 + 1, 1)
        end_month = quarter * 3
        end = date(year, end_month, calendar.monthrange(year, end_month)[1])
        if start > today:
            return None, "The requested quarter is in the future."
        matches.append((start, min(end, today), f"q{quarter}_{year}", f"{year} Q{quarter}"))

    requested_year = re.search(r"\b(?:in|during|for|year)\s+(20\d{2})\b", text)
    if requested_year and not quarter_year:
        year = int(requested_year.group(1))
        if year > today.year:
            return None, "The requested year is in the future."
        matches.append((date(year, 1, 1), min(date(year, 12, 31), today), f"year_{year}", f"Calendar year {year}"))

    if len(matches) > 1:
        return None, "I found more than one time period. Please ask about one period at a time."
    if matches:
        start, end, selection, label = matches[0]
        if end < start:
            return None, "The end date must be on or after the start date."
        if (end - start).days > MAX_EXPLICIT_PERIOD_DAYS:
            return None, "Choose a date range no longer than five years."
        return _date_period(start, end, label, selection), None

    # Never ignore an unrecognized date and silently substitute the default.
    if re.search(r"\b20\d{2}\b|\b(?:from|between)\b", text):
        return None, "Use a supported calendar month, quarter, year, or an explicit YYYY-MM-DD date range."
    if intent in ("population_summary", "pending_reviews"):
        return None, None
    # Activity questions without a period use an explicit, visible default.
    return _date_period(_month_start(today, 11), today, "Last 12 calendar months to date", "default_last_12_months"), None


def _resolve_species(text, species_names):
    names = sorted({name for name in species_names if name}, key=lambda name: len(name), reverse=True)
    direct = [name for name in names if _contains(text, name)]

    aliases_found = [
        (group, aliases)
        for group, aliases in SPECIES_ALIASES.items()
        if any(_contains(text, alias) for alias in aliases)
    ]
    if not aliases_found:
        return sorted(set(direct), key=str.casefold), None
    if len(aliases_found) > 1:
        return [], "Please ask about one livestock type at a time."
    if aliases_found[0][0] == "poultry":
        chicken = any(_contains(text, word) for word in ("chicken", "chickens", "manok", "hen", "layer"))
        duck = any(_contains(text, word) for word in ("duck", "ducks", "itik"))
        if chicken and duck:
            return [], "Please ask about one livestock type at a time."
    if direct:
        # Direct names must not hide a conflicting alias (e.g. cattle and goats).
        if len(direct) == 1:
            return direct, None
        return [], "Please ask about one livestock type at a time."
    group_name, aliases = aliases_found[0]
    candidates = [
        name for name in names
        if any(
            _contains(normalize_question(name), alias) or _contains(alias, normalize_question(name))
            for alias in (group_name, *aliases)
        )
    ]
    if len(candidates) == 1:
        return candidates, None
    if len(candidates) > 1:
        return [], "That livestock name matches more than one registered type. Please use the specific type name."
    return [], "I could not match that livestock type to a type currently registered in SmartLivestock."


def _resolve_production_type(text):
    found = [
        production_type
        for production_type, aliases in PRODUCTION_ALIASES.items()
        if any(_contains(text, alias) for alias in aliases)
    ]
    if len(found) > 1:
        return None, "Please ask about one production type at a time."
    return (found[0], None) if found else (None, None)


def _resolve_barangay(text, barangays):
    matches = [
        barangay for barangay in barangays
        if barangay.get("name") and _contains(text, barangay["name"])
    ]
    if len(matches) > 1:
        return None, "Please ask about one barangay at a time, or request a comparison by barangay."
    if matches:
        return matches[0], None
    location_match = re.search(r"\b(?:in|within|sa)\s+([a-z][\w-]*)", text)
    if location_match:
        first_word = location_match.group(1)
        non_locations = {
            "the", "this", "that", "last", "past", "previous", "current", "each", "all",
            "cattle", "cow", "carabao", "buffalo", "goat", "sheep", "swine", "pig", "poultry",
            "chicken", "duck", "milk", "dairy", "eggs", "egg", "meat", "wool", "quarter", "year",
            "q1", "q2", "q3", "q4", "2025", "2026", "bawat",
        }
        if first_word not in non_locations:
            return None, "I could not match that barangay within the data available to your account."
    if any(_contains(text, phrase) for phrase in ("all barangays", "every barangay", "which barangays", "by barangay", "per barangay", "across barangays", "each barangay", "sa bawat barangay")):
        return None, None
    if re.search(r"\bbarangay\s+[a-z]", text) and not any(_contains(text, phrase) for phrase in ("all barangays", "which barangays", "by barangay", "per barangay", "across barangays", "each barangay")):
        return None, "I could not match that barangay within the data available to your account."
    return None, None


def _unknown_species_reference(text, species_names):
    """Catch a likely named livestock filter that is outside the allowlist."""
    known = {alias for aliases in SPECIES_ALIASES.values() for alias in aliases}
    known.update(alias for aliases in PRODUCTION_ALIASES.values() for alias in aliases)
    known.update(token for name in species_names for token in normalize_question(name).split())
    ordinary = {
        "a", "an", "the", "all", "each", "how", "many", "much", "which", "what", "show", "compare",
        "reported", "report", "most", "more", "total", "current", "currently", "registered", "active", "approved",
        "heads", "animals", "animal", "livestock", "population", "inventory", "by", "per", "across", "in", "for",
        "of", "among", "from", "this", "last", "past", "previous", "quarter", "month", "months", "year", "years",
        "disease", "diseases", "death", "deaths", "mortality", "production", "yield", "output", "sakit", "namatay",
            "barangay", "barangays", "case", "cases", "ang", "ilan", "ilang", "are", "is", "was", "were", "livestock",
        "monthly", "daily", "breakdown", "break", "down", "trend", "type", "species", "composition", "distribution", "all",
    }
    markers = ("mortality", "death", "deaths", "disease", "diseases", "production", "yield", "registered", "heads")
    for marker in markers:
        match = re.search(rf"(?<!\w){re.escape(marker)}(?!\w)", text)
        if not match:
            continue
        prefix = text[:match.start()].split()
        while prefix and prefix[-1] in ordinary:
            prefix.pop()
        if prefix and prefix[-1] not in known:
            return prefix[-1]
        after = re.search(r"\b(?:of|among)\s+([a-z][\w-]*)", text[match.end():])
        if after and after.group(1) not in ordinary and after.group(1) not in known:
            return after.group(1)
    return None


def _has_farmer_count_request(text):
    """Recognize only per-farmer count wording, not inventory/comparison asks."""
    count_request = any(_contains(text, phrase) for phrase in (
        "how many", "count", "number of", "total", "ilan", "ilang", "bilangin",
    ))
    if not count_request or _contains(text, "registered farmers"):
        return False
    return (
        any(_contains(text, phrase) for phrase in (
            "farmer", "farmers", "raiser", "raisers", "magsasaka", "my", "mine", "akin",
        ))
        or bool(re.search(r"\bmagsasakang\b", text))
        or bool(re.search(r"\b(?:does|do)\s+.+\s+(?:have|own|owns)\b", text))
        or bool(re.search(r"\bbelongs?\s+to\b|\bowned\s+by\b|\b(?:ni|kay)\s+", text))
    )


def _trim_farmer_reference(value, species_names):
    """Stop a captured name at known question words or livestock names."""
    stop_words = {
        "s", "have", "has", "own", "owns", "belong", "belongs",
        "registered", "currently", "current", "active", "approved", "pending", "verified",
        "rejected", "inventory", "livestock", "count", "head", "heads", "number",
        "is", "are", "was", "were", "ni", "kay", "of", "for", "to", "please",
        "today", "this", "last", "month", "quarter", "year", "show", "tell", "me",
    }
    stop_words.update(alias for aliases in SPECIES_ALIASES.values() for alias in aliases)
    stop_words.update(
        token for name in species_names for token in normalize_question(name).split()
    )
    words = value.split()
    end = next((index for index, word in enumerate(words) if word in stop_words), len(words))
    return " ".join(words[:end]).strip()


def _extract_farmer_reference(text, species_names):
    """Extract a name-shaped phrase from a small set of supported templates."""
    marker = re.search(r"\b(farmer|raiser|magsasaka(?:ng)?)\b", text)
    if marker:
        name = _trim_farmer_reference(text[marker.end():].strip(), species_names)
        return f"{marker.group(1)} {name}".strip() if name else None

    patterns = (
        r"\b(?:does|do)\s+(.+?)\s+(?:have|own|owns)\b",
        r"\bbelongs?\s+to\s+(.+)$",
        r"\bowned\s+by\s+(.+)$",
        r"\b(?:ni|kay|of)\s+(.+)$",
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            name = _trim_farmer_reference(match.group(1).strip(), species_names)
            if name:
                return name

    # The normalizer separates possessive apostrophes, so support both common
    # English forms while retaining exact-name resolution downstream.
    possessive = re.search(r"\bcount\s+(.+?)\s+s\s+(?:cattle|cows?|baka|carabao|kalabaw|goats?|kambing|sheep|tupa|swine|pigs?|baboy|poultry|chickens?|manok|ducks?|itik)\b", text)
    if possessive:
        return _trim_farmer_reference(possessive.group(1).strip(), species_names)
    return None


def _parse_farmer_livestock_count(text, *, today, species_names):
    """Parse the first supported farmer-specific count without guessing entities."""
    farmer_query = _extract_farmer_reference(text, species_names)
    if not farmer_query:
        return {"status": "clarification", "message": "Which farmer should I look up? Include the farmer's exact registered name."}

    if any(_contains(text, phrase) for phrase in (
        "production", "milk", "dairy", "gatas", "eggs", "itlog", "meat", "karne",
        "wool", "disease", "sickness", "mortality", "death", "died", "namatay",
        "sales", "sale", "sold", "revenue", "profit", "slaughter", "compare",
        "most", "forecast", "predict", "rate", "percentage",
    )):
        return {"status": "unsupported", "message": "This farmer-specific query currently answers livestock counts only. Ask one count question without production, health, sales, comparison, or forecast filters."}

    species, species_error = _resolve_species(text, species_names)
    if species_error:
        return {"status": "clarification", "message": species_error}
    if len(species) > 1:
        return {"status": "clarification", "message": "Please ask about one livestock type at a time."}
    count_phrase = re.search(r"\b(?:how many|ilan|ilang)\s+(.+?)\s+(?:does|do|belong|belongs|ni|kay)\b", text)
    if count_phrase:
        known_tokens = {token for aliases in SPECIES_ALIASES.values() for alias in aliases for token in alias.split()}
        known_tokens.update(token for name in species_names for token in normalize_question(name).split())
        ordinary = {
            "registered", "current", "currently", "active", "approved", "pending", "verified",
            "subject", "to", "revision", "the", "a", "an", "mga", "na", "ang", "livestock", "animal", "animals", "head", "heads",
            "and", "of", "per", "total", "number", "how", "many", "ilan", "ilang",
        }
        unknown_in_count_phrase = next((word for word in count_phrase.group(1).split()
                                        if word not in known_tokens and word not in ordinary), None)
        if unknown_in_count_phrase:
            return {"status": "clarification", "message": "I could not match that livestock type to one currently registered in SmartLivestock."}

    if not species:
        unknown_species = _unknown_species_reference(text, species_names)
        if unknown_species:
            return {"status": "clarification", "message": "I could not match that livestock type to one currently registered in SmartLivestock."}
        return {"status": "clarification", "message": "Which one livestock type should I count for that farmer?"}

    if _contains(text, "rejected"):
        return {"status": "clarification", "message": "Livestock registrations do not use a REJECTED status in this system. Ask for approved, pending, verified, or subject-to-revision records."}
    status_aliases = {
        "APPROVED": ("approved",),
        "PENDING": ("pending",),
        "VERIFIED": ("verified",),
        "SUBJECT_TO_REVISION": ("subject to revision", "revision"),
    }
    statuses = [status for status, aliases in status_aliases.items()
                if any(_contains(text, alias) for alias in aliases)]
    if len(statuses) > 1:
        return {"status": "clarification", "message": "Please ask about one registration status at a time."}

    period, period_error = _parse_period(text, today, "population_summary")
    if period_error:
        return {"status": "clarification", "message": period_error}
    if period:
        return {"status": "clarification", "message": "Farmer livestock counts are a current snapshot; historical livestock counts are not available through this query."}

    return {
        "status": "parsed",
        "intent": "farmer_livestock_count",
        "parameters": {
            "period": None,
            "barangay_id": None,
            "barangay": None,
            "farmer_query": farmer_query,
            "species": species[0],
            "approval_status": statuses[0] if statuses else None,
            "production_type": None,
            "group_by": None,
        },
    }


def parse_question(question, *, today=None, barangays=(), species_names=()):
    """Parse questions with explicit rules; never return ORM fields or SQL."""
    normalized = normalize_question(question)
    if not normalized:
        return {"status": "clarification", "message": "Enter a question about livestock analytics."}
    if len(question) > MAX_QUESTION_LENGTH:
        return {"status": "clarification", "message": f"Keep the question to {MAX_QUESTION_LENGTH} characters or fewer."}

    today = today or timezone.localdate()
    if _has_farmer_count_request(normalized):
        return _parse_farmer_livestock_count(
            normalized, today=today, species_names=species_names,
        )
    # Other named-owner and animal filters remain unsupported. Never answer a
    # different question with municipal totals.
    if any(_contains(normalized, word) for word in ("farmer", "farmers", "raiser", "raisers", "magsasaka", "my", "mine", "akin", "own", "owns", "owner", "owned", "tag", "animal id", "farmer id")) or re.search(r"\bdoes\s+.+\s+have\b|\blivestock\s+\d+\b", normalized):
        return {"status": "unsupported", "message": "The assistant does not yet implement farmer-count, individual-owner, or animal-ID filters. This is a query capability limitation, not a decision about your permissions. Use the authorized farmer directory or inventory instead."}
    queue_request = _contains(normalized, "mao") and any(_contains(normalized, word) for word in ("waiting", "pending", "approval", "review"))
    if not queue_request and any(_contains(normalized, word) for word in ("sales", "sold", "revenue", "profit", "benta", "sold animals")):
        return {"status": "unsupported", "message": "Sales and sold-animal summaries are not implemented in this assistant. Use the existing trade records interface."}
    if any(_contains(normalized, word) for word in ("slaughter", "slaughtered", "katay")):
        return {"status": "unsupported", "message": "A separate slaughter summary is not implemented here. Ask for meat production to view approved recorded meat output, including linked slaughter yield."}
    if any(_contains(normalized, word) for word in ("rate", "rates", "percentage", "predict", "forecast")):
        return {"status": "unsupported", "message": "This assistant reports recorded counts and quantities, not rates, percentages, or forecasts."}
    signals = {
        "pending_reviews": any(_contains(normalized, phrase) for phrase in (
            "pending", "waiting", "awaiting", "review", "approval", "for mao", "ma approve", "hindi pa approved",
        )),
            "disease_by_barangay": any(_contains(normalized, phrase) for phrase in (
            "disease", "diseases", "desease", "disese", "outbreak", "illness", "sakit", "may sakit",
        )),
        "mortality_comparison": any(_contains(normalized, phrase) for phrase in (
            "mortality", "death", "deaths", "died", "namatay", "kamatayan",
        )),
            "production": any(_contains(normalized, phrase) for phrase in (
            "production", "prodution", "produccion", "yield", "output", "milk", "dairy", "gatas", "egg", "eggs", "itlog", "wool", "meat", "karne",
        )),
        "population_summary": any(_contains(normalized, phrase) for phrase in (
            "population", "inventory", "registered", "currently", "current herd", "heads", "how many", "ilang", "ilan", "active livestock", "livestock count", "herd size",
        )),
    }

    if not signals["pending_reviews"] and sum(signals[key] for key in ("disease_by_barangay", "mortality_comparison", "production")) > 1:
        return {"status": "clarification", "message": "Please ask about one metric at a time: production, disease cases, or mortality."}
    if signals["disease_by_barangay"] and signals["mortality_comparison"]:
        return {"status": "clarification", "message": "Do you want a disease-case comparison or a mortality comparison? Please ask about one metric."}
    if signals["pending_reviews"]:
        intent = "pending_reviews"
    elif signals["disease_by_barangay"]:
        intent = "disease_by_barangay"
    elif signals["mortality_comparison"]:
        intent = "mortality_comparison"
    elif signals["production"]:
        intent = "production"
    elif signals["population_summary"]:
        intent = "population_summary"
    else:
        return {"status": "unsupported", "reason": "unrecognized_intent", "message": "I can answer livestock population, production, disease, mortality, and MAO review-queue questions. Try one of the examples."}
    if intent != "pending_reviews" and any(_contains(normalized, word) for word in ("pending", "verified", "rejected", "declarations")):
        return {"status": "clarification", "message": "Analytics use approved records. For pending submissions, ask about the current MAO review queue."}
    if intent == "production":
        breakdown = any(_contains(normalized, phrase) for phrase in (
            "breakdown", "break down", "by barangay", "per barangay", "by type", "by livestock type", "by species", "distribution", "composition",
        ))
        intent = "production_breakdown" if breakdown else "production_trend"

    period, period_error = _parse_period(normalized, today, intent)
    if period_error:
        return {"status": "clarification", "message": period_error}
    if intent == "population_summary" and period:
        return {"status": "clarification", "message": "The population query is a current approved-active snapshot; historical population totals are not available through this query."}
    if intent == "pending_reviews" and period:
        return {"status": "clarification", "message": "The review-workload source is a current queue snapshot and does not provide historical queue counts."}

    barangay, barangay_error = _resolve_barangay(normalized, barangays)
    if barangay_error:
        return {"status": "clarification", "message": barangay_error}
    species, species_error = _resolve_species(normalized, species_names)
    if species_error:
        return {"status": "clarification", "message": species_error}
    if len(species) > 1:
        return {"status": "clarification", "message": "Please ask about one livestock type at a time so the result stays clear."}
    if not species:
        unknown_species = _unknown_species_reference(normalized, species_names)
        if unknown_species:
            return {"status": "clarification", "message": "I could not match that livestock type to a type currently registered in SmartLivestock."}
    if not species:
        entity_match = re.search(r"\b(?:of|among|for|by)\s+([a-z][\w-]*)", normalized)
        if entity_match:
            possible_species = entity_match.group(1)
            reserved = {
                "all", "type", "types", "species", "barangay", "barangays", "month", "months",
                "year", "years", "head", "heads", "records", "record", "production", "the", "each",
                "last", "past", "previous", "current", "this", "mao", "approval", "review", "all", "livestock",
            }
            known_species_words = {alias for aliases in SPECIES_ALIASES.values() for alias in aliases}
            known_species_words.update(normalize_question(name) for name in species_names)
            if possible_species not in reserved and possible_species not in known_species_words:
                return {"status": "clarification", "message": "I could not match that livestock type to a type currently registered in SmartLivestock."}
    production_type, production_error = _resolve_production_type(normalized)
    if production_error:
        return {"status": "clarification", "message": production_error}

    if species and production_type and production_type not in allowed_production_types(species[0]):
        return {"status": "clarification", "message": "That production category is not supported for the selected livestock type. Choose a supported combination."}
    if any(_contains(normalized, phrase) for phrase in ("by barangay", "per barangay")) and any(_contains(normalized, phrase) for phrase in ("by species", "by livestock type")):
        return {"status": "clarification", "message": "Please choose one grouping: barangay or livestock type."}
    group_by = None
    if intent in ("disease_by_barangay", "mortality_comparison"):
        if not any(_contains(normalized, phrase) for phrase in (
            "by barangay", "per barangay", "across barangays", "across all barangays", "each barangay", "which barangays", "barangays reported", "sa bawat barangay",
        )):
            return {"status": "clarification", "message": "Should I compare this metric by barangay? Please say 'by barangay' or 'across barangays'."}
        group_by = "barangay"
    elif intent == "population_summary":
        if any(_contains(normalized, phrase) for phrase in ("by barangay", "per barangay", "each barangay", "across barangays", "sa bawat barangay")):
            group_by = "barangay"
        elif any(_contains(normalized, phrase) for phrase in ("by livestock type", "by species", "per species")):
            group_by = "species"
    elif intent == "production_breakdown":
        if any(_contains(normalized, phrase) for phrase in ("by barangay", "per barangay", "sa bawat barangay")):
            group_by = "barangay"
        elif any(_contains(normalized, phrase) for phrase in ("by livestock type", "by species", "per species")):
            group_by = "species"
        else:
            group_by = "production_type"

    if intent == "production_trend" and production_type is None:
        return {"status": "clarification", "message": "Which production output should I trend: milk, meat, eggs, or wool? Their units differ."}
    review_domain = None
    if intent == "pending_reviews":
        domain_aliases = {
            "inventory": ("inventory", "livestock registration"),
            "production": ("production", "milk", "eggs", "meat", "wool"),
            "disease": ("disease", "diseases"),
            "mortality": ("mortality", "deaths"),
            "calving": ("calving", "birth"),
            "census": ("census",),
            "ownership_transfers": ("ownership transfer", "transfer of ownership"),
            "inspection_clearances": ("inspection", "clearance", "movement"),
            "sales": ("auction sales", "sale record"),
        }
        domains_found = [key for key, aliases in domain_aliases.items() if any(_contains(normalized, alias) for alias in aliases)]
        if len(domains_found) > 1:
            return {"status": "clarification", "message": "Please ask about one submission type at a time, or ask for all MAO queues."}
        review_domain = domains_found[0] if domains_found else None
        if not any(_contains(normalized, phrase) for phrase in ("mao", "municipal agriculture office")):
            return {"status": "clarification", "message": "Do you mean items waiting for MAO approval? This query does not combine SIBAT and MAO review stages."}
        if not any(_contains(normalized, phrase) for phrase in ("approval", "approve", "review", "waiting", "awaiting", "pending", "for mao", "ma approve")):
            return {"status": "clarification", "message": "Please specify that you mean submissions waiting for MAO review or approval."}
        if barangay or species or production_type:
            return {"status": "clarification", "message": "The existing MAO workload summary can group queue counts by submission type only; it cannot filter queue counts by barangay, livestock type, or production type."}

    return {
        "status": "parsed",
        "intent": intent,
        "parameters": {
            "period": period,
            "barangay_id": barangay.get("id") if barangay else None,
            "barangay": barangay.get("name") if barangay else None,
            "species": species[0] if species else None,
            "production_type": production_type,
            "group_by": group_by,
            "review_domain": review_domain,
        },
    }


def _species_expression():
    return Coalesce(
        "livestock__livestock_type__name",
        "batch__livestock_type__name",
        Value("Unspecified"),
        output_field=CharField(),
    )


def _apply_species(queryset, species_name):
    if not species_name:
        return queryset
    return queryset.filter(
        Q(livestock__livestock_type__name=species_name)
        | Q(batch__livestock_type__name=species_name)
    )


def _activity_query(queryset, *, user, period, barangay_id, species_name):
    scoped = scope_reviewer_queryset(queryset, user).filter(
        status="APPROVED",
        record_date__range=(date.fromisoformat(period["start"]), date.fromisoformat(period["end"])),
    )
    if barangay_id is not None:
        barangay_filter = Q(livestock__farmer__barangay_id=barangay_id) | Q(batch__farmer__barangay_id=barangay_id)
        if queryset.model is ProductionRecord:
            # Match the same historical owner used by production authorization.
            barangay_filter = Q(farmer_at_record__barangay_id=barangay_id)
        scoped = scoped.filter(barangay_filter)
    return _apply_species(scoped, species_name)


def _period_meta(parameters):
    period = parameters["period"]
    return {"start": period["start"], "end": period["end"], "label": period["label"]}


def _result_response(*, question, parsed, answer, results, visualization, coverage_note):
    parameters = parsed["parameters"]
    return {
        "status": "answered",
        "question": question,
        "intent": parsed["intent"],
        "answer": answer,
        "interpreted": {
            "metric": parsed["intent"],
            "group_by": parameters["group_by"],
            "filters": {
                "barangay": parameters["barangay"],
                "livestock_type": parameters["species"],
                "production_type": parameters["production_type"],
                "farmer": parameters.get("farmer_name"),
                "approval_status": parameters.get("approval_status"),
            },
        },
        "period": _period_meta(parameters) if parameters["period"] else None,
        "visualization": visualization,
        "results": results,
        "coverage_note": coverage_note,
    }


def _empty_answer(metric, period):
    return f"No matching approved {metric} records were returned for {period}. This does not establish that no activity occurred; record coverage may be incomplete."


def _population_results(parameters, user, today):
    summary = population_summary(user=user, today=today)
    barangay_id = parameters["barangay_id"]
    species_name = parameters["species"]
    group_by = parameters["group_by"]
    rows = []

    if group_by == "barangay":
        for barangay in summary["by_barangay"]:
            if barangay_id is not None and barangay["barangay_id"] != barangay_id:
                continue
            heads = sum(item["heads"] for item in barangay["species"] if not species_name or item["species"] == species_name)
            if heads:
                rows.append({"barangay": barangay["barangay"], "current_heads": heads})
        return rows, "bar", "barangay", "current_heads"
    if group_by == "species":
        selected_barangays = summary["by_barangay"]
        if barangay_id is not None:
            selected_barangays = [row for row in selected_barangays if row["barangay_id"] == barangay_id]
        # Sum the selected barangays, not the municipality-wide species totals.
        totals = {}
        for barangay in selected_barangays:
            for item in barangay["species"]:
                if not species_name or item["species"] == species_name:
                    totals[item["species"]] = totals.get(item["species"], 0) + item["heads"]
        rows = [{"livestock_type": name, "current_heads": heads}
                for name, heads in sorted(totals.items()) if heads]
        return rows, "bar", "livestock_type", "current_heads"

    barangays = summary["by_barangay"]
    if barangay_id is not None:
        barangays = [row for row in barangays if row["barangay_id"] == barangay_id]
    heads = sum(
        item["heads"]
        for barangay in barangays
        for item in barangay["species"]
        if not species_name or item["species"] == species_name
    )
    if heads:
        rows = [{"livestock_type": species_name or "All livestock", "current_heads": heads}]
    return rows, "kpi", None, "current_heads"


def _production_results(parameters, user):
    period = parameters["period"]
    queryset = _activity_query(
        ProductionRecord.objects.all(), user=user, period=period,
        barangay_id=parameters["barangay_id"], species_name=parameters["species"],
    ).annotate(
        output_quantity=Case(
            When(slaughter__isnull=False, then=F("slaughter__carcass_weight")),
            default=F("quantity"),
            output_field=DecimalField(max_digits=10, decimal_places=2),
        ),
    )
    production_type = parameters["production_type"]
    if production_type:
        queryset = queryset.filter(production_type=production_type)

    intent = parameters.get("intent")
    if intent == "production_trend":
        rows = [
            {
                "month": row["month"].isoformat(),
                "label": f"{calendar.month_abbr[row['month'].month]} {row['month'].year}",
                "livestock_type": row["species"],
                "quantity": float(row["quantity"] or 0),
                "unit": row["unit"],
                "records": row["records"],
            }
            for row in queryset.annotate(month=TruncMonth("record_date"), species=_species_expression())
            .values("month", "species", "unit")
            .annotate(quantity=Sum("output_quantity"), records=Count("id"))
            .order_by("month", "species")
        ]
        # Do not plot different units on one numeric axis or overwrite series.
        chart_type = "line" if len({row["unit"] for row in rows}) <= 1 else "table"
        return rows, chart_type, "label", "quantity", "livestock_type"

    group_by = parameters["group_by"]
    if group_by == "species":
        grouped = queryset.annotate(species=_species_expression()).values("species", "production_type", "unit")
    elif group_by == "barangay":
        grouped = queryset.annotate(
            barangay=Coalesce("farmer_at_record__barangay__barangay_name", Value("Unmapped"), output_field=CharField())
        ).values("barangay", "production_type", "unit")
    else:
        grouped = queryset.values("production_type", "unit")
    rows = []
    for row in grouped.annotate(quantity=Sum("output_quantity"), records=Count("id")).order_by("production_type", "unit"):
        result = {
            "production_type": row["production_type"],
            "unit": row["unit"],
            "quantity": float(row["quantity"] or 0),
            "records": row["records"],
        }
        if group_by == "species":
            result["livestock_type"] = row["species"]
        elif group_by == "barangay":
            result["barangay"] = row["barangay"]
        rows.append(result)
    x_key = {"species": "livestock_type", "barangay": "barangay"}.get(group_by, "production_type")
    chart_type = "bar" if production_type and group_by in ("species", "barangay") else "table"
    return rows, chart_type, x_key, "quantity", None


def _disease_results(parameters, user):
    queryset = _activity_query(
        DiseaseCase.objects.all(), user=user, period=parameters["period"],
        barangay_id=parameters["barangay_id"], species_name=parameters["species"],
    ).annotate(
        barangay=Coalesce(
            "livestock__farmer__barangay__barangay_name",
            "batch__farmer__barangay__barangay_name",
            Value("Unmapped"), output_field=CharField(),
        ),
    )
    rows = [
        {"barangay": row["barangay"], "disease_cases": row["cases"], "affected_heads": row["affected_heads"] or 0}
        for row in queryset.values("barangay").annotate(cases=Count("id"), affected_heads=Sum("affected_count"))
        .order_by("-cases", "barangay")
    ]
    return rows


def _mortality_results(parameters, user):
    queryset = _activity_query(
        MortalityRecord.objects.all(), user=user, period=parameters["period"],
        barangay_id=parameters["barangay_id"], species_name=parameters["species"],
    ).annotate(
        barangay=Coalesce(
            "livestock__farmer__barangay__barangay_name",
            "batch__farmer__barangay__barangay_name",
            Value("Unmapped"), output_field=CharField(),
        ),
    )
    return [
        {"barangay": row["barangay"], "deaths": row["deaths"] or 0, "records": row["records"]}
        for row in queryset.values("barangay").annotate(deaths=Sum("death_count"), records=Count("id"))
        .order_by("-deaths", "barangay")
    ]


def _resolve_farmer_reference(farmer_query):
    """Resolve an exact registered name or username; never choose a partial match."""
    normalized = normalize_question(farmer_query)
    variants = {normalized}
    for prefix in ("farmer ", "raiser ", "magsasaka ", "magsasakang "):
        if normalized.startswith(prefix):
            variants.add(normalized[len(prefix):].strip())

    candidates = []
    farmers = Farmer.objects.filter(
        user__role__role_name="FARMER",
        user__account_status="APPROVED",
        user__is_active=True,
    ).select_related("user").only(
        "id", "user_id", "user__first_name", "user__last_name", "user__username",
    )
    for farmer in farmers:
        user = farmer.user
        full_name = normalize_question(user.get_full_name())
        username = normalize_question(user.username)
        if full_name in variants or username in variants:
            candidates.append(farmer)

    if len(candidates) == 1:
        farmer = candidates[0]
        return farmer, (farmer.user.get_full_name() or farmer.user.username), None
    if len(candidates) > 1:
        return None, None, "ambiguous"
    return None, None, "not_found"


def _farmer_livestock_count(question, parameters):
    """Count an exact farmer's current individual inventory using official rules."""
    farmer, farmer_name, resolution = _resolve_farmer_reference(parameters["farmer_query"])
    if resolution == "ambiguous":
        return {
            "status": "ambiguous", "question": question,
            "answer": "More than one registered farmer has that exact name. Add the farmer's middle name or exact username; I will not choose a match.",
            "results": [],
        }
    if resolution == "not_found":
        return {
            "status": "not_found", "question": question,
            "answer": "I could not find an active, approved Farmer account with that exact registered name or username. Check the spelling and try again.",
            "results": [],
        }

    livestock_type = LivestockType.objects.filter(name__iexact=parameters["species"]).first()
    if livestock_type is None:
        return {
            "status": "clarification", "question": question,
            "answer": "I could not match that livestock type to one currently registered in SmartLivestock.",
            "results": [],
        }

    approval_status = parameters.get("approval_status") or LivestockInventory.StatusType.APPROVED
    if approval_status == LivestockInventory.StatusType.APPROVED:
        inventory = official_inventory()
        scope_label = "approved active current inventory"
    else:
        inventory = LivestockInventory.objects.filter(
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            status=approval_status,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            quantity__gt=0,
        )
        scope_label = f"{approval_status.lower().replace('_', ' ')} individual registration records"

    count = inventory.filter(
        farmer_id=farmer.pk,
        livestock_type_id=livestock_type.pk,
    ).aggregate(total=Count("pk", distinct=True))["total"] or 0
    parameters.update({
        "farmer_id": farmer.pk,
        "farmer_name": farmer_name,
        "species": livestock_type.name,
        "approval_status": approval_status,
        "period": None,
        "barangay_id": None,
        "barangay": None,
        "production_type": None,
        "group_by": None,
    })
    parsed = {"intent": "farmer_livestock_count", "parameters": parameters}
    if approval_status == LivestockInventory.StatusType.APPROVED:
        answer = f"{farmer_name} has {count:,} approved active {livestock_type.name} animal(s) in current inventory."
        note = (
            "Counts approved, active individual animal records linked to the farmer's current account. "
            "Herd containers and legacy aggregate rows are excluded. A transferred animal remains with its seller as SOLD; "
            "a registered buyer is counted after their separate inventory record is approved."
        )
    else:
        answer = f"Found {count:,} {scope_label} for {livestock_type.name} linked to {farmer_name}. These records are not approved current inventory."
        note = "Counts individual registration records in the explicitly requested status; herd containers and legacy aggregate rows are excluded."

    columns = [
        {"key": "farmer", "label": "Farmer"},
        {"key": "livestock_type", "label": "Livestock type"},
        {"key": "count", "label": "Count"},
        {"key": "approval_status", "label": "Record status"},
    ]
    return _result_response(
        question=question,
        parsed=parsed,
        answer=answer,
        results=[{
            "farmer": farmer_name,
            "livestock_type": livestock_type.name,
            "count": count,
            "approval_status": approval_status,
        }],
        visualization={"type": "table", "x_key": "livestock_type", "y_key": "count", "columns": columns},
        coverage_note=note,
    )


def execute_question(question, *, user, today=None):
    """Parse one question, then execute only fixed, permission-scoped analytics."""
    # Defense in depth: the service is also safe when called without its view.
    if role_name(user) not in ("MAO", "ADMIN", "SIBAT"):
        raise PermissionDenied("Your role cannot access this analytics assistant.")
    today = today or timezone.localdate()
    visible_barangays = list(
        scope_reviewer_queryset(Barangay.objects.all(), user)
        .order_by("barangay_name")
        .values("id", "barangay_name")
    )
    parser_barangays = [{"id": row["id"], "name": row["barangay_name"]} for row in visible_barangays]
    species_names = list(LivestockType.objects.order_by("name").values_list("name", flat=True))
    # Import here to keep the parser independently testable and avoid a cycle.
    # The production pipeline does not load scikit-learn or train a model.
    from .nlp_pipeline import interpret_question
    parsed = interpret_question(question, today=today, barangays=parser_barangays, species_names=species_names)
    if parsed["status"] != "parsed":
        return {"status": parsed["status"], "question": question, "answer": parsed["message"], "results": []}

    parameters = parsed["parameters"]
    intent = parsed["intent"]
    parameters["intent"] = intent
    if intent == "farmer_livestock_count":
        if role_name(user) not in ("MAO", "ADMIN"):
            raise PermissionDenied("Only MAO and Admin users can query livestock counts for individual farmers.")
        return _farmer_livestock_count(question, parameters)
    if intent == "pending_reviews":
        if role_name(user) not in ("MAO", "ADMIN"):
            raise PermissionDenied("Your role cannot access MAO review-queue counts.")
        workload = review_workload_summary()
        rows = [
            {"submission_type": row["label"], "waiting_for_mao": row["mao_count"]}
            for row in workload["by_domain"]
            if row["mao_count"] and (not parameters["review_domain"] or row["key"] == parameters["review_domain"])
        ]
        total = sum(row["waiting_for_mao"] for row in rows)
        answer = (
            f"There are {total:,} records in the current MAO review queues across {len(rows)} record types."
            if total else "The current review-workload summary has no records in the MAO queues. This describes recorded queue entries, not unsubmitted work."
        )
        response = _result_response(
            question=question, parsed=parsed, answer=answer, results=rows,
            visualization={"type": "table", "x_key": "submission_type", "y_key": "waiting_for_mao", "columns": [
                {"key": "submission_type", "label": "Submission type"},
                {"key": "waiting_for_mao", "label": "Waiting for MAO"},
            ]},
            coverage_note="Uses the existing MAO workload service. Its per-domain MAO counts follow each workflow's configured handoff statuses; no submission details are exposed.",
        )
        response["as_of"] = workload["as_of"]
        response["period"] = None
        return response

    if intent == "population_summary":
        rows, chart_type, x_key, y_key = _population_results(parameters, user, today)
        metric_label = "approved active livestock heads"
        if rows:
            answer = f"Found {sum(row['current_heads'] for row in rows):,} {metric_label} in the authorized current inventory snapshot."
        else:
            answer = "No matching approved active inventory rows were returned. This does not confirm that no livestock exists outside the recorded dataset."
        series_key = None
    elif intent == "production_trend":
        rows, chart_type, x_key, y_key, series_key = _production_results(parameters, user)
        answer = _empty_answer("production", parameters["period"]["label"]) if not rows else "Approved production quantities grouped by recorded month and livestock type."
        metric_label = "approved production"
    elif intent == "production_breakdown":
        rows, chart_type, x_key, y_key, series_key = _production_results(parameters, user)
        answer = _empty_answer("production", parameters["period"]["label"]) if not rows else "Approved production quantities grouped using the selected breakdown. Units stay separate by production category."
        metric_label = "approved production"
    elif intent == "disease_by_barangay":
        rows = _disease_results(parameters, user)
        chart_type, x_key, y_key, series_key = "bar", "barangay", "disease_cases", None
        answer = _empty_answer("disease", parameters["period"]["label"]) if not rows else "Approved disease cases grouped by barangay; affected heads are shown separately."
        metric_label = "approved disease"
    else:
        rows = _mortality_results(parameters, user)
        chart_type, x_key, y_key, series_key = "bar", "barangay", "deaths", None
        answer = _empty_answer("mortality", parameters["period"]["label"]) if not rows else "Approved recorded deaths grouped by barangay. This is a count, not a mortality rate."
        metric_label = "approved mortality"

    columns = [{"key": key, "label": key.replace("_", " ").title()} for key in (rows[0].keys() if rows else [])]
    visualization = {"type": chart_type, "x_key": x_key, "y_key": y_key, "columns": columns}
    if series_key:
        visualization["series_key"] = series_key
    if chart_type == "kpi":
        visualization["label"] = metric_label
    return _result_response(
        question=question, parsed=parsed, answer=answer, results=rows,
        visualization=visualization,
        coverage_note=(
            f"Based on approved records in SmartLivestock for the selected dates. {parameters['period']['label']} is shown above. "
            "The system cannot establish whether every real-world event was submitted. Missing periods are not treated as zero."
            if parameters["period"] else
            "Based on the current approved active inventory snapshot. This is not a historical population series."
        ),
    )
