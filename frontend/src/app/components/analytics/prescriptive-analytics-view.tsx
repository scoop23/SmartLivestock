"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  Info,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PrescriptiveEvidence {
  [key: string]: string | number;
}

interface RecommendationItem {
  rule: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  reason: string;
  evidence: PrescriptiveEvidence;
  recommendation: string;
  action_type: string;
}

interface PrescriptiveResponse {
  status: "ready" | "error";
  target: {
    production_type: string;
    unit: string;
  };
  forecast_status: string;
  is_seeded: boolean;
  total_recommendations: number;
  recommendations: RecommendationItem[];
}

export default function PrescriptiveAnalyticsView() {
  const [data, setData] = useState<PrescriptiveResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .get<PrescriptiveResponse>("analytics/prescriptive/", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (active) setData(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          setError("Failed to load prescriptive recommendations. Check backend availability.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-3">
          <AlertCircle className="size-6 text-red-600" />
          <h3 className="font-bold text-lg">Prescriptive Analytics Unavailable</h3>
        </div>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Button
          onClick={() => setRefreshTrigger((p) => p + 1)}
          className="mt-4 bg-red-700 text-white hover:bg-red-800"
          size="sm"
        >
          <RefreshCw className="mr-2 size-4" /> Retry
        </Button>
      </div>
    );
  }

  const recommendations = data?.recommendations ?? [];

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs">High Severity</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs">Medium Severity</Badge>;
      default:
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">Informational</Badge>;
    }
  };

  const severityBorder = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "border-l-red-500";
      case "MEDIUM":
        return "border-l-amber-500";
      default:
        return "border-l-blue-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-[#2D5A27] text-white p-6 rounded-2xl shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs">
              <Lightbulb className="size-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Prescriptive Decision Support & Actionable Recommendations
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Deterministic, rule-based operational guidance synthesized from forecasts, disease cases, and vaccination coverage.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setRefreshTrigger((p) => p + 1)}
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10 bg-transparent text-xs"
          >
            <RefreshCw className="size-3.5 mr-1.5" /> Re-evaluate Rules
          </Button>
        </div>
      </div>

      {/* 2. Transparency Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-blue-950 block mb-0.5">
            Transparent Rule Evaluation Policy:
          </span>
          <p className="text-blue-800 leading-relaxed">
            SmartLivestock does not generate black-box diagnostic claims. Every recommendation below provides the explicit
            mathematical trigger, quantitative evidence, and operational administrative action for Municipal Agriculture personnel.
          </p>
        </div>
      </div>

      {/* 3. Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <Card className="border-slate-200 p-8 text-center text-slate-500">
            <CheckCircle2 className="size-8 mx-auto text-emerald-600 mb-2" />
            <p className="font-semibold text-slate-700">All Municipal Indicators Within Normal Thresholds</p>
            <p className="text-xs text-slate-400 mt-1">No alerts or corrective actions are currently triggered.</p>
          </Card>
        ) : (
          recommendations.map((rec, idx) => (
            <Card
              key={`${rec.rule}-${idx}`}
              className={`border border-slate-200 border-l-4 ${severityBorder(rec.severity)} shadow-2xs overflow-hidden bg-white`}
            >
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {severityBadge(rec.severity)}
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {rec.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 pt-1">
                      {rec.title}
                    </h3>
                  </div>
                  <Badge variant="outline" className="font-mono text-[11px] text-slate-500 bg-slate-50">
                    Rule: {rec.rule}
                  </Badge>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {rec.reason}
                </p>

                {/* Quantitative Evidence Box */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Eye className="size-3.5 text-indigo-600" />
                    Observed System Evidence:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {Object.entries(rec.evidence).map(([key, val]) => (
                      <div key={key} className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-mono capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="font-bold text-slate-800 text-xs font-mono">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Municipal Action */}
                <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-200 flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800 shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Recommended Administrative Action:
                    </span>
                    <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed font-medium">
                      {rec.recommendation}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
