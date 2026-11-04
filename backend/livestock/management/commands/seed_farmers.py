from decimal import Decimal
from datetime import date
import os
import re
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.db import transaction
from users.models import User, Role
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory, LivestockBatch
from smartlivestock.seed_safety import assert_safe_seed_database

# ---------------------------------------------------------------------------
# RAW DATA PROVIDED FROM PADRE GARCIA SURVEY
# ---------------------------------------------------------------------------
RAW_DATA = """
Manggas,Mark Angelo Bathan,2
Manggas,Peter Comia,5
Manggas,Conrado Comia,3
Manggas,Cesar Comia,4
Manggas,Imelda Suco,1
Manggas,Tyron Lindog,5
Pansol,Leandro Linatoc,3
Pansol,Godofredo Camacho,5
Pansol,Alejandro Lanto,4
Pansol,Avelino Tapalla,4
Pansol,Marino Silva,1
Pansol,Victor Manguait,4
Pansol,Lucio Tapalla,4
Cawongan,Olga Escueta,5
Cawongan,Jobert Arellano,3
Cawongan,Larry Vergara,3
Cawongan,Edwin Vergara,2
Cawongan,Gregorio Vergara,4
Cawongan,Arvin Escueta,5
Cawongan,Morris Escueta,5
Cawongan,Ever Vergara,4
Cawongan,Ponciano Escueta,3
Cawongan,Ricky Castillo,2
Banay-Banay,Nelson Andal,1
Banay-Banay,Celso Moster,1
Banay-Banay,Ehner Laylo,1
Banay-Banay,Virgilio Moster,1
Banay-Banay,Nestor Patungan,1
Banay-Banay,Julia Andal,1
Banay-Banay,Agusto Latayan,1
Banay-Banay,Eduardo Garcia,1
Banay-Banay,Nepomuceno Laylo,1
Bawi,Emma Buquir,2
Bawi,Andreo Villanueva,2
San Miguel,Fred Calingasan,2
San Miguel,Elmer Manalon,1
San Miguel,Briccio Dimaano,2
San Miguel,Emiliano Dimaano,2
San Miguel,Christopher Kasilag,3
San Miguel,Norma Macatangay,3
San Miguel,Gloria Metrillo,2
Bukal,Esmeraldo Caraan,4
Bukal,Zaldy Fajardo,3
Bukal,Jayson Bathan,2
Bukal,Nancy de los Reyes,1
San Felipe,Maila Manimtim,1
San Felipe,Venistiano Hernandez,1
San Felipe,Teofila Hernandez,1
San Felipe,Ruel Hernandez,1
San Felipe,Amelita Tapay,1
Banaba,Saturnino Balhag,2
Banaba,Mark Jayson Katigbak,2
Banaba,Marieta Aguila,1
Maugat West,Rene Reña,4
Maugat West,Bernardo de Castro,5
Maugat West,Maria de Castro,4
Maugat West,Feriano Ramires,4
Maugat West,Victor Valencia,5
Maugat West,Reynante Bataan,4
Maugat West,Apolinario Valdez,6
Maugat West,Luis Aguila,4
Tamak,Ruelan Gonzales,1
Tamak,Rene Maala,1
Tamak,Rea Guce,1
Quilo Quilo North,Rey Melchor Casanova,5
Quilo Quilo North,Renaldo Datinggaling,2
Quilo Quilo North,Felipe Carreal,3
Quilo Quilo North,Heriel Bautista,3
Quilo Quilo North,Alberto Gutierrez,2
Quilo Quilo South,Rodolfo Jareno,1
Quilo Quilo South,Cardo Masalunga,2
Quilo Quilo South,Donald Manigbas,4
Quilo Quilo South,Emerlita Zara,2
Quilo Quilo South,Rudy Ocampo,1
Castillo,Bernie Gustillo,5
Castillo,Paulino Ariola,5
Castillo,Lito Leonin,2
Castillo,Maximo Valencia,5
Castillo,Ronel Paco,4
Castillo,Norma Mayor,5
Castillo,Marco Mayor,5
Castillo,Mario Magmanlac,3
Maugat East,Cristeta Aranes,6
Maugat East,Cristina Morados,4
Maugat East,Ruter Mendoza,3
Maugat East,Juan Aranes,4
Maugat East,Reynaldo Aranes,3
Maugat East,Felagio Rizare,5
Maugat East,Felix Renoza,5
Maugat East,Gloria Lopez,4
Maugat East,Marilyn Pasigsigan,2
Payapa,Violy Olan,10
Payapa,Jun Mangundayao,2
Payapa,Jose Marasigan,5
Payapa,Jun Escalera,5
Payapa,Ramon Ani,3
Tangob,Ogie Din,1
Tangob,Cornelio Carpio Jr.,1
"""

# Approximate coordinates across Padre Garcia, Batangas for GIS mapping
BARANGAY_COORDS = {
    "Manggas": (13.8820, 121.2210),
    "Pansol": (13.8690, 121.2050),
    "Cawongan": (13.8910, 121.2340),
    "Banay-Banay": (13.8610, 121.2180),
    "Bawi": (13.8740, 121.2410),
    "San Miguel": (13.8850, 121.2080),
    "Bukal": (13.8970, 121.2150),
    "San Felipe": (13.8580, 121.2310),
    "Banaba": (13.8660, 121.1960),
    "Maugat West": (13.8810, 121.1920),
    "Maugat East": (13.8830, 121.2010),
    "Tamak": (13.9040, 121.2260),
    "Quilo Quilo North": (13.8990, 121.2410),
    "Quilo Quilo South": (13.8930, 121.2450),
    "Castillo": (13.8710, 121.2280),
    "Payapa": (13.8520, 121.2070),
    "Tangob": (13.8640, 121.2490),
}


def parse_name(full_name: str):
    """Splits full name into (first_name, last_name)."""
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0], ""
    if len(parts) == 2:
        return parts[0], parts[1]
    if parts[-1].lower() in ["jr.", "sr.", "ii", "iii", "iv"]:
        last = f"{parts[-2]} {parts[-1]}"
        first = " ".join(parts[:-2])
        return first, last
    first = " ".join(parts[:-1])
    last = parts[-1]
    return first, last


def generate_username(first_name: str, last_name: str, index: int):
    """Creates a clean URL-safe username."""
    clean_first = re.sub(r"[^a-zA-Z0-9]", "", first_name.lower())
    clean_last = re.sub(r"[^a-zA-Z0-9]", "", last_name.lower())
    if not clean_last:
        clean_last = "farmer"
    return f"{clean_first}.{clean_last}{index}" if index > 0 else f"{clean_first}.{clean_last}"


class Command(BaseCommand):
    help = "Seeds or Cleans Barangays, Farmers, User accounts, and baseline Cattle Inventory from the Padre Garcia survey."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete records for this command's survey farmer accounts while keeping accounts and farmer profiles.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Disabled: this command no longer performs global operational-data cleanup.",
        )
        parser.add_argument(
            "--email",
            help="With --clean, limit cleanup to one exact farmer email generated by this seed.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="With --clean, show record counts without deleting anything.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["all"]:
            raise CommandError(
                "Global cleanup is disabled. Use --clean to remove only records linked to this command's survey farmer accounts."
            )

        if (options["email"] or options["dry_run"]) and not options["clean"]:
            raise CommandError("--email and --dry-run can only be used with --clean.")

        assert_safe_seed_database(clean=options["clean"], dry_run=options["dry_run"])

        # -------------------------------------------------------------------
        # REVERT / CLEAN MODE
        # -------------------------------------------------------------------
        if options["clean"]:
            self._clean_seeded_farmer_records(email=options["email"], dry_run=options["dry_run"])
            return

        # -------------------------------------------------------------------
        # SEED MODE
        # -------------------------------------------------------------------
        self.stdout.write(self.style.NOTICE("[+] Starting database seeding for Padre Garcia farmers..."))

        # 1. Ensure FARMER role exists
        farmer_role, _ = Role.objects.get_or_create(
            role_name=Role.UserRoles.FARMER,
        )

        # 2. Ensure Cattle livestock type exists
        cattle_type, _ = LivestockType.objects.get_or_create(
            name="Cattle",
            defaults={"description": "Bovine livestock (Baka)"},
        )

        lines = [l.strip() for l in RAW_DATA.strip().split("\n") if l.strip()]

        created_barangays = 0
        created_farmers = 0
        created_inventories = 0
        demo_password = os.environ.get("SMARTLIVESTOCK_DEMO_PASSWORD")

        username_counts = {}

        for line in lines:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 3:
                continue

            brgy_name, farmer_full_name, heads_str = parts[0], parts[1], parts[2]
            try:
                heads = int(heads_str)
            except ValueError:
                heads = 1

            # 3. Create or Get Barangay
            coords = BARANGAY_COORDS.get(brgy_name, (13.8767, 121.2144))
            barangay, b_created = Barangay.objects.get_or_create(
                barangay_name=brgy_name,
                defaults={
                    "latitude": Decimal(str(coords[0])),
                    "longitude": Decimal(str(coords[1])),
                    "description": f"Barangay {brgy_name}, Padre Garcia, Batangas",
                },
            )
            if b_created:
                created_barangays += 1

            # 4. Parse Name & Generate Unique Username/Email
            first_name, last_name = parse_name(farmer_full_name)
            base_key = f"{first_name}_{last_name}".lower()
            idx = username_counts.get(base_key, 0)
            username_counts[base_key] = idx + 1

            username = generate_username(first_name, last_name, idx)
            email = f"{username}@smartlivestock.ph"

            # 5. Create or Get User
            user, u_created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": farmer_role,
                    "account_status": (
                        User.AccountStatus.APPROVED if demo_password else User.AccountStatus.PENDING
                    ),
                    "is_active": bool(demo_password),
                },
            )
            if u_created:
                if demo_password:
                    user.set_password(demo_password)
                else:
                    user.set_unusable_password()
                user.save()

            # 6. Create or Get Farmer Profile
            farmer, f_created = Farmer.objects.get_or_create(
                user=user,
                defaults={
                    "barangay": barangay,
                    "address": f"{brgy_name}, Padre Garcia, Batangas",
                    "farm_size": Decimal("1.50"),
                },
            )
            if f_created:
                created_farmers += 1

            # 7. Create Baseline Livestock Batch & Individual Animal Records
            batch_code = f"BATCH-PG-{farmer.pk:03d}"
            batch, b_created = LivestockBatch.objects.get_or_create(
                farmer=farmer,
                batch_code=batch_code,
                defaults={
                    "livestock_type": cattle_type,
                    "batch_name": f"{farmer.user.first_name}'s Cattle Herd",
                    "housing_pen": "Pen 1",
                    "feed_type": "Grass & Forage",
                    "status": LivestockBatch.StatusType.ACTIVE,
                    "created_by": user,
                },
            )
            for h in range(1, heads + 1):
                tag = f"PG-{barangay.barangay_name[:3].upper()}-{farmer.pk:03d}-{h:02d}"
                inv, inv_created = LivestockInventory.objects.get_or_create(
                    farmer=farmer,
                    tag_number=tag,
                    defaults={
                        "batch": batch,
                        "livestock_type": cattle_type,
                        "entry_type": LivestockInventory.EntryType.INDIVIDUAL,
                        "quantity": 1,
                        "breed": "Native / Brahman Cross",
                        "sex": "Female" if h % 2 == 0 else "Male",
                        # Keep seeded DOBs before the historical production windows.
                        "birth_date": date(2019 + (h % 5), 1 + ((h - 1) % 12), min(15 + (h % 10), 28)),
                        "weight": Decimal(str(320 + (h * 15))),
                        "status": LivestockInventory.StatusType.APPROVED,
                        "created_by": user,
                    },
                )
                if inv_created:
                    created_inventories += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\n[OK] Seeding Complete!\n"
                f"   * Barangays created/verified: {created_barangays} new\n"
                f"   * Farmer accounts & Users: {created_farmers} created\n"
                f"   * Livestock Inventory records: {created_inventories} individual animals created\n"
                f"   * Login accounts and farmer profiles are retained by --clean.\n\n"
                f"   To clear this seed's related farm records while retaining its accounts, run: python manage.py seed_farmers --clean\n"
                + ("   Login-enabled accounts were created using SMARTLIVESTOCK_DEMO_PASSWORD.\n" if demo_password else "   Accounts created without SMARTLIVESTOCK_DEMO_PASSWORD are disabled and have no usable password.\n")
            )
        )

    @staticmethod
    def _seeded_account_emails():
        """Rebuild this seed's exact identities; never treat a whole email domain as ownership."""
        username_counts = {}
        emails = set()
        for line in RAW_DATA.strip().splitlines():
            parts = [part.strip() for part in line.split(",")]
            if len(parts) < 3:
                continue
            first_name, last_name = parse_name(parts[1])
            base_key = f"{first_name}_{last_name}".lower()
            index = username_counts.get(base_key, 0)
            username_counts[base_key] = index + 1
            emails.add(f"{generate_username(first_name, last_name, index)}@smartlivestock.ph")
        return emails

    def _clean_seeded_farmer_records(self, *, email=None, dry_run=False):
        """Remove demo operational records, retaining the seeded users and Farmer profiles."""
        from diseases.models import (
            DiseaseCase,
            DiseaseCaseFollowUp,
            MortalityCauseClassificationReview,
            MortalityRecord,
        )
        from movements.models import (
            LivestockInspection,
            LivestockInspectionClearance,
            LivestockInspectionItem,
            MeatMovementRecord,
        )
        from production.models import (
            AnimalDisposition,
            BreedingRecord,
            CalvingRecord,
            CalvingRecordWorkflowEvent,
            FeedingRecord,
            LiveAnimalSale,
            LivestockTreatmentRecord,
            ProductionRecord,
            SlaughterAnimal,
            SlaughterRecord,
            WeightRecord,
        )
        from livestock.models import (
            CensusSubmissionItem,
            LivestockGateVerification,
            LivestockOwnershipTransfer,
        )

        seeded_emails = self._seeded_account_emails()
        if email:
            email = email.strip().lower()
            if email not in seeded_emails:
                raise CommandError("--email must exactly match an account generated from this seed's survey list.")
            seeded_emails = {email}

        seeded_users = User.objects.filter(
            role__role_name=Role.UserRoles.FARMER,
            email__in=seeded_emails,
        )
        farmers = Farmer.objects.filter(user__in=seeded_users)
        batches = LivestockBatch.objects.filter(Q(farmer__in=farmers) | Q(created_by__in=seeded_users)).distinct()
        inventories = LivestockInventory.objects.filter(farmer__in=farmers)

        disease_cases = DiseaseCase.objects.filter(
            Q(livestock__in=inventories)
            | Q(batch__in=batches)
            | Q(created_by__in=seeded_users)
            | Q(follow_ups__created_by__in=seeded_users)
        ).distinct()
        mortality_records = MortalityRecord.objects.filter(
            Q(livestock__in=inventories)
            | Q(batch__in=batches)
            | Q(created_by__in=seeded_users)
        ).distinct()
        production_records = ProductionRecord.objects.filter(
            Q(livestock__in=inventories)
            | Q(batch__in=batches)
            | Q(farmer_at_record__in=farmers)
            | Q(created_by__in=seeded_users)
        ).distinct()
        slaughter_records = SlaughterRecord.objects.filter(
            Q(livestock__in=inventories)
            | Q(batch__in=batches)
            | Q(created_by__in=seeded_users)
        ).distinct()
        slaughter_animal_links = SlaughterAnimal.objects.filter(animal__in=inventories)
        calving_records = CalvingRecord.objects.filter(
            Q(dam__in=inventories)
            | Q(offspring_inventory__in=inventories)
            | Q(created_by__in=seeded_users)
        ).distinct()
        sales = LiveAnimalSale.objects.filter(
            Q(livestock__in=inventories)
            | Q(batch__in=batches)
            | Q(created_by__in=seeded_users)
        ).distinct()
        inspections = LivestockInspection.objects.filter(
            Q(shipper__in=farmers)
            | Q(created_by__in=seeded_users)
            | Q(items__inventory__in=inventories)
        ).distinct()
        inspection_clearances = LivestockInspectionClearance.objects.filter(inspection__in=inspections)
        meat_movements = MeatMovementRecord.objects.filter(
            Q(slaughter__in=slaughter_records) | Q(created_by__in=seeded_users)
        )
        inspection_items = LivestockInspectionItem.objects.filter(
            Q(inspection__in=inspections) | Q(inventory__in=inventories)
        ).distinct()
        disease_followups = DiseaseCaseFollowUp.objects.filter(
            Q(case__in=disease_cases) | Q(created_by__in=seeded_users)
        )
        mortality_reviews = MortalityCauseClassificationReview.objects.filter(
            mortality_record__in=mortality_records
        )
        calving_events = CalvingRecordWorkflowEvent.objects.filter(
            Q(calving_record__in=calving_records) | Q(actor__in=seeded_users)
        )
        ownership_transfers = LivestockOwnershipTransfer.objects.filter(
            Q(livestock__in=inventories)
            | Q(previous_owner__in=farmers)
            | Q(new_owner__in=farmers)
            | Q(created_by__in=seeded_users)
        )
        weights = WeightRecord.objects.filter(Q(livestock__in=inventories) | Q(created_by__in=seeded_users))
        dispositions = AnimalDisposition.objects.filter(
            Q(livestock__in=inventories) | Q(created_by__in=seeded_users)
        )
        breeding_records = BreedingRecord.objects.filter(
            Q(dam__in=inventories)
        )
        treatment_records = LivestockTreatmentRecord.objects.filter(livestock__in=inventories)
        feeding_records = FeedingRecord.objects.filter(
            Q(livestock__in=inventories) | Q(batch__in=batches)
        )
        census_items = CensusSubmissionItem.objects.filter(farmer__in=farmers)
        gate_verifications = LivestockGateVerification.objects.filter(
            Q(livestock__in=inventories) | Q(verified_by__in=seeded_users)
        )

        related_counts = {
            "animals": inventories.count(),
            "batches": batches.count(),
            "production records": production_records.count(),
            "disease cases": disease_cases.count(),
            "disease follow-ups": disease_followups.count(),
            "mortality records": mortality_records.count(),
            "mortality reviews": mortality_reviews.count(),
            "slaughter records": slaughter_records.count(),
            "links from shared slaughter reports to these animals": slaughter_animal_links.count(),
            "meat movement records": meat_movements.count(),
            "sales": sales.count(),
            "calving records": calving_records.count(),
            "calving workflow events": calving_events.count(),
            "inspections": inspections.count(),
            "inspection clearances": inspection_clearances.count(),
            "inspection items": inspection_items.count(),
            "ownership transfers": ownership_transfers.count(),
            "weight records": weights.count(),
            "animal dispositions": dispositions.count(),
            "breeding records": breeding_records.count(),
            "treatment records": treatment_records.count(),
            "feeding records": feeding_records.count(),
            "census items": census_items.count(),
            "gate verifications": gate_verifications.count(),
        }
        retained_counts = {"farmer profiles": farmers.count(), "login accounts": seeded_users.count()}

        if dry_run:
            self.stdout.write(
                "Dry run: these linked farm/report records would be removed; no rows were deleted.\n"
                + "\n".join(f"  {label}: {count}" for label, count in related_counts.items())
                + "\nWould keep: "
                + ", ".join(f"{count} {label}" for label, count in retained_counts.items())
            )
            return

        # Remove protected child rows and reports before their parent records.
        inspection_clearances.delete()
        meat_movements.delete()
        inspection_items.delete()
        inspections.delete()

        disease_followups.delete()
        mortality_reviews.delete()
        disease_cases.delete()
        mortality_records.delete()

        calving_events.delete()
        calving_records.delete()

        ownership_transfers.delete()
        production_records.delete()
        slaughter_records.delete()
        slaughter_animal_links.delete()
        sales.delete()
        weights.delete()
        dispositions.delete()
        breeding_records.delete()
        treatment_records.delete()
        feeding_records.delete()
        census_items.delete()
        gate_verifications.delete()

        inventories.delete()
        batches.delete()

        self.stdout.write(
            self.style.SUCCESS(
                "Removed farm and report records linked to this seed's exact farmer accounts. "
                "Login accounts and farmer profiles were kept.\n"
                + "\n".join(f"  {label}: {count}" for label, count in related_counts.items())
                + "\nKept: "
                + ", ".join(f"{count} {label}" for label, count in retained_counts.items())
            )
        )
