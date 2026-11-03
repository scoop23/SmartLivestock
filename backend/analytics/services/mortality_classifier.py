"""MAO-only advisory classification of approved, farmer-reported mortality data."""

from collections import Counter

from django.db.models import Q
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import f1_score, make_scorer
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from diseases.models import MortalityCauseClassificationReview, MortalityRecord


MIN_TRAINING_RECORDS = 30
MIN_RECORDS_PER_CATEGORY = 10
REVIEW_QUEUE_LIMIT = 30


def _real_approved_records():
    real_record = Q(review_remarks__isnull=True) | ~Q(review_remarks__contains="AI_SEED")
    return MortalityRecord.objects.filter(
        status=MortalityRecord.MortalityRecordStatus.APPROVED,
    ).filter(real_record).select_related(
        "livestock__livestock_type",
        "batch__livestock_type",
        "source_disease_case",
    ).order_by("-record_date", "-id")


UNKNOWN_CAUSES = {
    "",
    "unknown",
    "unknown (needs vet inspection)",
    "undetermined",
    "not known",
    "not recorded",
}


def _farmer_reported_illness(record):
    disease_case = record.source_disease_case
    # Only treat an explicitly linked, dated disease report before the death
    # as pre-death history. A same-day or undated report cannot establish order.
    if (
        not disease_case
        or not disease_case.record_date
        or not record.record_date
        or disease_case.record_date >= record.record_date
    ):
        return ""
    return str(disease_case.name or "").strip()


def _has_classification_evidence(record):
    """Require a meaningful farmer cause statement or a linked sick report."""
    cause = " ".join((record.cause or "").casefold().split())
    return bool(_farmer_reported_illness(record)) or cause not in UNKNOWN_CAUSES


def _record_text(record):
    """Use farmer-reported cause/history and stable record details, not CBAT findings."""
    tokens = []

    species = None
    if record.livestock_id and record.livestock and record.livestock.livestock_type_id:
        species = record.livestock.livestock_type.name
    elif record.batch_id and record.batch and record.batch.livestock_type_id:
        species = record.batch.livestock_type.name
    if species:
        tokens.append(f"species_{species}")

    if record.record_date:
        tokens.append(f"month_{record.record_date.month}")
    tokens.append(f"death_count_{_death_count_band(record.death_count)}")
    farmer_illness = _farmer_reported_illness(record)
    tokens.append(f"linked_prior_farmer_illness_{'yes' if farmer_illness else 'no'}")
    if farmer_illness:
        tokens.append(f"farmer_reported_sick_case_{farmer_illness}")

    # CBAT inspection details, reviewer notes and labels are excluded: they are
    # field verification or review outcomes, not reliable pre-death history.
    cause_text = (record.cause or "")[:5000]
    return f"{cause_text} {' '.join(tokens)}".strip()


def _death_count_band(value):
    if value <= 1:
        return "one"
    if value <= 5:
        return "two_to_five"
    return "six_or_more"


def _category_rows(counts):
    return [
        {"value": value, "label": label, "count": counts.get(value, 0)}
        for value, label in MortalityCauseClassificationReview.Category.choices
    ]


def _pipeline():
    return Pipeline([
        ("text", TfidfVectorizer(
            lowercase=True,
            strip_accents="unicode",
            ngram_range=(1, 2),
            max_features=1000,
        )),
        ("tree", DecisionTreeClassifier(
            max_depth=5,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
        )),
    ])


def _decision_path(pipeline, text):
    vector = pipeline.named_steps["text"].transform([text])
    tree = pipeline.named_steps["tree"]
    feature_names = pipeline.named_steps["text"].get_feature_names_out()
    node_ids = tree.decision_path(vector).indices
    terms = []
    for node_id in node_ids:
        feature_index = tree.tree_.feature[node_id]
        if feature_index < 0:
            continue
        feature = str(feature_names[feature_index])
        value = float(vector[0, feature_index])
        threshold = float(tree.tree_.threshold[node_id])
        terms.append({
            "term": feature,
            "matched": value > threshold,
        })
    return terms


def mortality_classification_dashboard():
    records = list(_real_approved_records())
    record_by_id = {record.pk: record for record in records}
    record_ids = list(record_by_id)

    latest_labels = {}
    labels = MortalityCauseClassificationReview.objects.filter(
        mortality_record_id__in=record_ids,
        mortality_record__status=MortalityRecord.MortalityRecordStatus.APPROVED,
    ).filter(
        Q(mortality_record__review_remarks__isnull=True)
        | ~Q(mortality_record__review_remarks__contains="AI_SEED")
    ).order_by("mortality_record_id", "-reviewed_at", "-id")
    for label in labels:
        latest_labels.setdefault(label.mortality_record_id, label)

    labelled_records = [
        record for record_id, record in record_by_id.items()
        if record_id in latest_labels
    ]
    training_records = [record for record in labelled_records if _has_classification_evidence(record)]
    training_labels = [latest_labels[record.pk].category for record in training_records]
    category_counts = Counter(training_labels)
    observed_categories = [value for value, count in category_counts.items() if count]
    enough_examples = (
        len(training_records) >= MIN_TRAINING_RECORDS
        and len(observed_categories) >= 2
        and all(category_counts[value] >= MIN_RECORDS_PER_CATEGORY for value in observed_categories)
    )

    if not training_records:
        if labelled_records:
            readiness_status = "NO_USABLE_REPORTED_INFORMATION"
            readiness_message = "Staff have labeled reports, but none has a clear farmer-reported cause or an earlier linked sick report to train from."
        else:
            readiness_status = "NO_REVIEWED_LABELS"
            readiness_message = "No approved mortality reports have a staff-confirmed classification yet."
    elif not enough_examples:
        readiness_status = "MORE_REVIEWED_LABELS_NEEDED"
        readiness_message = (
            f"The experimental tree needs at least {MIN_TRAINING_RECORDS} labeled reports, "
            f"with at least {MIN_RECORDS_PER_CATEGORY} examples in each of two or more categories."
        )
    else:
        readiness_status = "EXPERIMENTAL"
        readiness_message = "The tree can suggest categories for staff review. Its suggestions are not diagnoses or approval decisions."

    pipeline = None
    if enough_examples:
        texts = [_record_text(record) for record in training_records]
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        scores = cross_val_score(
            _pipeline(), texts, training_labels, cv=cv,
            scoring=make_scorer(f1_score, average="macro", zero_division=0),
        )
        pipeline = _pipeline().fit(texts, training_labels)
        cv_summary = {
            "method": "5-fold stratified cross-validation",
            "macro_f1": round(float(scores.mean()), 3),
            "fold_scores": [round(float(score), 3) for score in scores],
        }
    else:
        cv_summary = None

    pending_records = [record for record in records if record.pk not in latest_labels]
    labelled_records = [record for record in records if record.pk in latest_labels]
    ordered_queue = pending_records + labelled_records
    review_queue = []
    for record in ordered_queue[:REVIEW_QUEUE_LIMIT]:
        latest_label = latest_labels.get(record.pk)
        prediction = None
        prediction_status = None
        if latest_label is None and not _has_classification_evidence(record):
            prediction_status = "NOT_ENOUGH_INFORMATION"
        elif pipeline is not None and latest_label is None:
            text = _record_text(record)
            predicted_category = str(pipeline.predict([text])[0])
            prediction = {
                "category": predicted_category,
                "label": dict(MortalityCauseClassificationReview.Category.choices)[predicted_category],
                "decision_path": _decision_path(pipeline, text),
            }
            prediction_status = "SUGGESTION_AVAILABLE"
        details = record.inspection_details if isinstance(record.inspection_details, dict) else {}
        inspection_signs = details.get("confirmedSymptoms", [])
        review_queue.append({
            "id": record.pk,
            "record_date": record.record_date.isoformat() if record.record_date else None,
            "cause": record.cause,
            "farmer_reported_illness": _farmer_reported_illness(record) or None,
            "death_count": record.death_count,
            "species": (
                record.livestock.livestock_type.name
                if record.livestock_id and record.livestock and record.livestock.livestock_type_id
                else record.batch.livestock_type.name
                if record.batch_id and record.batch and record.batch.livestock_type_id
                else "Not recorded"
            ),
            "inspection_signs": inspection_signs if isinstance(inspection_signs, list) else [],
            "current_category": latest_label.category if latest_label else None,
            "current_category_label": latest_label.get_category_display() if latest_label else None,
            "prediction": prediction,
            "prediction_status": prediction_status,
        })

    return {
        "model": "DecisionTreeClassifier",
        "readiness_status": readiness_status,
        "readiness_message": readiness_message,
        "training_record_count": len(training_records),
        "minimum_training_records": MIN_TRAINING_RECORDS,
        "minimum_records_per_category": MIN_RECORDS_PER_CATEGORY,
        "categories": _category_rows(category_counts),
        "cross_validation": cv_summary,
        "review_queue_count": len(records),
        "unlabelled_record_count": len(pending_records),
        "review_queue_limit": REVIEW_QUEUE_LIMIT,
        "review_queue": review_queue,
    }
