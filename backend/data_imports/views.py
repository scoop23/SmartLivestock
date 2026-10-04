import csv
import io
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes, renderer_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.generics import get_object_or_404

from .models import DataImportBatch
from .permissions import IsMAOOrAdmin
from .serializers import (
    DataImportBatchSerializer,
    ValidateImportRequestSerializer,
    ExecuteImportRequestSerializer,
)
from .services.datasets import DATASET_REGISTRY, get_dataset_config
from .services.parser import parse_file
from .services.validation import ValidationEngine
from .services.import_service import execute_batch_import
from .services.templates import generate_template_file


# =============================================================
# CUSTOM RENDERERS
# =============================================================
# DRF uses renderers to control what format the HTTP response is sent in.
# The default JSONRenderer handles all API responses.
# CsvRenderer and XlsxRenderer let Django return file downloads directly
# from the same endpoint — the frontend sets responseType: "blob" to capture them.
# =============================================================

class CsvRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class XlsxRenderer(BaseRenderer):
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    format = "xlsx"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


# =============================================================
# ENDPOINT: list_datasets
# GET /api/data-imports/datasets/
# =============================================================
# Returns the list of supported dataset types (livestock_inventory, production,
# disease, mortality, slaughter, auction) from the DATASET_REGISTRY.
#
# Used by the frontend dropdown so MAO officers know which import options exist.
# The registry is defined in services/datasets.py as BaseDatasetConfig subclasses.
#
# Security: IsMAOOrAdmin — only MAO staff and admins can access this endpoint.
# =============================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
def list_datasets(request):
    """
    List all supported municipal datasets available for bulk upload,
    including required fields and column descriptions.
    """
    results = []
    for code, config in DATASET_REGISTRY.items():
        results.append({
            "code": code,
            "label": config.label,
            "description": config.description,
            "required_fields": config.required_fields,
            "available_fields": list(config.field_aliases.keys()),
            "column_descriptions": config.column_descriptions,
        })
    return Response(results, status=status.HTTP_200_OK)


# =============================================================
# ENDPOINT: validate_import — STEP 1 OF 2 (DRY RUN)
# POST /api/data-imports/validate/
# =============================================================
# This is the FIRST step in the two-step import pipeline.
# It parses and validates the uploaded file WITHOUT writing anything to the database.
#
# Flow inside this view:
#   1. Deserialize the multipart request using ValidateImportRequestSerializer
#      → checks that dataset_type is valid and a file was attached
#   2. Look up the dataset config (field rules, required columns, aliases)
#   3. parse_file() reads the CSV or XLSX and returns sanitized rows
#   4. ValidationEngine.validate_batch() checks every row:
#      - Are required fields present?
#      - Does the barangay exist in Padre Garcia?
#      - Does the farmer name match a registered account?
#      - Are dates valid and not in the future?
#      - Are numbers in range?
#      - Are there duplicate ear tags?
#   5. Returns a preview: row counts (valid/warning/error) + first 200 rows
#
# The frontend shows this preview to the MAO officer before they confirm.
# If the preview looks good, they click "Import" → calls execute_import.
#
# Parsers: MultiPartParser + FormParser allows file uploads via multipart/form-data.
# =============================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
@parser_classes([MultiPartParser, FormParser])
def validate_import(request):
    """
    POST /api/data-imports/validate/
    Dry-run file parse and validation stage.
    DOES NOT modify database records.
    Returns:
    - total_rows, valid_count, warning_count, error_count
    - column_mapping
    - preview_rows (with specific cell validation issues)
    """
    serializer = ValidateImportRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    dataset_type = serializer.validated_data["dataset_type"]
    uploaded_file = serializer.validated_data["file"]

    try:
        config = get_dataset_config(dataset_type)
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Parse file (CSV or XLSX)
    headers, rows, parse_err = parse_file(uploaded_file, uploaded_file.name)
    if parse_err:
        return Response({"error": parse_err}, status=status.HTTP_400_BAD_REQUEST)

    if not rows:
        return Response({"error": "The uploaded spreadsheet contains no data rows."}, status=status.HTTP_400_BAD_REQUEST)

    # 2. Run Validation Engine
    engine = ValidationEngine(config)
    results = engine.validate_batch(rows, headers)

    return Response({
        "file_name": uploaded_file.name,
        "dataset_type": dataset_type,
        "dataset_label": results["dataset_label"],
        "total_rows": results["total_rows"],
        "valid_count": results["valid_count"],
        "warning_count": results["warning_count"],
        "error_count": results["error_count"],
        "column_mapping": results["column_mapping"],
        "preview_rows": results["preview_rows"],
        "issues_sample": results["all_issues"][:100],
    }, status=status.HTTP_200_OK)


# =============================================================
# ENDPOINT: execute_import — STEP 2 OF 2 (ACTUAL DATABASE WRITE)
# POST /api/data-imports/import/
# =============================================================
# This is the SECOND and final step in the import pipeline.
# It re-runs validation, then inserts all valid rows in a database transaction.
#
# Flow inside this view:
#   1. Deserialize request (same as validate, but includes skip_duplicates and target_status)
#   2. Get dataset config
#   3. parse_file() again — the file is re-parsed from scratch (not cached from validate)
#   4. ValidationEngine.validate_batch() runs again for safety
#   5. If zero valid rows exist → abort with 400 error
#   6. execute_batch_import() runs inside transaction.atomic():
#      - Creates a DataImportBatch audit record
#      - Builds model instances for each VALID or WARNING row
#      - Bulk-inserts all instances in chunks of 500 (BATCH_CHUNK_SIZE)
#      - Updates the audit record with final counts and duration
#   7. Returns the import summary (batch_id, imported/skipped/rejected counts)
#
# Why re-validate?
# The frontend sends the file twice (validate → import). The second parse ensures
# no one bypasses the preview step by calling /import/ directly with a bad file.
#
# Why transaction.atomic()?
# If any row fails to insert (e.g. database constraint error), the entire batch
# rolls back. This prevents partial imports where some records are in the DB
# and some are not — which would corrupt the municipal dataset.
# =============================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
@parser_classes([MultiPartParser, FormParser])
def execute_import(request):
    """
    POST /api/data-imports/import/
    Execute confirmed batch import inside a database transaction.
    """
    serializer = ExecuteImportRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    dataset_type = serializer.validated_data["dataset_type"]
    uploaded_file = serializer.validated_data["file"]
    skip_duplicates = serializer.validated_data.get("skip_duplicates", True)
    target_status = serializer.validated_data.get("target_status", DataImportBatch.TargetStatus.APPROVED)

    try:
        config = get_dataset_config(dataset_type)
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Parse file
    headers, rows, parse_err = parse_file(uploaded_file, uploaded_file.name)
    if parse_err:
        return Response({"error": parse_err}, status=status.HTTP_400_BAD_REQUEST)

    if not rows:
        return Response({"error": "The uploaded spreadsheet contains no data rows."}, status=status.HTTP_400_BAD_REQUEST)

    # 2. Validate rows
    engine = ValidationEngine(config)
    val_results = engine.validate_batch(rows, headers)

    if val_results["valid_count"] == 0 and val_results["warning_count"] == 0:
        return Response({
            "error": "Cannot import spreadsheet: All rows contain errors. Please fix validation errors and try again.",
            "issues": val_results["all_issues"][:20],
        }, status=status.HTTP_400_BAD_REQUEST)

    # 3. Execute transactional batch import
    try:
        import_summary = execute_batch_import(
            dataset_type=dataset_type,
            normalized_records=val_results["normalized_records"],
            user=request.user,
            file_name=uploaded_file.name,
            skip_duplicates=skip_duplicates,
            target_status=target_status,
            all_issues=val_results["all_issues"],
        )
        return Response(import_summary, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            "error": f"Batch import failed: {str(e)}",
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================
# ENDPOINT: list_batches
# GET /api/data-imports/batches/
# =============================================================
# Returns the last 50 import batches with audit metadata.
# select_related("uploaded_by") avoids an N+1 query — instead of fetching the
# User object for each batch row separately, Django joins them in a single SQL query.
# =============================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
def list_batches(request):
    """
    GET /api/data-imports/
    List recent import batches with audit metadata and metrics.
    """
    batches = DataImportBatch.objects.select_related("uploaded_by").order_by("-uploaded_at")[:50]
    serializer = DataImportBatchSerializer(batches, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
def batch_detail(request, pk):
    """
    GET /api/data-imports/<pk>/
    Retrieve single batch details and full metrics.
    """
    batch = get_object_or_404(DataImportBatch.objects.select_related("uploaded_by"), pk=pk)
    serializer = DataImportBatchSerializer(batch)
    return Response(serializer.data, status=status.HTTP_200_OK)


# =============================================================
# ENDPOINT: download_batch_errors
# GET /api/data-imports/<pk>/errors/
# =============================================================
# Generates a CSV file listing every row-level validation error from the batch.
# The error_log field stored in DataImportBatch.error_log (JSON) is written
# out row-by-row into a CSV with utf-8-sig encoding (BOM prefix for Excel compatibility).
#
# MAO staff download this after an import to see which rows need correction.
# =============================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
@renderer_classes([JSONRenderer, CsvRenderer, XlsxRenderer])
def download_batch_errors(request, pk):
    """
    GET /api/data-imports/<pk>/errors/
    Download CSV error report containing row numbers, fields, and error explanations.
    """
    batch = get_object_or_404(DataImportBatch, pk=pk)
    error_log = batch.error_log or []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Row Number",
        "Barangay",
        "Species",
        "Field",
        "Error Type",
        "Severity",
        "Error Message",
    ])

    for err in error_log:
        writer.writerow([
            err.get("row_number", ""),
            err.get("barangay", ""),
            err.get("species", ""),
            err.get("field", ""),
            err.get("error_type", ""),
            err.get("severity", ""),
            err.get("error_message", ""),
        ])

    # utf-8-sig adds a BOM (Byte Order Mark) at the start so Excel opens it correctly
    csv_data = output.getvalue().encode("utf-8-sig")
    filename = f"Import_Errors_Batch_{batch.id}_{batch.dataset_type}.csv"
    response = HttpResponse(csv_data, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# =============================================================
# ENDPOINT: download_template
# GET /api/data-imports/templates/<dataset_type>/?format=xlsx
# =============================================================
# Returns a pre-formatted official template spreadsheet in XLSX or CSV.
# The template is generated by services/templates.py with correct column headers
# and sample data rows so MAO staff know exactly what to fill in.
#
# The Content-Disposition header tells the browser to download the file
# rather than display it inline (like a web page).
# =============================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMAOOrAdmin])
@renderer_classes([JSONRenderer, CsvRenderer, XlsxRenderer])
def download_template(request, dataset_type):
    """
    GET /api/data-imports/templates/<dataset_type>/?format=xlsx
    Download official municipal template for chosen dataset in XLSX or CSV format.
    """
    file_format = (request.GET.get("file_format") or request.GET.get("format", "xlsx")).lower()
    if file_format not in ["xlsx", "csv"]:
        file_format = "xlsx"

    try:
        content, filename, content_type = generate_template_file(dataset_type, file_format)
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
