"use client";

import React, { useState, useMemo } from "react";
import { 
  MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Tooltip 
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Shield, Activity, AlertCircle, CheckCircle, Send, 
  BarChart3, PieChart, Map as MapIcon, Info 
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "../components/sidebar";
import { useRouter } from "next/navigation";
import MobileNavSibat from "../components/mobilenavsibat";

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

      <header className="bg-[#1A365D] text-white p-4 shadow-xl ">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MapIcon className="text-amber-400" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">GIS Monitoring: Padre Garcia</h1>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Batangas SmartLivestock System</p>
            </div>
          </div>
          <div className="hidden md:flex gap-4 items-center">
             <div className="text-right">
               <p className="text-xs font-bold">SIBAT: Sector 1</p>
               <p className="text-[10px] text-amber-400 font-black uppercase">Admin Access</p>
             </div>
             <div className="h-8 w-8 bg-amber-400 rounded-full flex items-center justify-center text-blue-900 font-bold">PG</div>
          </div>
        </div>
      </header>
       

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
              <MapContainer 
                center={[13.8750, 121.2200]} 
                zoom={13} 
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                
                {/* GeoJSON Layer for Padre Garcia */}
                <GeoJSON 
                  data={PADRE_GARCIA_GEOJSON} 
                  style={geojsonStyle}
                  onEachFeature={(feature, layer) => {
                    layer.on({
                      mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({ fillOpacity: 0.7, weight: 3 });
                        setHoveredBarangay(feature.properties.name);
                      },
                      mouseout: (e) => {
                        const l = e.target;
                        l.setStyle({ fillOpacity: 0.3, weight: 2 });
                        setHoveredBarangay(null);
                      }
                    });
                  }}
                />

                {/* Hotspot Pulse Marker in Banaba */}
                <CircleMarker 
                  center={[13.8900, 121.2400]} 
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.5 }} 
                  radius={10}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-bold text-red-600 uppercase text-xs">Alert: Banaba Sector</p>
                      <p className="text-[10px]">3 Disease Reports Validated</p>
                    </div>
                  </Popup>
                  <Tooltip permanent direction="top">Banaba Hotspot</Tooltip>
                </CircleMarker>
              </MapContainer>
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