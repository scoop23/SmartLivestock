# Cattle profile weekly forecast

The annotated implementation is in `services/cattle_price_forecast.py`.
The existing `services/cattle_price.py` loads approved, permission-scoped cattle
transfer snapshots and supplies them to this module. Registered and external
sales are queried separately. Real-sales mode excludes marked synthetic/demo sales.

## Read the code in this order

1. `PriceSale`: one sale, its sale-time traits, price, and availability date.
   Availability is the later of submission and approval. Missing dates prevent
   that week from being used for forecasting.
2. `ridge_pipeline`: scale age/weight and encode breed/sex, then fit Ridge to
   the individual purchase prices. This estimates the price component explained
   by the recorded traits.
3. `fit_before`: subtract Ridge's estimates from actual prices. Average these
   residuals by week, then fit ARIMA(1,0,1) to the weekly adjustment series.
4. `weekly_profile_forecast`: repeat both fits at historical Monday cutoffs.
   Compare later sale prices with conditional predictions for their known
   profiles. The later prices never enter the fitted models.
5. Once checks pass, fit the latest eligible history and add each forecast
   adjustment to the selected fixed profile's Ridge estimate.

    future profile price = trait price + forecast weekly adjustment

## Readiness and interpretation

- At least 80 complete sales and 26 consecutive recent recorded weeks are
  required. These are application defaults, not evidence of accuracy.
- Unknown weeks are never filled with zero. The source describes captured,
  approved transfers rather than every cattle sale in the market.
- Training ends before the current Monday. The unfinished current week is
  skipped; future points start next Monday and cover the requested 1-12 weeks.
- At least four successful rolling cutoffs are required. The hybrid must beat
  both Ridge alone and Ridge plus the latest weekly residual, using equal-week
  mean absolute error in pesos per head. Overlapping cutoffs are not independent.
- Age/weight ranges use a grid of up to 25 fixed profiles. Their traits do not
  age or gain weight across the forecast horizon. Unknown traits give recorded
  comparisons only; unsupported profile ranges do not receive a forecast.
- The shaded band combines profile variation with the 80th percentile of
  historical absolute forecast errors. It is a descriptive calibration band,
  not a guaranteed 80% interval. Validation errors are source-wide, not a claim
  of accuracy for each individual breed/sex combination.
- The optional Model performance panel reports MAE, RMSE, and R² from these
  same later-sale predictions. Each week/check has equal weight for all three
  forecast methods. R² uses that weighted evaluation-set mean and is null when
  actual prices are constant. It is not percentage accuracy. MAE remains the
  readiness gate; RMSE and R² provide additional diagnostics.
- Performance includes scores by lead week, cutoff dates, total prediction
  comparisons, and distinct sale counts. Overlapping windows may score the same
  sale multiple times. The trait-only Ridge/Random Forest table uses its separate
  chronological holdout and ordinary per-sale weighting; compare methods within
  each table. Opening the panel or zooming does not change the evaluation set.
- Models are fitted in memory for the current scoped request. No sale records
  are changed and no fitted model file is saved by this endpoint.

The UI is under Cattle Price per Head -> Registered/External -> Price by Animal
Profile on `/analysis/predictive`. It retains recorded history when forecasting
is unavailable and explains the unmet readiness condition.

## Forecast seed demonstration

The `seed_forecast_quality_demo` command sets up the ideal scenario in one command:

```powershell
# Run from backend, against the intended local development database.
$env:SMARTLIVESTOCK_ENV_FILE = '.env.local'
$env:SMARTLIVESTOCK_DEMO_ENV = 'development'
$env:SMARTLIVESTOCK_DEMO_DATABASE_ACK = 'development:smart_livestock'
.\.venv\Scripts\python.exe manage.py seed_forecast_quality_demo --scenario ideal
```

It creates 104 complete recorded weeks with realistic seasonal and weekly volume
fluctuations (averaging ~56 registered and ~56 external cattle transfers per week,
totaling ~11,700 transfers), along with 36 months of dairy milk and slaughter meat records.
An optional `--prices-only` flag is also available if you only want the cattle price transfers without milk or slaughter records.

The profile view uses one data view, with the example Male, Brahman, 2 to under
4 years, 350 to under 500 kg. Both source choices support it. Its default API
mode is AUTO: real approved sales take priority, including incomplete sales that
may not yet support training. With DEBUG enabled and no real approved sales in
the scoped source, it can use only `AI_SEED::CATTLE_PRICE::V1` as a clearly
labeled sample. Production AUTO never falls back to seed data. Explicit REAL
and DEMO API modes remain available for isolated checks. Real and synthetic
records are never mixed for profile-model training. Existing permission scopes
apply to both modes. A field user may see fewer fixtures than a municipal reviewer.

The seed has a deliberately constructed alternating, decaying weekly adjustment
and balanced trait combinations. Passing backtests on this data demonstrates
the implementation, not real price accuracy. Readiness gates are not bypassed.

Cleanup uses the same flags plus `--clean`, requires
`SMARTLIVESTOCK_DEMO_ALLOW_CLEANUP=YES`, and removes only this dedicated marker's
transfers and synthetic inventory. The full-market ideal/poor seeds and reused
accounts are retained.
