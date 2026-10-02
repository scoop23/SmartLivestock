# SmartLivestock — Comprehensive Predictive & Prescriptive Analytics Learning Guide

Welcome to the **SmartLivestock-Batangas Predictive Analytics Architecture & Machine Learning Guide**.

This guide is designed for student developers, municipal agriculture data officers, and academic presentation panels. It explains not only what the system does, but **mathematically and conceptually how it works**, why specific design choices were made, and how to defend each layer.

---

## The End-to-End Analytics Pipeline

```text
                           DATABASE (PostgreSQL)
                                     │
                                     ▼
                        Approved ProductionRecords
                        (Only status='APPROVED')
                                     │
                                     ▼
                             Data Preparation
                             (pandas / numpy)
                          • Group by calendar month
                          • Unit isolation (e.g. MILK/LITERS)
                          • Missing data != Zero
                                     │
                                     ▼
                            Monthly Time Series
                                     │
               ┌─────────────────────┼─────────────────────┐
               ▼                     ▼                     ▼
        Lag & Rolling          Univariate Series     Calendar Time
        Feature Matrix         (Quantity array)      (Month & Step)
        [lag1, lag2, roll3]          │               [month_num, t]
               │                     │                     │
               ▼                     ▼                     ▼
     Tabular ML Models         Time-Series Models    Naive Baseline
     • Linear Regression       • ARIMA(1,1,1)        • Persistence (t-1)
     • Random Forest (50)      • Holt-Winters (Exp)
               │                     │                     │
               └─────────────────────┼─────────────────────┘
                                     │
                                     ▼
                      Fair Chronological Evaluation
                      (Unseen 20% Out-of-Sample Test)
                       Metrics: MAE, RMSE, R²
                                     │
                                     ▼
                         Data-Driven Model Selection
                        (Selected by lowest test MAE)
                                     │
                                     ▼
                         Full History Re-fitting
                                     │
                                     ▼
                         Future Out-of-Sample
                         Forecast (+3 to +12 months)
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
             Interactive UI                   Prescriptive Rules
             (Recharts Line/Area)             (Deterministic Domain Guidelines)
                     │                               │
                     └───────────────┬───────────────┘
                                     ▼
                          MAO / SIBAT Decision
```

---

## 1. What Predictive Analytics Means

In agricultural information systems, analytics exists on three distinct maturity levels:

- **Descriptive Analytics ("What happened?"):**
  Aggregates historical transactions.
  *Example:* "Farmers in Padre Garcia produced 450 Liters of milk in September 2026."
- **Predictive Analytics ("What is likely to happen?"):**
  Learns historical patterns, seasonal cycles, and momentum trends to project future quantities.
  *Example:* "Based on the last 36 months of data, next month's milk yield is projected to be 472 Liters."
- **Prescriptive Analytics ("What action should be taken?"):**
  Synthesizes forecasts, disease reports, and operational thresholds to recommend concrete municipal actions.
  *Example:* "Projected yield decline exceeds 10%; schedule field technologist visits to inspect feed and lactation cycles."

---

## 2. What Our Prediction Target Is

A forecasting target must represent a single, well-defined physical quantity.

In SmartLivestock:
- **Target commodity:** `MILK` (dairy cattle yield)
- **Target unit:** `LITERS`
- **Time frequency:** `MONTHLY` aggregation

### Why We Never Mix Units:
- Milk is measured in **LITERS**.
- Meat/Carcass is measured in **KILOGRAMS**.
- Eggs are measured in **PIECES**.
- Wool is measured in **KILOGRAMS**.

If an algorithm combined 500 liters of milk, 200 kilograms of meat, and 1,000 eggs into a single numerical column, the numbers would have no physical or economic meaning. A model trained on mixed units would optimize for an arbitrary mathematical sum rather than real production capacity.

---

## 3. How ProductionRecord Becomes a Dataset

In Django, `ProductionRecord` stores individual logging events submitted by farmers or reviewers:

```python
class ProductionRecord(models.Model):
    livestock = models.ForeignKey(...)
    production_type = models.CharField(...)  # MILK, MEAT, EGGS, WOOL
    quantity = models.DecimalField(...)
    unit = models.CharField(...)             # LITERS, KILOGRAMS, PIECES
    record_date = models.DateField()
    status = models.CharField(...)           # PENDING, APPROVED, etc.
```

To transform these rows into an ML time series:
1. **Filter by Authoritative Status:** We query only `status='APPROVED'`. Draft, pending, or returned records are excluded because they have not undergone SIBAT verification or MAO final review.
2. **Filter by Target & Unit:** We strictly filter `production_type='MILK'` and `unit='LITERS'`.
3. **Monthly Truncation:** We annotate each date with `TruncMonth('record_date')`.
4. **Aggregate Sum:** Multiple daily or weekly entries in the same month are aggregated with `Sum('quantity')`.

---

## 4. What pandas Does

`pandas` is the standard Python data science library for structured tabular data.

Key functions used in SmartLivestock:
- **`pd.DataFrame`:** A 2-dimensional labeled data structure (like an in-memory SQL table or spreadsheet).
- **`df.sort_values('month')`:** Orders observations strictly from oldest to newest.
- **`df['quantity'].shift(1)`:** Shifts values down by 1 row to generate lag features without leaking future rows.
- **`df['quantity'].rolling(window=3).mean()`:** Computes a 3-month moving average of recent production.
- **`df.dropna()`:** Removes initial rows that lack sufficient past history for lag calculations.

### Missing Data != Zero
If no records exist for March 2025, that does **NOT** mean Padre Garcia produced 0 Liters of milk. Cows do not stop producing milk simply because a record was not submitted. In SmartLivestock, missing periods represent an absence of reporting, not zero production. We do not fill missing periods with 0.0, because doing so would falsely pull down trend lines and distort model variance.

---

## 5. What X and y Mean in Supervised Learning

Machine learning algorithms do not understand raw time sequences directly; they learn mathematical mapping functions between inputs and outputs:

$$y = f(X)$$

- **$X$ (Feature Matrix / Independent Variables):**
  The predictors or signals available to make a forecast:
  - `time_step`: An integer sequence ($0, 1, 2, \dots, N$) that captures long-term upward or downward linear trend.
  - `month_num`: Calendar month ($1 \dots 12$) that informs the model about annual cyclicality.
  - `lag_1`: Production quantity from 1 month ago ($t - 1$).
  - `lag_2`: Production quantity from 2 months ago ($t - 2$).
  - `lag_3`: Production quantity from 3 months ago ($t - 3$).
  - `rolling_mean_3`: Moving average of the last 3 observed months.
- **$y$ (Target Vector / Dependent Variable):**
  The actual recorded monthly production quantity we want to predict.

---

## 6. Chronological Train/Test Split

When evaluating models, we split our historical observations into two parts:
1. **Training Set ($80\%$ oldest observations):** Used by the algorithms to fit parameters, find split points, or estimate coefficients.
2. **Testing Set ($20\%$ newest observations):** Kept completely hidden during training. The models must predict these unseen periods, and their predictions are compared against actual values.

```text
TIMELINE: 2022 ──────────► 2024 ──────────► 2025 ──────────► 2026
          [─────── TRAINING SET (80%) ───────] [── TEST SET (20%) ──]
                   (Algorithm Learns)           (Algorithm Evaluated)
```

---

## 7. Data Leakage (The Cardinal Sin of Time Series)

**Data leakage** occurs when information from the future or from the test set inadvertently enters the training process.

### Examples of Data Leakage to Avoid:
1. **Random Splitting (`shuffle=True`):**
   If we randomly shuffle rows, the model might train on May 2026 and then be "tested" on April 2026. Because it already saw the future, its test score will look artificially high, but it will fail in the real world.
2. **Unshifted Rolling Features:**
   If `rolling_mean_3` included the current month's target $y_t$, the model would simply learn to copy the feature rather than forecast it. In our code, we explicitly use `.shift(1)` before `.rolling(3)` to ensure rolling statistics only use past observations.

---

## 8. Model 1 — Naive Baseline (Persistence)

### How it works:
$$\hat{y}_{t} = y_{t-1}$$
The forecast for next month is simply whatever was observed in the most recent month.

### Why it matters:
The Naive baseline is the gold standard benchmark in time-series forecasting. If a sophisticated Machine Learning model (like Random Forest or ARIMA) cannot achieve lower prediction error than this simple rule, the complex model should **not** be deployed.

---

## 9. Model 2 — Linear Regression (scikit-learn)

### How it works:
`sklearn.linear_model.LinearRegression` finds the linear combination of input features that minimizes the Residual Sum of Squares (Ordinary Least Squares):

$$\hat{y} = \beta_0 + \beta_1 \cdot \text{time\_step} + \beta_2 \cdot \text{month\_num} + \beta_3 \cdot \text{lag\_1} + \dots$$

- **`fit(X, y)`:** Solves the linear algebra equation $(X^T X)^{-1} X^T y$ to find the optimal $\beta$ coefficients.
- **`predict(X)`:** Computes dot products of new feature vectors with the learned $\beta$ weights.

**Pros:** Extremely fast, highly interpretable, captures global trend.  
**Cons:** Assumes strict linear relationships; cannot model complex non-linear waves.

---

## 10. Model 3 — Random Forest Regressor (scikit-learn)

### How it works:
`sklearn.ensemble.RandomForestRegressor` is an ensemble of 50 Decision Trees.
1. **Bootstrapping (Bagging):** Each tree is trained on a random sample of the training data with replacement.
2. **Feature Subsampling:** At each node split, only a random subset of features is evaluated.
3. **Averaging:** The final prediction is the average of all 50 individual tree predictions.

$$\hat{y} = \frac{1}{B} \sum_{b=1}^{B} T_b(X)$$

- **Deterministic Seed (`random_state=42`):** Ensures that tree splits are 100% reproducible across test runs.

**Pros:** Captures non-linear thresholds and complex feature interactions without manual feature transformations.  
**Cons:** Decision trees cannot extrapolate beyond the minimum and maximum values seen in training data.

---

## 11. Model 4 — ARIMA (statsmodels)

### How it works:
**ARIMA(p, d, q)** stands for **AutoRegressive Integrated Moving Average**. Unlike regression models, ARIMA operates directly on the univariate sequence without requiring manual tabular feature engineering:
- **AR ($p=1$):** Autoregression. Today's value depends linearly on the previous month's value ($\phi_1 y_{t-1}$).
- **I ($d=1$):** Integrated differencing. Subtracts previous observations ($y_t - y_{t-1}$) to stabilize non-stationary trends.
- **MA ($q=1$):** Moving Average. Models dependency on recent forecast error residuals ($\theta_1 \epsilon_{t-1}$).

Order used: **ARIMA(1, 1, 1)** — a standard, mathematically defensible configuration for monthly production.

---

## 12. Model 5 — Holt-Winters Exponential Smoothing (statsmodels)

### How it works:
Exponential smoothing models three separate time-series components with exponentially decaying historical weights:
1. **Level ($\ell_t$):** The baseline smoothed value.
2. **Trend ($b_t$):** The additive rate of growth or decline.
3. **Seasonality ($s_t$):** Periodic fluctuations that repeat every $m=12$ months.

$$\hat{y}_{t+h} = \ell_t + h b_t + s_{t+h-m}$$

### Seasonality Requirement:
To reliably estimate 12-month seasonality, the dataset must span at least **two full seasonal cycles (24 monthly observations)**. If fewer than 24 observations exist, our implementation automatically falls back to Holt's Linear Trend (level + trend, without seasonal terms) and reports this status honestly in the API response.

---

## 13. MAE (Mean Absolute Error)

$$\text{MAE} = \frac{1}{n} \sum_{i=1}^{n} |y_i - \hat{y}_i|$$

- **Units:** Exact same unit as the target (e.g. `LITERS`).
- **Meaning:** "On average, how many Liters was our prediction away from actual production?"
- **Example:** An MAE of $14.2\text{ L}$ means our model was off by an average of 14.2 Liters per month during the test period.

---

## 14. RMSE (Root Mean Squared Error)

$$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} (y_i - \hat{y}_i)^2}$$

- **Meaning:** Errors are squared before averaging, which severely penalizes large outlier mistakes.
- **Relationship with MAE:** $\text{RMSE} \ge \text{MAE}$. If RMSE is much higher than MAE, it indicates the model made a few very large errors on specific months.

---

## 15. R² (Coefficient of Determination)

$$R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$$

- **Meaning:** The proportion of variance in production explained by the model compared to a naive horizontal line through the historical average $\bar{y}$.
- **Values:**
  - $R^2 = 1.0$: Perfect fit.
  - $R^2 = 0.0$: Performs no better than predicting the historical average.
  - $R^2 < 0.0$: Performs worse than the historical average (often happens if a non-stationary model overshoots on out-of-sample data).

---

## 16. Fair Model Comparison

In SmartLivestock, model comparison is governed by three strict rules:
1. **Identical Target & Unit:** Every model predicts the exact same column (`MILK` in `LITERS`).
2. **Identical Training Window:** Every model is trained on the exact same historical dates.
3. **Identical Unseen Test Set:** Every model is evaluated on the exact same test months.

The system selects the winning model based on **lowest validation MAE**.

---

## 17. Out-of-Sample Future Forecasting

Once the best model is identified:
1. The selected model is re-fitted on the **entire available historical dataset** (both train and test periods up to the present).
2. The model projects forward into the future for a configurable horizon ($3$, $6$, or $12$ months).
3. The API packages both historical actuals and future predictions into a single timeline so the frontend Recharts line chart connects smoothly from the last observed month into the forecast line.

---

## 18. Prescriptive Rules (Transparent Decision Support)

Prescriptive analytics is **NOT** a black-box AI model. It is a deterministic, rule-based recommendation engine that evaluates:

$$\text{Forecast} + \text{Observed Data} + \text{Municipal Thresholds} \longrightarrow \text{Actionable Guideline}$$

### Implemented Rules:
| Rule ID | Severity | Condition | Quantified Evidence | Recommended Action |
| --- | --- | --- | --- | --- |
| `PRODUCTION_DECLINE_ALERT` | HIGH / MEDIUM | Forecast drops $\ge 10\%$ below recent 3-month baseline | Baseline avg vs. Forecast avg (% drop) | Schedule field visits with livestock technologists to inspect feed and pasture conditions. |
| `PRODUCTION_SURGE_PREPARATION` | LOW (Info) | Forecast increases $\ge 10\%$ above recent baseline | Baseline avg vs. Forecast avg (% gain) | Coordinate with collection centers and dairy coops to ensure cold-storage and logistics readiness. |
| `STABLE_PRODUCTION_OUTLOOK` | LOW | Forecast within $\pm 10\%$ of baseline | Baseline vs. Forecast alignment | Maintain standard rotational monitoring and quarterly census verification. |
| `DISEASE_SURVEILLANCE_PRESSURE` | HIGH / MEDIUM | Approved `DiseaseCase` events recorded in past 90 days | Active case count & affected heads | Deploy SIBAT surveillance officers for targeted health checks and verify herd movement permits. |
| `LOW_VACCINATION_COVERAGE` | MEDIUM | Verified vaccination coverage $< 60\%$ of approved inventory | Vaccinated heads vs. Total heads | Prioritize municipal vaccination campaign scheduling with MAO veterinary staff. |

---

## 19. Known Limitations & Academic Defensibility

When presenting this work to your capstone panel, be honest and precise about its scope:
1. **Recorded Production vs. Total Municipal Census:** The models forecast **recorded production** submitted through the SmartLivestock system, not unrecorded private backyard farming.
2. **Sample Size:** High-confidence statistical models benefit from 36+ consecutive monthly observations. In the absence of multi-year real historical records, testing uses the safe `seed_productions` command.
3. **Non-Veterinary Scope:** Prescriptive rules provide operational and municipal guidance (logistics, inspections, vaccination scheduling), never clinical diagnoses or medication prescriptions.
