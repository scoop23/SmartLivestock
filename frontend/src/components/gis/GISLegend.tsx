'use client';

import React from 'react';
import { MapLayer } from './types';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface GISLegendProps {
  layer: MapLayer;
  simulationMode: boolean;
}

export function GISLegend({ layer, simulationMode }: GISLegendProps) {
  const getLegendItems = () => {
    if (simulationMode && layer === 'disease') {
      return [
        { color: '#991b1b', label: 'Critical (20+ projected cases)' },
        { color: '#dc2626', label: 'High (8–19 projected cases)' },
        { color: '#f59e0b', label: 'Medium (2–7 projected cases)' },
        { color: '#10b981', label: 'Low (0–1 projected cases)' },
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
      case 'disease':
        return [
          { color: '#D32F2F', label: 'High — Active Outbreak' },
          { color: '#FFA726', label: 'Medium — Reported / Flagged' },
          { color: '#66BB6A', label: 'Low — Healthy / No cases' },
        ];
      case 'milk':
        return [
          { color: '#0c4a6e', label: '10,000+ L' },
          { color: '#0284c7', label: '1,000–10,000 L' },
          { color: '#38bdf8', label: '1–1,000 L' },
          { color: '#e0f2fe', label: '0 L' },
        ];
      case 'meat':
        return [
          { color: '#7c1d00', label: '500+ kg' },
          { color: '#dc2626', label: '100–500 kg' },
          { color: '#f87171', label: '1–100 kg' },
          { color: '#fecaca', label: 'No records available' },
        ];
      case 'movement':
        return [
          { color: '#dc2626', label: '📤 Outbound Inspection Transport' },
          { color: '#2563eb', label: '📥 Inbound Transport' },
          { color: '#1E4D2B', label: '📍 Padre Garcia Hub / Centroid' },
        ];
      default:
        return [];
    }
  };

  const titles: Record<MapLayer, { title: string; icon: string }> = {
    cattle: { title: 'Cattle Distribution', icon: '🐄' },
    disease: { title: simulationMode ? 'Simulated Disease Risk' : 'Disease Heat Map', icon: '🩺' },
    milk: { title: 'Dairy Milk Production', icon: '🥛' },
    meat: { title: 'Katay (Meat Yield)', icon: '🥩' },
    movement: { title: 'Live Cow Movement', icon: '🚛' },
  };

  const { title, icon } = titles[layer];
  const items = getLegendItems();

  return (
    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200/90 shadow-lg text-slate-800 pointer-events-auto max-w-[260px]">
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
        <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
          <span>{icon}</span>
          <span className="truncate">{title}</span>
        </h4>
        {simulationMode && layer === 'disease' && (
          <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 font-mono">
            <Zap className="size-2 mr-0.5 inline" /> SIM
          </Badge>
        )}
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
    </div>
  );
}
