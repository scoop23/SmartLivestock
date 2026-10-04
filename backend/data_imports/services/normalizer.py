import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple
from django.utils import timezone


def normalize_string(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def normalize_date(val: Any) -> Tuple[Optional[date], Optional[str]]:
    """
    Parse and normalize varied spreadsheet date values into a datetime.date object.
    Supports:
    - datetime / date instances (from openpyxl)
    - YYYY-MM-DD (ISO)
    - MM/DD/YYYY or M/D/YYYY
    - DD-MM-YYYY or DD/MM/YYYY
    - Textual formats like "October 1, 2026" or "1 Oct 2026"
    """
    if val is None or val == "":
        return None, None

    if isinstance(val, datetime):
        return val.date(), None
    if isinstance(val, date):
        return val, None

    # If it's a numeric Excel serial number (days since 1899-12-30)
    if isinstance(val, (int, float)):
        try:
            # Excel serial date 1 = 1900-01-01
            # Note: Excel's leap year bug in 1900 means serials >= 61 offset by 1
            from datetime import timedelta
            base_date = date(1899, 12, 30)
            parsed = base_date + timedelta(days=float(val))
            return parsed, None
        except Exception:
            return None, f"Could not convert serial number {val} to a valid date."

    s = str(val).strip()
    if not s:
        return None, None

    # Remove time portion if present (e.g. "2026-10-01 00:00:00" or "2026-10-01T00:00:00")
    if " " in s:
        s = s.split(" ")[0]
    elif "T" in s:
        s = s.split("T")[0]

    # Try common explicit date formats
    date_formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%m-%d-%Y",
        "%d-%m-%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B %Y",
        "%d %b %Y",
    ]

    for fmt in date_formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.date(), None
        except ValueError:
            continue

    return None, f"Invalid date format '{val}'. Expected format is YYYY-MM-DD or MM/DD/YYYY."


def normalize_decimal(
    val: Any,
    min_val: Optional[Decimal] = None,
    max_val: Optional[Decimal] = None,
) -> Tuple[Optional[Decimal], Optional[str]]:
    """
    Clean and convert spreadsheet numbers to Decimal.
    Handles commas ('1,250.50'), currency symbols ('PHP 1,250'), and whitespace.
    """
    if val is None or val == "":
        return None, None

    if isinstance(val, (int, float)):
        try:
            d = Decimal(str(val))
        except InvalidOperation:
            return None, f"Invalid numeric value '{val}'."
    else:
        s = str(val).strip()
        # Remove currency symbols and labels
        s = re.sub(r"[^\d.-]", "", s)
        if not s:
            return None, None
        try:
            d = Decimal(s)
        except InvalidOperation:
            return None, f"Invalid numeric value '{val}'."

    if min_val is not None and d < min_val:
        return None, f"Value {d} cannot be less than {min_val}."
    if max_val is not None and d > max_val:
        return None, f"Value {d} cannot exceed {max_val}."

    return d, None


def normalize_integer(
    val: Any,
    min_val: Optional[int] = None,
    max_val: Optional[int] = None,
) -> Tuple[Optional[int], Optional[str]]:
    """
    Clean and convert spreadsheet numbers to integer.
    """
    if val is None or val == "":
        return None, None

    if isinstance(val, (int, float)):
        i = int(val)
    else:
        s = str(val).strip()
        # Remove commas
        s = s.replace(",", "")
        try:
            # Handle float string like "24.0"
            i = int(float(s))
        except (ValueError, TypeError):
            return None, f"Invalid integer value '{val}'."

    if min_val is not None and i < min_val:
        return None, f"Value {i} cannot be less than {min_val}."
    if max_val is not None and i > max_val:
        return None, f"Value {i} cannot exceed {max_val}."

    return i, None


def clean_column_key(col: str) -> str:
    """Normalize column header for alias matching: lowercase, alphanumeric only."""
    return re.sub(r"[^a-z0-9]", "", col.lower())


def map_columns(
    uploaded_headers: List[str],
    field_alias_map: Dict[str, List[str]],
) -> Dict[str, str]:
    """
    Auto-match uploaded spreadsheet column headers against target system fields
    using the alias dictionary.
    Returns:
        {system_field: uploaded_header_name}
    """
    cleaned_uploaded = {clean_column_key(h): h for h in uploaded_headers}
    mapping: Dict[str, str] = {}

    for field, aliases in field_alias_map.items():
        # Check direct field match first
        field_clean = clean_column_key(field)
        if field_clean in cleaned_uploaded:
            mapping[field] = cleaned_uploaded[field_clean]
            continue

        # Check aliases
        for alias in aliases:
            alias_clean = clean_column_key(alias)
            if alias_clean in cleaned_uploaded:
                mapping[field] = cleaned_uploaded[alias_clean]
                break

    return mapping
