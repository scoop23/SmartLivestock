"""
Predictive Time-Series Forecasting Models & Training Pipeline.

=============================================================================
EDUCATIONAL OVERVIEW: MACHINE LEARNING CONCEPTS
=============================================================================
What is Machine Learning in this context?
In our livestock system, we have a series of historical monthly production numbers:
[420, 435, 410, 460, 475, ...]

Instead of a human manually typing fixed formulas, ML algorithms discover patterns
from historical data. Here is what each concept means:

1. X (Features / Independent Variables):
   The inputs used to make a prediction. In our tabular models (Linear Regression &
   Random Forest), X is a matrix where each row contains past observations:
   [lag_1, lag_2, lag_3, rolling_mean, month_num, time_step].

2. y (Target / Dependent Variable):
   The true value we want to predict. In our case, the recorded production quantity for
   that month.

3. fit(X, y):
   The training phase. The model adjusts its internal parameters (e.g. slopes, decision thresholds)
   to minimize the difference between its estimates and the true values y.

4. predict(X):
   The inference phase. The trained model takes new (unseen) input features X and computes
   its prediction y_pred.

5. Overfitting vs. Generalization:
   Overfitting happens when a model memorizes past noise instead of true underlying patterns.
   Such a model scores great on training data but fails terribly on future test data.
   Our fair chronological test set reveals whether models truly generalize.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from .data import prepare_tabular_features, chronological_split

FEATURE_COLS = ["time_step", "month_num", "lag_1", "lag_2", "lag_3", "rolling_mean_3"]


class NaiveBaselineModel:
    """
    Model 1: Naive (Persistence) Baseline.

    How it works:
    The forecast for time t is simply the observed value at time t - 1.
      y_hat[t] = y[t-1]

    Why it matters:
    This is the foundational baseline for all time-series analysis. If an advanced
    ML model (like Random Forest or ARIMA) cannot achieve lower error than a naive persistence
    guess, then using the complex model is unjustified in production.
    """
    def __init__(self):
        self.last_observed = None

    def fit(self, y_train: pd.Series):
        self.last_observed = float(y_train.iloc[-1])
        return self

    def predict_test(self, test_df: pd.DataFrame, train_df: pd.DataFrame) -> np.ndarray:
        """
        One-step-ahead persistence forecast for the test period.
        For each test month t, the naive prediction is the value from month t - 1.
        """
        # Combine the last observation of train with test to get t-1 for all test points
        full_series = pd.concat([train_df["quantity"].iloc[[-1]], test_df["quantity"]]).values
        return full_series[:-1]


class TabularLinearRegression:
    """
    Model 2: Multiple Linear Regression (scikit-learn).

    Mathematical Formulation:
      y = beta_0 + beta_1 * time_step + beta_2 * month_num + beta_3 * lag_1 + ... + epsilon

    How fit() works:
    scikit-learn's LinearRegression calculates the Ordinary Least Squares (OLS) solution,
    finding beta coefficients that minimize the sum of squared differences between actual
    and predicted values on the training set.

    Strengths: Interpretable, fast, establishes trend.
    Weaknesses: Assumes linear relationships; cannot model complex non-linear seasonal waves.
    """
    def __init__(self):
        self.model = LinearRegression()
        self.feature_names = FEATURE_COLS

    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        self.model.fit(X_train[self.feature_names], y_train)
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict(X[self.feature_names])


class TabularRandomForest:
    """
    Model 3: Random Forest Regressor (scikit-learn).

    How it works:
    An ensemble algorithm that constructs a collection of Decision Trees (n_estimators=50).
    During training, each tree is grown on a random bootstrap sample of the training data,
    and at each split point, only a random subset of features is considered.
    The final prediction is the average of all individual tree predictions.

    Why random_state=42?
    Ensures reproducibility: every run of the pipeline produces identical tree splits and results.

    Strengths: Captures complex non-linear patterns and feature interactions without assuming linearity.
    Weaknesses: Cannot extrapolate outside historical min/max values (cannot project infinite linear trend).
    """
    def __init__(self, random_state: int = 42):
        self.model = RandomForestRegressor(
            n_estimators=50,
            max_depth=5,
            min_samples_split=2,
            random_state=random_state,
        )
        self.feature_names = FEATURE_COLS

    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        self.model.fit(X_train[self.feature_names], y_train)
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict(X[self.feature_names])


class ARIMAForecaster:
    """
    Model 4: ARIMA (Autoregressive Integrated Moving Average) via statsmodels.

    Components:
    - AR (p=1): AutoRegressive part. Uses the dependent relationship between an observation
      and a number of lagged observations (p=1 means output depends on previous month).
    - I (d=1): Integrated part. Differencing the raw observations (subtracting an observation
      from an observation at the previous time step) to make the time series stationary
      (removing constant trend).
    - MA (q=1): Moving Average part. Uses the dependency between an observation and a residual
      error from a moving average model applied to lagged observations.

    Order: (p=1, d=1, q=1) — a standard, defensible time-series configuration.
    """
    def __init__(self, order=(1, 1, 1)):
        self.order = order
        self.fitted_model = None

    def fit(self, train_series: pd.Series):
        model = ARIMA(train_series, order=self.order)
        self.fitted_model = model.fit()
        return self

    def predict_steps(self, steps: int) -> np.ndarray:
        forecast_res = self.fitted_model.forecast(steps=steps)
        return np.array(forecast_res)


class HoltWintersForecaster:
    """
    Model 5: Holt-Winters Exponential Smoothing via statsmodels.

    How it works:
    Exponential smoothing assigns exponentially decreasing weights to older observations.
    Holt-Winters models three components:
    1. Level (baseline estimate)
    2. Trend (additive rate of increase/decrease)
    3. Seasonality (cyclical patterns repeating every S periods, e.g. 12 months)

    Data Requirement:
    Seasonality with period=12 requires at least 2 full cycles (24 monthly observations).
    If fewer than 24 observations exist in the training window, we fall back to Holt's
    Linear Trend (level + trend, no seasonal), rather than raising an error or fabricating values.
    """
    def __init__(self, seasonal_periods: int = 12):
        self.seasonal_periods = seasonal_periods
        self.fitted_model = None
        self.has_seasonality = False

    def fit(self, train_series: pd.Series):
        n_obs = len(train_series)
        if n_obs >= 2 * self.seasonal_periods:
            # Full Holt-Winters with additive trend and additive seasonality
            model = ExponentialSmoothing(
                train_series,
                trend="add",
                seasonal="add",
                seasonal_periods=self.seasonal_periods,
                initialization_method="estimated",
            )
            self.has_seasonality = True
        else:
            # Fallback: Holt's linear trend without seasonal (insufficient data for full cycle)
            model = ExponentialSmoothing(
                train_series,
                trend="add",
                seasonal=None,
                initialization_method="estimated",
            )
            self.has_seasonality = False

        self.fitted_model = model.fit()
        return self

    def predict_steps(self, steps: int) -> np.ndarray:
        forecast_res = self.fitted_model.forecast(steps=steps)
        return np.array(forecast_res)
