"""Offline XLM-RoBERTa comparison for Ask SmartLivestock intent labels.

This module is intentionally separate from the live query path. Fine-tuning is
opt-in through a management command and its predictions never select a Django
handler, scope records, or affect permissions.
"""

import json
import random
import time
from collections import Counter, defaultdict
from pathlib import Path

from .nlp_evaluation import BARANGAYS, EVALUATION_DATE, classification_metrics
from .nlp_query import SUPPORTED_INTENTS, normalize_question, parse_question


CANDIDATE_CORPUS_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "ask_smartlivestock_candidates.json"
)
EXTENSION_CORPUS_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "ask_smartlivestock_intent_xlmr_extension.json"
)
MODEL_ID = "FacebookAI/xlm-roberta-base"
RANDOM_SEED = 42
DEFAULT_EPOCHS = 3
DEFAULT_BATCH_SIZE = 8
DEFAULT_MAX_LENGTH = 128
DEFAULT_LEARNING_RATE = 2e-5
SPECIES = ["Cattle", "Carabao", "Goat", "Sheep", "Swine", "Chicken", "Duck"]
INTENT_LABELS = tuple(sorted(SUPPORTED_INTENTS | {"clarification", "unsupported"}))


def load_xlmr_corpus():
    """Load audited candidate families plus examples for intents added later."""
    base = json.loads(CANDIDATE_CORPUS_PATH.read_text(encoding="utf-8"))
    extension = json.loads(EXTENSION_CORPUS_PATH.read_text(encoding="utf-8"))
    rows = {split: [] for split in ("train", "validation", "test")}
    seen_groups = {}
    seen_questions = {}
    group_counts = Counter()
    intent_groups = defaultdict(Counter)
    language_counts = {split: Counter() for split in rows}
    variant_counts = {split: Counter() for split in rows}
    difficulty_counts = {split: Counter() for split in rows}
    review_counts = {split: Counter() for split in rows}

    def add_example(*, split, intent, family, question, language, variant,
                    difficulty, review_status, source):
        if split not in rows or intent not in INTENT_LABELS or not family:
            raise ValueError("Each XLM-R example needs a valid split, supported label, and family ID.")
        prior_group = seen_groups.get(family)
        if prior_group and prior_group != (split, intent):
            raise ValueError(f"XLM-R paraphrase family crosses splits or labels: {family}")
        seen_groups[family] = (split, intent)
        if language not in {"en", "tl", "taglish"} or not question:
            raise ValueError(f"Invalid XLM-R example in family {family}.")
        normalized = normalize_question(question)
        if normalized in seen_questions:
            previous_split = seen_questions[normalized]
            raise ValueError(
                "A normalized XLM-R question appears more than once "
                f"({previous_split} and {split})."
            )
        seen_questions[normalized] = split
        rows[split].append({
            "question": question,
            "intent": intent,
            "language": language,
            "variant": variant or "standard",
            "difficulty": difficulty or "unspecified",
            "family": family,
            "split": split,
            "review_status": review_status,
            "source": source,
        })
        language_counts[split][language] += 1
        variant_counts[split][variant or "standard"] += 1
        difficulty_counts[split][difficulty or "unspecified"] += 1
        review_counts[split][review_status] += 1

    candidate_language_map = {"en": "en", "tl": "tl", "tl_en": "taglish"}
    candidate_groups = set()
    for example in base.get("examples", []):
        family = str(example.get("split_group", "")).strip()
        split = example.get("split")
        intent = example.get("intent")
        candidate_groups.add((family, split, intent))
        add_example(
            split=split,
            intent=intent,
            family=f"candidate:{family}",
            question=str(example.get("utterance", "")).strip(),
            language=candidate_language_map.get(example.get("language")),
            variant="candidate",
            difficulty=example.get("difficulty"),
            review_status=example.get("review_status"),
            source="generated_candidate",
        )
    group_counts["train"] += len({family for family, split, _ in candidate_groups if split == "train"})
    group_counts["validation"] += len({family for family, split, _ in candidate_groups if split == "validation"})
    group_counts["test"] += len({family for family, split, _ in candidate_groups if split == "test"})
    for family, split, intent in candidate_groups:
        intent_groups[split][intent] += 1

    for group in base.get("groups", []) + extension.get("groups", []):
        split = group.get("split")
        intent = group.get("intent")
        family_id = group.get("id")
        family = f"extension:{family_id}"
        examples = group.get("examples") or []
        if not examples:
            raise ValueError(f"Empty XLM-R paraphrase family: {family}")

        group_counts[split] += 1
        intent_groups[split][intent] += 1
        for example in examples:
            add_example(
                split=split,
                intent=intent,
                family=family,
                question=str(example.get("question", "")).strip(),
                language=example.get("language"),
                variant=example.get("variant"),
                difficulty="new_intent_extension",
                review_status="candidate",
                source="xlmr_intent_extension",
            )

    for split, examples in rows.items():
        if not examples:
            raise ValueError(f"XLM-R corpus has no {split} examples.")
        missing = set(INTENT_LABELS) - {row["intent"] for row in examples}
        if missing:
            raise ValueError(f"XLM-R {split} split is missing labels: {sorted(missing)}")

    distribution = {
        "groups": dict(group_counts),
        "intent_groups": {split: dict(intent_groups[split]) for split in rows},
        "languages": {split: dict(language_counts[split]) for split in rows},
        "variants": {split: dict(variant_counts[split]) for split in rows},
        "difficulty": {split: dict(difficulty_counts[split]) for split in rows},
        "review_status": {split: dict(review_counts[split]) for split in rows},
    }
    return {
        "source": f"{base.get('version')} plus {extension.get('source')}",
        "candidate_corpus_version": base.get("version"),
        "intent_extension_version": extension.get("version"),
        "candidate_labels_human_reviewed": False,
        "schema_version": base.get("schema_version", 1),
    }, rows, distribution


def _load_optional_dependencies():
    try:
        import torch
        from torch.utils.data import DataLoader, Dataset
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError as exc:
        raise RuntimeError(
            "XLM-R experiment dependencies are missing. From backend/, install "
            "analytics/requirements-nlp-xlmr.txt in an isolated virtual environment."
        ) from exc
    return torch, DataLoader, Dataset, AutoModelForSequenceClassification, AutoTokenizer


def _report_metrics(examples, expected, predicted):
    report = classification_metrics(expected, predicted)
    report["by_language"] = {}
    for language in ("en", "tl", "taglish"):
        indexes = [index for index, row in enumerate(examples) if row["language"] == language]
        report["by_language"][language] = classification_metrics(
            [expected[index] for index in indexes],
            [predicted[index] for index in indexes],
        )
    typo_indexes = [index for index, row in enumerate(examples) if row["variant"] == "typo"]
    report["typo_variant"] = classification_metrics(
        [expected[index] for index in typo_indexes],
        [predicted[index] for index in typo_indexes],
    )
    report["by_difficulty"] = {}
    for difficulty in sorted({row["difficulty"] for row in examples}):
        indexes = [index for index, row in enumerate(examples) if row["difficulty"] == difficulty]
        report["by_difficulty"][difficulty] = classification_metrics(
            [expected[index] for index in indexes],
            [predicted[index] for index in indexes],
        )
    return report


def _parser_label(question):
    result = parse_question(
        question,
        today=EVALUATION_DATE,
        barangays=BARANGAYS,
        species_names=SPECIES,
    )
    return result.get("intent") if result.get("status") == "parsed" else result["status"]


def _predict(model, tokenizer, examples, *, torch, DataLoader, Dataset, label_to_id,
             batch_size, max_length, device):
    class InferenceDataset(Dataset):
        def __len__(self):
            return len(examples)

        def __getitem__(self, index):
            return examples[index]["question"]

    def collate(questions):
        return tokenizer(
            questions,
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        )

    predictions = []
    loader = DataLoader(InferenceDataset(), batch_size=batch_size, shuffle=False, collate_fn=collate)
    model.eval()
    with torch.inference_mode():
        for batch in loader:
            logits = model(**{key: value.to(device) for key, value in batch.items()}).logits
            probabilities = torch.softmax(logits, dim=-1).cpu()
            for row in probabilities:
                score, label_id = row.max(dim=0)
                predictions.append({
                    "intent": next(label for label, index in label_to_id.items() if index == int(label_id)),
                    "score": float(score),
                })
    return predictions


def evaluate_xlmr(*, model_id=MODEL_ID, epochs=DEFAULT_EPOCHS,
                  batch_size=DEFAULT_BATCH_SIZE, max_length=DEFAULT_MAX_LENGTH,
                  learning_rate=DEFAULT_LEARNING_RATE, include_examples=False):
    """Fine-tune and evaluate the multilingual classifier without database access."""
    if epochs < 1 or epochs > 20:
        raise ValueError("Epochs must be between 1 and 20.")
    if batch_size < 1 or batch_size > 64:
        raise ValueError("Batch size must be between 1 and 64.")
    if max_length < 16 or max_length > 512:
        raise ValueError("Maximum token length must be between 16 and 512.")
    if learning_rate <= 0 or learning_rate > 1e-3:
        raise ValueError("Learning rate must be greater than zero and no more than 0.001.")

    torch, DataLoader, Dataset, AutoModel, AutoTokenizer = _load_optional_dependencies()
    torch.manual_seed(RANDOM_SEED)
    random.seed(RANDOM_SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(RANDOM_SEED)
    torch.set_num_threads(min(4, torch.get_num_threads()))

    metadata, splits, distribution = load_xlmr_corpus()
    labels = list(INTENT_LABELS)
    label_to_id = {label: index for index, label in enumerate(labels)}
    id_to_label = {index: label for label, index in label_to_id.items()}
    train_intent_counts = Counter(row["intent"] for row in splits["train"])
    class_weight_values = {
        label: len(splits["train"]) / (len(labels) * train_intent_counts[label])
        for label in labels
    }
    class_weights = torch.tensor(
        [class_weight_values[label] for label in labels], dtype=torch.float32, device="cpu"
    )
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModel.from_pretrained(
        model_id,
        num_labels=len(labels),
        id2label=id_to_label,
        label2id=label_to_id,
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    class TrainingDataset(Dataset):
        def __len__(self):
            return len(splits["train"])

        def __getitem__(self, index):
            row = splits["train"][index]
            return row["question"], label_to_id[row["intent"]]

    def collate(examples):
        encoded = tokenizer(
            [row[0] for row in examples],
            padding=True,
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        )
        encoded["labels"] = torch.tensor([row[1] for row in examples], dtype=torch.long)
        return encoded

    generator = torch.Generator().manual_seed(RANDOM_SEED)
    training_loader = DataLoader(
        TrainingDataset(), batch_size=batch_size, shuffle=True,
        collate_fn=collate, generator=generator,
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    validation_expected = [row["intent"] for row in splits["validation"]]
    best_state = None
    best_macro_f1 = -1.0
    best_epoch = None
    validation_history = []
    started = time.perf_counter()

    for epoch in range(1, epochs + 1):
        model.train()
        loss_total = 0.0
        batch_count = 0
        for batch in training_loader:
            batch = {key: value.to(device) for key, value in batch.items()}
            optimizer.zero_grad(set_to_none=True)
            targets = batch["labels"]
            model_inputs = {key: value for key, value in batch.items() if key != "labels"}
            logits = model(**model_inputs).logits
            loss = torch.nn.functional.cross_entropy(
                logits, targets, weight=class_weights.to(device)
            )
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            loss_total += float(loss.detach().cpu())
            batch_count += 1

        validation_predictions = _predict(
            model, tokenizer, splits["validation"], torch=torch,
            DataLoader=DataLoader, Dataset=Dataset, label_to_id=label_to_id,
            batch_size=batch_size, max_length=max_length, device=device,
        )
        validation_labels = [row["intent"] for row in validation_predictions]
        metrics = classification_metrics(validation_expected, validation_labels)
        validation_history.append({
            "epoch": epoch,
            "mean_train_loss": round(loss_total / max(batch_count, 1), 6),
            "accuracy": metrics["outcome_accuracy"],
            "macro_f1": metrics["macro_f1"],
        })
        if metrics["macro_f1"] > best_macro_f1:
            best_macro_f1 = metrics["macro_f1"]
            best_epoch = epoch
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    training_seconds = time.perf_counter() - started
    if best_state is None:
        raise RuntimeError("XLM-R did not produce a validation checkpoint.")
    model.load_state_dict(best_state)
    model.to(device)

    test_rows = splits["test"]
    expected = [row["intent"] for row in test_rows]
    xlmr_predictions = _predict(
        model, tokenizer, test_rows, torch=torch, DataLoader=DataLoader,
        Dataset=Dataset, label_to_id=label_to_id, batch_size=batch_size,
        max_length=max_length, device=device,
    )
    model_labels = [row["intent"] for row in xlmr_predictions]
    parser_labels = [_parser_label(row["question"]) for row in test_rows]
    examples = [
        {
            **row,
            "expected": target,
            "rules_intent": rule,
            "xlmr_intent": prediction["intent"],
            "xlmr_score": round(prediction["score"], 6),
            "xlmr_matches_expected": prediction["intent"] == target,
            "rules_match_expected": rule == target,
        }
        for row, target, rule, prediction in zip(test_rows, expected, parser_labels, xlmr_predictions)
    ]
    comparison = {
        "xlmr_test": _report_metrics(test_rows, expected, model_labels),
        "rules_test": _report_metrics(test_rows, expected, parser_labels),
    }
    if include_examples:
        comparison["examples"] = examples

    return {
        "model": {
            "id": model_id,
            "architecture": "XLM-RoBERTa sequence classification",
            "labels": labels,
            "device": str(device),
            "parameters": sum(parameter.numel() for parameter in model.parameters()),
            "score_note": "Softmax scores are raw and uncalibrated; predictions are diagnostic only.",
        },
        "dataset": {
            **metadata,
            "distribution": distribution,
            "split_method": "Candidate paraphrase families keep their assigned train, validation, and test splits; validation selects the checkpoint; the test split is held out.",
            "limitations": "The 1,296-example base corpus contains AI-authored, unreviewed candidate labels for nine intents. The 48-example extension adds three newer intents with few examples. Treat results as exploratory, not evidence of real-world or general Taglish performance.",
        },
        "training": {
            "seed": RANDOM_SEED,
            "epochs_requested": epochs,
            "best_epoch": best_epoch,
            "batch_size": batch_size,
            "max_length": max_length,
            "learning_rate": learning_rate,
            "train_examples": len(splits["train"]),
            "train_intent_counts": dict(train_intent_counts),
            "class_weights": {label: round(weight, 4) for label, weight in class_weight_values.items()},
            "validation_examples": len(splits["validation"]),
            "test_examples": len(splits["test"]),
            "seconds": round(training_seconds, 3),
            "validation_history": validation_history,
        },
        "comparison": comparison,
        "routing": {
            "production_changed": False,
            "query_execution_changed": False,
            "note": "XLM-R predictions are offline shadow diagnostics. Only the deterministic parser and existing permission-scoped handlers can answer live questions.",
        },
    }
