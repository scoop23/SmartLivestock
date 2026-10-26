import json
from django.core.management.base import BaseCommand, CommandError
from analytics.services.nlp_dataset import CORPUS_PATH, audit_corpus, build_corpus, load_corpus


class Command(BaseCommand):
    help = "Build or audit the versioned NLP candidate corpus. Never changes production training."

    def add_arguments(self, parser):
        parser.add_argument("--check", action="store_true", help="Verify regeneration and audit without writing.")

    def handle(self, *args, **options):
        corpus = build_corpus()
        report = audit_corpus(corpus)
        if options["check"] and (not CORPUS_PATH.exists() or load_corpus() != corpus):
            report["errors"].append("Checked-in corpus differs from deterministic regeneration.")
        if not options["check"] and not report["errors"]:
            CORPUS_PATH.write_text(json.dumps(corpus, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))
        if report["errors"]:
            raise CommandError("Dataset contract/leakage audit failed. Correct the source; no training was performed.")
