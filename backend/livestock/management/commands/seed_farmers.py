from decimal import Decimal
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import User, Role
from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory

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
            help="Deletes only the seeded test farmers, inventories, and users (reverts the seed data).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # -------------------------------------------------------------------
        # REVERT / CLEAN MODE
        # -------------------------------------------------------------------
        if options["clean"]:
            self.stdout.write(self.style.WARNING("🧹 Cleaning up seeded test data..."))
            
            # Find all users with email ending in @smartlivestock.ph
            seeded_users = User.objects.filter(email__endswith="@smartlivestock.ph")
            user_count = seeded_users.count()

            # Delete related livestock inventories and farmer profiles
            farmers = Farmer.objects.filter(user__in=seeded_users)
            farmer_count = farmers.count()

            LivestockInventory.objects.filter(farmer__in=farmers).delete()
            farmers.delete()
            seeded_users.delete()

            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ Cleanup Complete! Reverted {farmer_count} farmers, their inventories, and {user_count} user accounts.\n"
                    f"   (Barangays and Roles were preserved)."
                )
            )
            return

        # -------------------------------------------------------------------
        # SEED MODE
        # -------------------------------------------------------------------
        self.stdout.write(self.style.NOTICE("🚀 Starting database seeding for Padre Garcia farmers..."))

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
                    "account_status": User.AccountStatus.APPROVED,
                },
            )
            if u_created:
                user.set_password("Password123!")
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

            # 7. Create Baseline Livestock Inventory Record
            inventory, inv_created = LivestockInventory.objects.get_or_create(
                farmer=farmer,
                livestock_type=cattle_type,
                defaults={
                    "entry_type": LivestockInventory.EntryType.BATCH,
                    "quantity": heads,
                    "breed": "Native / Crossbred",
                    "sex": "Mixed",
                    "status": LivestockInventory.StatusType.APPROVED,
                    "created_by": user,
                },
            )
            if inv_created:
                created_inventories += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Seeding Complete!\n"
                f"   • Barangays created/verified: {created_barangays} new\n"
                f"   • Farmer accounts & Users: {created_farmers} created\n"
                f"   • Livestock Inventory records: {created_inventories} batches created\n"
                f"   • Default password for all created accounts: Password123!\n\n"
                f"ℹ️  To revert this data anytime, run: python manage.py seed_farmers --clean\n"
            )
        )
