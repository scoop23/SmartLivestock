'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Municipal Metadata Footer (`GISFooter.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * This component renders the municipal GIS metadata bar docked at the very bottom
 * of the screen (`w-full bg-slate-950/90 text-white/70 py-1.5 px-3 sm:px-4 text-[10px] shrink-0`).
 * 
 * KEY PURPOSES:
 * ----------------------------------------------------------------------------
 * 1. Bug B Gap Elimination:
 *    - In our full-height flex column layout (`h-dvh flex flex-col`), the map gets
 *      `flex-1 min-h-0` and this footer sits at the bottom with `shrink-0`.
 *      This completely eliminates the blank viewport gap below the map across all browsers.
 * 2. Academic & Legal Disclaimers:
 *    - Explicitly clarifies that the Haversine epidemic spread model is a
 *      decision-support planning tool, not a clinical laboratory diagnosis.
 * 3. Attribution & Spatial Metadata:
 *    - Cites authoritative sources: Padre Garcia MAO Registry, Open-Meteo Archive API,
 *      and WGS84 GeoJSON municipal boundaries.
 * 4. Responsive Adaptation:
 *    - On desktop: A single clean horizontal status ribbon.
 *    - On mobile: A compact one-line header with a collapsible 'Info & Disclaimers' drawer.
 */

import React, { useState } from 'react';
import { Database, MapPin, Wind, Sparkles, Info, ChevronUp, ChevronDown, Mail, ShieldAlert, CheckCircle2, Truck, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GISUserScope } from './types';

interface GISFooterProps {
  userScope?: GISUserScope;
}

export function GISFooter({ userScope }: GISFooterProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const lastUpdated = useMemoTime();

  const role = userScope?.role?.toUpperCase();
  const isFarmer = role === 'FARMER' || userScope?.scope === 'OWN_BARANGAY';
  const isSibat = role === 'SIBAT';
  const isAuction = role === 'AUCTION';
  const isSlaughter = role === 'SLAUGHTERHOUSESTAFF';
  const isAdmin = !isFarmer && !isSibat && !isAuction && !isSlaughter;

  const farmerBarangay = userScope?.allowed_barangays?.[0] || 'Padre Garcia';

  // ── 1. Role-Tailored Mobile Header ──
  const mobileTitle = isFarmer
    ? `SmartLivestock • Brgy. ${farmerBarangay}`
    : isSibat
    ? 'Field Monitoring GIS • SIBAT'
    : isAuction
    ? 'Livestock Movement & Trade GIS'
    : isSlaughter
    ? 'Livestock Origin & Slaughter GIS'
    : 'Padre Garcia GIS • MAO';

  // ── 2. Role-Tailored Mobile Drawer Content ──
  const renderMobileDrawer = () => {
    if (isFarmer) {
      return (
        <div className="sm:hidden pt-2 mt-1.5 border-t border-white/10 space-y-1.5 text-[9.5px] text-white/80 animate-in fade-in duration-150">
          <p className="flex items-center gap-1.5 text-emerald-300 font-medium">
            <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
            <span>
              <strong>Verified Farm Records:</strong> Official barangay livestock inventory &amp; production telemetry.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-1 pt-1 text-white/60">
            <span>• Registry: Padre Garcia MAO</span>
            <span>• Jurisdiction: Brgy. {farmerBarangay}</span>
            <span className="flex items-center gap-1">
              <Mail className="size-2.5 text-sky-400" /> mao@padregarcia.gov.ph
            </span>
            <span>• Updated: {lastUpdated}</span>
          </div>
        </div>
      );
    }

    if (isSibat) {
      return (
        <div className="sm:hidden pt-2 mt-1.5 border-t border-white/10 space-y-1.5 text-[9.5px] text-white/80 animate-in fade-in duration-150">
          <p className="flex items-center gap-1.5 text-sky-300 font-medium">
            <CheckCircle2 className="size-3 shrink-0 text-sky-400" />
            <span>
              <strong>Field Surveillance:</strong> Assigned barangay inspection &amp; validation monitoring.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-1 pt-1 text-white/60">
            <span>• Scope: {userScope?.can_view_all_barangays ? '18 Barangays' : `${userScope?.allowed_barangays?.length || 1} Assigned Brgy.`}</span>
            <span>• Source: PostgreSQL Database</span>
            <span className="flex items-center gap-1">
              <Mail className="size-2.5 text-sky-400" /> mao@padregarcia.gov.ph
            </span>
            <span>• Updated: {lastUpdated}</span>
          </div>
        </div>
      );
    }

    if (isAuction) {
      return (
        <div className="sm:hidden pt-2 mt-1.5 border-t border-white/10 space-y-1.5 text-[9.5px] text-white/80 animate-in fade-in duration-150">
          <p className="flex items-center gap-1.5 text-indigo-300 font-medium">
            <Truck className="size-3 shrink-0 text-indigo-400" />
            <span>
              <strong>Trade &amp; Movement:</strong> Origin/destination flows and shipping health clearances.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-1 pt-1 text-white/60">
            <span>• Scope: Municipal Livestock Market</span>
            <span>• Registry: Inspection Clearances</span>
            <span className="flex items-center gap-1">
              <Mail className="size-2.5 text-sky-400" /> mao@padregarcia.gov.ph
            </span>
            <span>• Updated: {lastUpdated}</span>
          </div>
        </div>
      );
    }

    if (isSlaughter) {
      return (
        <div className="sm:hidden pt-2 mt-1.5 border-t border-white/10 space-y-1.5 text-[9.5px] text-white/80 animate-in fade-in duration-150">
          <p className="flex items-center gap-1.5 text-amber-300 font-medium">
            <Scissors className="size-3 shrink-0 text-amber-400" />
            <span>
              <strong>Slaughter Traceability:</strong> Ante/post-mortem clearances &amp; carcass yield tracking.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-1 pt-1 text-white/60">
            <span>• Scope: Municipal Abattoir</span>
            <span>• Registry: Meat Inspection Certificates</span>
            <span>• Updated: {lastUpdated}</span>
          </div>
        </div>
      );
    }

    // Default: Admin / MAO Contingency Planning
    return (
      <div className="sm:hidden pt-2 mt-1.5 border-t border-white/10 space-y-1.5 text-[9.5px] text-white/80 animate-in fade-in duration-150">
        <p className="flex items-center gap-1 text-amber-300">
          <ShieldAlert className="size-3 shrink-0" />
          <span>
            <strong>Disclaimer:</strong> Decision-support epidemic spread model for contingency planning.
            Not a clinical FMD laboratory diagnosis.
          </span>
        </p>
        <div className="grid grid-cols-2 gap-1 pt-1 text-white/60">
          <span>• Sources: PostgreSQL, Open-Meteo, PAGASA</span>
          <span>• Geometry: 18 Official Barangays</span>
          <span className="flex items-center gap-1">
            <Mail className="size-2.5 text-sky-400" /> mao@padregarcia.gov.ph
          </span>
          <span>• Updated: {lastUpdated}</span>
        </div>
      </div>
    );
  };

  return (
    <footer className="w-full bg-slate-950/95 backdrop-blur-md border-t border-white/10 text-white/70 py-1.5 px-3 sm:px-4 text-[10px] shrink-0 pointer-events-auto z-[800]">
      {/* Mobile Bar: Compact line with expand toggle */}
      <div className="flex sm:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-white text-[11px] truncate">
          <Sparkles className="size-3 text-emerald-400 shrink-0" />
          <span className="truncate">{mobileTitle}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className="h-7 px-2 text-[10px] text-emerald-400 hover:text-white hover:bg-white/10 rounded-md flex items-center gap-1"
        >
          <Info className="size-3" />
          <span>{mobileExpanded ? 'Hide Info' : 'Info & Details'}</span>
          {mobileExpanded ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
        </Button>
      </div>

      {/* Mobile Expanded Drawer */}
      {mobileExpanded && renderMobileDrawer()}

      {/* Desktop Bar: Role-Tailored Details & Attribution */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* Left Side: System identity & Role Context */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tracking-tight flex items-center gap-1">
            <Sparkles className="size-3 text-emerald-400" />
            SmartLivestock-Batangas
          </span>
          <span className="text-white/40">•</span>

          {isFarmer ? (
            <>
              <span className="text-emerald-300 font-medium">
                My Farm Map — Brgy. {farmerBarangay}
              </span>
              <span className="text-white/40">•</span>
              <span className="text-emerald-400 font-medium text-[9px] flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="size-2.5 text-emerald-400" />
                Verified Farm Records
              </span>
            </>
          ) : isSibat ? (
            <>
              <span className="text-emerald-300 font-medium">
                Field Monitoring GIS — SIBAT Validation
              </span>
              <span className="text-white/40">•</span>
              <span className="text-sky-300 font-medium text-[9px] flex items-center gap-1 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-500/30">
                <CheckCircle2 className="size-2.5 text-sky-400" />
                Territorial Surveillance
              </span>
            </>
          ) : isAuction ? (
            <>
              <span className="text-emerald-300 font-medium">
                Livestock Movement &amp; Trade GIS
              </span>
              <span className="text-white/40">•</span>
              <span className="text-indigo-300 font-medium text-[9px] flex items-center gap-1 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-500/30">
                <Truck className="size-2.5 text-indigo-400" />
                Transport &amp; Clearance Tracking
              </span>
            </>
          ) : isSlaughter ? (
            <>
              <span className="text-emerald-300 font-medium">
                Livestock Origin &amp; Slaughter GIS
              </span>
              <span className="text-white/40">•</span>
              <span className="text-amber-300 font-medium text-[9px] flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                <Scissors className="size-2.5 text-amber-400" />
                Meat Production &amp; Traceability
              </span>
            </>
          ) : (
            <>
              <span className="text-emerald-300 font-medium">
                Padre Garcia Municipal Agriculture Office (MAO)
              </span>
              <span className="text-white/40">•</span>
              <span className="text-white/50 italic text-[9px] flex items-center gap-1">
                <ShieldAlert className="size-2.5 text-amber-400" />
                Contingency Planning Model
              </span>
            </>
          )}
        </div>

        {/* Right Side: Data Sources & Scope */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
          <span className="flex items-center gap-1">
            <Database className="size-2.5 text-emerald-400" />
            PostgreSQL DB
          </span>
          <span className="text-white/30">•</span>

          {isFarmer ? (
            <>
              <span className="flex items-center gap-1">
                <MapPin className="size-2.5 text-emerald-400" />
                Brgy. {farmerBarangay} Registry
              </span>
              <span className="text-white/30">•</span>
              <span className="text-white/50">Padre Garcia MAO Registry</span>
            </>
          ) : isSibat ? (
            <>
              <span className="flex items-center gap-1">
                <MapPin className="size-2.5 text-sky-400" />
                {userScope?.can_view_all_barangays ? '18 Barangays' : `${userScope?.allowed_barangays?.length || 1} Assigned Jurisdiction(s)`}
              </span>
              <span className="text-white/30">•</span>
              <span className="text-white/50">Field Validation Records</span>
            </>
          ) : isAuction ? (
            <>
              <span className="flex items-center gap-1">
                <MapPin className="size-2.5 text-sky-400" />
                18 Barangays &amp; Trade Hubs
              </span>
              <span className="text-white/30">•</span>
              <span className="text-white/50">Official Movement Clearances</span>
            </>
          ) : isSlaughter ? (
            <>
              <span className="flex items-center gap-1">
                <MapPin className="size-2.5 text-sky-400" />
                Municipal Slaughterhouse
              </span>
              <span className="text-white/30">•</span>
              <span className="text-white/50">Carcass &amp; Health Inspections</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <MapPin className="size-2.5 text-sky-400" />
                18 Barangays
              </span>
              <span className="text-white/30">•</span>
              <span className="flex items-center gap-1">
                <Wind className="size-2.5 text-teal-400" />
                PAGASA &amp; Open-Meteo
              </span>
            </>
          )}

          <span className="text-white/30">•</span>
          <span className="text-white/50">Updated: {lastUpdated}</span>
          <span className="text-white/30">•</span>
          <span className="font-mono text-emerald-400 font-bold">v2.0</span>
        </div>
      </div>
    </footer>
  );
}

function useMemoTime() {
  const [timeStr, setTimeStr] = React.useState<string>('Live');
  React.useEffect(() => {
    const d = new Date();
    setTimeStr(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  }, []);
  return timeStr;
}
