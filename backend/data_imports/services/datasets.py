from decimal import Decimal
from typing import Dict, List, Any, Type
from django.db import models

from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory
from production.models import ProductionRecord, SlaughterRecord, LiveAnimalSale
from diseases.models import DiseaseCase, MortalityRecord


class BaseDatasetConfig:
    code: str
    label: str
    description: str
    model_class: Type[models.Model]
    required_fields: List[str]
    field_aliases: Dict[str, List[str]]
    sample_rows: List[Dict[str, Any]]
    column_descriptions: Dict[str, str]


class LivestockInventoryDataset(BaseDatasetConfig):
    code = "livestock_inventory"
    label = "Livestock Inventory"
    description = "Individual and herd livestock head registrations, ear tags, breeds, and health records."
    model_class = LivestockInventory
    required_fields = ["farmer", "barangay", "livestock_type"]
    field_aliases = {
        "farmer": ["farmer", "farmer_name", "farmer name", "owner", "owner_name", "farmer_id", "farmer id"],
        "barangay": ["barangay", "barangay_name", "barangay name", "location", "brgy"],
        # Keep `species` as an alias so existing inventory spreadsheets remain importable.
        "livestock_type": ["livestock_type", "livestock type", "species", "animal_type", "animal type", "type"],
        "tag_number": ["tag_number", "tag number", "tag", "ear_tag", "ear tag", "animal_id", "animal id"],
        "entry_type": ["entry_type", "entry type", "type_of_entry"],
        "quantity": ["quantity", "animal count", "animal_count", "count", "head_count", "heads", "qty"],
        "breed": ["breed", "animal_breed"],
        "sex": ["sex", "gender"],
        "weight": ["weight", "live_weight", "weight_kg", "weight (kg)"],
        "last_vaccination_date": ["last_vaccination_date", "vaccination_date", "vaccination date", "last vaccinated"],
    }
    column_descriptions = {
        "farmer": "Farmer full name, username, or registered ID.",
        "barangay": "Official Padre Garcia barangay name (e.g. Manggas, Poblacion).",
        "livestock_type": "Livestock type (e.g. Cattle, Swine, Goat, Carabao, Sheep).",
        "tag_number": "Unique ear tag / identification code (e.g. PG-CAT-00101).",
        "entry_type": "'INDIVIDUAL' (default) or 'BATCH'.",
        "quantity": "Animal head count (must be 1 for INDIVIDUAL).",
        "breed": "Breed name (e.g. Brahman, Native, Anglo-Nubian).",
        "sex": "'MALE' or 'FEMALE'.",
        "weight": "Live animal weight in kilograms (e.g. 385.50).",
        "last_vaccination_date": "Date of latest vaccination (YYYY-MM-DD).",
    }
    sample_rows = [
        {
            "farmer": "Juan Dela Cruz",
            "barangay": "Manggas",
            "livestock_type": "Cattle",
            "tag_number": "PG-CAT-00101",
            "entry_type": "INDIVIDUAL",
            "quantity": 1,
            "breed": "Brahman",
            "sex": "MALE",
            "weight": 420.50,
            "last_vaccination_date": "2026-03-15",
        },
        {
            "farmer": "Maria Santos",
            "barangay": "Banaba",
            "livestock_type": "Swine",
            "tag_number": "PG-SWN-00204",
            "entry_type": "INDIVIDUAL",
            "quantity": 1,
            "breed": "Landrace",
            "sex": "FEMALE",
            "weight": 88.00,
            "last_vaccination_date": "2026-03-20",
        },
    ]


class ProductionRecordDataset(BaseDatasetConfig):
    code = "production"
    label = "Production Records"
    description = "Daily and seasonal livestock yield (milk in liters, eggs in pieces, wool in kg)."
    model_class = ProductionRecord
    required_fields = ["farmer", "barangay", "production_type", "quantity", "unit", "record_date"]
    field_aliases = {
        "farmer": ["farmer", "farmer_name", "farmer name", "owner", "owner_name", "farmer_id"],
        "barangay": ["barangay", "barangay_name", "barangay name", "location", "brgy"],
        "production_type": ["production_type", "production type", "commodity", "product", "type"],
        "quantity": ["quantity", "volume", "amount", "yield", "output", "qty"],
        "unit": ["unit", "unit_of_measure", "uom"],
        "record_date": ["record_date", "record date", "date", "date_recorded", "production_date"],
        "tag_number": ["tag_number", "tag number", "tag", "animal_tag"],
        "notes": ["notes", "remarks", "comments"],
    }
    column_descriptions = {
        "farmer": "Farmer full name, username, or registered ID.",
        "barangay": "Official Padre Garcia barangay name.",
        "production_type": "'MILK', 'MEAT', 'EGGS', or 'WOOL'.",
        "quantity": "Produced volume or amount (numeric).",
        "unit": "'LITERS' (milk), 'PIECES' (eggs), or 'KILOGRAMS' (meat/wool).",
        "record_date": "Production date (YYYY-MM-DD).",
        "tag_number": "Optional ear tag of individual producer animal.",
        "notes": "Optional notes or remarks.",
    }
    sample_rows = [
        {
            "farmer": "Juan Dela Cruz",
            "barangay": "Manggas",
            "production_type": "MILK",
            "quantity": 25.50,
            "unit": "LITERS",
            "record_date": "2026-04-01",
            "tag_number": "PG-CAT-00101",
            "notes": "Morning and afternoon milking session.",
        },
        {
            "farmer": "Maria Santos",
            "barangay": "Banaba",
            "production_type": "EGGS",
            "quantity": 180,
            "unit": "PIECES",
            "record_date": "2026-04-02",
            "tag_number": "",
            "notes": "Free-range daily egg collection.",
        },
    ]


class DiseaseCaseDataset(BaseDatasetConfig):
    code = "disease"
    label = "Disease Reports"
    description = "Field observations and clinical veterinary reports of livestock morbidity and outbreaks."
    model_class = DiseaseCase
    required_fields = ["farmer", "barangay", "disease_name", "affected_count", "record_date"]
    field_aliases = {
        "farmer": ["farmer", "farmer_name", "farmer name", "owner", "owner_name", "farmer_id"],
        "barangay": ["barangay", "barangay_name", "barangay name", "location", "brgy"],
        "disease_name": ["disease_name", "disease name", "disease", "illness", "diagnosis", "condition", "name"],
        "affected_count": ["affected_count", "affected count", "sick_count", "heads_affected", "number_affected", "affected"],
        "record_date": ["record_date", "record date", "date", "date_reported", "observation_date"],
        "tag_number": ["tag_number", "tag number", "tag", "animal_tag"],
    }
    column_descriptions = {
        "farmer": "Farmer full name, username, or registered ID.",
        "barangay": "Official Padre Garcia barangay name.",
        "disease_name": "Name of diagnosed illness or observed syndrome.",
        "affected_count": "Number of animals showing symptoms (>= 1).",
        "record_date": "Date of observation / reporting (YYYY-MM-DD).",
        "tag_number": "Optional ear tag of affected animal if individual.",
    }
    sample_rows = [
        {
            "farmer": "Juan Dela Cruz",
            "barangay": "Manggas",
            "disease_name": "Foot and Mouth Disease",
            "affected_count": 2,
            "record_date": "2026-04-05",
            "tag_number": "PG-CAT-00101",
        },
        {
            "farmer": "Pedro Reyes",
            "barangay": "San Miguel",
            "disease_name": "Mastitis",
            "affected_count": 1,
            "record_date": "2026-04-08",
            "tag_number": "",
        },
    ]


class MortalityRecordDataset(BaseDatasetConfig):
    code = "mortality"
    label = "Mortality Records"
    description = "Livestock casualty logs, deaths, and post-mortem causes."
    model_class = MortalityRecord
    required_fields = ["farmer", "barangay", "cause", "death_count", "record_date"]
    field_aliases = {
        "farmer": ["farmer", "farmer_name", "farmer name", "owner", "owner_name", "farmer_id"],
        "barangay": ["barangay", "barangay_name", "barangay name", "location", "brgy"],
        "cause": ["cause", "cause_of_death", "cause of death", "reason"],
        "death_count": ["death_count", "death count", "deaths", "number_dead", "casualties", "count"],
        "record_date": ["record_date", "record date", "date", "date_of_death", "date of death"],
        "tag_number": ["tag_number", "tag number", "tag", "animal_tag"],
    }
    column_descriptions = {
        "farmer": "Farmer full name, username, or registered ID.",
        "barangay": "Official Padre Garcia barangay name.",
        "cause": "Suspected or verified cause of death.",
        "death_count": "Number of deceased animals (>= 1).",
        "record_date": "Date of death (YYYY-MM-DD).",
        "tag_number": "Optional ear tag of deceased animal.",
    }
    sample_rows = [
        {
            "farmer": "Juan Dela Cruz",
            "barangay": "Manggas",
            "cause": "Heat Stress",
            "death_count": 1,
            "record_date": "2026-04-10",
            "tag_number": "PG-CAT-00101",
        },
        {
            "farmer": "Maria Santos",
            "barangay": "Banaba",
            "cause": "Unknown (Needs Vet Inspection)",
            "death_count": 2,
            "record_date": "2026-04-12",
            "tag_number": "",
        },
    ]


class SlaughterRecordDataset(BaseDatasetConfig):
    code = "slaughter"
    label = "Slaughter Records"
    description = "Municipal abattoir and authorized on-farm slaughter events, including slaughter quantities and carcass yields."
    model_class = SlaughterRecord
    required_fields = ["barangay", "livestock_type", "quantity", "record_date"]
    field_aliases = {
        "barangay": ["barangay", "barangay_name", "barangay name", "location", "brgy"],
        "livestock_type": ["livestock_type", "livestock type", "species", "animal_type", "animal type", "type"],
        "quantity": ["quantity", "heads", "animal count", "number_slaughtered", "count", "qty"],
        "carcass_weight": ["carcass_weight", "carcass weight", "meat_yield", "meat_yield_kg", "weight_kg"],
        "record_date": ["record_date", "record date", "date", "slaughter_date", "date_slaughtered"],
        "farmer": ["farmer", "farmer_name", "farmer name", "owner", "owner_name"],
    }
    column_descriptions = {
        "barangay": "Official Padre Garcia barangay name.",
        "livestock_type": "Livestock type slaughtered (e.g. Swine, Cattle).",
        "quantity": "Number of animals butchered (>= 1).",
        "carcass_weight": "Total dressed carcass meat in kilograms.",
        "record_date": "Slaughter date (YYYY-MM-DD).",
        "farmer": "Optional farmer or livestock owner name.",
    }
    sample_rows = [
        {
            "barangay": "Poblacion",
            "livestock_type": "Swine",
            "quantity": 12,
            "carcass_weight": 860.50,
            "record_date": "2026-04-15",
            "farmer": "Municipal Abattoir",
        },
        {
            "barangay": "Manggas",
            "livestock_type": "Cattle",
            "quantity": 2,
            "carcass_weight": 520.00,
            "record_date": "2026-04-16",
            "farmer": "Juan Dela Cruz",
        },
    ]


class LiveAnimalSaleDataset(BaseDatasetConfig):
    code = "auction"
    label = "Auction / Live Animal Sales"
    description = "Padre Garcia Livestock Auction Market transactions and off-farm live sales."
    model_class = LiveAnimalSale
    required_fields = ["farmer", "barangay", "quantity", "total_price", "sale_date"]
    field_aliases = {
        "farmer": ["farmer", "farmer_name", "farmer name", "seller", "seller_name", "owner"],
        "barangay": ["barangay", "barangay_name", "barangay name", "location", "brgy"],
        "quantity": ["quantity", "heads", "animal count", "head_count", "qty"],
        "sale_method": ["sale_method", "sale method", "method"],
        "total_live_weight": ["total_live_weight", "live_weight", "weight_kg", "total weight"],
        "price_per_head": ["price_per_head", "price per head", "unit_price"],
        "total_price": ["total_price", "total price", "price", "amount", "total_amount"],
        "sale_date": ["sale_date", "sale date", "date", "date_sold", "transaction_date"],
        "destination": ["destination", "buyer", "buyer_destination", "target_market"],
        "purpose": ["purpose", "sale_purpose", "purpose_of_sale"],
    }
    column_descriptions = {
        "farmer": "Farmer / seller name or registered ID.",
        "barangay": "Official Padre Garcia barangay name.",
        "quantity": "Number of live animals sold (>= 1).",
        "sale_method": "'MATA-MATA', 'WEIGHING', or 'OTHER'.",
        "total_live_weight": "Optional total live weight in kilograms.",
        "price_per_head": "Optional price per head in PHP.",
        "total_price": "Total transaction price in PHP (>= 0).",
        "sale_date": "Sale transaction date (YYYY-MM-DD).",
        "destination": "Optional buyer name or destination municipality.",
        "purpose": "'BREEDING', 'FATTENING', 'SLAUGHTER', or 'UNKNOWN'.",
    }
    sample_rows = [
        {
            "farmer": "Juan Dela Cruz",
            "barangay": "Manggas",
            "quantity": 3,
            "sale_method": "WEIGHING",
            "total_live_weight": 1150.00,
            "price_per_head": 45000.00,
            "total_price": 135000.00,
            "sale_date": "2026-04-18",
            "destination": "San Jose, Batangas",
            "purpose": "FATTENING",
        },
        {
            "farmer": "Maria Santos",
            "barangay": "Banaba",
            "quantity": 5,
            "sale_method": "MATA-MATA",
            "total_live_weight": 420.00,
            "price_per_head": 8500.00,
            "total_price": 42500.00,
            "sale_date": "2026-04-19",
            "destination": "Lipa City",
            "purpose": "SLAUGHTER",
        },
    ]


DATASET_REGISTRY: Dict[str, BaseDatasetConfig] = {
    LivestockInventoryDataset.code: LivestockInventoryDataset(),
    ProductionRecordDataset.code: ProductionRecordDataset(),
    DiseaseCaseDataset.code: DiseaseCaseDataset(),
    MortalityRecordDataset.code: MortalityRecordDataset(),
    SlaughterRecordDataset.code: SlaughterRecordDataset(),
    LiveAnimalSaleDataset.code: LiveAnimalSaleDataset(),
}


def get_dataset_config(dataset_type: str) -> BaseDatasetConfig:
    config = DATASET_REGISTRY.get(dataset_type)
    if not config:
        valid_types = ", ".join(DATASET_REGISTRY.keys())
        raise ValueError(f"Unsupported dataset type '{dataset_type}'. Supported types: {valid_types}")
    return config
