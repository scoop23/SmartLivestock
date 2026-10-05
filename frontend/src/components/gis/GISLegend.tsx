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
 *     * SubMode = 'forecast'   -> Statistical predictive trajectory tiers (Purple: Elevated velocity, Sky: Normal, Green: Low).
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
}

export function GISLegend({ layer, viewMode, diseaseSubMode }: GISLegendProps) {
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
      if (diseaseSubMode === 'forecast') {
        return [
          { color: '#9333ea', label: 'Surveillance Alert (Elevated Velocity)' },
          { color: '#0284c7', label: 'Projected Normal Trajectory' },
          { color: '#10b981', label: 'Low Baseline Risk' },
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
      case 'meat':
        return [
          { color: '#7c1d00', label: '500+ kg yield' },
          { color: '#dc2626', label: '100–500 kg yield' },
          { color: '#f87171', label: '1–100 kg yield' },
          { color: '#fecaca', label: 'No slaughter data available' },
        ];
      case 'movement':
        return [
          { color: '#dc2626', label: '📤 Outbound Inspection Transport' },
          { color: '#2563eb', label: '📥 Inbound Transport' },
          { color: '#1E4D2B', label: '📍 Padre Garcia Origin / Hub' },
        ];
      default:
        return [];
    }
  };

  const titles: Record<MapLayer, { title: string; icon: string }> = {
    cattle: { title: 'Cattle Distribution', icon: '🐄' },
    disease: {
      title:
        diseaseSubMode === 'simulation'
          ? 'Simulated Disease Pressure'
          : diseaseSubMode === 'forecast'
          ? 'Predictive Disease Forecast'
          : 'Reported Disease Heat Map',
      icon: '🩺',
    },
    milk: { title: 'Dairy Milk Production', icon: '🥛' },
    meat: { title: 'Katay (Meat Yield)', icon: '🥩' },
    movement: { title: 'Live Cow Movement', icon: '🚛' },
  };

  const { title, icon } = titles[layer];
  const items = getLegendItems();

  return (
    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200/90 shadow-lg text-slate-800 pointer-events-auto max-w-[270px]">
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
        <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
          <span>{icon}</span>
          <span className="truncate">{title}</span>
        </h4>
        {viewMode === '3D' ? (
          <Badge className="bg-emerald-800 text-white text-[9px] px-1 py-0 font-mono flex items-center gap-0.5">
            <Box className="size-2.5" /> 3D
          </Badge>
        ) : layer === 'disease' && diseaseSubMode === 'simulation' ? (
          <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 font-mono">
            <Zap className="size-2 mr-0.5 inline" /> SIM
          </Badge>
        ) : null}
      </div>

      <div className="space-y-1.5 text-xs">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="size-3 rounded-xs border border-black/10 shrink-0 shadow-2xs"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] font-semibold text-slate-700 truncate">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {viewMode === '3D' && (
        <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1">
          <Box className="size-3 text-emerald-700" />
          <span>Barangay column height shows density</span>
        </div>
      )}
    </div>
  );
}
