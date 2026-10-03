"""
Data Extraction, Cleaning, and Feature Engineering for Time-Series Forecasting.

=============================================================================
EDUCATIONAL OVERVIEW: MULTI-DOMAIN TIME-SERIES EXTRACTION & DATA INTEGRITY
=============================================================================
In municipal livestock analytics, we process five core time-series domains:
  1. Production: Milk (Liters), Farmer-reported Meat (kg), Eggs (pcs), Wool (kg)
  2. Disease Surveillance: Outbreak frequency (Cases) and Affected Animals (Heads)
  3. Mortality: Livestock Deaths (Heads) across disease-linked and independent causes
  4. Slaughter: Abattoir Throughput (Heads) vs Meat Biomass (Carcass Weight kg)
  5. Auction / Live Animal Sales: Market throughput (Heads) and trading volume (PHP)

KEY DATA SCIENCE & CAPSTONE PRINCIPLES:
1. Approved Records Only:
   Only MAO-approved records represent official, verified municipal observations.
   Pending or revised records may contain unverified estimates or data entry typos.

2. Unit Purity Rule:
   Different production yields have incompatible physical units:
     - Milk: LITERS
     - Meat: KILOGRAMS
     - Eggs: PIECES
   Mixing liters, kilograms, and pieces into a single time series corrupts the data.
   Every model strictly targets a single (domain, target, unit) tuple.

3. Farmer-Reported Meat vs. Slaughterhouse Meat (Preventing Double Counting):
   Farmer meat (ProductionRecord with production_type='MEAT' and slaughter=None)
   is kept strictly separate from municipal slaughterhouse records (SlaughterRecord).
   Counting both in the same meat metric would double-count the same livestock.

4. Data Sufficiency vs. Fake Forecasts:
   If a domain has fewer than 12 monthly observations, we NEVER fabricate fake forecast
   curves or random numbers. We return `status: "insufficient_data"` with the historical
   trend line and an educational explanation of minimum observation thresholds.

5. Chronological Train/Test Split (Preventing Data Leakage):
   Standard ML often splits data randomly (e.g. train_test_split(..., shuffle=True)).
   In TIME SERIES, random splitting is a fatal error called DATA LEAKAGE:
   if the model sees May 2026 during training, it can "cheat" when predicting April 2026.
   We always split chronologically:
     - Oldest observations -> Training set (past)
     - Newest observations -> Test set (unseen future)
"""

from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np

from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth

from production.models import ProductionRecord, SlaughterRecord, LiveAnimalSale
from diseases.models import DiseaseCase, MortalityRecord
from smartlivestock.workflows import scope_reviewer_queryset
from analytics.seed_markers import (
    SEED_MARKER_PRODUCTION_V2,
    SEED_MARKER_PRODUCTION_LEGACY,
    SEED_MARKER_DISEASE,
    SEED_MARKER_MORTALITY,
    SEED_MARKER_SLAUGHTER,
    SEED_MARKER_AUCTION,
)

SEED_MARKER_V2 = SEED_MARKER_PRODUCTION_V2
SEED_MARKER_LEGACY = SEED_MARKER_PRODUCTION_LEGACY
SEED_MARKER = SEED_MARKER_V2
MIN_OBSERVATIONS_REQUIRED = 12  # Minimum monthly points to perform a meaningful train/test comparison


def extract_monthly_series(
    domain: str = "production",
    target: str = "MILK",
    unit: str = "LITERS",
    user=None,
) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Extracts approved municipal records grouped by calendar month for any supported domain.

    Supported domains:
      - 'production': Target is commodity (MILK, MEAT, EGGS, WOOL). Unit is LITERS, KILOGRAMS, PIECES.
                      Farmer meat enforces slaughter=None to prevent double counting.
      - 'disease': Target is disease name or 'ALL'. Unit is 'CASES' or 'HEADS'.
      - 'mortality': Target is cause or 'ALL'. Unit is 'HEADS'.
      - 'slaughter': Target is species or 'ALL'. Unit is 'HEADS' (throughput) or 'KILOGRAMS' (carcass weight).
      - 'auction': Target is purpose/method or 'ALL'. Unit is 'HEADS' or 'PHP'.

    Returns:
        (df, metadata)
        - df: A pandas DataFrame with columns ['month', 'quantity'], indexed by DatetimeIndex,
              or None if insufficient data (< 12 observations).
        - metadata: Dictionary containing observation counts, seed status, historical points,
                    and sufficiency explanation.
    """
    domain = (domain or "production").lower()
    target_clean = (target or "MILK").upper()
    unit_clean = (unit or "LITERS").upper()

    active_marker = None
    has_seed = False
    base_qs = None
    records = []

    if domain == "production":
        # ---------------------------------------------------------------------
        # DOMAIN: PRODUCTION (Milk, Meat, Eggs, Wool)
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(ProductionRecord.objects.all(), user).filter(
            status=ProductionRecord.ProductionStatus.APPROVED,
            production_type=target_clean,
            unit=unit_clean,
        )
        # Crucial: Farmer-reported meat must NOT double-count slaughter records!
        if target_clean == "MEAT":
            base_qs = base_qs.filter(slaughter__isnull=True)

        seeded_record = base_qs.filter(notes__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = (
                SEED_MARKER_PRODUCTION_V2
                if SEED_MARKER_PRODUCTION_V2 in seeded_record.notes
                else SEED_MARKER_PRODUCTION_LEGACY
            )

        monthly_data = (
            base_qs.annotate(month=TruncMonth("record_date"))
            .values("month")
            .annotate(total_quantity=Sum("quantity"))
            .order_by("month")
        )
        records = list(monthly_data)

    elif domain == "disease":
        # ---------------------------------------------------------------------
        # DOMAIN: DISEASE SURVEILLANCE
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(DiseaseCase.objects.all(), user).filter(
            status=DiseaseCase.DiseaseStatus.APPROVED
        )
        if target_clean not in ("ALL", "CASES", "HEADS", ""):
            base_qs = base_qs.filter(name__icontains=target_clean)

        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_DISEASE

        if unit_clean == "HEADS":
            # Track affected animals count
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("affected_count"))
                .order_by("month")
            )
        else:
            # Track distinct clinical case events (default: CASES)
            unit_clean = "CASES"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Count("id"))
                .order_by("month")
            )
        records = list(monthly_data)

    elif domain == "mortality":
        # ---------------------------------------------------------------------
        # DOMAIN: LIVESTOCK MORTALITY
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(MortalityRecord.objects.all(), user).filter(
            status=MortalityRecord.MortalityRecordStatus.APPROVED
        )
        if target_clean not in ("ALL", "DEATHS", "HEADS", ""):
            base_qs = base_qs.filter(cause__icontains=target_clean)

        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_MORTALITY

        unit_clean = "HEADS"
        monthly_data = (
            base_qs.annotate(month=TruncMonth("record_date"))
            .values("month")
            .annotate(total_quantity=Sum("death_count"))
            .order_by("month")
        )
        records = list(monthly_data)

    elif domain == "slaughter":
        # ---------------------------------------------------------------------
        # DOMAIN: MUNICIPAL SLAUGHTERHOUSE
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(SlaughterRecord.objects.all(), user).filter(
            status=SlaughterRecord.StatusType.APPROVED
        )
        if target_clean not in ("ALL", "HEADS", "WEIGHT", "KILOGRAMS", ""):
            base_qs = base_qs.filter(livestock_type__name__icontains=target_clean)

        seeded_record = base_qs.filter(review_remarks__contains="AI_SEED").first()
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_SLAUGHTER

        if unit_clean in ("KILOGRAMS", "KG", "WEIGHT"):
            unit_clean = "KILOGRAMS"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("carcass_weight"))
                .order_by("month")
            )
        else:
            unit_clean = "HEADS"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("record_date"))
                .values("month")
                .annotate(total_quantity=Sum("quantity"))
                .order_by("month")
            )
        records = list(monthly_data)

    elif domain == "auction":
        # ---------------------------------------------------------------------
        # DOMAIN: AUCTION / LIVE ANIMAL SALES
        # ---------------------------------------------------------------------
        base_qs = scope_reviewer_queryset(LiveAnimalSale.objects.all(), user).filter(
            status=LiveAnimalSale.StatusType.APPROVED
        )
        if target_clean not in ("ALL", "HEADS", "SALES", "PHP", ""):
            base_qs = base_qs.filter(
                Q(sale_method__icontains=target_clean) | Q(purpose__icontains=target_clean)
            )

        # Check for synthetic test seed markers so test datasets are clearly flagged
        # (This allows safe cleaning via python manage.py seed_auction --clean without touching real records)
        seeded_record = (
            base_qs.filter(review_remarks__contains="AI_SEED").first()
            or (base_qs.filter(notes__contains="AI_SEED").first() if hasattr(LiveAnimalSale, "notes") else None)
        )
        if seeded_record:
            has_seed = True
            active_marker = SEED_MARKER_AUCTION

        if unit_clean in ("PHP", "VALUE", "TOTAL_PRICE"):
            unit_clean = "PHP"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("sale_date"))
                .values("month")
                .annotate(total_quantity=Sum("total_price"))
                .order_by("month")
            )
        else:
            unit_clean = "HEADS"
            monthly_data = (
                base_qs.annotate(month=TruncMonth("sale_date"))
                .values("month")
                .annotate(total_quantity=Sum("quantity"))
                .order_by("month")
            )
        records = list(monthly_data)

    else:
        # Fallback to empty series for unknown domain
        records = []
        base_qs = ProductionRecord.objects.none()

    # Filter out any None months if legacy records had null dates
    records = [r for r in records if r.get("month") is not None and r.get("total_quantity") is not None]

    # Convert the raw database query results into a list of chronological data points
    historical_trend_points = [
        {
            "date": r["month"].strftime("%Y-%m-%d"),
            "month_label": r["month"].strftime("%b %Y"),
            "actual": float(r["total_quantity"]),
        }
        for r in records
    ]

    # Explicit Domain Scopes:
    # We explicitly define the geographic and administrative scope of the forecast here.
    # For example, disease and mortality are municipal-level aggregates (overall totals),
    # NOT spatial GIS barangay risk predictions.
    domain_scopes = {
        "production": "Municipal-level production output",
        "disease": "Municipal-level disease forecast",
        "mortality": "Municipality-wide mortality totals",
        "slaughter": "Municipal slaughterhouse (abattoir) throughput",
        "auction": "Municipal live animal commercial trade",
    }
    domain_scope = domain_scopes.get(domain, f"Municipal {domain} aggregate")

    # Build standardized metadata dictionary passed downstream to evaluation and forecasting
    metadata = {
        "domain": domain,
        "scope": domain_scope,
        "target": target_clean,
        "unit": unit_clean,
        "frequency": "MONTHLY",
        "is_seeded": has_seed,
        "seed_marker": active_marker,
        "total_records": base_qs.count() if base_qs is not None else 0,
        "total_monthly_observations": len(records),
        # Observation counters consumed by frontend to display available vs required points:
        "available_observations": len(records),
        "required_observations": MIN_OBSERVATIONS_REQUIRED,
        "min_observations_required": MIN_OBSERVATIONS_REQUIRED,
        "historical_trend": historical_trend_points,
    }

    # Data sufficiency verification: NEVER force machine learning on sparse data (< 12 points).
    # If the user does not have 12 months yet, we return status="insufficient_data"
    # along with the historical points so the frontend can display honest ground truth without guessing.
    if len(records) < MIN_OBSERVATIONS_REQUIRED:
        metadata["status"] = "insufficient_data"
        metadata["forecast_available"] = False
        metadata["message"] = (
            f"Insufficient historical data for {domain.title()} ({target_clean}): Found {len(records)} "
            f"monthly observation(s). At least {MIN_OBSERVATIONS_REQUIRED} monthly observations are required "
            f"to train, chronologically evaluate, and benchmark predictive forecasting models reliably "
            f"without fabricating synthetic scores."
        )
        return None, metadata

    rows = [
        {
            "month": pd.to_datetime(r["month"]),
            "quantity": float(r["total_quantity"]),
        }
        for r in records
    ]

    df = pd.DataFrame(rows)
    df.sort_values("month", inplace=True)
    df.reset_index(drop=True, inplace=True)

    metadata["status"] = "ready"
    metadata["forecast_available"] = True
    metadata["start_date"] = df["month"].min().strftime("%Y-%m-%d")
    metadata["end_date"] = df["month"].max().strftime("%Y-%m-%d")

    return df, metadata


def extract_monthly_production_series(
    production_type: str = "MILK",
    unit: str = "LITERS",
    user=None,
) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Backward-compatible convenience wrapper for production series extraction.
    """
    return extract_monthly_series(
        domain="production",
        target=production_type,
        unit=unit,
        user=user,
    )


def prepare_tabular_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms a 1D univariate time series into a supervised tabular dataset (X, y).

    Feature Engineering Explanation:
    Machine learning algorithms like Linear Regression and Random Forest do not inherently
    understand sequences or dates. They require row-by-row feature vectors.
    We create:
    1. Lag 1 (lag_1): Production from 1 month ago (t - 1).
    2. Lag 2 (lag_2): Production from 2 months ago (t - 2).
    3. Lag 3 (lag_3): Production from 3 months ago (t - 3).
    4. Rolling Mean (rolling_mean_3): The average production of the last 3 months,
       which smooths short-term noise and reveals local momentum.
    5. Time Index (time_step): 0, 1, 2, ..., N which allows regression to capture linear trend.
    6. Month Number (month_num): 1 to 12 which allows modeling annual seasonality.
    """
    df_feat = df.copy()

    # Time step index for trend
    df_feat["time_step"] = np.arange(len(df_feat))

    # Calendar month for seasonal cyclicality
    df_feat["month_num"] = df_feat["month"].dt.month

    # Lag features (previous values)
    df_feat["lag_1"] = df_feat["quantity"].shift(1)
    df_feat["lag_2"] = df_feat["quantity"].shift(2)
    df_feat["lag_3"] = df_feat["quantity"].shift(3)

    # Rolling window statistics (past 3 months mean)
    # Important: shift(1) ensures the rolling window only uses PAST data,
    # preventing current target 'quantity' from leaking into the feature!
    df_feat["rolling_mean_3"] = df_feat["quantity"].shift(1).rolling(window=3).mean()

    # Drop the first 3 rows because lag_3 / rolling_mean_3 creates NaN values for them
    df_feat.dropna(inplace=True)
    df_feat.reset_index(drop=True, inplace=True)

    return df_feat


def chronological_split(
    df: pd.DataFrame,
    test_ratio: float = 0.2,
    min_test_size: int = 4,
    max_test_size: int = 8,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits the time-series DataFrame chronologically into training and testing subsets.

    Why Chronological?
    In time series, we must simulate the real world:
      - We train on historical data up to time T.
      - We test our predictions on unseen future data after time T.
    Using shuffle=True would leak future observations into the training phase,
    falsely inflating metrics (a classic machine learning mistake).
    """
    n = len(df)
    test_size = int(np.round(n * test_ratio))
    test_size = max(min_test_size, min(test_size, max_test_size))

    split_idx = n - test_size

    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    return train_df, test_df
