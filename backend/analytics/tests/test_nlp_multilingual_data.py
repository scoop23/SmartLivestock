import sys
from unittest.mock import patch

from django.test import SimpleTestCase

from analytics.services.nlp_intent_model import ALLOWED_INTENTS
from analytics.services.nlp_query import normalize_question
from analytics.services.nlp_spacy_experiment import EPOCHS, RANDOM_SEED, train_spacy_classifier
from analytics.management.commands.evaluate_ask_smartlivestock_multilingual import load_corpus


class MultilingualNLPCorpusTests(SimpleTestCase):
    def test_grouped_splits_are_balanced_and_have_no_question_or_family_leakage(self):
        data, splits, distribution = load_corpus()
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(distribution["groups"], {"train": 18, "validation": 9, "test": 9})
        self.assertEqual({key: len(value) for key, value in splits.items()},
                         {"train": 72, "validation": 36, "test": 36})
        self.assertEqual(set(distribution["intent_groups"]["test"]), ALLOWED_INTENTS)
        self.assertEqual(distribution["languages"]["test"], {"en": 9, "tl": 9, "taglish": 18})
        normalized = [{normalize_question(row["question"]) for row in splits[key]}
                      for key in ("train", "validation", "test")]
        self.assertFalse(normalized[0] & normalized[1])
        self.assertFalse(normalized[0] & normalized[2])
        self.assertFalse(normalized[1] & normalized[2])
        self.assertEqual(EPOCHS, 40)
        self.assertEqual(RANDOM_SEED, 42)

    def test_corpus_has_unsupported_and_clarification_and_synthetic_source(self):
        data, splits, _ = load_corpus()
        self.assertIn("synthetic", data["source"].lower())
        for label in ("unsupported", "clarification"):
            self.assertTrue(any(row["intent"] == label for rows in splits.values() for row in rows))

    def test_missing_optional_spacy_dependency_has_install_guidance(self):
        with patch.dict(sys.modules, {"spacy": None}):
            with self.assertRaisesRegex(RuntimeError, "requirements-nlp-experiment.txt"):
                train_spacy_classifier([])

