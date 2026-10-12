"""Run the same reproducible parser evaluation shown on the examples page."""
import json
from django.core.management.base import BaseCommand, CommandError
from analytics.services.nlp_evaluation import compare_pipelines, evaluate_parser


class Command(BaseCommand):
    help = "Evaluate the live rule-based NLP parser, outcomes and extracted filters."

    def add_arguments(self, parser):
        parser.add_argument("--compare", action="store_true",
                            help="Also run the isolated ML validation and rules-first shadow comparison.")

    def handle(self, *args, **options):
        report = compare_pipelines() if options["compare"] else evaluate_parser()
        self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))
        baseline = report["baseline"] if options["compare"] else report
        if baseline["passed"] != baseline["total"]:
            raise CommandError("Some parser expectations failed; inspect the report above.")
