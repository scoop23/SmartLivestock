import csv
import io
import os
from typing import Any, Tuple, List, Dict, Optional
import openpyxl

# =============================================================
# PARSER — CSV and Excel Workbook Reader
# =============================================================
# This module is responsible for reading the uploaded file and
# returning a flat list of row dictionaries that the ValidationEngine can process.
#
# Responsibilities:
#   - Detect file format from extension (.csv, .xlsx, or .xlsm)
#   - Read and decode the file bytes safely (UTF-8 BOM, latin-1 fallback)
#   - Sanitize cell values (strip whitespace, defuse formula injection)
#   - Return a list of {column_name: value} dicts with _row_number tracking
#   - Return a human-readable error string if the file cannot be parsed
#
# This module does NOT validate business rules — that is done by ValidationEngine.
# It only cares about reading the file correctly.
# =============================================================

# Maximum number of data rows per upload (excluding header).
# 25,000 rows is more than enough for a municipal livestock import.
MAX_IMPORT_ROWS = 25000

# Maximum file size accepted (25 MB).
# Prevents abuse or accidental upload of large files that would overload the server.
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB


def sanitize_cell_value(val: Any) -> Any:
    """
    Sanitize raw cell values from CSV/XLSX:
    - Strips leading and trailing whitespace from strings.
    - Prevents CSV/Excel formula injection (values starting with =, +, -, @ when string).
    - Converts empty strings or whitespace-only strings to None.
    """
    if val is None:
        return None
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        # Defuse formula injection if cell starts with dangerous formula symbols
        if val.startswith(("=", "+", "-", "@")) and not (val.startswith(("-", "+")) and len(val) > 1 and val[1:].replace(".", "", 1).isdigit()):
            # Prefix with single quote to neutralize formula execution in spreadsheets
            val = val.lstrip("=+-@").strip()
            if not val:
                return None
    return val


def parse_csv(file_obj) -> Tuple[List[str], List[Dict[str, Any]], Optional[str]]:
    """
    Parse a CSV file safely:
    - Handles UTF-8 with or without BOM, with fallback to latin-1.
    - Detects delimiter using csv.Sniffer (falls back to comma).
    - Yields sanitized rows with 1-based row_number (starting at 2).
    """
    try:
        raw_bytes = file_obj.read()
        if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
            return [], [], f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."

        # Decode with UTF-8 BOM awareness, fallback to latin-1
        try:
            content = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = raw_bytes.decode("latin-1")

        lines = content.splitlines()
        if not lines:
            return [], [], "The uploaded CSV file is empty."

        # Sniff delimiter safely
        sample = "\n".join(lines[:10])
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ","

        reader = csv.reader(io.StringIO(content), delimiter=delimiter)
        raw_headers = next(reader, None)
        if not raw_headers:
            return [], [], "No headers found in CSV file."

        header_columns = [
            (idx, str(header).strip())
            for idx, header in enumerate(raw_headers)
            if str(header).strip()
        ]
        headers = [header for _, header in header_columns]
        if not headers:
            return [], [], "CSV file has no valid column headers."

        rows: List[Dict[str, Any]] = []
        for idx, row in enumerate(reader, start=2):
            if idx - 1 > MAX_IMPORT_ROWS:
                return [], [], f"File exceeds maximum supported row limit of {MAX_IMPORT_ROWS} rows."

            # Check if row is completely empty
            if not any(row):
                continue

            row_data: Dict[str, Any] = {"_row_number": idx}
            for col_idx, col_name in header_columns:
                val = row[col_idx] if col_idx < len(row) else None
                row_data[col_name] = sanitize_cell_value(val)
            rows.append(row_data)

        if not rows:
            return headers, [], "The uploaded CSV contains a header but no data rows."

        return headers, rows, None
    except Exception as e:
        return [], [], f"Failed to parse CSV file: {str(e)}"


def parse_xlsx(file_obj) -> Tuple[List[str], List[Dict[str, Any]], Optional[str]]:
    """
    Parse an Excel (.xlsx or .xlsm) file safely:
    - Uses openpyxl with read_only=True and data_only=True for memory efficiency.
    - Yields sanitized rows with row_number matching Excel sheet rows.
    """
    try:
        if getattr(file_obj, "size", 0) > MAX_FILE_SIZE_BYTES:
            return [], [], f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."

        # Load workbook with data_only=True to evaluate formula values
        wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
        sheet = wb.active
        if sheet is None:
            return [], [], "Excel workbook has no active sheet."

        rows_iter = sheet.iter_rows(values_only=True)
        raw_headers = next(rows_iter, None)
        if not raw_headers:
            return [], [], "No headers found in Excel file."

        header_columns = [
            (idx, str(header).strip())
            for idx, header in enumerate(raw_headers)
            if header is not None and str(header).strip()
        ]
        headers = [header for _, header in header_columns]
        if not headers:
            return [], [], "Excel file has no valid column headers."

        rows: List[Dict[str, Any]] = []
        row_num = 1
        for row in rows_iter:
            row_num += 1
            if row_num - 1 > MAX_IMPORT_ROWS:
                return [], [], f"File exceeds maximum supported row limit of {MAX_IMPORT_ROWS} rows."

            if not any(v is not None for v in row):
                continue

            row_data: Dict[str, Any] = {"_row_number": row_num}
            has_data = False
            for col_idx, col_name in header_columns:
                val = row[col_idx] if col_idx < len(row) else None
                sanitized = sanitize_cell_value(val)
                if sanitized is not None:
                    has_data = True
                row_data[col_name] = sanitized

            if has_data:
                rows.append(row_data)

        wb.close()

        if not rows:
            return headers, [], "The uploaded Excel sheet contains headers but no data rows."

        return headers, rows, None
    except Exception as e:
        return [], [], f"Failed to parse Excel file: {str(e)}"


def parse_file(file_obj, filename: str) -> Tuple[List[str], List[Dict[str, Any]], Optional[str]]:
    """
    Unified entry point for CSV and XLSX file parsing.
    Dispatches to appropriate parser based on file extension.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".csv":
        return parse_csv(file_obj)
    elif ext in [".xlsx", ".xlsm"]:
        return parse_xlsx(file_obj)
    elif ext == ".xls":
        return [], [], "Legacy .xls format is not supported. Please save and upload as .xlsx, .xlsm, or .csv."
    else:
        return [], [], f"Unsupported file format '{ext}'. Please upload a .csv, .xlsx, or .xlsm file."
