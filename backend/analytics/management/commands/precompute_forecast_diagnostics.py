"""Precompute municipal forecast readiness diagnostics and store in ForecastReadinessReport.

Usage:
    python manage.py precompute_forecast_diagnostics
    python manage.py precompute_forecast_diagnostics --horizon 6
    python manage.py precompute_forecast_diagnostics --all-horizons
"""

import json
from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

from analytics.models import ForecastReadinessReport
from analytics.services.predictive.diagnostics import get_all_forecast_readiness_diagnostics
from users.models import User


class Command(BaseCommand):
    help = "Precompute all municipal forecasting evaluations and persist them into ForecastReadinessReport."

    def add_arguments(self, parser):
        parser.add_argument(
            "--horizon",
            type=int,
            default=6,
            help="Forecast horizon in months to evaluate (default: 6).",
        )
        parser.add_argument(
            "--all-horizons",
            action="store_true",
            help="Precompute standard horizons (3, 6, 12 months).",
        )
        parser.add_argument(
            "--category",
            type=str,
            default="",
            help="Specific category to precompute (leave blank for all municipal targets).",
        )

    def handle(self, *args, **options):
        horizons = [3, 6, 12] if options["all_horizons"] else [options["horizon"]]
        category = options["category"].strip()

        categories = {
            "disease": {"disease", "mortality"},
            "mortality": {"mortality"},
            "auction": {"auction"},
            "slaughter": {"slaughter"},
        }
        domains = categories.get(category) if category else None

        # Resolve a municipal MAO or staff user context
        staff_user = (
            User.objects.filter(role__role_name__in=["MAO", "ADMIN"], is_active=True).first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )

        self.stdout.write(
            self.style.NOTICE(
                f"Starting pre-computation for horizon(s) {horizons} (category: '{category or 'ALL'}')..."
            )
        )

        for h in horizons:
            start_time = timezone.now()
            self.stdout.write(f"Evaluating horizon = {h} months...")

            try:
                results = get_all_forecast_readiness_diagnostics(
                    user=staff_user,
                    horizon_months=h,
                    domains=domains,
                )

                summary_cards = results.get("summary_cards", [])
                ready_count = sum(1 for c in summary_cards if c.get("forecast_available"))
                total_count = len(summary_cards)

                sanitized_payload = json.loads(json.dumps(results, cls=DjangoJSONEncoder))

                report, created = ForecastReadinessReport.objects.update_or_create(
                    horizon_months=h,
                    category=category,
                    defaults={
                        "payload": sanitized_payload,
                    },
                )

                duration = (timezone.now() - start_time).total_seconds()
                action_word = "Created" if created else "Updated"
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  -> {action_word} ForecastReadinessReport ID {report.id} in {duration:.1f}s. "
                        f"Available: {ready_count}/{total_count} forecasts ready."
                    )
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"  -> Failed evaluating horizon {h}: {e}")
                )
                raise

        self.stdout.write("Evaluating prescriptive recommendations...")
        try:
            from analytics.services.predictive.rules import generate_prescriptive_recommendations
            presc_res = generate_prescriptive_recommendations(user=staff_user)
            sanitized_presc = json.loads(json.dumps(presc_res, cls=DjangoJSONEncoder))
            role_name = getattr(getattr(staff_user, "role", None), "role_name", "MAO")
            ForecastReadinessReport.objects.update_or_create(
                horizon_months=0,
                category=f"prescriptive:{role_name}",
                defaults={"payload": sanitized_presc},
            )
            ForecastReadinessReport.objects.update_or_create(
                horizon_months=0,
                category="prescriptive",
                defaults={"payload": sanitized_presc},
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"  -> Successfully precomputed {presc_res.get('total_recommendations', 0)} prescriptive recommendations!"
                )
            )
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  -> Could not precompute prescriptive: {e}"))

        self.stdout.write("Evaluating default cattle profile price forecasts...")
        try:
            from analytics.services.cattle_price import estimate_price
            for src in ("REGISTERED", "EXTERNAL"):
                prof_payload = {
                    "source": src,
                    "species": "Cattle",
                    "sex": "MALE",
                    "breed": "Brahman",
                    "age_min_months": 24,
                    "age_max_months": 47,
                    "weight_min_kg": 350.0,
                    "weight_max_kg": 499.99,
                    "horizon_weeks": 6,
                    "data_mode": "AUTO",
                }
                prof_res = estimate_price(staff_user, prof_payload)
                sanitized_prof = json.loads(json.dumps(prof_res, cls=DjangoJSONEncoder))
                ForecastReadinessReport.objects.update_or_create(
                    horizon_months=0,
                    category=f"profile_price:{src.lower()}:default",
                    defaults={"payload": sanitized_prof},
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  -> Successfully precomputed default profile price for {src} Cattle ({prof_res.get('status')})!"
                    )
                )
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  -> Could not precompute default profile price: {e}"))

        self.stdout.write(
            self.style.SUCCESS("All requested forecast diagnostics have been precomputed successfully!")
        )
