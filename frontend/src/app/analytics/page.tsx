'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { PageHeader } from '../components/page-header';
import { AskAIBar } from '../components/ask-ai-bar';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import PredictiveCharts from '../components/analytics/predictiveCharts';
import AdminForecastingConsole from '../components/analytics/adminforecasting';

export default function AnalyticsPage() {
  const router = useRouter();
  const [analyticsView, setAnalyticsView] = useState<'descriptive' | 'predictive' | 'prescriptive'>('descriptive');

  const mortalityByDisease = [
    { disease: 'FMD', cases: 6, percentage: 40 },
    { disease: 'Brucellosis', cases: 3, percentage: 20 },
    { disease: 'Mastitis', cases: 2, percentage: 13 },
    { disease: 'Old Age', cases: 4, percentage: 27 },
  ];

  const monthlyMortality = [
    { month: 'Oct', rate: 1.5, cases: 5 },
    { month: 'Nov', rate: 1.3, cases: 4 },
    { month: 'Dec', rate: 1.8, cases: 6 },
    { month: 'Jan', rate: 1.2, cases: 4 },
    { month: 'Feb', rate: 1.0, cases: 3 },
    { month: 'Mar', rate: 1.2, cases: 4 },
  ];

  const milkForecast = [
    { month: 'Apr (Actual)', actual: 99900, forecast: null },
    { month: 'May', actual: null, forecast: 102000 },
    { month: 'Jun', actual: null, forecast: 104100 },
    { month: 'Jul', actual: null, forecast: 103500 },
    { month: 'Aug', actual: null, forecast: 105800 },
    { month: 'Sep', actual: null, forecast: 107200 },
  ];

  const diseaseForecast = [
    { month: 'May', predicted: 2, confidence: 85 },
    { month: 'Jun', predicted: 1, confidence: 78 },
    { month: 'Jul', predicted: 3, confidence: 72 },
    { month: 'Aug', predicted: 2, confidence: 70 },
    { month: 'Sep', predicted: 1, confidence: 68 },
  ];

  const recommendations = [
    {
      id: 1,
      category: 'Disease Prevention',
      priority: 'high',
      title: 'Immediate FMD Vaccination Required',
      description: 'AI models predict 65% probability of FMD outbreak in Banaba Ibaba within 30 days. Recommend vaccination of all cattle within 5km radius.',
      action: 'Schedule mass vaccination campaign',
      impact: 'Prevent potential ₱350,000 in losses',
    },
    {
      id: 2,
      category: 'Production Optimization',
      priority: 'medium',
      title: 'Optimize Feed Mix for San Roque Farms',
      description: 'Analysis shows 12% lower milk yield compared to optimal. Adjusting feed composition could increase production.',
      action: 'Distribute improved feed formula',
      impact: 'Potential +8% milk production',
    },
    {
      id: 3,
      category: 'Supply Planning',
      priority: 'medium',
      title: 'Increased Demand Forecast',
      description: 'Predict 15% increase in milk demand for Q3 2026 based on market trends.',
      action: 'Increase breeding program',
      impact: 'Capture additional market share',
    },
    {
      id: 4,
      category: 'Resource Management',
      priority: 'low',
      title: 'Optimize Veterinary Schedules',
      description: 'Route optimization could reduce vet visit time by 25% across all barangays.',
      action: 'Implement new routing schedule',
      impact: 'Save 40 hours/month',
    },
  ];

  const priorityBorder: Record<string, string> = {
    high: 'border-red-500',
    medium: 'border-yellow-500',
    low: 'border-blue-500',
  };

  const priorityBadge: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
  };

  const getAINarrative = () => {
    const latestMilkActual = milkForecast[0].actual || 0;
    const forecastMilkEnd = milkForecast[milkForecast.length - 1].forecast || 0;
    const milkGrowth = (((forecastMilkEnd - latestMilkActual) / latestMilkActual) * 100).toFixed(1);

    const highRiskMonth = diseaseForecast.reduce((prev, current) =>
      (prev.predicted > current.predicted) ? prev : current
    );

    return {
      milkGrowth,
      highRiskMonth: highRiskMonth.month,
      confidence: highRiskMonth.confidence,
      predictedCases: highRiskMonth.predicted
    };
  };

  const aiInsights = getAINarrative();


  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="lgu" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto">
        <PageHeader
          title="Advanced Analytics"
          subtitle="AI-powered insights and predictions"
        />

        {/* AI Search Bar */}
        <div className="p-4 md:p-6 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <AskAIBar />
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Analytics Type Selector */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'descriptive', label: '📊 Descriptive Analytics' },
                { value: 'predictive', label: '🔮 Predictive Analytics' },
                { value: 'prescriptive', label: '💡 Prescriptive Analytics' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setAnalyticsView(value)}
                  className={`px-6 py-3 rounded-lg transition-colors ${analyticsView === value
                    ? 'bg-[#2D5A27] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Descriptive Analytics View */}
          {analyticsView === 'descriptive' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="mb-4">Historical Mortality Rates</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyMortality}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Cases', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="rate" stroke="#D32F2F" name="Mortality Rate (%)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="cases" stroke="#2D5A27" name="Total Cases" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="mb-4">Mortality Causes Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={mortalityByDisease}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ disease, percentage }) => `${disease}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cases"
                      >
                        {mortalityByDisease.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#D32F2F', '#F57C00', '#FBC02D', '#8BC34A'][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="mb-4">Disease Occurrence by Type</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mortalityByDisease}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="disease" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="cases" fill="#2D5A27" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="mb-2 text-blue-900">Key Insights</h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li>• Mortality rate decreased by 16.7% compared to last quarter</li>
                      <li>• FMD remains the leading cause at 40% of all cases</li>
                      <li>• San Roque and Quilo-quilo show lowest mortality rates</li>
                      <li>• Peak mortality observed in December due to weather conditions</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Predictive Analytics View */}
          {analyticsView === 'predictive' && (
            <div className="space-y-6">

              {/* 1. NARRATIVE AI SUMMARY GENERATOR (Top Priority) */}
              <AdminForecastingConsole />
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                      <Lightbulb className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-blue-900 font-bold text-lg">AI Executive Narrative</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Live Analysis</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <p className="text-gray-700 leading-relaxed text-lg">
                        Our AI models indicate a <span className="font-bold text-green-700">7.3% projected surge</span> in milk production across the municipality by Q3 2026, peaking at approximately <span className="font-bold text-gray-900">107,200 liters</span> per month.
                      </p>
                      <p className="text-gray-700 leading-relaxed mt-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mr-1">Alert:</span>
                        However, environmental data suggests a <span className="font-bold text-red-600">heightened disease risk for May</span>. With an 85% confidence score, we predict a small spike in FMD cases due to humidity changes. Pre-emptive vaccination in <span className="italic">San Roque</span> and <span className="italic">Banaba Ibaba</span> is highly recommended.
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">Predictive Indicators</h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Model Accuracy</span>
                          <span className="text-sm font-bold text-blue-600">92.5%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Production Trend</span>
                          <div className="flex items-center gap-1 text-green-600">
                            <TrendingUp className="w-3 h-3" />
                            <span className="text-sm font-bold italic">Bullish</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Risk Confidence</span>
                          <span className="text-sm font-bold text-orange-600">High (85%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <PredictiveCharts />

              {/* 2. CHARTS SECTION (Middle) */}
              <div className="grid grid-cols-1 gap-6">
                {/* Milk Production Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-gray-800 text-lg">6-Month Milk Production Forecast</h3>
                    <div className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">Unit: Liters (L)</div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={milkForecast}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis label={{ value: 'Liters', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="actual" stroke="#2D5A27" name="Actual Production" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="forecast" stroke="#FFA726" strokeDasharray="8 5" name="Predicted Production" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Disease Outbreak Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-800 text-lg mb-6">Disease Outbreak Probability Forecast</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={diseaseForecast}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" label={{ value: 'Predicted Cases', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Confidence %', angle: 90, position: 'insideRight', fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="predicted" fill="#D32F2F" name="Predicted Cases" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="confidence" stroke="#2D5A27" name="Model Confidence (%)" strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. SUMMARY CARDS (Bottom) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-green-200 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h4 className="font-bold text-gray-700">Milk Growth</h4>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">+7.3%</p>
                  <p className="text-sm text-gray-500 italic">Expected growth (6 months)</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-red-200 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h4 className="font-bold text-gray-700">Disease Risk</h4>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">Moderate</p>
                  <p className="text-sm text-gray-500 italic">9 predicted cases (6 months)</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-gray-700">Model Accuracy</h4>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">92.5%</p>
                  <p className="text-sm text-gray-500 italic">Based on historical training</p>
                </div>
              </div>
            </div>
          )}

          {/* Prescriptive Analytics View */}
          {analyticsView === 'prescriptive' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-[#2D5A27] to-[#3d7234] text-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Lightbulb className="w-8 h-8" />
                  <h3 className="text-white">AI-Powered Recommendations</h3>
                </div>
                <p className="text-white/90">
                  Based on predictive models and historical patterns, here are actionable recommendations to optimize livestock management.
                </p>
              </div>

              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${priorityBorder[rec.priority]}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs uppercase ${priorityBadge[rec.priority]}`}>
                          {rec.priority} Priority
                        </span>
                        <span className="text-sm text-gray-500">{rec.category}</span>
                      </div>
                      <h4 className="mb-2">{rec.title}</h4>
                      <p className="text-gray-600 mb-3">{rec.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-[#2D5A27]">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">{rec.action}</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-600">
                          <TrendingUp className="w-4 h-4" />
                          <span>{rec.impact}</span>
                        </div>
                      </div>
                    </div>
                    <button className="ml-4 px-4 py-2 bg-[#2D5A27] text-white rounded-lg hover:bg-[#3d7234] transition-colors whitespace-nowrap">
                      Take Action
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="mb-2 text-green-900">Implementation Impact Summary</h4>
                    <ul className="space-y-2 text-sm text-green-800">
                      <li>• Potential prevention of ₱350,000+ in disease-related losses</li>
                      <li>• Expected 8-10% increase in milk production efficiency</li>
                      <li>• 40+ hours saved per month in resource optimization</li>
                      <li>• Improved market competitiveness through demand forecasting</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
