'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Dynamic Chloropleth Legend (`GISLegend.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * This component provides an immediate visual interpretation guide for the map.
 * Positioned at the bottom-left (`absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-[900]`),
 * it dynamically re-renders its color swatches, thresholds, and metric units
 * whenever the user changes the active layer or disease sub-mode.
 * 
 * DATA & BEHAVIOR:
 * ----------------------------------------------------------------------------
 * - layer = 'cattle'   -> Shows green stepped scale (0 to 35+ heads).
 * - layer = 'disease'  -> 
 *     * SubMode = 'reported'   -> Standard traffic-light triage (Red: Outbreak, Orange: Suspect, Green: Clear).
 *     * SubMode = 'simulation' -> Normalized Haversine/wind epidemic pressure (Critical 70%+, High 40-69%, Moderate, Low).
 *     * SubMode = 'trend'      -> Current surveillance status (Purple: Elevated activity, Blue: Reported activity, Green: No reported activity).
 * - layer = 'milk'     -> Blue graduated scale in Liters/month.
 * - layer = 'meat'     -> Red/Crimson scale in kg yield from slaughter records.
 * - layer = 'movement' -> Transport vector guide (Origin, Inter-barangay route, Destination).
 * 
 * CAPSTONE PRESENTATION / DEFENSE TALKING POINTS:
 * ----------------------------------------------------------------------------
 * - "What is a Chloropleth map?"
 *   A chloropleth map is a thematic map where geographic areas (barangays) are
 *   shaded in proportion to an aggregated statistical variable (e.g. cattle count or disease incidence).
 * - "Why must the legend be dynamic?"
 *   Because multiple layers share the same map canvas, a static legend would mislead
 *   officials. Recomputing the color bins dynamically ensures that a green polygon
 *   is understood as 'Low Disease' in disease mode, but 'Healthy Herd Concentration' in cattle mode.
 */

import React from 'react';
import { MapLayer, ViewMode, DiseaseSubMode } from './types';
import { Badge } from '@/components/ui/badge';
import { Zap, Box, TrendingUp, Activity } from 'lucide-react';

interface GISLegendProps {
  layer: MapLayer;
  viewMode: ViewMode;
  diseaseSubMode: DiseaseSubMode;
  selectedLivestockType?: string;
}

export function GISLegend({
  layer,
  viewMode,
  diseaseSubMode,
  selectedLivestockType = 'Cattle',
}: GISLegendProps) {
  const getLegendItems = () => {
    if (layer === 'disease') {
      if (diseaseSubMode === 'simulation') {
        return [
          { color: '#991b1b', label: 'Critical (70%+ Epidemic Pressure)' },
          { color: '#ea580c', label: 'High (40%–69% Pressure)' },
          { color: '#f59e0b', label: 'Moderate (20%–39% Pressure)' },
          { color: '#10b981', label: 'Low (<20% Baseline)' },
        ];
      }
      if (diseaseSubMode === 'trend') {
        return [
          { color: '#9333ea', label: 'Elevated Activity (Active Cases)' },
          { color: '#0284c7', label: 'Reported Activity (Past Records)' },
          { color: '#10b981', label: 'No Reported Disease Activity' },
        ];
      }
      return [
        { color: '#D32F2F', label: 'High — Active Confirmed Cases' },
        { color: '#FFA726', label: 'Medium — Reported / Suspected' },
        { color: '#66BB6A', label: 'Low — Healthy / No Active Cases' },
      ];
    }

    switch (layer) {
      case 'cattle':
        return [
          { color: '#1a3d15', label: '35+ heads' },
          { color: '#2D5A27', label: '25–35 heads' },
          { color: '#5A8F4F', label: '15–25 heads' },
          { color: '#8AB877', label: '5–15 heads' },
          { color: '#C5E0A8', label: '1–5 heads' },
          { color: '#EAF3E4', label: '0 heads' },
        ];
      case 'milk':
        return [
          { color: '#0c4a6e', label: '10,000+ L/mo' },
          { color: '#0284c7', label: '1,000–10,000 L/mo' },
          { color: '#38bdf8', label: '1–1,000 L/mo' },
          { color: '#e0f2fe', label: '0 L (No records)' },
        ];
      case 'farmer_meat':
        return [
          { color: '#9a3412', label: '500+ kg production' },
          { color: '#c2410c', label: '100–500 kg production' },
          { color: '#fb923c', label: '1–100 kg production' },
          { color: '#fff7ed', label: '0 kg (No farmer production)' },
        ];
      case 'slaughter_yield':
      case 'meat':
        return [
          { color: '#7c1d00', label: '500+ kg carcass yield' },
          { color: '#dc2626', label: '100–500 kg carcass yield' },
          { color: '#f87171', label: '1–100 kg carcass yield' },
          { color: '#fecaca', label: 'No slaughterhouse data' },
        ];
      case 'mortality':
        return [
          { color: '#0f172a', label: 'High (6+ recorded deaths)' },
          { color: '#475569', label: 'Moderate (3–5 recorded deaths)' },
          { color: '#94a3b8', label: 'Low (1–2 recorded deaths)' },
          { color: '#f8fafc', label: 'No recorded deaths' },
        ];
      case 'movement':
        return [
          { color: '#ef4444', label: '📤 Outbound Shipment (Padre Garcia → External)' },
          { color: '#2563eb', label: '📥 Inbound Transport (External → Padre Garcia)' },
          { color: '#10b981', label: '🔄 Local Intra-Municipal Transfer' },
          { color: '#f59e0b', label: '⏳ Permit Under Inspection / Review' },
          { color: '#1E4D2B', label: '🟢 Origin Barangay Centroid' },
          { color: '#38bdf8', label: '✨ Active Selected Route' },
        ];
      default:
        return [];
    }
  };

  const livestockIcon =
    selectedLivestockType?.toLowerCase() === 'sheep'
      ? '🐑'
      : selectedLivestockType?.toLowerCase() === 'swine'
      ? '🐖'
      : selectedLivestockType?.toLowerCase() === 'goat'
      ? '🐐'
      : selectedLivestockType === 'ALL'
      ? '🐾'
      : '🐄';

  const livestockTitle =
    selectedLivestockType === 'ALL'
      ? 'All Livestock Distribution'
      : `${selectedLivestockType || 'Cattle'} Distribution`;

  const mortalityTitle =
    selectedLivestockType === 'ALL'
      ? 'All Livestock Mortality'
      : `${selectedLivestockType || 'Cattle'} Mortality Distribution`;

  const titles: Record<MapLayer, { title: string; icon: string }> = {
    cattle: { title: livestockTitle, icon: livestockIcon },
    disease: {
      title:
        diseaseSubMode === 'simulation'
          ? 'Simulated Disease Pressure'
          : diseaseSubMode === 'trend'
          ? 'Disease Surveillance Trend'
          : 'Reported Disease Heat Map',
      icon: '🩺',
    },
    milk: { title: 'Dairy Milk Production', icon: '🥛' },
    farmer_meat: { title: 'Farmer Meat Production', icon: '🥩' },
    slaughter_yield: { title: 'Slaughterhouse Carcass Yield', icon: '🔪' },
    meat: { title: 'Slaughterhouse Carcass Yield', icon: '🔪' },
    mortality: { title: mortalityTitle, icon: '☠️' },
    movement: { title: 'Live Cow Movement', icon: '🚛' },
  };

  const { title, icon } = titles[layer];
  const items = getLegendItems();
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        aria-label={`Expand ${title} Legend`}
        className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-lg text-slate-800 pointer-events-auto flex items-center gap-2 text-xs font-black active:scale-95 transition-transform cursor-pointer min-h-[38px] select-none"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-slate-300 bg-slate-50 text-slate-700 shrink-0">
          Show
        </Badge>
      </button>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-lg text-slate-800 pointer-events-auto max-w-[240px] sm:max-w-[270px] max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain animate-in fade-in duration-150 scrollbar-thin">
      <div className="flex items-center justify-between gap-1.5 mb-1.5 pb-1.5 border-b border-slate-100">
        <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
          <span>{icon}</span>
          <span className="truncate">{title}</span>
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {viewMode === '3D' ? (
            <Badge className="bg-emerald-800 text-white text-[9px] px-1 py-0 font-mono flex items-center gap-0.5">
              <Box className="size-2.5" /> 3D
            </Badge>
          ) : layer === 'disease' && diseaseSubMode === 'simulation' ? (
            <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 font-mono">
              <Zap className="size-2 mr-0.5 inline" /> SIM
            </Badge>
          ) : layer === 'disease' && diseaseSubMode === 'trend' ? (
            <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 font-mono">
              <TrendingUp className="size-2 mr-0.5 inline" /> TREND
            </Badge>
          ) : layer === 'cattle' || layer === 'mortality' ? (
            <Badge className="bg-slate-900 text-white text-[9px] px-1 py-0 font-mono">
              {selectedLivestockType === 'ALL' ? 'ALL' : (selectedLivestockType || 'CATTLE').toUpperCase()}
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Minimize Legend"
            title="Minimize Legend"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-1 sm:space-y-1.5 text-xs">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="size-2.5 sm:size-3 rounded-xs border border-black/10 shrink-0 shadow-2xs"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 truncate">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {viewMode === '3D' && (
        <div className="mt-1.5 pt-1 border-t border-slate-100 text-[9px] sm:text-[10px] text-slate-500 flex items-center gap-1">
          <Box className="size-2.5 sm:size-3 text-emerald-700" />
          <span>Extrusion height follows the selected GIS layer</span>
        </div>
      )}
    </div>
  );
}
