"""Seed irregular synthetic disease and mortality events with monthly coverage."""

from calendar import monthrange
from datetime import date, datetime, time, timedelta
import os
import re
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

# Realistic scenario: localized epidemiology with an outbreak cluster in high-density livestock
# corridors (Hotspot), sporadic seasonal cases in buffer zones (Moderate), and disease-free
# negative monitoring in quiet barangays (Quiet).
BARANGAY_EPIDEMIOLOGY_TIER = {
    # Hotspot Cluster (Outbreak Wave): ~100% of wave
    "Manggas": "HOTSPOT",
    "Pansol": "HOTSPOT",
    "Cawongan": "HOTSPOT",
    "Bawi": "HOTSPOT",

    # Moderate / Buffer Zone (Sporadic surveillance): ~20% of wave
    "Banaba": "MODERATE",
    "San Miguel": "MODERATE",
    "Bukal": "MODERATE",
    "San Felipe": "MODERATE",
    "Maugat West": "MODERATE",

    # Quiet / Clean Zone (Zero or near-zero disease, clean coverage attestations)
    "Banay-Banay": "QUIET",
    "Tamak": "QUIET",
    "Quilo Quilo North": "QUIET",
    "Quilo Quilo South": "QUIET",
    "Castillo": "QUIET",
    "Maugat East": "QUIET",
    "Payapa": "QUIET",
    "Tangob": "QUIET",
    "Poblacion": "QUIET",
}

# Hotspot sequence (40-50 cases over 24 months, with natural epidemic peaks in rainy season)
HOTSPOT_DISEASE_CASES_PER_MONTH = (
    1, 0, 1, 2, 4, 6, 8, 7, 5, 2, 1, 0,  # Year 1 (Outbreak in months 4-8)
    1, 1, 2, 3, 5, 7, 9, 8, 6, 4, 3, 4,  # Year 2 (Outbreak in months 16-21)
    2,                                    # Current month up to today (Month 24)
)
HOTSPOT_MORTALITY_RECORDS_PER_MONTH = (
    1, 0, 1, 1, 2, 3, 4, 3, 2, 1, 1, 0,  # Year 1
    1, 1, 2, 2, 3, 4, 5, 3, 2, 2, 1, 2,  # Year 2
    1,                                    # Current month
)

# Moderate sequence (sporadic 1-2 cases only during wet season, quiet in dry season)
MODERATE_DISEASE_CASES_PER_MONTH = (
    0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0, 0,  # Year 1
    0, 0, 1, 1, 1, 2, 2, 1, 1, 1, 0, 1,  # Year 2
    1,                                    # Current month
)
MODERATE_MORTALITY_RECORDS_PER_MONTH = (
    0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0,  # Year 1
    0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1,  # Year 2
    0,                                    # Current month
)

# Quiet sequence (0 disease cases, and 1 non-infectious mortality in month 14)
QUIET_DISEASE_CASES_PER_MONTH = (0,) * 25
QUIET_MORTALITY_RECORDS_PER_MONTH = (
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0,
)

# Retained aliases for backward compatibility
REALISTIC_DISEASE_CASES_PER_MONTH = HOTSPOT_DISEASE_CASES_PER_MONTH
REALISTIC_MORTALITY_RECORDS_PER_MONTH = HOTSPOT_MORTALITY_RECORDS_PER_MONTH

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

# Realistic CBAT officers and farmers for every barangay in Padre Garcia, Batangas
BARANGAY_CBAT_OFFICERS = {
    "Banaba": {"first_name": "Arvin", "last_name": "Mendoza", "username": "cbat.banaba", "email": "arvin.mendoza.banaba@smartlivestock.ph"},
    "Manggas": {"first_name": "Carmina", "last_name": "Reyes", "username": "cbat.manggas", "email": "carmina.reyes.manggas@smartlivestock.ph"},
    "Pansol": {"first_name": "Dennis", "last_name": "Castillo", "username": "cbat.pansol", "email": "dennis.castillo.pansol@smartlivestock.ph"},
    "Cawongan": {"first_name": "Elena", "last_name": "Ramos", "username": "cbat.cawongan", "email": "elena.ramos.cawongan@smartlivestock.ph"},
    "Banay-Banay": {"first_name": "Fernando", "last_name": "Garcia", "username": "cbat.banaybanay", "email": "fernando.garcia.banaybanay@smartlivestock.ph"},
    "Bawi": {"first_name": "Grace", "last_name": "Villanueva", "username": "cbat.bawi", "email": "grace.villanueva.bawi@smartlivestock.ph"},
    "San Miguel": {"first_name": "Hector", "last_name": "Navarro", "username": "cbat.sanmiguel", "email": "hector.navarro.sanmiguel@smartlivestock.ph"},
    "Bukal": {"first_name": "Irene", "last_name": "Mercado", "username": "cbat.bukal", "email": "irene.mercado.bukal@smartlivestock.ph"},
    "San Felipe": {"first_name": "Joel", "last_name": "Magpantay", "username": "cbat.sanfelipe", "email": "joel.magpantay.sanfelipe@smartlivestock.ph"},
    "Maugat West": {"first_name": "Katherine", "last_name": "Dimaculangan", "username": "cbat.maugatwest", "email": "katherine.dimaculangan.maugatwest@smartlivestock.ph"},
    "Tamak": {"first_name": "Leonardo", "last_name": "Recto", "username": "cbat.tamak", "email": "leonardo.recto.tamak@smartlivestock.ph"},
    "Quilo Quilo North": {"first_name": "Maricel", "last_name": "Silva", "username": "cbat.quiloquilonorth", "email": "maricel.silva.qqnorth@smartlivestock.ph"},
    "Quilo Quilo South": {"first_name": "Noel", "last_name": "Malabanan", "username": "cbat.quiloquilosouth", "email": "noel.malabanan.qqsouth@smartlivestock.ph"},
    "Castillo": {"first_name": "Olivia", "last_name": "Marasigan", "username": "cbat.castillo", "email": "olivia.marasigan.castillo@smartlivestock.ph"},
    "Maugat East": {"first_name": "Patrick", "last_name": "Ilagan", "username": "cbat.maugateast", "email": "patrick.ilagan.maugateast@smartlivestock.ph"},
    "Payapa": {"first_name": "Quirino", "last_name": "Lanto", "username": "cbat.payapa", "email": "quirino.lanto.payapa@smartlivestock.ph"},
    "Tangob": {"first_name": "Rowena", "last_name": "Atienza", "username": "cbat.tangob", "email": "rowena.atienza.tangob@smartlivestock.ph"},
    "Poblacion": {"first_name": "Samuel", "last_name": "De Castro", "username": "cbat.poblacion", "email": "samuel.decastro.poblacion@smartlivestock.ph"},
}

BARANGAY_FARMERS = {
    "Banaba": [
        {"first_name": "Danilo", "last_name": "Hernandez", "username": "danilo.hernandez.banaba", "email": "danilo.hernandez.banaba@smartlivestock.ph", "address": "Sitio Ilaya, Banaba, Padre Garcia, Batangas"},
        {"first_name": "Maria Theresa", "last_name": "Santos", "username": "mariatheresa.santos.banaba", "email": "mariatheresa.santos.banaba@smartlivestock.ph", "address": "Purok 2, Banaba, Padre Garcia, Batangas"},
    ],
    "Manggas": [
        {"first_name": "Eduardo", "last_name": "Guinto", "username": "eduardo.guinto.manggas", "email": "eduardo.guinto.manggas@smartlivestock.ph", "address": "Sitio Kanluran, Manggas, Padre Garcia, Batangas"},
        {"first_name": "Corazon", "last_name": "Alcantara", "username": "corazon.alcantara.manggas", "email": "corazon.alcantara.manggas@smartlivestock.ph", "address": "Purok 3, Manggas, Padre Garcia, Batangas"},
    ],
    "Pansol": [
        {"first_name": "Leandro", "last_name": "Linatoc", "username": "leandro.linatoc.pansol", "email": "leandro.linatoc.pansol@smartlivestock.ph", "address": "Sitio Centro, Pansol, Padre Garcia, Batangas"},
        {"first_name": "Alejandro", "last_name": "Lanto", "username": "alejandro.lanto.pansol", "email": "alejandro.lanto.pansol@smartlivestock.ph", "address": "Purok 1, Pansol, Padre Garcia, Batangas"},
    ],
    "Cawongan": [
        {"first_name": "Olga", "last_name": "Escueta", "username": "olga.escueta.cawongan", "email": "olga.escueta.cawongan@smartlivestock.ph", "address": "Purok 4, Cawongan, Padre Garcia, Batangas"},
        {"first_name": "Larry", "last_name": "Vergara", "username": "larry.vergara.cawongan", "email": "larry.vergara.cawongan@smartlivestock.ph", "address": "Sitio Silangan, Cawongan, Padre Garcia, Batangas"},
    ],
    "Banay-Banay": [
        {"first_name": "Nelson", "last_name": "Andal", "username": "nelson.andal.banaybanay", "email": "nelson.andal.banaybanay@smartlivestock.ph", "address": "Purok 2, Banay-Banay, Padre Garcia, Batangas"},
        {"first_name": "Virgilio", "last_name": "Moster", "username": "virgilio.moster.banaybanay", "email": "virgilio.moster.banaybanay@smartlivestock.ph", "address": "Sitio Ilaya, Banay-Banay, Padre Garcia, Batangas"},
    ],
    "Bawi": [
        {"first_name": "Emma", "last_name": "Buquir", "username": "emma.buquir.bawi", "email": "emma.buquir.bawi@smartlivestock.ph", "address": "Sitio Ibaba, Bawi, Padre Garcia, Batangas"},
        {"first_name": "Andreo", "last_name": "Villanueva", "username": "andreo.villanueva.bawi", "email": "andreo.villanueva.bawi@smartlivestock.ph", "address": "Purok 3, Bawi, Padre Garcia, Batangas"},
    ],
    "San Miguel": [
        {"first_name": "Fred", "last_name": "Calingasan", "username": "fred.calingasan.sanmiguel", "email": "fred.calingasan.sanmiguel@smartlivestock.ph", "address": "Purok 1, San Miguel, Padre Garcia, Batangas"},
        {"first_name": "Briccio", "last_name": "Dimaano", "username": "briccio.dimaano.sanmiguel", "email": "briccio.dimaano.sanmiguel@smartlivestock.ph", "address": "Sitio Gitna, San Miguel, Padre Garcia, Batangas"},
    ],
    "Bukal": [
        {"first_name": "Esmeraldo", "last_name": "Caraan", "username": "esmeraldo.caraan.bukal", "email": "esmeraldo.caraan.bukal@smartlivestock.ph", "address": "Sitio Bukal, Bukal, Padre Garcia, Batangas"},
        {"first_name": "Zaldy", "last_name": "Fajardo", "username": "zaldy.fajardo.bukal", "email": "zaldy.fajardo.bukal@smartlivestock.ph", "address": "Purok 2, Bukal, Padre Garcia, Batangas"},
    ],
    "San Felipe": [
        {"first_name": "Venistiano", "last_name": "Hernandez", "username": "venistiano.hernandez.sanfelipe", "email": "venistiano.hernandez.sanfelipe@smartlivestock.ph", "address": "Purok 3, San Felipe, Padre Garcia, Batangas"},
        {"first_name": "Amelita", "last_name": "Tapay", "username": "amelita.tapay.sanfelipe", "email": "amelita.tapay.sanfelipe@smartlivestock.ph", "address": "Sitio Ilaya, San Felipe, Padre Garcia, Batangas"},
    ],
    "Maugat West": [
        {"first_name": "Rene", "last_name": "Rena", "username": "rene.rena.maugatwest", "email": "rene.rena.maugatwest@smartlivestock.ph", "address": "Purok 1, Maugat West, Padre Garcia, Batangas"},
        {"first_name": "Victor", "last_name": "Valencia", "username": "victor.valencia.maugatwest", "email": "victor.valencia.maugatwest@smartlivestock.ph", "address": "Sitio Centro, Maugat West, Padre Garcia, Batangas"},
    ],
    "Tamak": [
        {"first_name": "Ruelan", "last_name": "Gonzales", "username": "ruelan.gonzales.tamak", "email": "ruelan.gonzales.tamak@smartlivestock.ph", "address": "Sitio Bundok, Tamak, Padre Garcia, Batangas"},
        {"first_name": "Rene", "last_name": "Maala", "username": "rene.maala.tamak", "email": "rene.maala.tamak@smartlivestock.ph", "address": "Purok 2, Tamak, Padre Garcia, Batangas"},
    ],
    "Quilo Quilo North": [
        {"first_name": "Rey Melchor", "last_name": "Casanova", "username": "reymelchor.casanova.qqnorth", "email": "reymelchor.casanova.qqnorth@smartlivestock.ph", "address": "Purok 4, Quilo Quilo North, Padre Garcia, Batangas"},
        {"first_name": "Alberto", "last_name": "Gutierrez", "username": "alberto.gutierrez.qqnorth", "email": "alberto.gutierrez.qqnorth@smartlivestock.ph", "address": "Sitio Ilaya, Quilo Quilo North, Padre Garcia, Batangas"},
    ],
    "Quilo Quilo South": [
        {"first_name": "Rodolfo", "last_name": "Jareno", "username": "rodolfo.jareno.qqsouth", "email": "rodolfo.jareno.qqsouth@smartlivestock.ph", "address": "Purok 1, Quilo Quilo South, Padre Garcia, Batangas"},
        {"first_name": "Cardo", "last_name": "Masalunga", "username": "cardo.masalunga.qqsouth", "email": "cardo.masalunga.qqsouth@smartlivestock.ph", "address": "Sitio Centro, Quilo Quilo South, Padre Garcia, Batangas"},
    ],
    "Castillo": [
        {"first_name": "Bernie", "last_name": "Gustillo", "username": "bernie.gustillo.castillo", "email": "bernie.gustillo.castillo@smartlivestock.ph", "address": "Purok 3, Castillo, Padre Garcia, Batangas"},
        {"first_name": "Maximo", "last_name": "Valencia", "username": "maximo.valencia.castillo", "email": "maximo.valencia.castillo@smartlivestock.ph", "address": "Sitio Tabing-Ilog, Castillo, Padre Garcia, Batangas"},
    ],
    "Maugat East": [
        {"first_name": "Cristeta", "last_name": "Aranes", "username": "cristeta.aranes.maugateast", "email": "cristeta.aranes.maugateast@smartlivestock.ph", "address": "Purok 2, Maugat East, Padre Garcia, Batangas"},
        {"first_name": "Felix", "last_name": "Renoza", "username": "felix.renoza.maugateast", "email": "felix.renoza.maugateast@smartlivestock.ph", "address": "Sitio Kanluran, Maugat East, Padre Garcia, Batangas"},
    ],
    "Payapa": [
        {"first_name": "Violy", "last_name": "Olan", "username": "violy.olan.payapa", "email": "violy.olan.payapa@smartlivestock.ph", "address": "Sitio Centro, Payapa, Padre Garcia, Batangas"},
        {"first_name": "Jun", "last_name": "Mangundayao", "username": "jun.mangundayao.payapa", "email": "jun.mangundayao.payapa@smartlivestock.ph", "address": "Purok 1, Payapa, Padre Garcia, Batangas"},
    ],
    "Tangob": [
        {"first_name": "Ogie", "last_name": "Din", "username": "ogie.din.tangob", "email": "ogie.din.tangob@smartlivestock.ph", "address": "Purok 2, Tangob, Padre Garcia, Batangas"},
        {"first_name": "Cornelio", "last_name": "Carpio", "username": "cornelio.carpio.tangob", "email": "cornelio.carpio.tangob@smartlivestock.ph", "address": "Sitio Ilaya, Tangob, Padre Garcia, Batangas"},
    ],
    "Poblacion": [
        {"first_name": "Manuel", "last_name": "Bautista", "username": "manuel.bautista.poblacion", "email": "manuel.bautista.poblacion@smartlivestock.ph", "address": "Rizal Street, Poblacion, Padre Garcia, Batangas"},
        {"first_name": "Luzviminda", "last_name": "Dela Cruz", "username": "luzviminda.delacruz.poblacion", "email": "luzviminda.delacruz.poblacion@smartlivestock.ph", "address": "Mabini Street, Poblacion, Padre Garcia, Batangas"},
    ],
}


def _get_cbat_spec_for_barangay(barangay):
    name = barangay.barangay_name
    if name in BARANGAY_CBAT_OFFICERS:
        return BARANGAY_CBAT_OFFICERS[name]
    slug = re.sub(r"[^a-z0-9]", "", name.lower())
    return {
        "first_name": "Barangay",
        "last_name": f"Officer {name}",
        "username": f"cbat.{slug}",
        "email": f"cbat.{slug}@smartlivestock.ph",
    }


def _get_farmer_specs_for_barangay(barangay):
    name = barangay.barangay_name
    if name in BARANGAY_FARMERS:
        return BARANGAY_FARMERS[name]
    slug = re.sub(r"[^a-z0-9]", "", name.lower())
    return [
        {
            "first_name": "Farmer",
            "last_name": f"One {name}",
            "username": f"farmer1.{slug}",
            "email": f"farmer1.{slug}@smartlivestock.ph",
            "address": f"Purok 1, {name}, Padre Garcia, Batangas",
        },
        {
            "first_name": "Farmer",
            "last_name": f"Two {name}",
            "username": f"farmer2.{slug}",
            "email": f"farmer2.{slug}@smartlivestock.ph",
            "address": f"Purok 2, {name}, Padre Garcia, Batangas",
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
        barangay = plan["barangay"]
        cbat_spec = _get_cbat_spec_for_barangay(barangay)
        farmer_specs = _get_farmer_specs_for_barangay(barangay)

        farmers = []
        if plan["farmer_user"]:
            farmers.append({
                "user": plan["farmer_user"],
                "farmer": plan["farmer_profile"],
                "mortality_animals": [],
            })
        else:
            for idx, suffix in enumerate(("a", "b")):
                spec = farmer_specs[idx] if idx < len(farmer_specs) else farmer_specs[0]
                user = self._create_demo_user(
                    key=f"farmer-{suffix}",
                    email=spec["email"],
                    username=spec["username"],
                    role=plan["roles"][Role.UserRoles.FARMER],
                    assigned_barangay=barangay,
                    first_name=spec["first_name"],
                    last_name=spec["last_name"],
                )
                farmer = Farmer.objects.create(
                    user=user,
                    barangay=barangay,
                    address=spec["address"],
                )
                self._track(f"farmer-{suffix}:profile", "farmer", farmer)
                farmers.append({"user": user, "farmer": farmer, "mortality_animals": []})

        verifier = plan["verifier"] or self._create_demo_user(
            key="cbat-verifier",
            email=cbat_spec["email"],
            username=cbat_spec["username"],
            role=plan["roles"][Role.UserRoles.CBAT],
            assigned_barangay=barangay,
            first_name=cbat_spec["first_name"],
            last_name=cbat_spec["last_name"],
        )

        if scenario == "realistic":
            brgy_name = barangay.barangay_name
            tier = BARANGAY_EPIDEMIOLOGY_TIER.get(brgy_name, "QUIET")
            # If a specific farmer account was provided for this barangay, ensure it has activity
            if plan["farmer_profile"] and plan["farmer_profile"].barangay_id == barangay.pk and tier == "QUIET":
                tier = "MODERATE"

            if tier == "HOTSPOT":
                disease_counts_seq = HOTSPOT_DISEASE_CASES_PER_MONTH
                mortality_counts_seq = HOTSPOT_MORTALITY_RECORDS_PER_MONTH
            elif tier == "MODERATE":
                disease_counts_seq = MODERATE_DISEASE_CASES_PER_MONTH
                mortality_counts_seq = MODERATE_MORTALITY_RECORDS_PER_MONTH
            else:
                disease_counts_seq = QUIET_DISEASE_CASES_PER_MONTH
                mortality_counts_seq = QUIET_MORTALITY_RECORDS_PER_MONTH
        else:
            tier = "HOTSPOT"
            disease_counts_seq = DISEASE_CASES_PER_MONTH
            mortality_counts_seq = MORTALITY_RECORDS_PER_MONTH

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
                else:
                    d_name = "DEMO synthetic cattle illness observation (not a diagnosis)"
                    d_symptoms = []

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
                self._seed_disease_timeline(
                    case=case,
                    key=f"disease:{month_end:%Y-%m}:{event_index + 1}",
                    event_index=event_index,
                    month_index=month_index,
                    is_low_or_declining=is_low_or_declining,
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
                    if tier == "QUIET":
                        quiet_profiles = [p for p in REALISTIC_MORTALITY_PROFILES if p["category"] != MortalityCauseClassificationReview.Category.SUSPECTED_INFECTIOUS]
                        m_profile = quiet_profiles[event_index % len(quiet_profiles)]
                    else:
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
                        prior_case.clinical_status = DiseaseCase.ClinicalStatus.CLOSED
                        prior_case.save(update_fields=["clinical_status"])
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

    def _create_demo_user(
        self,
        *,
        key,
        email,
        username,
        role,
        assigned_barangay=None,
        first_name="",
        last_name="",
    ):
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username=username).exists():
            raise CommandError(
                f"User identity {email} or username {username} already exists without this seed's ownership; refusing to reuse it."
            )
        default_password = os.environ.get("SMARTLIVESTOCK_DEMO_PASSWORD", "Password123!")
        user = User.objects.create_user(
            username=username,
            email=email,
            password=default_password,
            role=role,
            first_name=first_name,
            last_name=last_name,
            account_status=User.AccountStatus.APPROVED,
            is_active=True,
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
            breed="Native / Brahman Cross",
            sex="Female",
            status=LivestockInventory.StatusType.APPROVED,
            operational_status=LivestockInventory.OperationalStatus.ACTIVE,
            created_by=owner["user"],
            reviewed_by=reviewer,
            reviewed_at=reviewed_time,
            review_remarks=f"{SEED_MARKER_DISEASE} Registered livestock inventory.",
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

    def _seed_disease_timeline(self, *, case, key, event_index, month_index, is_low_or_declining, reviewer):
        """Record realistic clinical follow-ups and progression over time:
        - Initial status: OPEN
        - Day 7-9: Intermediate FARMER_UPDATE follow-up
        - Day 21 (RECOVERED) or Day 42 (CLOSED): Resolution follow-up
        - Recent cases (last ~25 days) remain OPEN awaiting outcome.
        """
        record_date = case.record_date
        today = timezone.localdate()

        # Start as OPEN awaiting resolution
        case.clinical_status = DiseaseCase.ClinicalStatus.OPEN
        case.save(update_fields=["clinical_status"])

        # 1. Interim Field Follow-Up (~7-9 days after initial report)
        update_day = record_date + timedelta(days=7 + (event_index % 3))
        if update_day <= today:
            interim_notes = [
                "Farmer follow-up: Medication administered. Animal isolated in shaded pen; fever reducing and appetite returning.",
                "Field check: Swelling localized and inflammation subsiding under treatment. Animal resting comfortably.",
                "Farmer follow-up: Respiratory rate improving; nasal discharge cleared after supportive antibiotic care.",
                "Field check: Rumination resumed, animal drinking water and standing actively. Continuing prescribed therapy.",
            ]
            interim_fu = DiseaseCaseFollowUp.objects.create(
                case=case,
                event_type=DiseaseCaseFollowUp.EventType.FARMER_UPDATE,
                observed_on=update_day,
                created_by=reviewer,
                notes=f"{SEED_MARKER_DISEASE} {interim_notes[(month_index + event_index) % len(interim_notes)]}",
            )
            self._track(f"{key}:fu:update", "follow_up", interim_fu)
            DiseaseCaseFollowUp.objects.filter(pk=interim_fu.pk).update(
                created_at=demo_time(update_day, 10),
            )

        # 2. Determine Outcome
        if is_low_or_declining:
            outcome = DiseaseCase.ClinicalStatus.RECOVERED if (event_index % 5 < 4) else DiseaseCase.ClinicalStatus.CLOSED
        else:
            mod = event_index % 6
            if mod in (0, 1, 2, 3):
                outcome = DiseaseCase.ClinicalStatus.RECOVERED
            elif mod == 4:
                outcome = DiseaseCase.ClinicalStatus.CLOSED
            else:
                outcome = DiseaseCase.ClinicalStatus.OPEN

        if outcome == DiseaseCase.ClinicalStatus.OPEN:
            return

        days_to_resolve = 21 if outcome == DiseaseCase.ClinicalStatus.RECOVERED else 42
        resolved_on = record_date + timedelta(days=days_to_resolve)

        if resolved_on > today:
            # Resolution date is in the future; case remains actively OPEN
            return

        if outcome == DiseaseCase.ClinicalStatus.RECOVERED:
            recovery_notes = [
                "Full clinical recovery confirmed: Animal has resumed normal grazing and rumination. Temperature 38.6°C normal.",
                "Clinical recovery verified by field inspection: Respiratory distress resolved, vital signs stable, discharged from monitoring.",
                "Recovery confirmed: Udder inflammation completely subsided, milk appearance and yield restored to baseline.",
                "Recovery confirmed: Oral and foot lesions healed cleanly, normal gait restored, no lingering clinical signs.",
            ]
            resolution_notes = recovery_notes[(month_index + event_index) % len(recovery_notes)]
            event_type = DiseaseCaseFollowUp.EventType.RECOVERED
        else:
            closed_notes = [
                "Case officially closed: Standard 30-day post-treatment observation period completed without relapse.",
                "Case closed: Animal certified symptom-free by agricultural technologist. Surveillance record finalized.",
                "Case closed: Full resolution of clinical symptoms confirmed upon final veterinary follow-up.",
            ]
            resolution_notes = closed_notes[(month_index + event_index) % len(closed_notes)]
            event_type = DiseaseCaseFollowUp.EventType.CLOSED

        res_fu = DiseaseCaseFollowUp.objects.create(
            case=case,
            event_type=event_type,
            observed_on=resolved_on,
            created_by=reviewer,
            notes=f"{SEED_MARKER_DISEASE} Follow-up evaluation: {resolution_notes}",
        )
        self._track(f"{key}:fu:resolution", "follow_up", res_fu)
        DiseaseCaseFollowUp.objects.filter(pk=res_fu.pk).update(
            created_at=demo_time(resolved_on, 16),
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
        verify_remark = f"{marker} Field verification completed by CBAT officer."
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
            "verificationMode": "FIELD_VERIFICATION",
            "timelineMode": "SIMULATED_HISTORICAL_AVAILABILITY",
            "confirmedSymptoms": symptoms or [],
        }
        record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_remarks", "inspection_details"])

        approve_time = demo_time(record.record_date, 17)
        approve_remark = f"{marker} Approved by MAO; {label}."
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
            inspection_details__verificationMode__in=["SYNTHETIC_DEMO", "FIELD_VERIFICATION"],
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
                inspection_details__verificationMode__in=["SYNTHETIC_DEMO", "FIELD_VERIFICATION"],
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

        # Recover reviews created interactively in the staff UI on owned mortality records
        for record_marker in SurveillanceDemoOwnership.objects.filter(
            identifier__startswith=PREFIX,
            object_type="mortality",
        ):
            for review in MortalityCauseClassificationReview.objects.filter(
                mortality_record_id=record_marker.object_id
            ):
                if not SurveillanceDemoOwnership.objects.filter(
                    object_type="mortality_review",
                    object_id=review.pk,
                ).exists():
                    self._track(
                        f"mortality_review:{record_marker.object_id}:{review.pk}",
                        "mortality_review",
                        review,
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
