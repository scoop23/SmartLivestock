"""
Data Extraction, Cleaning, and Feature Engineering for Time-Series Forecasting.

=============================================================================
EDUCATIONAL OVERVIEW: FROM DATABASE TO MACHINE LEARNING DATASET
=============================================================================
In traditional software, we query a database and display the rows.
In Machine Learning (ML), algorithms cannot understand raw database rows.
They require structured numerical arrays:
  - X (Input Features): The predictors or independent variables (e.g. past production, month number).
  - y (Target Variable): The quantity we want to predict (e.g. current month's milk production).

KEY DATA SCIENCE PRINCIPLES IMPLEMENTED HERE:
1. Approved Records Only:
   Only MAO-approved records represent official, verified production output.
   Pending or revised records may contain unverified estimates or data entry typos.

2. Never Mix Units (Unit Purity):
   Milk is measured in LITERS, meat in KILOGRAMS, eggs in PIECES.
   Mixing 100 liters of milk with 100 kilograms of meat into one series creates
   meaningless numbers. Every model targets a single (production_type, unit) pair.

3. Missing Data != Zero:
   If a farmer did not report in March 2025, that does NOT mean the cows produced 0 Liters.
   It means an observation was not recorded. In real data science, treating missing values
   as zero falsely pulls the trend line down. We aggregate available observations and
   distinguish observed months from missing periods.

4. Chronological Train/Test Split (Preventing Data Leakage):
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

from django.db.models import Sum
from django.db.models.functions import TruncMonth

from production.models import ProductionRecord

SEED_MARKER = "AI_SEED::PREDICTIVE_ANALYTICS::V1"
MIN_OBSERVATIONS_REQUIRED = 12  # Minimum monthly points to perform a meaningful train/test comparison


def extract_monthly_production_series(
    production_type: str = "MILK",
    unit: str = "LITERS",
    user=None,
) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Extracts approved ProductionRecords grouped by month for a specific commodity and unit.

    Returns:
        (df, metadata)
        - df: A pandas DataFrame with columns ['month', 'quantity'], indexed by DatetimeIndex,
              or None if insufficient data.
        - metadata: Dictionary containing observation counts, seed status, and messages.
    """
    # Step 1: Filter strictly for APPROVED records of the exact requested type & unit
    base_qs = ProductionRecord.objects.filter(
        status=ProductionRecord.ProductionStatus.APPROVED,
        production_type=production_type,
        unit=unit,
    )

    # Step 2: Check for test seed marker
    # This allows the API/UI to honestly disclose whether the data is seeded test data
    has_seed = base_qs.filter(notes__contains=SEED_MARKER).exists()

    # Step 3: Aggregate by calendar month
    # Multiple daily or weekly entries within the same month are summed to produce
    # the total monthly recorded output.
    monthly_data = (
        base_qs.annotate(month=TruncMonth("record_date"))
        .values("month")
        .annotate(total_quantity=Sum("quantity"))
        .order_by("month")
    )

    records = list(monthly_data)

    metadata = {
        "production_type": production_type,
        "unit": unit,
        "frequency": "MONTHLY",
        "is_seeded": has_seed,
        "total_records": base_qs.count(),
        "total_monthly_observations": len(records),
    }

    if len(records) < MIN_OBSERVATIONS_REQUIRED:
        metadata["status"] = "insufficient_data"
        metadata["message"] = (
            f"Insufficient historical data: Found {len(records)} monthly observation(s). "
            f"At least {MIN_OBSERVATIONS_REQUIRED} monthly observations are required to train and evaluate "
            f"predictive forecasting models reliably without fabricating scores."
        )
        return None, metadata

    # Step 4: Construct the pandas DataFrame
    # A DataFrame is a 2D tabular data structure with labeled axes (rows and columns).
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
    metadata["start_date"] = df["month"].min().strftime("%Y-%m-%d")
    metadata["end_date"] = df["month"].max().strftime("%Y-%m-%d")

    return df, metadata


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
