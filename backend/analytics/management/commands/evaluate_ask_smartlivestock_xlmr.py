"""Train and compare XLM-RoBERTa against the rules parser on synthetic text."""

import json

from django.core.management.base import BaseCommand, CommandError

from analytics.services.nlp_xlmr_experiment import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_EPOCHS,
    DEFAULT_LEARNING_RATE,
    DEFAULT_MAX_LENGTH,
    MODEL_ID,
    evaluate_xlmr,
)


class Command(BaseCommand):
    help = "Run the optional offline XLM-RoBERTa intent experiment."

    def add_arguments(self, parser):
        parser.add_argument("--model-id", default=MODEL_ID)
        parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
        parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
        parser.add_argument("--max-length", type=int, default=DEFAULT_MAX_LENGTH)
        parser.add_argument("--learning-rate", type=float, default=DEFAULT_LEARNING_RATE)
        parser.add_argument(
            "--include-examples",
            action="store_true",
            help="Include each held-out question and both predictions in the JSON output.",
        )

    def handle(self, *args, **options):
        try:
            report = evaluate_xlmr(
                model_id=options["model_id"],
                epochs=options["epochs"],
                batch_size=options["batch_size"],
                max_length=options["max_length"],
                learning_rate=options["learning_rate"],
                include_examples=options["include_examples"],
            )
        except (RuntimeError, ValueError, OSError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))
