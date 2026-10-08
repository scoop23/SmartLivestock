from datetime import date
from decimal import Decimal
from typing import Dict, List, Any, Optional, Tuple, Set
from django.utils import timezone

from livestock.models import Barangay, Farmer, LivestockType, LivestockInventory
from production.models import ProductionRecord, SlaughterRecord, LiveAnimalSale
from diseases.models import DiseaseCase, MortalityRecord
from .datasets import BaseDatasetConfig, get_dataset_config
from .normalizer import (
    normalize_string,
    normalize_date,
    normalize_decimal,
    normalize_integer,
    map_columns,
)


# =============================================================
# VALIDATION ENGINE
# =============================================================
# The ValidationEngine checks every row of the uploaded spreadsheet
# against the business rules for each dataset domain.
#
# KEY CONCEPT — Pre-cached lookups to avoid N+1 queries:
# Instead of hitting the database for every row (which would be
# extremely slow for hundreds of rows), __init__ loads ALL barangays,
# livestock types, and farmers once into Python dictionaries.
#
# Then for each row we do an O(1) dictionary lookup instead of a SQL query.
# This is why large imports stay fast regardless of file size.
#
# Each row is returned with one of three statuses:
#   VALID   — all required fields pass, no issues
#   WARNING — optional issues like duplicate ear tags (importable but flagged)
#   ERROR   — required field missing, invalid foreign key, bad date, etc.
#
# Only VALID and WARNING rows can be imported.
# ERROR rows are always rejected and logged.
# =============================================================

class ValidationEngine:
    """
    High-performance validation engine for municipal livestock datasets.
    Pre-caches foreign keys (Barangays, Livestock Types, Farmers) in memory to validate
    thousands of rows in a single pass without N+1 database queries.
    """

    def __init__(self, dataset_config: BaseDatasetConfig):
        self.config = dataset_config
        self.today = timezone.localdate()
        self._load_lookups()

    def _load_lookups(self):
        # 1. Barangays
        self.barangays_by_name: Dict[str, Barangay] = {
            b.barangay_name.strip().lower(): b for b in Barangay.objects.all()
        }

        # 2. Livestock Types
        self.livestock_types_by_name: Dict[str, LivestockType] = {
            s.name.strip().lower(): s for s in LivestockType.objects.all()
        }

        # 3. Farmers (lookup by ID, username, or full name)
        self.farmers_by_id: Dict[int, Farmer] = {}
        self.farmers_by_username: Dict[str, Farmer] = {}
        self.farmers_by_name: Dict[str, List[Farmer]] = {}

        for f in Farmer.objects.select_related("user", "barangay").all():
            self.farmers_by_id[f.id] = f
            if f.user:
                uname = f.user.username.strip().lower()
                self.farmers_by_username[uname] = f
                
                full_name = f.user.get_full_name().strip().lower()
                if full_name:
                    self.farmers_by_name.setdefault(full_name, []).append(f)
                # Also index "last_name, first_name" or parts
                if f.user.last_name and f.user.first_name:
                    inverted = f"{f.user.last_name} {f.user.first_name}".strip().lower()
                    self.farmers_by_name.setdefault(inverted, []).append(f)

        # 4. Duplicate caches
        self.existing_tags: Set[str] = set(
            LivestockInventory.objects.filter(operational_status="ACTIVE")
            .exclude(tag_number="")
            .values_list("tag_number", flat=True)
        )

    def find_farmer(self, raw_val: Any, target_barangay: Optional[Barangay] = None) -> Optional[Farmer]:
        if not raw_val:
            return None
        val_str = str(raw_val).strip()
        
        # Numeric ID
        if val_str.isdigit() and int(val_str) in self.farmers_by_id:
            return self.farmers_by_id[int(val_str)]

        lowered = val_str.lower()
        if lowered in self.farmers_by_username:
            return self.farmers_by_username[lowered]

        if lowered in self.farmers_by_name:
            candidates = self.farmers_by_name[lowered]
            if len(candidates) == 1:
                return candidates[0]
            if target_barangay:
                for c in candidates:
                    if c.barangay_id == target_barangay.id:
                        return c
            return candidates[0]

        return None

    def validate_row(
        self,
        row_raw: Dict[str, Any],
        col_map: Dict[str, str],
        seen_tags_in_batch: Set[str],
    ) -> Tuple[Dict[str, Any], List[Dict[str, str]], str]:
        """
        Validate and normalize a single spreadsheet row.
        Returns:
            (normalized_data, issues_list, status)
            where status is "VALID", "WARNING", or "ERROR"
        """
        issues: List[Dict[str, str]] = []
        clean_data: Dict[str, Any] = {"_row_number": row_raw.get("_row_number", 0)}

        # Helper to get raw value using mapped column header
        def get_val(field_name: str) -> Any:
            header = col_map.get(field_name)
            return row_raw.get(header) if header else None

        # 1. Check required fields
        for req_field in self.config.required_fields:
            raw_v = get_val(req_field)
            if raw_v is None or str(raw_v).strip() == "":
                field_label = "Livestock Type" if req_field == "livestock_type" else req_field
                issues.append({
                    "field": req_field,
                    "type": "MISSING_REQUIRED_FIELD",
                    "message": f"Required field '{field_label}' is missing or empty.",
                    "severity": "ERROR",
                })

        # 2. Barangay Lookup
        raw_barangay = get_val("barangay")
        matched_barangay: Optional[Barangay] = None
        if raw_barangay:
            b_key = str(raw_barangay).strip().lower()
            if b_key in self.barangays_by_name:
                matched_barangay = self.barangays_by_name[b_key]
                clean_data["barangay"] = matched_barangay
                clean_data["barangay_name"] = matched_barangay.barangay_name
            else:
                issues.append({
                    "field": "barangay",
                    "type": "INVALID_FOREIGN_KEY",
                    "message": f"Barangay '{raw_barangay}' does not exist in Padre Garcia.",
                    "severity": "ERROR",
                })
                clean_data["barangay_name"] = str(raw_barangay)

        # 3. Farmer Lookup
        raw_farmer = get_val("farmer")
        if raw_farmer:
            farmer_obj = self.find_farmer(raw_farmer, matched_barangay)
            if farmer_obj:
                clean_data["farmer"] = farmer_obj
                clean_data["farmer_name"] = (
                    farmer_obj.user.get_full_name() or farmer_obj.user.username
                )
                if matched_barangay and farmer_obj.barangay_id != matched_barangay.id:
                    issues.append({
                        "field": "farmer",
                        "type": "LOCATION_MISMATCH",
                        "message": (
                            f"Farmer '{clean_data['farmer_name']}' is registered in Barangay "
                            f"'{farmer_obj.barangay.barangay_name}', but row lists '{matched_barangay.barangay_name}'."
                        ),
                        "severity": "WARNING",
                    })
            else:
                issues.append({
                    "field": "farmer",
                    "type": "INVALID_FOREIGN_KEY",
                    "message": f"Farmer '{raw_farmer}' is not registered in the system.",
                    "severity": "ERROR",
                })
                clean_data["farmer_name"] = str(raw_farmer)

        # Datasets that refer to the domain's livestock type share one canonical
        # key. Legacy headers such as `species` are resolved through aliases.
        livestock_field = "livestock_type"
        if livestock_field in self.config.field_aliases:
            raw_livestock_type = get_val(livestock_field)
            if raw_livestock_type:
                type_key = str(raw_livestock_type).strip().lower()
                if type_key in self.livestock_types_by_name:
                    livestock_type = self.livestock_types_by_name[type_key]
                    clean_data["livestock_type"] = livestock_type
                else:
                    issues.append({
                        "field": livestock_field,
                        "type": "INVALID_FOREIGN_KEY",
                        "message": (
                            f"Livestock Type '{raw_livestock_type}' is not recognized. "
                            f"Valid livestock types: {', '.join(s.name for s in self.livestock_types_by_name.values())}."
                        ),
                        "severity": "ERROR",
                    })
                    clean_data["livestock_type"] = str(raw_livestock_type)

        # 5. Dates
        for date_field in ["record_date", "last_vaccination_date", "sale_date"]:
            if date_field in self.config.field_aliases:
                raw_d = get_val(date_field)
                if raw_d is not None:
                    parsed_d, d_err = normalize_date(raw_d)
                    if d_err:
                        issues.append({
                            "field": date_field,
                            "type": "INVALID_DATE",
                            "message": d_err,
                            "severity": "ERROR",
                        })
                    elif parsed_d:
                        if parsed_d > self.today:
                            issues.append({
                                "field": date_field,
                                "type": "FUTURE_DATE",
                                "message": f"{date_field} '{parsed_d}' cannot be in the future.",
                                "severity": "ERROR",
                            })
                        clean_data[date_field] = parsed_d

        # 6. Numbers: Quantity
        if "quantity" in self.config.field_aliases:
            raw_qty = get_val("quantity")
            if raw_qty is not None:
                qty_val, qty_err = normalize_integer(raw_qty, min_val=1)
                if qty_err:
                    issues.append({
                        "field": "quantity",
                        "type": "INVALID_NUMBER",
                        "message": qty_err,
                        "severity": "ERROR",
                    })
                else:
                    clean_data["quantity"] = qty_val
            else:
                # Default quantity to 1 if not specified
                clean_data["quantity"] = 1

        # 7. Dataset-specific rules
        if self.config.code == "livestock_inventory":
            raw_entry_type = (normalize_string(get_val("entry_type")) or "INDIVIDUAL").upper()
            entry_type = raw_entry_type
            if entry_type not in ["INDIVIDUAL", "BATCH"]:
                issues.append({
                    "field": "entry_type",
                    "type": "INVALID_CHOICE",
                    "message": "Invalid entry type. Choices: INDIVIDUAL, BATCH.",
                    "severity": "ERROR",
                })
                entry_type = "INDIVIDUAL"
            clean_data["entry_type"] = entry_type

            # Check individual quantity constraint
            if entry_type == "INDIVIDUAL" and clean_data.get("quantity") != 1:
                issues.append({
                    "field": "quantity",
                    "type": "CONSTRAINT_VIOLATION",
                    "message": "Individual livestock records must have a quantity of exactly 1.",
                    "severity": "ERROR",
                })

            raw_tag = normalize_string(get_val("tag_number")) or ""
            clean_data["tag_number"] = raw_tag
            if raw_tag:
                if raw_tag in self.existing_tags:
                    issues.append({
                        "field": "tag_number",
                        "type": "DUPLICATE_WARNING",
                        "message": f"Active animal with ear tag '{raw_tag}' already exists in database.",
                        "severity": "WARNING",
                    })
                elif raw_tag in seen_tags_in_batch:
                    issues.append({
                        "field": "tag_number",
                        "type": "DUPLICATE_WARNING",
                        "message": f"Ear tag '{raw_tag}' is duplicated within this uploaded file.",
                        "severity": "WARNING",
                    })
                else:
                    seen_tags_in_batch.add(raw_tag)

            clean_data["breed"] = normalize_string(get_val("breed")) or ""
            raw_sex = (normalize_string(get_val("sex")) or "").upper()
            if raw_sex in {"M", "MALE"}:
                clean_data["sex"] = "MALE"
            elif raw_sex in {"F", "FEMALE"}:
                clean_data["sex"] = "FEMALE"
            else:
                clean_data["sex"] = raw_sex
                if raw_sex:
                    issues.append({
                        "field": "sex",
                        "type": "INVALID_CHOICE",
                        "message": "Invalid sex. Choices: MALE, FEMALE.",
                        "severity": "ERROR",
                    })

            raw_wt = get_val("weight")
            if raw_wt is not None:
                wt, wt_err = normalize_decimal(raw_wt, min_val=Decimal("0.00"))
                if wt_err:
                    issues.append({"field": "weight", "type": "INVALID_NUMBER", "message": wt_err, "severity": "ERROR"})
                else:
                    clean_data["weight"] = wt

        elif self.config.code == "production":
            prod_type = (normalize_string(get_val("production_type")) or "").upper()
            if prod_type not in ["MILK", "MEAT", "EGGS", "WOOL"]:
                issues.append({
                    "field": "production_type",
                    "type": "INVALID_CHOICE",
                    "message": f"Invalid production type '{prod_type}'. Choices: MILK, MEAT, EGGS, WOOL.",
                    "severity": "ERROR",
                })
            clean_data["production_type"] = prod_type

            raw_unit = (normalize_string(get_val("unit")) or "").upper()
            valid_units = {"MILK": "LITERS", "EGGS": "PIECES", "MEAT": "KILOGRAMS", "WOOL": "KILOGRAMS"}
            if raw_unit and raw_unit not in {"LITERS", "PIECES", "KILOGRAMS"}:
                issues.append({
                    "field": "unit",
                    "type": "INVALID_CHOICE",
                    "message": "Invalid unit. Choices: LITERS, PIECES, KILOGRAMS.",
                    "severity": "ERROR",
                })
            expected_unit = valid_units.get(prod_type)
            if expected_unit and raw_unit and raw_unit != expected_unit:
                issues.append({
                    "field": "unit",
                    "type": "UNIT_MISMATCH",
                    "message": f"Unit '{raw_unit}' does not match production type '{prod_type}'. Expected '{expected_unit}'.",
                    "severity": "WARNING",
                })
            clean_data["unit"] = raw_unit or expected_unit or "LITERS"

            raw_qty = get_val("quantity")
            if raw_qty is not None:
                q, q_err = normalize_decimal(raw_qty, min_val=Decimal("0.01"))
                if q_err:
                    issues.append({"field": "quantity", "type": "INVALID_NUMBER", "message": q_err, "severity": "ERROR"})
                else:
                    clean_data["quantity"] = q

            clean_data["tag_number"] = normalize_string(get_val("tag_number")) or ""
            clean_data["notes"] = normalize_string(get_val("notes")) or ""

        elif self.config.code == "disease":
            disease_name = normalize_string(get_val("disease_name"))
            if not disease_name:
                issues.append({"field": "disease_name", "type": "MISSING_FIELD", "message": "Disease name is required.", "severity": "ERROR"})
            clean_data["name"] = disease_name or ""

            raw_affected = get_val("affected_count")
            aff, aff_err = normalize_integer(raw_affected, min_val=1)
            if aff_err:
                issues.append({"field": "affected_count", "type": "INVALID_NUMBER", "message": aff_err, "severity": "ERROR"})
            else:
                clean_data["affected_count"] = aff or 1

            clean_data["tag_number"] = normalize_string(get_val("tag_number")) or ""

        elif self.config.code == "mortality":
            cause = normalize_string(get_val("cause"))
            if not cause:
                issues.append({"field": "cause", "type": "MISSING_FIELD", "message": "Cause of death is required.", "severity": "ERROR"})
            clean_data["cause"] = cause or ""

            raw_dead = get_val("death_count")
            dead, dead_err = normalize_integer(raw_dead, min_val=1)
            if dead_err:
                issues.append({"field": "death_count", "type": "INVALID_NUMBER", "message": dead_err, "severity": "ERROR"})
            else:
                clean_data["death_count"] = dead or 1

            clean_data["tag_number"] = normalize_string(get_val("tag_number")) or ""

        elif self.config.code == "slaughter":
            raw_wt = get_val("carcass_weight")
            if raw_wt is not None:
                wt, wt_err = normalize_decimal(raw_wt, min_val=Decimal("0.01"))
                if wt_err:
                    issues.append({"field": "carcass_weight", "type": "INVALID_NUMBER", "message": wt_err, "severity": "ERROR"})
                else:
                    clean_data["carcass_weight"] = wt

        elif self.config.code == "auction":
            sale_method = (normalize_string(get_val("sale_method")) or "MATA-MATA").upper()
            if sale_method not in ["MATA-MATA", "WEIGHING", "OTHER"]:
                issues.append({
                    "field": "sale_method",
                    "type": "INVALID_CHOICE",
                    "message": "Invalid sale method. Choices: MATA-MATA, WEIGHING, OTHER.",
                    "severity": "ERROR",
                })
                sale_method = "MATA-MATA"
            clean_data["sale_method"] = sale_method

            raw_price = get_val("total_price")
            price, price_err = normalize_decimal(raw_price, min_val=Decimal("0.00"))
            if price_err:
                issues.append({"field": "total_price", "type": "INVALID_NUMBER", "message": price_err, "severity": "ERROR"})
            else:
                clean_data["total_price"] = price

            raw_head = get_val("price_per_head")
            if raw_head is not None:
                ph, ph_err = normalize_decimal(raw_head, min_val=Decimal("0.00"))
                if ph_err:
                    issues.append({"field": "price_per_head", "type": "INVALID_NUMBER", "message": ph_err, "severity": "ERROR"})
                else:
                    clean_data["price_per_head"] = ph

            raw_wt = get_val("total_live_weight")
            if raw_wt is not None:
                wt, wt_err = normalize_decimal(raw_wt, min_val=Decimal("0.00"))
                if wt_err:
                    issues.append({"field": "total_live_weight", "type": "INVALID_NUMBER", "message": wt_err, "severity": "ERROR"})
                else:
                    clean_data["total_live_weight"] = wt

            clean_data["destination"] = normalize_string(get_val("destination")) or ""
            raw_purp = (normalize_string(get_val("purpose")) or "UNKNOWN").upper()
            if raw_purp not in ["BREEDING", "FATTENING", "SLAUGHTER", "UNKNOWN"]:
                issues.append({
                    "field": "purpose",
                    "type": "INVALID_CHOICE",
                    "message": "Invalid sale purpose. Choices: BREEDING, FATTENING, SLAUGHTER, UNKNOWN.",
                    "severity": "ERROR",
                })
                raw_purp = "UNKNOWN"
            clean_data["purpose"] = raw_purp

        # Determine overall row status
        has_error = any(i["severity"] == "ERROR" for i in issues)
        has_warning = any(i["severity"] == "WARNING" for i in issues)
        row_status = "ERROR" if has_error else ("WARNING" if has_warning else "VALID")

        return clean_data, issues, row_status

    def validate_batch(
        self,
        rows: List[Dict[str, Any]],
        headers: List[str],
    ) -> Dict[str, Any]:
        """
        Validate all rows in the parsed spreadsheet.
        Returns summary metrics, column mapping, issues, and preview records.
        """
        col_map = map_columns(headers, self.config.field_aliases)
        seen_tags_in_batch: Set[str] = set()

        valid_count = 0
        warning_count = 0
        error_count = 0

        preview_rows: List[Dict[str, Any]] = []
        all_issues: List[Dict[str, Any]] = []
        normalized_records: List[Dict[str, Any]] = []

        for row in rows:
            clean_data, issues, status = self.validate_row(row, col_map, seen_tags_in_batch)
            row_num = row.get("_row_number", 0)

            if status == "VALID":
                valid_count += 1
            elif status == "WARNING":
                warning_count += 1
            elif status == "ERROR":
                error_count += 1

            livestock_type_value = clean_data.get("livestock_type")
            if isinstance(livestock_type_value, LivestockType):
                livestock_type_value = livestock_type_value.name
            livestock_type_key = (
                "livestock_type" if "livestock_type" in self.config.field_aliases else "species"
            )
            for iss in issues:
                all_issues.append({
                    "row_number": row_num,
                    "barangay": clean_data.get("barangay_name") or row.get("barangay", ""),
                    livestock_type_key: (
                        livestock_type_value
                        or clean_data.get("species")
                        or row.get("livestock_type")
                        or row.get("species", "")
                    ),
                    "field": iss.get("field", ""),
                    "error_type": iss.get("type", "VALIDATION_ERROR"),
                    "severity": iss.get("severity", "ERROR"),
                    "error_message": iss.get("message", ""),
                })

            clean_data["_status"] = status
            clean_data["_issues"] = issues
            clean_data["_raw"] = {k: v for k, v in row.items() if not k.startswith("_")}
            normalized_records.append(clean_data)

            # Store preview rows (e.g. up to first 200 rows for UI display)
            if len(preview_rows) < 200:
                # Format dates and decimals for JSON serialization
                serializable_data = {}
                for k, v in clean_data.items():
                    if k.startswith("_") or isinstance(v, (Barangay, Farmer)):
                        continue
                    if isinstance(v, LivestockType):
                        if k == "livestock_type":
                            serializable_data[k] = v.name
                        continue
                    if isinstance(v, date):
                        serializable_data[k] = v.isoformat()
                    elif isinstance(v, Decimal):
                        serializable_data[k] = float(v)
                    else:
                        serializable_data[k] = v

                preview_rows.append({
                    "row_number": row_num,
                    "status": status,
                    "data": serializable_data,
                    "issues": issues,
                })

        return {
            "dataset_type": self.config.code,
            "dataset_label": self.config.label,
            "total_rows": len(rows),
            "valid_count": valid_count,
            "warning_count": warning_count,
            "error_count": error_count,
            "column_mapping": col_map,
            "preview_rows": preview_rows,
            "all_issues": all_issues,
            "normalized_records": normalized_records,
        }
