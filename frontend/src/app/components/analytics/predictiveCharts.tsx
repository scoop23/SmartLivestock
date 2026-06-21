'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function PredictiveCharts() {
  // Holt-Winters Exponential Smoothing Data - Forecasted Meat Supply
  const meatSupplyData = [
    { month: "Jan", actual: 2100, forecast: 2100, label: "Q1 2026" },
    { month: "Feb", actual: 2250, forecast: 2230, label: "Q1 2026" },
    { month: "Mar", actual: 2180, forecast: 2190, label: "Q1 2026" },
    { month: "Apr", actual: 2320, forecast: 2310, label: "Q2 2026" },
    { month: "May", actual: 2450, forecast: 2440, label: "Q2 2026" },
    { month: "Jun", actual: 2380, forecast: 2390, label: "Q2 2026" },
    { month: "Jul", actual: null, forecast: 2520, label: "Q3 2026" },
    { month: "Aug", actual: null, forecast: 2680, label: "Q3 2026" },
    { month: "Sep", actual: null, forecast: 2847, label: "Q3 2026" },
  ];

  // NEW: ARIMA Weekly Production Forecast (replacing disease propensity)
  const productionArimaData = [
    { week: "W14", yield: 5800, forecast: 5800, quarter: "Q2" },
    { week: "W15", yield: 6100, forecast: 6100, quarter: "Q2" },
    { week: "W16", yield: 5950, forecast: 5950, quarter: "Q2" },
    { week: "W17", yield: 6200, forecast: 6200, quarter: "Q2" }, // Current
    { week: "W18", yield: null, forecast: 6450, quarter: "Q2" },
    { week: "W19", yield: null, forecast: 6700, quarter: "Q2" },
    { week: "W20", yield: null, forecast: 6950, quarter: "Q2" },
    { week: "W21", yield: null, forecast: 7100, quarter: "Q2" },
  ];

  // Linear Regression - Herd Growth Rate
  const herdGrowthData = [
    { year: "2022", herdSize: 38500, regression: 38200, growth: 0 },
    { year: "2023", herdSize: 41200, regression: 41100, growth: 7.0 },
    { year: "2024", herdSize: 44800, regression: 44000, growth: 8.7 },
    { year: "2025", herdSize: 47100, regression: 46900, growth: 5.1 },
    { year: "2026", herdSize: 48523, regression: 49800, growth: 3.0 },
    { year: "2027", herdSize: null, regression: 52700, growth: 5.8 },
    { year: "2028", herdSize: null, regression: 55600, growth: 5.5 },
  ];

  // Inventory vs Slaughter Capacity
  const inventoryData = [
    { category: "Brahman", inventory: 12500, capacity: 15000 },
    { category: "Holstein-Friesian", inventory: 8200, capacity: 10000 },
    { category: "Native Cattle", inventory: 18300, capacity: 20000 },
    { category: "Crossbreed", inventory: 9523, capacity: 12000 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Forecasted Meat Supply - Holt-Winters */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Forecasted Meat Supply (Metric Tons) - Q3 2026
          </h3>
          <p className="text-sm text-gray-600">
            Holt-Winters Exponential Smoothing | Trend Line: y = mx + b
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={meatSupplyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis label={{ value: "Metric Tons", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#2D5A27"
              fill="#2D5A27"
              fillOpacity={0.6}
              name="Actual"
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#FFBF00"
              fill="#FFBF00"
              fillOpacity={0.4}
              strokeDasharray="5 5"
              name="Forecast (Holt-Winters)"
            />
            <ReferenceLine x="Jun" stroke="#1A365D" strokeDasharray="3 3" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center justify-between bg-white rounded-lg p-3">
          <div>
            <p className="text-xs text-gray-600">Q3 2026 Forecast</p>
            <p className="text-2xl font-bold text-[#2D5A27]">2,847 MT</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Growth Rate</p>
            <p className="text-xl font-bold text-green-600">+19.6%</p>
          </div>
        </div>
      </div>

      {/* REPLACED: Weekly Production Yield - ARIMA */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Weekly Production Forecast (Milk L)
          </h3>
          <p className="text-sm text-gray-600">
            ARIMA (2,1,0) Time-Series Analysis | Weekly Aggregates
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={productionArimaData}>
            <defs>
              <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" />
            <YAxis label={{ value: "Liters", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Area
              type="stepAfter"
              dataKey="yield"
              stroke="#4F46E5"
              strokeWidth={3}
              fill="url(#colorProd)"
              name="Actual Yield"
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#4F46E5"
              strokeWidth={2}
              fill="transparent"
              strokeDasharray="5 5"
              name="ARIMA Projection"
            />
            <ReferenceLine x="W17" stroke="#6366f1" strokeDasharray="3 3" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 bg-white rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Short-term Outlook</p>
              <p className="text-lg font-bold text-indigo-600">
                Increasing Yield (+14.5%)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">AIC Score</p>
              <p className="text-sm font-semibold text-gray-900">142.8 (Optimal)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estimated Herd Growth Rate - Linear Regression */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Estimated Herd Growth Rate
          </h3>
          <p className="text-sm text-gray-600">
            Linear Regression | Based on Mortality vs. Birth Records
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={herdGrowthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis label={{ value: "Herd Size", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="herdSize"
              stroke="#1A365D"
              strokeWidth={3}
              name="Actual Herd Size"
              dot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="regression"
              stroke="#FFBF00"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Regression Line (y=mx+b)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 bg-white rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-2">Regression Equation</p>
          <p className="font-mono text-sm text-gray-900 font-semibold">
            y = 2,900x + 35,300
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Average Annual Growth: 5.8% | R² = 0.94
          </p>
        </div>
      </div>

      {/* Inventory vs Slaughter Capacity - Supply Planning */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Inventory vs. Slaughter Capacity
          </h3>
          <p className="text-sm text-gray-600">
            Supply Planning Logic - Batangas Livestock
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={inventoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis label={{ value: "Head Count", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="inventory" fill="#2D5A27" name="Current Inventory" />
            <Bar dataKey="capacity" fill="#1A365D" name="Slaughter Capacity" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 bg-white rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Total Inventory</p>
              <p className="text-xl font-bold text-[#2D5A27]">48,523 heads</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Capacity Utilization</p>
              <p className="text-xl font-bold text-[#1A365D]">85.2%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}