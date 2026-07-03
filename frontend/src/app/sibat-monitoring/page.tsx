"use client";
import dynamic from "next/dynamic";
import React, { useState, useMemo } from "react";
// import { 
//   MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Tooltip 
// } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
import {
  Shield, Activity, AlertCircle, CheckCircle, Send,
  BarChart3, PieChart, Map as MapIcon, Info
} from "lucide-react";
import { Sidebar } from "../components/sidebar";
import { PageHeader } from "../components/page-header";
import { useRouter } from "next/navigation";
import MobileNavSibat from "../components/mobilenavsibat";

const SibatLeafletMap = dynamic(() => import('../components/SibatLeafletMap'), { ssr: false });

// Your Provided GeoJSON Data
const PADRE_GARCIA_GEOJSON: any = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Banaba' }, geometry: { type: 'Polygon', coordinates: [[[121.2310, 13.8920], [121.2480, 13.8950], [121.2500, 13.8830], [121.2380, 13.8780], [121.2280, 13.8800], [121.2260, 13.8870], [121.2310, 13.8920]]] } },
    { type: 'Feature', properties: { name: 'Banaybanay' }, geometry: { type: 'Polygon', coordinates: [[[121.2160, 13.8950], [121.2260, 13.8960], [121.2310, 13.8920], [121.2260, 13.8870], [121.2180, 13.8850], [121.2120, 13.8880], [121.2100, 13.8930], [121.2160, 13.8950]]] } },
    { type: 'Feature', properties: { name: 'Bawi' }, geometry: { type: 'Polygon', coordinates: [[[121.2480, 13.8950], [121.2600, 13.8940], [121.2620, 13.8800], [121.2520, 13.8750], [121.2430, 13.8760], [121.2380, 13.8780], [121.2500, 13.8830], [121.2480, 13.8950]]] } },
    { type: 'Feature', properties: { name: 'Bukal' }, geometry: { type: 'Polygon', coordinates: [[[121.2600, 13.8940], [121.2720, 13.8920], [121.2740, 13.8780], [121.2620, 13.8750], [121.2520, 13.8750], [121.2620, 13.8800], [121.2600, 13.8940]]] } },
    { type: 'Feature', properties: { name: 'Castillo' }, geometry: { type: 'Polygon', coordinates: [[[121.2180, 13.8850], [121.2260, 13.8870], [121.2280, 13.8800], [121.2220, 13.8740], [121.2140, 13.8750], [121.2120, 13.8800], [121.2180, 13.8850]]] } },
    { type: 'Feature', properties: { name: 'Poblacion' }, geometry: { type: 'Polygon', coordinates: [[[121.2060, 13.8720], [121.2060, 13.8660], [121.1960, 13.8640], [121.1940, 13.8700], [121.1960, 13.8760], [121.2040, 13.8770], [121.2060, 13.8720]]] } },
    // ... rest of your features
  ],
};

export default function PadreGarciaGIS() {
  const [hoveredBarangay, setHoveredBarangay] = useState<string | null>(null);
  const router = useRouter();
  // Stats for the municipality
  const stats = [
    { label: "Total Population", value: "1,240", icon: <Activity className="text-blue-600" />, color: "bg-blue-50" },
    { label: "Active Quarantine", value: "2", icon: <Shield className="text-red-600" />, color: "bg-red-50" },
    { label: "Validated Today", value: "18", icon: <CheckCircle className="text-emerald-600" />, color: "bg-emerald-50" },
    { label: "MAO Forwarded", value: "42", icon: <Send className="text-amber-600" />, color: "bg-amber-50" },
  ];

  // Styling for GeoJSON Polygons
  const geojsonStyle = (feature: any) => ({
    fillColor: feature.properties.name === "Banaba" ? "#ef4444" : "#3b82f6", // Red for Banaba (Alert)
    weight: 2,
    opacity: 1,
    color: 'white',
    fillOpacity: 0.3,
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans mb-15">
      {/* Header */}
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar role="sibat" onLogout={() => router.push('/')} />
        </div>
        <div className="flex flex-col w-full">

          <PageHeader
            title="GIS Monitoring: Padre Garcia"
            subtitle="Batangas SmartLivestock System"
            icon={<MapIcon className="text-amber-400" />}
            variant="sibat"
            mobileMenuOffset={false}
            action={
              <div className="hidden items-center gap-4 md:flex">
                <div className="text-right">
                  <p className="text-xs font-bold">SIBAT: Sector 1</p>
                  <p className="text-[10px] font-black uppercase text-amber-400">Admin Access</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-bold text-blue-900">PG</div>
              </div>
            }
          />


          <main className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
            {/* Stats Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>{s.icon}</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Map Container */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative">
                <div className="absolute top-4 right-4 z-[500] space-y-2">
                  <div className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-lg border border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Map Legend</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold"><span className="w-3 h-3 rounded bg-red-500/50 border border-red-500"></span> High Risk Area</div>
                      <div className="flex items-center gap-2 text-[10px] font-bold"><span className="w-3 h-3 rounded bg-blue-500/50 border border-blue-500"></span> Active Monitoring</div>
                    </div>
                  </div>
                </div>

                <div className="h-[600px] w-full">
                  {/* leaflet map */}
                  <SibatLeafletMap
                    geojsonStyle={geojsonStyle}
                    PADRE_GARCIA_GEOJSON={PADRE_GARCIA_GEOJSON}
                    setHoveredBarangay={setHoveredBarangay}
                  />
                </div>
              </div>

              {/* Sidebar Analytics */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
                  <h3 className="font-black text-slate-900 uppercase text-sm mb-4 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" size={18} /> Sector Risk Profile
                  </h3>
                  <div className="space-y-4">
                    <RiskProgress label="Banaba" value={85} color="bg-red-500" />
                    <RiskProgress label="Poblacion" value={20} color="bg-emerald-500" />
                    <RiskProgress label="Bukal" value={45} color="bg-amber-500" />
                    <RiskProgress label="Castillo" value={10} color="bg-emerald-500" />
                  </div>
                </div>

                <div className="bg-[#1A365D] p-6 rounded-3xl shadow-xl text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="text-amber-400" />
                    <h3 className="font-bold">SIBAT Intelligence</h3>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed mb-4">
                    Currently showing **{hoveredBarangay || "Select a Barangay"}**.
                    The GeoJSON layer highlights boundaries specific to your sector in Padre Garcia.
                  </p>
                  <button className="w-full bg-amber-400 text-blue-900 py-3 rounded-2xl font-black text-xs uppercase hover:bg-white transition-colors">
                    View Full Municipality Report
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <MobileNavSibat />
    </div>
  );
}

function RiskProgress({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-black uppercase mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{value}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}
