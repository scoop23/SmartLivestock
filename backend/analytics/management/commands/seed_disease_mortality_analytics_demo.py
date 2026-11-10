"""Seed irregular synthetic disease and mortality events with monthly coverage."""

from calendar import monthrange
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.db import transaction
from django.utils import timezone

from analytics.models import SurveillanceCoverageReport, SurveillanceDemoOwnership
from analytics.seed_markers import SEED_MARKER_DISEASE, SEED_MARKER_MORTALITY
from diseases.models import (
    DiseaseCase,
    DiseaseCaseFollowUp,
    MortalityCauseClassificationReview,
    MortalityRecord,
)
from diseases.serializer import DiseaseCaseSerializer, MortalityRecordSerializer
from livestock.models import Barangay, Farmer, LivestockBatch, LivestockInventory, LivestockType
from livestock.reconciliation import reconcile_approved_mortality
from smartlivestock.seed_tags import next_seed_colc_number, next_seed_livestock_tag
from smartlivestock.seed_safety import assert_safe_seed_database
from smartlivestock.workflows import validate_review_transition
from users.models import Notification, Role, User


PREFIX = "disease-mortality-analytics-v1:"
OBJECT_MODELS = {
    "user": User,
    "farmer": Farmer,
    "livestock": LivestockInventory,
    "herd": LivestockBatch,
    "disease": DiseaseCase,
    "follow_up": DiseaseCaseFollowUp,
    "mortality": MortalityRecord,
    "mortality_review": MortalityCauseClassificationReview,
    "coverage": SurveillanceCoverageReport,
    "notification": Notification,
}
MONTHS = 24


def demo_time(day, hour):
    """Explicit simulated availability, never evidence of real historical review."""
    return timezone.make_aware(datetime.combine(day, time(hour)), timezone.get_current_timezone())


# Increasing scenario: deliberately increasing synthetic reporting, with early quiet months.
DISEASE_CASES_PER_MONTH = (
    0, 1, 0, 1, 1, 2, 1, 2, 2, 3, 2, 3, 3, 4, 3, 4, 4, 5, 4, 5, 6, 6, 7, 8, 3,
)
MORTALITY_RECORDS_PER_MONTH = (
    0, 1, 0, 0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 0, 1,
)

# Realistic scenario: natural seasonal/outbreak waves where cases peak during wet/monsoon
# seasons and decline into troughs where prior cases recover and close ("goes low meaning recovery and closed").
# Includes current in-progress month so rolling 7-day, 14-day, and 30-day surveillance windows are active.
REALISTIC_DISEASE_CASES_PER_MONTH = (
    1, 0, 1, 2, 4, 6, 8, 7, 5, 2, 1, 0,  # Year 1 (Months 0-11)
    1, 1, 2, 3, 5, 7, 9, 8, 6, 4, 3, 4,  # Year 2 (Months 12-23)
    2,                                    # Current Month up to today (Month 24)
)
REALISTIC_MORTALITY_RECORDS_PER_MONTH = (
    1, 0, 1, 1, 2, 3, 4, 3, 2, 1, 1, 0,  # Year 1
    1, 1, 2, 2, 3, 4, 5, 3, 2, 2, 1, 2,  # Year 2
    1,                                    # Current Month up to today (Month 24)
)

REALISTIC_DISEASE_PROFILES = [
    {
        "name": "High fever, labored breathing, and coughing (suspected pneumonia)",
        "symptoms": ["Fever", "Coughing", "Nasal discharge", "Labored breathing"],
    },
    {
        "name": "Swollen hot udder, painful milking, and abnormal milk clots (mastitis)",
        "symptoms": ["Swollen udder", "Abnormal milk", "Fever", "Decreased appetite"],
    },
    {
        "name": "Excessive drooling, mouth ulcers, and lameness with foot sores",
        "symptoms": ["Drooling", "Mouth lesions", "Foot sores", "Lameness"],
    },
    {
        "name": "Acute high fever, throat swelling, and severe lethargy (suspected hemorrhagic septicemia)",
        "symptoms": ["High fever", "Swollen throat", "Lethargy", "Respiratory distress"],
    },
    {
        "name": "Watery diarrhea, dehydration, and dull coat (suspected enteritis)",
        "symptoms": ["Diarrhea", "Dehydration", "Lethargy"],
    },
    {
        "name": "Red swollen eyes with corneal opacity and tearing (infectious pinkeye)",
        "symptoms": ["Eye discharge", "Corneal cloudiness", "Photophobia"],
    },
    {
        "name": "Acute abdominal distension on left flank and labored breathing (severe bloat)",
        "symptoms": ["Abdominal distension", "Restlessness", "Labored breathing"],
    },
    {
        "name": "Severe heat stress, panting, and elevated body temperature during dry spell",
        "symptoms": ["Panting", "Excessive salivation", "High temperature"],
    },
]

REALISTIC_MORTALITY_PROFILES = [
    # SUSPECTED_INFECTIOUS
    {
        "cause": "Severe bacterial pneumonia and acute respiratory failure",
        "category": MortalityCauseClassificationReview.Category.SUSPECTED_INFECTIOUS,
        "note": "MAO confirmed suspected infectious respiratory pathology.",
        "link_prior_disease": True,
        "disease_name": "High fever, labored breathing, and coughing (suspected pneumonia)",
        "symptoms": ["Fever", "Coughing", "Labored breathing"],
    },
    {
        "cause": "Acute hemorrhagic septicemia with throat swelling and high fever",
        "category": MortalityCauseClassificationReview.Category.SUSPECTED_INFECTIOUS,
        "note": "Acute systemic infectious signs observed in field.",
        "link_prior_disease": True,
        "disease_name": "Acute high fever, throat swelling, and severe lethargy (suspected hemorrhagic septicemia)",
        "symptoms": ["High fever", "Swollen throat", "Lethargy"],
    },
    {
        "cause": "Severe toxic mastitis with high fever and systemic collapse",
        "category": MortalityCauseClassificationReview.Category.SUSPECTED_INFECTIOUS,
        "note": "Toxic coliform mastitis complication.",
        "link_prior_disease": True,
        "disease_name": "Swollen hot udder, painful milking, and abnormal milk clots (mastitis)",
        "symptoms": ["Swollen udder", "Abnormal milk", "Fever"],
    },
    {
        "cause": "Severe viral diarrhea with acute dehydration and circulatory collapse",
        "category": MortalityCauseClassificationReview.Category.SUSPECTED_INFECTIOUS,
        "note": "Severe infectious enteritis and dehydration.",
        "link_prior_disease": True,
        "disease_name": "Watery diarrhea, dehydration, and dull coat (suspected enteritis)",
        "symptoms": ["Diarrhea", "Dehydration", "Lethargy"],
    },
    {
        "cause": "Suspected blackleg infection with rapid muscle swelling and high fever",
        "category": MortalityCauseClassificationReview.Category.SUSPECTED_INFECTIOUS,
        "note": "Clostridial infectious disease suspected from field evidence.",
        "link_prior_disease": False,
        "symptoms": ["High fever", "Muscle swelling", "Lameness"],
    },
    # INJURY_ACCIDENT
    {
        "cause": "Severe leg fracture and internal trauma after falling into deep drainage canal",
        "category": MortalityCauseClassificationReview.Category.INJURY_ACCIDENT,
        "note": "Physical injury confirmed by CBAT inspection and photos.",
        "link_prior_disease": False,
        "symptoms": ["Bone fracture", "Trauma", "Internal injury"],
    },
    {
        "cause": "Traumatic vehicle collision on municipal road during grazing transit",
        "category": MortalityCauseClassificationReview.Category.INJURY_ACCIDENT,
        "note": "Accidental vehicular impact.",
        "link_prior_disease": False,
        "symptoms": ["Blunt force trauma", "Lacerations", "Shock"],
    },
    {
        "cause": "Strangulation asphyxiation from tether rope entanglement around pasture tree",
        "category": MortalityCauseClassificationReview.Category.INJURY_ACCIDENT,
        "note": "Mechanical asphyxiation accident.",
        "link_prior_disease": False,
        "symptoms": ["Asphyxiation", "Neck trauma", "Accidental injury"],
    },
    {
        "cause": "Deep goring puncture wound to abdomen from aggressive bull",
        "category": MortalityCauseClassificationReview.Category.INJURY_ACCIDENT,
        "note": "Severe pasture fighting trauma.",
        "link_prior_disease": False,
        "symptoms": ["Goring wound", "Abdominal puncture", "Hemorrhage"],
    },
    {
        "cause": "Hardware disease; traumatic reticulopericarditis from swallowed sharp wire",
        "category": MortalityCauseClassificationReview.Category.INJURY_ACCIDENT,
        "note": "Foreign body penetration confirmed during post-mortem inspection.",
        "link_prior_disease": False,
        "symptoms": ["Heart failure", "Foreign object trauma"],
    },
    # REPRODUCTIVE_PERINATAL
    {
        "cause": "Severe calving dystocia; uterine rupture and internal hemorrhage during delivery",
        "category": MortalityCauseClassificationReview.Category.REPRODUCTIVE_PERINATAL,
        "note": "Perinatal complications during obstructed labor.",
        "link_prior_disease": False,
        "symptoms": ["Calving dystocia", "Uterine rupture", "Hemorrhage"],
    },
    {
        "cause": "Complete uterine prolapse and shock following difficult birth",
        "category": MortalityCauseClassificationReview.Category.REPRODUCTIVE_PERINATAL,
        "note": "Post-calving uterine prolapse and acute shock.",
        "link_prior_disease": False,
        "symptoms": ["Uterine prolapse", "Hypovolemic shock"],
    },
    {
        "cause": "Severe post-partum hypocalcemia (milk fever) complicated by downer cow syndrome",
        "category": MortalityCauseClassificationReview.Category.REPRODUCTIVE_PERINATAL,
        "note": "Periparturient metabolic complication.",
        "link_prior_disease": False,
        "symptoms": ["Downer cow recumbency", "Hypocalcemia", "Calving weakness"],
    },
    {
        "cause": "Retained placenta complicated by acute septic metritis 4 days post-calving",
        "category": MortalityCauseClassificationReview.Category.REPRODUCTIVE_PERINATAL,
        "note": "Perinatal infection following dystocia.",
        "link_prior_disease": False,
        "symptoms": ["Retained placenta", "Metritis", "Foul discharge"],
    },
    # OTHER_REPORTED_CAUSE
    {
        "cause": "Acute ruminal bloat after grazing excessive fresh wet legume forage",
        "category": MortalityCauseClassificationReview.Category.OTHER_REPORTED_CAUSE,
        "note": "Acute dietary frothy bloat.",
        "link_prior_disease": False,
        "symptoms": ["Ruminal bloat", "Abdominal distension", "Asphyxiation"],
    },
    {
        "cause": "Heat stroke and acute cardiopulmonary arrest during midday dry spell",
        "category": MortalityCauseClassificationReview.Category.OTHER_REPORTED_CAUSE,
        "note": "Severe environmental hyperthermia.",
        "link_prior_disease": False,
        "symptoms": ["Heat stroke", "Hyperthermia", "Panting"],
    },
    {
        "cause": "Sudden lightning strike in open field during severe thunderstorm",
        "category": MortalityCauseClassificationReview.Category.OTHER_REPORTED_CAUSE,
        "note": "Lightning strike confirmed by scorch marks and field report.",
        "link_prior_disease": False,
        "symptoms": ["Lightning scorch marks", "Sudden death"],
    },
    {
        "cause": "Suspected toxic weed ingestion leading to acute neuromuscular paralysis",
        "category": MortalityCauseClassificationReview.Category.OTHER_REPORTED_CAUSE,
        "note": "Plant toxicity suspected.",
        "link_prior_disease": False,
        "symptoms": ["Neuromuscular paralysis", "Salivation", "Toxicosis"],
    },
    # UNDETERMINED
    {
        "cause": "Found dead in pasture without prior observed symptoms or trauma",
        "category": MortalityCauseClassificationReview.Category.UNDETERMINED,
        "note": "Unobserved sudden death with inconclusive field evidence.",
        "link_prior_disease": False,
        "symptoms": ["Inconclusive findings"],
    },
]


class Command(BaseCommand):
    help = (
        "Create 24 months of synthetic disease reports with simulated resolutions and mortality events "
        "across every existing barangay, supporting realistic wave fluctuations and mortality classifier seeding."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--scenario",
            choices=["realistic", "increasing"],
            default="realistic",
            help=(
                "Reporting pattern scenario: 'realistic' (default) generates natural wave fluctuations "
                "with seasonal outbreaks, quiet recovery/closure periods, and seeded mortality classifications; "
                "'increasing' preserves the historical monotonically climbing demonstration."
            ),
        )
        parser.add_argument(
            "--enrich-disease-heads", action="store_true",
            help="Give owned synthetic disease reports a repeatable mix of individual and multi-head herd events, without replacing reports.",
        )
        parser.add_argument(
            "--repair-timestamps", action="store_true",
            help="Repair simulated historical timestamps on explicitly owned demo rows without recreating them.",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete only rows tracked as owned by this demo seed, then stop.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the planned month range and owned-row action without changing data.",
        )
        parser.add_argument("--cbat-email", help="Use this active, approved CBAT account for field verification.")
        parser.add_argument("--mao-email", help="Use this active, approved MAO account for review.")
        parser.add_argument("--farmer-email", help="Use this Farmer in their own barangay; other barangays use inactive demo farmers.")

    def handle(self, *args, **options):
        clean = options["clean"]
        dry_run = options["dry_run"]
        scenario = options.get("scenario", "realistic")
        assert_safe_seed_database(clean=clean, dry_run=dry_run)
        if options["enrich_disease_heads"]:
            if clean or options["repair_timestamps"]:
                raise CommandError("Use --enrich-disease-heads separately from --clean and --repair-timestamps.")
            with transaction.atomic():
                self._enrich_disease_heads(dry_run=dry_run)
            return
        if options["repair_timestamps"]:
            if clean:
                raise CommandError("Choose --repair-timestamps or --clean, not both.")
            with transaction.atomic():
                self._repair_demo_timestamps(dry_run=dry_run)
            return
        months = self._completed_months(timezone.localdate())

        if dry_run:
            count = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).count()
            action = "would remove" if clean else "would replace and seed"
            self.stdout.write(
                f"Dry run: {action} {count} explicitly owned objects. "
                f"Monthly event range: {months[0].isoformat()} to {months[-1].isoformat()} "
                f"({MONTHS} complete calendar months plus current month to date)."
            )
            if not clean:
                self.stdout.write(f"Scenario: {scenario}")
                disease_seq = REALISTIC_DISEASE_CASES_PER_MONTH if scenario == "realistic" else DISEASE_CASES_PER_MONTH
                mortality_seq = REALISTIC_MORTALITY_RECORDS_PER_MONTH if scenario == "realistic" else MORTALITY_RECORDS_PER_MONTH
                self.stdout.write(f"Scope: all {Barangay.objects.count()} existing barangays; existing coverage confirmations are preserved.")
                self.stdout.write(
                    f"Disease reports per barangay by month: {disease_seq}. "
                    "Low periods feature high rates of recovered and closed follow-ups. "
                    f"Mortality records per barangay by month: {mortality_seq}."
                )
                if scenario == "realistic":
                    self.stdout.write("Mortality cause classification reviews will be seeded for the decision tree classifier.")
            self.stdout.write("No database changes were made.")
            return

        with transaction.atomic():
            self._clean_owned_objects()
            if clean:
                return
            plan = self._build_plan(options)
            barangays = list(Barangay.objects.order_by("pk"))
            if not barangays:
                raise CommandError("Existing barangays are required; no shared lookup data was created.")
            for barangay in barangays:
                local_plan = dict(plan, barangay=barangay)
                if not plan["farmer_profile"] or plan["farmer_profile"].barangay_id != barangay.pk:
                    local_plan.update(farmer_user=None, farmer_profile=None)
                verifier = plan["verifier"]
                if verifier and verifier.assigned_barangay_id != barangay.pk and verifier.access_scope != "ALL_BARANGAYS":
                    local_plan["verifier"] = None
                self.barangay_key = f"barangay-{barangay.pk}:"
                self._seed(local_plan, months, scenario=scenario)
            self._enrich_disease_heads(dry_run=False)
            self.stdout.write(self.style.SUCCESS(
                f"Completed synthetic analytics seed ({scenario} scenario) across {len(barangays)} barangays."
            ))

    @staticmethod
    def _completed_months(today):
        """Return the final day of each of the 24 completed months, plus current month to date."""
        month_index = today.year * 12 + today.month - 1
        dates = []
        for offset in range(MONTHS, 0, -1):
            year, zero_month = divmod(month_index - offset, 12)
            month = zero_month + 1
            dates.append(date(year, month, monthrange(year, month)[1]))
        dates.append(today)
        return dates

    @staticmethod
    def _exactly_one(queryset, label):
        count = queryset.count()
        if count != 1:
            raise CommandError(f"Expected exactly one existing {label}; found {count}. No shared lookup data was created.")
        return queryset.get()

    def _build_plan(self, options):
        farmer_user = None
        farmer_profile = None
        if options["farmer_email"]:
            farmer_user = User.objects.filter(
                email__iexact=options["farmer_email"],
                role__role_name=Role.UserRoles.FARMER,
            ).first()
            if farmer_user is None or not hasattr(farmer_user, "farmer_profile"):
                raise CommandError("The selected seed_farmers account must have a Farmer profile.")
            farmer_profile = farmer_user.farmer_profile
            barangay = farmer_profile.barangay
        else:
            barangay = Barangay.objects.order_by("pk").first()
            if barangay is None:
                raise CommandError("Existing barangays are required.")
        cattle = self._exactly_one(
            LivestockType.objects.filter(name__iexact="Cattle"), "Cattle livestock type"
        )
        roles = {
            role_name: self._exactly_one(Role.objects.filter(role_name=role_name), f"{role_name} role")
            for role_name in (Role.UserRoles.FARMER, Role.UserRoles.CBAT, Role.UserRoles.MAO)
        }
        reviewers = User.objects.filter(
            role__role_name=Role.UserRoles.MAO,
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
        )
        reviewer = reviewers.filter(email__iexact=options["mao_email"]).first() if options["mao_email"] else reviewers.order_by("pk").first()
        if reviewer is None:
            if not options["mao_email"]:
                reviewer = User.objects.filter(is_superuser=True, is_active=True).order_by("pk").first()
        if reviewer is None:
            raise CommandError("An active approved MAO/Admin reviewer is required to approve the demo records.")
        if options["mao_email"] and reviewer.role.role_name != Role.UserRoles.MAO:
            raise CommandError("The selected reviewer must be an active, approved MAO account.")

        verifier = None
        if options["cbat_email"]:
            verifier = User.objects.filter(
                email__iexact=options["cbat_email"],
                role__role_name=Role.UserRoles.CBAT,
                account_status=User.AccountStatus.APPROVED,
                is_active=True,
            ).first()
            if verifier is None:
                raise CommandError("The selected verifier must be an active, approved CBAT account.")
        return {
            "barangay": barangay, "cattle": cattle, "roles": roles,
            "reviewer": reviewer, "verifier": verifier,
            "farmer_user": farmer_user, "farmer_profile": farmer_profile,
        }

    def _seed(self, plan, months, *, scenario="realistic"):
        identity_suffix = f"-b{plan['barangay'].pk}"
        farmers = []
        if plan["farmer_user"]:
            farmers.append({
                "user": plan["farmer_user"],
                "farmer": plan["farmer_profile"],
                "mortality_animals": [],
            })
        else:
            for suffix in ("a", "b"):
                user = self._create_demo_user(
                    key=f"farmer-{suffix}",
                    email=f"demo.analytics.farmer.{suffix}{identity_suffix}@smartlivestock-demo.invalid",
                    username=f"demo-analytics-farmer-{suffix}{identity_suffix}",
                    role=plan["roles"][Role.UserRoles.FARMER],
                )
                farmer = Farmer.objects.create(
                    user=user,
                    barangay=plan["barangay"],
                    address=f"DEMO ONLY - synthetic analytics farm {suffix.upper()} in {plan['barangay'].barangay_name}",
                )
                self._track(f"farmer-{suffix}:profile", "farmer", farmer)
                farmers.append({"user": user, "farmer": farmer, "mortality_animals": []})

        verifier = plan["verifier"] or self._create_demo_user(
            key="cbat-verifier",
            email=f"demo.analytics.cbat{identity_suffix}@smartlivestock-demo.invalid",
            username=f"demo-analytics-cbat-verifier{identity_suffix}",
            role=plan["roles"][Role.UserRoles.CBAT],
            assigned_barangay=plan["barangay"],
            last_name="CBAT Verifier",
        )

        disease_counts_seq = REALISTIC_DISEASE_CASES_PER_MONTH if scenario == "realistic" else DISEASE_CASES_PER_MONTH
        mortality_counts_seq = REALISTIC_MORTALITY_RECORDS_PER_MONTH if scenario == "realistic" else MORTALITY_RECORDS_PER_MONTH

        disease_count = 0
        mortality_count = 0
        review_count = 0
        for month_index, month_end in enumerate(months):
            num_disease = disease_counts_seq[month_index]
            prev_disease = disease_counts_seq[month_index - 1] if month_index > 0 else num_disease
            is_low_or_declining = num_disease <= 2 or num_disease < prev_disease

            for event_index in range(num_disease):
                owner_index = (month_index + event_index) % len(farmers)
                owner = farmers[owner_index]
                disease_count += 1
                disease_animal = self._create_demo_animal(
                    key=f"farmer-{chr(97 + owner_index)}:disease-animal:{month_end:%Y-%m}:{event_index + 1}",
                    owner=owner,
                    livestock_type=plan["cattle"],
                    reviewer=plan["reviewer"],
                )
                if scenario == "realistic":
                    d_profile = REALISTIC_DISEASE_PROFILES[(month_index * 3 + event_index) % len(REALISTIC_DISEASE_PROFILES)]
                    d_name = d_profile["name"]
                    d_symptoms = d_profile["symptoms"]
                    if is_low_or_declining:
                        # In low/trough months, cases resolve cleanly (80% recovered, 20% closed, 0% open)
                        resolution_outcome = 0 if (event_index % 5 < 4) else 1
                    else:
                        # In peak months, some remain open/under treatment
                        peak_mod = event_index % 4
                        resolution_outcome = 0 if peak_mod < 2 else (1 if peak_mod == 2 else 2)
                else:
                    d_name = "DEMO synthetic cattle illness observation (not a diagnosis)"
                    d_symptoms = []
                    resolution_outcome = (month_index + event_index) % 3

                case = self._create_approved_disease(
                    key=f"disease:{month_end:%Y-%m}:{event_index + 1}",
                    farmer_user=owner["user"],
                    animal=disease_animal,
                    record_date=self._event_day(month_end, month_index, event_index, offset=3),
                    verifier=verifier,
                    reviewer=plan["reviewer"],
                    disease_name=d_name,
                    symptoms=d_symptoms,
                )
                self._seed_disease_resolution(
                    case=case,
                    key=f"disease:{month_end:%Y-%m}:{event_index + 1}",
                    outcome_index=resolution_outcome,
                    reviewer=plan["reviewer"],
                )
                self._track_notifications("disease_case", f"disease:{month_end:%Y-%m}:{event_index + 1}")

            num_mortality = mortality_counts_seq[month_index]
            for event_index in range(num_mortality):
                owner_index = (month_index + event_index) % len(farmers)
                owner = farmers[owner_index]
                mortality_count += 1
                mortality_animal = self._create_demo_animal(
                    key=f"farmer-{chr(97 + owner_index)}:mortality-animal:{month_end:%Y-%m}:{event_index + 1}",
                    owner=owner,
                    livestock_type=plan["cattle"],
                    reviewer=plan["reviewer"],
                )
                owner["mortality_animals"].append(mortality_animal)
                mortality_date = self._event_day(month_end, month_index, event_index, offset=11)

                if scenario == "realistic":
                    m_profile = REALISTIC_MORTALITY_PROFILES[
                        (month_index * 2 + event_index + plan["barangay"].pk) % len(REALISTIC_MORTALITY_PROFILES)
                    ]
                    m_cause = m_profile["cause"]
                    m_category = m_profile["category"]
                    m_note = m_profile["note"]
                    m_symptoms = m_profile.get("symptoms", [])
                    source_case = None

                    if m_profile.get("link_prior_disease"):
                        delta = 2 + (event_index % 3)
                        prior_day = max(1, mortality_date.day - delta)
                        if prior_day >= mortality_date.day and mortality_date.day > 1:
                            prior_day = mortality_date.day - 1
                        prior_date = date(month_end.year, month_end.month, prior_day)
                        prior_case = self._create_approved_disease(
                            key=f"mortality-prior-disease:{month_end:%Y-%m}:{event_index + 1}",
                            farmer_user=owner["user"],
                            animal=mortality_animal,
                            record_date=prior_date,
                            verifier=verifier,
                            reviewer=plan["reviewer"],
                            disease_name=m_profile.get("disease_name", "High fever, labored breathing, and coughing (suspected pneumonia)"),
                            symptoms=m_symptoms,
                        )
                        source_case = prior_case
                else:
                    m_cause = "DEMO synthetic mortality event (cause not established)"
                    m_category = MortalityCauseClassificationReview.Category.UNDETERMINED
                    m_note = "Demo synthetic mortality record."
                    m_symptoms = []
                    source_case = None

                record = self._create_approved_mortality(
                    key=f"mortality:{month_end:%Y-%m}:{event_index + 1}",
                    farmer_user=owner["user"],
                    animal=mortality_animal,
                    record_date=mortality_date,
                    verifier=verifier,
                    reviewer=plan["reviewer"],
                    cause=m_cause,
                    source_disease_case=source_case,
                    symptoms=m_symptoms,
                )
                self._track_notifications("mortality_record", f"mortality:{month_end:%Y-%m}:{event_index + 1}")

                # Staff confirmed cause classification label:
                # Seed labels for months <= 21 to establish a rich training set,
                # leaving the recent ~3 months unlabelled for the live prediction queue.
                should_label = (month_index <= 21)
                if should_label:
                    review = MortalityCauseClassificationReview.objects.create(
                        mortality_record=record,
                        category=m_category,
                        reviewer=plan["reviewer"],
                        note=m_note,
                    )
                    MortalityCauseClassificationReview.objects.filter(pk=review.pk).update(
                        reviewed_at=demo_time(mortality_date, 18),
                    )
                    self._track(f"mortality:{month_end:%Y-%m}:{event_index + 1}:review", "mortality_review", review)
                    review_count += 1

        self._seed_coverage_confirmations(plan, months)
        self.stdout.write(self.style.SUCCESS("Disease and mortality event analytics demo is ready."))
        farmer_summary = (
            f"Used Farmer demo {plan['farmer_user'].email}"
            if plan["farmer_user"]
            else "Created 2 inactive analytics-only demo farmers"
        )
        self.stdout.write(
            f"{farmer_summary} in {plan['barangay'].barangay_name}; "
            f"{disease_count} approved disease cases, {mortality_count} approved mortality records, "
            f"and {review_count} staff classification training labels from "
            f"{months[0]:%b %Y} through {months[-1]:%b %Y}."
        )
        self.stdout.write(
            "Each report passed the PENDING -> CBAT VERIFIED -> MAO APPROVED transition checks. "
            f"Mortality approvals reconciled {mortality_count} uniquely identified demo animals as deceased."
        )
        self.stdout.write(
            "All records are synthetic and explicitly marked; disease labels are not diagnoses. "
            "They are intended for analytics display, not real-world surveillance evidence."
        )
        self.stdout.write(
            "Disease reports increase over the simulated timeline. Some recover after 21 days, "
            "some close after 45 days, and others remain open. Only resolutions due by today are recorded. "
            "Historical GIS currently uses present clinical status, not status reconstructed at each past date."
        )
        self.stdout.write(
            "Synthetic coverage confirmations demonstrate explicit quiet months; they are not operational attestations. "
            "Existing coverage confirmations are preserved."
        )

    @staticmethod
    def _event_day(month_end, month_index, event_index, *, offset):
        max_day = min(month_end.day, monthrange(month_end.year, month_end.month)[1])
        if max_day <= 3:
            day = max(2, max_day)
        else:
            day = 2 + ((month_index * 7 + event_index * 11 + offset) % (max_day - 2))
        return date(month_end.year, month_end.month, day)

    def _seed_coverage_confirmations(self, plan, months):
        """Add reversible synthetic coverage only where no prior attestation exists."""
        created_count = 0
        preserved_count = 0
        skipped_count = 0
        for domain, model, approved_status, marker in (
            (SurveillanceCoverageReport.Domain.DISEASE, DiseaseCase, DiseaseCase.DiseaseStatus.APPROVED, SEED_MARKER_DISEASE),
            (SurveillanceCoverageReport.Domain.MORTALITY, MortalityRecord, MortalityRecord.MortalityRecordStatus.APPROVED, SEED_MARKER_MORTALITY),
        ):
            for month_end in months:
                month_start = date(month_end.year, month_end.month, 1)
                # Skip in-progress current month for monthly coverage confirmations
                if month_end >= timezone.localdate():
                    continue
                events = model.objects.filter(
                    record_date__year=month_start.year,
                    record_date__month=month_start.month,
                ).filter(
                    Q(livestock__farmer__barangay=plan["barangay"])
                    | Q(batch__farmer__barangay=plan["barangay"])
                )
                record_count = events.count()
                approved_count = events.filter(status=approved_status).count()
                existing_report = SurveillanceCoverageReport.objects.filter(
                    barangay=plan["barangay"], domain=domain, report_month=month_start,
                ).order_by("-confirmed_at", "-pk").first()
                if existing_report is not None:
                    if (
                        existing_report.status == SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED
                        and record_count > 0
                        and approved_count == record_count
                    ):
                        existing_report.status = SurveillanceCoverageReport.Status.REPORTS_COMPLETE
                        existing_report.save(update_fields=["status"])
                    preserved_count += 1
                    continue

                if events.filter(
                    Q(review_remarks__isnull=True)
                    | ~Q(review_remarks__contains=marker)
                ).exists() and approved_count != record_count:
                    # Do not create a synthetic attestation over unapproved
                    # records in the same barangay and month.
                    skipped_count += 1
                    continue
                if record_count and approved_count != record_count:
                    skipped_count += 1
                    continue
                report = SurveillanceCoverageReport.objects.create(
                    barangay=plan["barangay"],
                    domain=domain,
                    report_month=month_start,
                    status=(
                        SurveillanceCoverageReport.Status.REPORTS_COMPLETE
                        if record_count
                        else SurveillanceCoverageReport.Status.NO_REPORTS_RECEIVED
                    ),
                    confirmed_by=plan["reviewer"],
                    confirmed_at=demo_time(month_end, 23),
                )
                SurveillanceCoverageReport.objects.filter(pk=report.pk).update(created_at=report.confirmed_at)
                self._track(f"coverage:{domain.lower()}:{month_start:%Y-%m}", "coverage", report)
                created_count += 1
        self.stdout.write(
            f"{plan['barangay'].barangay_name} coverage: {created_count} synthetic confirmations created, "
            f"{preserved_count} existing confirmations preserved, {skipped_count} months/domains skipped "
            "because they contain other records or unapproved reports."
        )
        if preserved_count or skipped_count:
            self.stdout.write(self.style.WARNING(
                "Forecast readiness can still be blocked: review existing confirmations and mixed-record months "
                "in Monthly Reporting Coverage. This seed does not attest to real reports."
            ))

    def _track_notifications(self, entity_type, record_key):
        record_marker = SurveillanceDemoOwnership.objects.filter(identifier=f"{PREFIX}{getattr(self, 'barangay_key', '')}{record_key}").first()
        if record_marker is None:
            return
        for notification in Notification.objects.filter(
            related_entity_type=entity_type,
            related_entity_id=record_marker.object_id,
        ):
            self._track(
                f"notification:{entity_type}:{record_marker.object_id}:{notification.pk}",
                "notification",
                notification,
            )

    def _create_demo_user(self, *, key, email, username, role, assigned_barangay=None, last_name="Farmer"):
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username=username).exists():
            raise CommandError(
                f"Demo identity {email} or username {username} already exists without this seed's ownership; refusing to reuse it."
            )
        user = User.objects.create_user(
            username=username,
            email=email,
            password=None,
            role=role,
            first_name="Demo Analytics",
            last_name=last_name,
            account_status=User.AccountStatus.PENDING,
            is_active=False,
            assigned_barangay=assigned_barangay,
        )
        self._track(key, "user", user)
        return user

    def _create_demo_animal(self, *, key, owner, livestock_type, reviewer, batch=None, recorded_on=None):
        reviewed_time = demo_time(recorded_on, 7) if recorded_on else timezone.now()
        animal = LivestockInventory(
            farmer=owner["farmer"],
            batch=batch,
            livestock_type=livestock_type,
            entry_type=LivestockInventory.EntryType.INDIVIDUAL,
            quantity=1,
            tag_number=next_seed_livestock_tag(self, owner["user"]),
            ownership_certificate_number=next_seed_colc_number(self, recorded_on),
            ownership_certificate_recorded_by=reviewer,
            ownership_certificate_recorded_at=reviewed_time,
            breed="Synthetic demo cattle",
            sex="Female",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=owner["user"],
            reviewed_by=reviewer,
            reviewed_at=reviewed_time,
            review_remarks=f"{SEED_MARKER_DISEASE} Synthetic demo inventory only; not a real animal.",
        )
        animal.full_clean()
        animal.save()
        if recorded_on:
            LivestockInventory.objects.filter(pk=animal.pk).update(created_at=demo_time(recorded_on, 6))
        self._track(key, "livestock", animal)
        return animal

    def _create_approved_disease(
        self, *, key, farmer_user, animal, record_date, verifier, reviewer,
        disease_name=None, symptoms=None,
    ):
        name = disease_name or "DEMO synthetic cattle illness observation (not a diagnosis)"
        serializer = DiseaseCaseSerializer(
            data={
                "livestock": animal.pk,
                "name": name,
                "affected_count": 1,
                "record_date": record_date,
            },
            context={"request": SimpleNamespace(user=farmer_user)},
        )
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        self._track(key, "disease", case)
        self._approve_with_verification(
            domain="disease",
            record=case,
            verified_status=DiseaseCase.DiseaseStatus.VERIFIED,
            approved_status=DiseaseCase.DiseaseStatus.APPROVED,
            verifier=verifier,
            reviewer=reviewer,
            marker=SEED_MARKER_DISEASE,
            label="synthetic disease observation; not a confirmed or diagnosed case" if "DEMO synthetic" in name else name,
            symptoms=symptoms,
        )
        return case

    def _seed_disease_resolution(self, *, case, key, outcome_index, reviewer):
        """Record explicitly simulated outcomes only for this command's new owned cases."""
        if outcome_index == 2:
            return
        recovered = outcome_index == 0
        resolved_on = case.record_date + timedelta(days=21 if recovered else 45)
        if resolved_on > timezone.localdate():
            return
        outcome = (
            DiseaseCaseFollowUp.EventType.RECOVERED if recovered
            else DiseaseCaseFollowUp.EventType.CLOSED
        )
        follow_up = DiseaseCaseFollowUp.objects.create(
            case=case, event_type=outcome, observed_on=resolved_on, created_by=reviewer,
            notes=(
                f"{SEED_MARKER_DISEASE} SIMULATED_HISTORICAL_AVAILABILITY: "
                f"Synthetic {outcome.lower()} outcome for demonstration only; "
                "not evidence of an actual field assessment or historical review."
            ),
        )
        self._track(f"{key}:resolution", "follow_up", follow_up)
        DiseaseCaseFollowUp.objects.filter(pk=follow_up.pk).update(
            created_at=demo_time(resolved_on, 17),
        )
        DiseaseCase.objects.filter(pk=case.pk).update(clinical_status=outcome)

    def _create_approved_mortality(
        self, *, key, farmer_user, animal, record_date, verifier, reviewer,
        cause=None, source_disease_case=None, symptoms=None,
    ):
        cause_text = cause or "DEMO synthetic mortality event (cause not established)"
        data = {
            "livestocks": [animal.pk],
            "death_count": 1,
            "cause": cause_text,
            "record_date": record_date,
        }
        if source_disease_case:
            data["source_disease_case"] = source_disease_case.pk
        serializer = MortalityRecordSerializer(
            data=data,
            context={"request": SimpleNamespace(user=farmer_user)},
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        self._track(key, "mortality", record)
        self._approve_with_verification(
            domain="mortality",
            record=record,
            verified_status=MortalityRecord.MortalityRecordStatus.VERIFIED,
            approved_status=MortalityRecord.MortalityRecordStatus.APPROVED,
            verifier=verifier,
            reviewer=reviewer,
            marker=SEED_MARKER_MORTALITY,
            label="synthetic mortality event; cause not established" if "DEMO synthetic" in cause_text else cause_text,
            symptoms=symptoms,
        )
        reconcile_approved_mortality(record)
        return record

    @staticmethod
    def _approve_with_verification(
        *, domain, record, verified_status, approved_status, verifier, reviewer, marker, label,
        symptoms=None,
    ):
        # Synthetic events simulate submission and review on the event date.
        # QuerySet.update restores auto_now_add without issuing new notifications.
        submitted_time = demo_time(record.record_date, 8)
        type(record).objects.filter(pk=record.pk).update(created_at=submitted_time)
        record.created_at = submitted_time
        verify_time = demo_time(record.record_date, 14)
        verify_remark = f"{marker} Synthetic CBAT verification for analytics demo; not a field inspection."
        validate_review_transition(
            domain=domain,
            role=Role.UserRoles.CBAT,
            current=record.status,
            target=verified_status,
            remarks=verify_remark,
        )
        record.status = verified_status
        record.reviewed_by = verifier
        record.reviewed_at = verify_time
        record.review_remarks = verify_remark
        record.inspection_details = {
            "verifiedBy": verifier.get_full_name().strip() or verifier.username,
            "verifiedAt": verify_time.isoformat(),
            "remarks": verify_remark,
            "verificationMode": "SYNTHETIC_DEMO",
            "timelineMode": "SIMULATED_HISTORICAL_AVAILABILITY",
            "confirmedSymptoms": symptoms or [],
        }
        record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks", "inspection_details"])

        approve_time = demo_time(record.record_date, 17)
        approve_remark = f"{marker} Synthetic MAO-approved analytics demo; {label}."
        validate_review_transition(
            domain=domain,
            role=Role.UserRoles.MAO,
            current=record.status,
            target=approved_status,
            remarks=approve_remark,
        )
        details = dict(record.inspection_details or {})
        details.update({
            "maoRemarks": approve_remark,
            "maoReviewedBy": reviewer.get_full_name().strip() or reviewer.username,
            "maoReviewedAt": approve_time.isoformat(),
            "confirmedSymptoms": symptoms or [],
        })
        record.status = approved_status
        record.reviewed_by = reviewer
        record.reviewed_at = approve_time
        record.review_remarks = approve_remark
        record.inspection_details = details
        record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks", "inspection_details"])

    def _enrich_disease_heads(self, *, dry_run):
        """Keep report IDs/dates while varying affected counts on owned demo rows.

        Individual reports stay at one head. Herd events use actual owned demo
        rosters and the ordinary serializer's ownership/population validation.
        """
        self.barangay_key = ""
        owned = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX)
        rows = DiseaseCase.objects.filter(
            pk__in=owned.filter(object_type="disease").values("object_id"),
            review_remarks__contains=SEED_MARKER_DISEASE,
            inspection_details__verificationMode="SYNTHETIC_DEMO",
            status=DiseaseCase.DiseaseStatus.APPROVED,
        ).select_related(
            "livestock__farmer__user", "livestock__livestock_type",
            "batch__farmer__user", "batch__livestock_type", "reviewed_by",
        ).order_by("record_date", "pk")
        identifiers = dict(owned.filter(object_type="disease").values_list("object_id", "identifier"))
        pattern = (1, 3, 2, 1, 5, 4, 1, 6)
        counts = {"reports": 0, "individual_reports": 0, "herd_reports": 0, "affected_heads": 0}
        herds = {}
        for case in rows:
            ident = identifiers.get(case.pk, "")
            if "mortality-prior-disease" in ident:
                continue
            target = case.livestock or case.batch
            if target is None or case.record_date is None:
                raise CommandError(f"Owned disease report #{case.pk} has no valid animal/herd or date.")
            # Event position comes from the stable seed key, not database IDs.
            event_index = int(ident.rsplit(":", 1)[1]) - 1
            month_index = case.record_date.year * 12 + case.record_date.month
            affected = pattern[(month_index + event_index + target.farmer.barangay_id) % len(pattern)]
            # Never convert a previously enriched herd back to an individual.
            if case.batch_id and affected == 1:
                raise CommandError("Demo pattern changed for an enriched herd; refusing an ambiguous conversion.")
            counts["reports"] += 1
            counts["herd_reports" if affected > 1 else "individual_reports"] += 1
            counts["affected_heads"] += affected
            if dry_run or affected == 1:
                continue
            owner = {"farmer": target.farmer, "user": target.farmer.user}
            farmer_id = target.farmer_id
            if farmer_id not in herds:
                key = f"disease-herd:farmer-{farmer_id}"
                ledger = owned.filter(identifier=f"{PREFIX}{key}", object_type="herd").first()
                if ledger:
                    herd = LivestockBatch.objects.get(pk=ledger.object_id)
                    if herd.farmer_id != farmer_id or SEED_MARKER_DISEASE not in herd.notes:
                        raise CommandError("Demo herd ownership mismatch; refusing modification.")
                    roster_ids = list(herd.animals.values_list("pk", flat=True))
                    owned_roster_ids = set(owned.filter(object_type="livestock", object_id__in=roster_ids).values_list("object_id", flat=True))
                    if set(roster_ids) != owned_roster_ids:
                        raise CommandError("Demo herd contains unowned animals; refusing modification.")
                else:
                    code = f"DM-DEMO-H-{farmer_id}"
                    if LivestockBatch.objects.filter(batch_code=code).exists():
                        raise CommandError("Demo herd code exists without ownership; refusing reuse.")
                    herd = LivestockBatch(
                        farmer=target.farmer, livestock_type=target.livestock_type,
                        batch_name="Synthetic disease analytics herd", batch_code=code,
                        created_by=owner["user"], status=LivestockBatch.StatusType.ACTIVE,
                        notes=f"{SEED_MARKER_DISEASE} Synthetic six-animal herd; simulated historical availability.",
                    )
                    herd.full_clean()
                    herd.save()
                    submitted = demo_time(case.record_date, 6)
                    LivestockBatch.objects.filter(pk=herd.pk).update(created_at=submitted, updated_at=submitted)
                    self._track(key, "herd", herd)
                    for member in range(1, 7):
                        self._create_demo_animal(
                            key=f"{key}:member-{member}", owner=owner,
                            livestock_type=target.livestock_type, reviewer=case.reviewed_by,
                            batch=herd, recorded_on=case.record_date,
                        )
                herds[farmer_id] = herd
            herd = herds[farmer_id]
            if case.batch_id and case.batch_id != herd.pk:
                raise CommandError("Report points to another herd; refusing modification.")
            serializer = DiseaseCaseSerializer(
                instance=case, data={"livestock": None, "batch": herd.pk, "affected_count": affected},
                partial=True, context={"request": SimpleNamespace(user=owner["user"])},
            )
            serializer.is_valid(raise_exception=True)
            details = dict(case.inspection_details or {})
            details["demoHeadCountScenario"] = "MIXED_INDIVIDUAL_AND_HERD_V1"
            # Fixture-only update preserves approval dates, report IDs and
            # notifications; operational correction workflows remain unchanged.
            DiseaseCase.objects.filter(pk=case.pk).update(
                livestock=None, batch=herd, affected_count=affected, inspection_details=details,
            )
        self.stdout.write(f"{'Would enrich' if dry_run else 'Enriched'} owned synthetic disease data: {counts}")

    def _repair_demo_timestamps(self, *, dry_run):
        """Repair only ledger-owned marked demo events and unmixed owned coverage."""
        owned = SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX)
        counts = {}
        for kind, model, marker in (
            ("disease", DiseaseCase, SEED_MARKER_DISEASE),
            ("mortality", MortalityRecord, SEED_MARKER_MORTALITY),
        ):
            rows = model.objects.filter(
                pk__in=owned.filter(object_type=kind).values("object_id"),
                review_remarks__contains=marker, status="APPROVED",
                inspection_details__verificationMode="SYNTHETIC_DEMO",
            )
            counts[kind] = rows.count()
            if not dry_run:
                for row in rows:
                    details = dict(row.inspection_details or {})
                    details.update(
                        verifiedAt=demo_time(row.record_date, 14).isoformat(),
                        maoReviewedAt=demo_time(row.record_date, 17).isoformat(),
                        timelineMode="SIMULATED_HISTORICAL_AVAILABILITY",
                    )
                    model.objects.filter(pk=row.pk).update(
                        created_at=demo_time(row.record_date, 8),
                        reviewed_at=demo_time(row.record_date, 17),
                        inspection_details=details,
                    )
        counts["coverage"] = 0
        counts["coverage_skipped_mixed"] = 0
        for report in SurveillanceCoverageReport.objects.filter(
            pk__in=owned.filter(object_type="coverage").values("object_id"),
        ):
            kind = report.domain.lower()
            model = OBJECT_MODELS[kind]
            marker = SEED_MARKER_DISEASE if kind == "disease" else SEED_MARKER_MORTALITY
            events = model.objects.filter(
                record_date__year=report.report_month.year,
                record_date__month=report.report_month.month,
            ).filter(Q(livestock__farmer__barangay_id=report.barangay_id)
                     | Q(batch__farmer__barangay_id=report.barangay_id))
            safe_ids = owned.filter(object_type=kind).values("object_id")
            if events.exclude(pk__in=safe_ids).exists() or events.exclude(
                review_remarks__contains=marker, status="APPROVED",
                inspection_details__verificationMode="SYNTHETIC_DEMO",
            ).exists():
                counts["coverage_skipped_mixed"] += 1
                continue
            counts["coverage"] += 1
            if not dry_run:
                month_end = report.report_month.replace(day=monthrange(
                    report.report_month.year, report.report_month.month,
                )[1])
                confirmed = demo_time(month_end, 23)
                SurveillanceCoverageReport.objects.filter(pk=report.pk).update(
                    confirmed_at=confirmed, created_at=confirmed,
                )
        self.stdout.write(f"{'Would repair' if dry_run else 'Repaired'} synthetic timestamps: {counts}")
        self.stdout.write("Simulated demo availability only; this is not evidence of historical field reviews. Unowned records and confirmations are preserved.")

    def _track(self, identifier, object_type, obj):
        marker, created = SurveillanceDemoOwnership.objects.get_or_create(
            identifier=f"{PREFIX}{getattr(self, 'barangay_key', '')}{identifier}",
            defaults={"object_type": object_type, "object_id": obj.pk},
        )
        if not created and (marker.object_type != object_type or marker.object_id != obj.pk):
            raise CommandError(f"Ownership marker conflict for {identifier}; refusing to claim another row.")

    def _clean_owned_objects(self):
        # Earlier versions created notifications before the ownership ledger
        # tracked them. Recover only notifications whose entity IDs point to
        # this seed's already-owned synthetic reports.
        entity_types = {"disease": "disease_case", "mortality": "mortality_record"}
        for record_marker in SurveillanceDemoOwnership.objects.filter(
            identifier__startswith=PREFIX,
            object_type__in=entity_types,
        ):
            for notification in Notification.objects.filter(
                related_entity_type=entity_types[record_marker.object_type],
                related_entity_id=record_marker.object_id,
            ):
                self._track(
                    f"notification:{record_marker.object_type}:{record_marker.object_id}:{notification.pk}",
                    "notification",
                    notification,
                )

        markers = list(
            SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).order_by("identifier")
        )
        owned_ids = {}
        owned_objects = []
        for marker in markers:
            model = OBJECT_MODELS.get(marker.object_type)
            if model is None:
                raise CommandError(f"Unknown owned object type {marker.object_type!r}; refusing cleanup.")
            try:
                obj = model.objects.get(pk=marker.object_id)
            except model.DoesNotExist as exc:
                raise CommandError(
                    f"Ownership marker {marker.identifier} points to a missing {model.__name__} "
                    f"#{marker.object_id}; refusing cleanup."
                ) from exc
            owned_ids.setdefault(model, set()).add(obj.pk)
            owned_objects.append((marker, obj))

        for marker, obj in owned_objects:
            for relation in obj._meta.related_objects:
                if relation.related_model is SurveillanceDemoOwnership:
                    continue
                manager = getattr(obj, relation.get_accessor_name(), None)
                if manager is None:
                    continue
                related_ids = (
                    manager.all().values_list("pk", flat=True).iterator()
                    if hasattr(manager, "all")
                    else (manager.pk,)
                )
                for related_id in related_ids:
                    if related_id not in owned_ids.get(relation.related_model, set()):
                        raise CommandError(
                            f"Cannot clean {marker.identifier}: {relation.related_model.__name__} "
                            f"#{related_id} is related but is not owned by this seed. No rows were deleted."
                        )

        for object_type in (
            "notification",
            "coverage",
            "mortality_review",
            "mortality",
            "follow_up",
            "disease",
            "livestock",
            "herd",
            "farmer",
            "user",
        ):
            model = OBJECT_MODELS[object_type]
            ids = owned_ids.get(model, set())
            if ids:
                model.objects.filter(pk__in=ids).delete()
        SurveillanceDemoOwnership.objects.filter(identifier__startswith=PREFIX).delete()
        if markers:
            self.stdout.write(f"Removed {len(markers)} explicitly owned disease/mortality analytics demo objects.")
