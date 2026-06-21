'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { Map as MapIcon, Layers, AlertTriangle, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Dynamically import all react-leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

interface BarangayData {
  name: string;
  position: [number, number];
  cattle: number;
  diseaseRisk: 'low' | 'medium' | 'high';
  activeCases: number;
  milk: number;
  meat: number;
  cheese: number;
}

const PADRE_GARCIA_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Banaba' }, geometry: { type: 'Polygon', coordinates: [[[121.2310, 13.8920], [121.2480, 13.8950], [121.2500, 13.8830], [121.2380, 13.8780], [121.2280, 13.8800], [121.2260, 13.8870], [121.2310, 13.8920]]] } },
    { type: 'Feature', properties: { name: 'Banaybanay' }, geometry: { type: 'Polygon', coordinates: [[[121.2160, 13.8950], [121.2260, 13.8960], [121.2310, 13.8920], [121.2260, 13.8870], [121.2180, 13.8850], [121.2120, 13.8880], [121.2100, 13.8930], [121.2160, 13.8950]]] } },
    { type: 'Feature', properties: { name: 'Bawi' }, geometry: { type: 'Polygon', coordinates: [[[121.2480, 13.8950], [121.2600, 13.8940], [121.2620, 13.8800], [121.2520, 13.8750], [121.2430, 13.8760], [121.2380, 13.8780], [121.2500, 13.8830], [121.2480, 13.8950]]] } },
    { type: 'Feature', properties: { name: 'Bukal' }, geometry: { type: 'Polygon', coordinates: [[[121.2600, 13.8940], [121.2720, 13.8920], [121.2740, 13.8780], [121.2620, 13.8750], [121.2520, 13.8750], [121.2620, 13.8800], [121.2600, 13.8940]]] } },
    { type: 'Feature', properties: { name: 'Castillo' }, geometry: { type: 'Polygon', coordinates: [[[121.2180, 13.8850], [121.2260, 13.8870], [121.2280, 13.8800], [121.2220, 13.8740], [121.2140, 13.8750], [121.2120, 13.8800], [121.2180, 13.8850]]] } },
    { type: 'Feature', properties: { name: 'Cawongan' }, geometry: { type: 'Polygon', coordinates: [[[121.1900, 13.9050], [121.2100, 13.9060], [121.2120, 13.8930], [121.2100, 13.8930], [121.2120, 13.8880], [121.2000, 13.8850], [121.1880, 13.8870], [121.1900, 13.9050]]] } },
    { type: 'Feature', properties: { name: 'Manggas' }, geometry: { type: 'Polygon', coordinates: [[[121.2100, 13.9060], [121.2260, 13.9060], [121.2260, 13.8960], [121.2160, 13.8950], [121.2100, 13.8930], [121.2120, 13.8930], [121.2100, 13.9060]]] } },
    { type: 'Feature', properties: { name: 'Maugat East' }, geometry: { type: 'Polygon', coordinates: [[[121.2220, 13.8600], [121.2340, 13.8620], [121.2380, 13.8560], [121.2300, 13.8490], [121.2200, 13.8500], [121.2160, 13.8560], [121.2220, 13.8600]]] } },
    { type: 'Feature', properties: { name: 'Maugat West' }, geometry: { type: 'Polygon', coordinates: [[[121.2020, 13.8650], [121.2140, 13.8660], [121.2180, 13.8600], [121.2120, 13.8540], [121.2020, 13.8530], [121.1940, 13.8570], [121.1960, 13.8640], [121.2020, 13.8650]]] } },
    { type: 'Feature', properties: { name: 'Pansol' }, geometry: { type: 'Polygon', coordinates: [[[121.2380, 13.8780], [121.2520, 13.8750], [121.2540, 13.8640], [121.2440, 13.8580], [121.2340, 13.8620], [121.2260, 13.8680], [121.2280, 13.8800], [121.2380, 13.8780]]] } },
    { type: 'Feature', properties: { name: 'Payapa' }, geometry: { type: 'Polygon', coordinates: [[[121.2140, 13.8750], [121.2220, 13.8740], [121.2260, 13.8680], [121.2180, 13.8600], [121.2140, 13.8660], [121.2060, 13.8660], [121.2060, 13.8720], [121.2140, 13.8750]]] } },
    { type: 'Feature', properties: { name: 'Poblacion' }, geometry: { type: 'Polygon', coordinates: [[[121.2060, 13.8720], [121.2060, 13.8660], [121.1960, 13.8640], [121.1940, 13.8700], [121.1960, 13.8760], [121.2040, 13.8770], [121.2060, 13.8720]]] } },
    { type: 'Feature', properties: { name: 'Quilo-quilo North' }, geometry: { type: 'Polygon', coordinates: [[[121.1880, 13.8870], [121.2000, 13.8850], [121.2000, 13.8770], [121.1960, 13.8760], [121.1940, 13.8700], [121.1860, 13.8720], [121.1840, 13.8800], [121.1880, 13.8870]]] } },
    { type: 'Feature', properties: { name: 'Quilo-quilo South' }, geometry: { type: 'Polygon', coordinates: [[[121.1840, 13.8800], [121.1860, 13.8720], [121.1780, 13.8700], [121.1760, 13.8780], [121.1800, 13.8840], [121.1840, 13.8800]]] } },
    { type: 'Feature', properties: { name: 'San Felipe' }, geometry: { type: 'Polygon', coordinates: [[[121.2440, 13.8580], [121.2540, 13.8640], [121.2620, 13.8620], [121.2620, 13.8500], [121.2520, 13.8430], [121.2360, 13.8430], [121.2300, 13.8490], [121.2380, 13.8560], [121.2440, 13.8580]]] } },
    { type: 'Feature', properties: { name: 'San Miguel' }, geometry: { type: 'Polygon', coordinates: [[[121.2300, 13.8490], [121.2360, 13.8430], [121.2260, 13.8390], [121.2160, 13.8420], [121.2120, 13.8490], [121.2160, 13.8540], [121.2200, 13.8500], [121.2300, 13.8490]]] } },
    { type: 'Feature', properties: { name: 'Tamak' }, geometry: { type: 'Polygon', coordinates: [[[121.1940, 13.8570], [121.2020, 13.8530], [121.2020, 13.8460], [121.1940, 13.8440], [121.1860, 13.8460], [121.1840, 13.8540], [121.1880, 13.8580], [121.1940, 13.8570]]] } },
    { type: 'Feature', properties: { name: 'Tangob' }, geometry: { type: 'Polygon', coordinates: [[[121.1760, 13.8780], [121.1780, 13.8700], [121.1760, 13.8620], [121.1680, 13.8620], [121.1660, 13.8720], [121.1700, 13.8800], [121.1760, 13.8780]]] } },
  ],
};

const BARANGAY_DATA: Record<string, BarangayData> = {
  'Banaba':            { name: 'Banaba',            position: [13.8870, 121.2395], cattle: 245, diseaseRisk: 'low',    activeCases: 0, milk: 3675, meat: 1225, cheese: 245 },
  'Banaybanay':        { name: 'Banaybanay',        position: [13.8910, 121.2220], cattle: 112, diseaseRisk: 'low',    activeCases: 0, milk: 1680, meat: 560,  cheese: 112 },
  'Bawi':              { name: 'Bawi',              position: [13.8860, 121.2510], cattle: 198, diseaseRisk: 'high',   activeCases: 5, milk: 2970, meat: 990,  cheese: 198 },
  'Bukal':             { name: 'Bukal',             position: [13.8850, 121.2640], cattle: 134, diseaseRisk: 'low',    activeCases: 0, milk: 2010, meat: 670,  cheese: 134 },
  'Castillo':          { name: 'Castillo',          position: [13.8810, 121.2210], cattle: 143, diseaseRisk: 'medium', activeCases: 1, milk: 2145, meat: 715,  cheese: 143 },
  'Cawongan':          { name: 'Cawongan',          position: [13.8960, 121.2000], cattle: 167, diseaseRisk: 'low',    activeCases: 0, milk: 2505, meat: 835,  cheese: 167 },
  'Manggas':           { name: 'Manggas',           position: [13.9010, 121.2180], cattle: 76,  diseaseRisk: 'low',    activeCases: 0, milk: 1140, meat: 380,  cheese: 76  },
  'Maugat East':       { name: 'Maugat East',       position: [13.8560, 121.2280], cattle: 88,  diseaseRisk: 'low',    activeCases: 0, milk: 1320, meat: 440,  cheese: 88  },
  'Maugat West':       { name: 'Maugat West',       position: [13.8590, 121.2060], cattle: 121, diseaseRisk: 'low',    activeCases: 0, milk: 1815, meat: 605,  cheese: 121 },
  'Pansol':            { name: 'Pansol',            position: [13.8785, 121.2438], cattle: 156, diseaseRisk: 'medium', activeCases: 2, milk: 2340, meat: 780,  cheese: 156 },
  'Payapa':            { name: 'Payapa',            position: [13.8700, 121.2190], cattle: 99,  diseaseRisk: 'low',    activeCases: 0, milk: 1485, meat: 495,  cheese: 99  },
  'Poblacion':         { name: 'Poblacion',         position: [13.8720, 121.2010], cattle: 87,  diseaseRisk: 'low',    activeCases: 0, milk: 1305, meat: 435,  cheese: 87  },
  'Quilo-quilo North': { name: 'Quilo-quilo North', position: [13.8800, 121.1930], cattle: 73,  diseaseRisk: 'low',    activeCases: 0, milk: 1095, meat: 365,  cheese: 73  },
  'Quilo-quilo South': { name: 'Quilo-quilo South', position: [13.8760, 121.1810], cattle: 59,  diseaseRisk: 'low',    activeCases: 0, milk: 885,  meat: 295,  cheese: 59  },
  'San Felipe':        { name: 'San Felipe',        position: [13.8530, 121.2510], cattle: 182, diseaseRisk: 'medium', activeCases: 1, milk: 2730, meat: 910,  cheese: 182 },
  'San Miguel':        { name: 'San Miguel',        position: [13.8460, 121.2260], cattle: 95,  diseaseRisk: 'low',    activeCases: 0, milk: 1425, meat: 475,  cheese: 95  },
  'Tamak':             { name: 'Tamak',             position: [13.8510, 121.1940], cattle: 44,  diseaseRisk: 'low',    activeCases: 0, milk: 660,  meat: 220,  cheese: 44  },
  'Tangob':            { name: 'Tangob',            position: [13.8710, 121.1720], cattle: 62,  diseaseRisk: 'low',    activeCases: 0, milk: 930,  meat: 310,  cheese: 62  },
};

type MapLayer = 'cattle' | 'disease' | 'milk' | 'meat' | 'cheese';

const LAYER_CONFIG: Record<MapLayer, { label: string; icon: string; unit: string }> = {
  cattle: { label: 'Cattle Distribution', icon: '🐄', unit: 'heads' },
  disease: { label: 'Disease Heat Map',   icon: '🩺', unit: '' },
  milk:    { label: 'Milk Production',    icon: '🥛', unit: 'L/mo' },
  meat:    { label: 'Katay (Meat)',        icon: '🥩', unit: 'kg/mo' },
  cheese:  { label: 'Cheese Output',      icon: '🧀', unit: 'kg/mo' },
};

function getCattleColor(cattle: number): string {
  if (cattle > 200) return '#1a3d15';
  if (cattle > 150) return '#2D5A27';
  if (cattle > 100) return '#5A8F4F';
  if (cattle > 60)  return '#8AB877';
  return '#C5E0A8';
}

function getDiseaseColor(risk: 'low' | 'medium' | 'high'): string {
  if (risk === 'high')   return '#D32F2F';
  if (risk === 'medium') return '#FFA726';
  return '#66BB6A';
}

function getMilkColor(milk: number): string {
  if (milk > 3000) return '#0c4a6e';
  if (milk > 2000) return '#075985';
  if (milk > 1500) return '#0284c7';
  if (milk > 1000) return '#38bdf8';
  return '#bae6fd';
}

function getMeatColor(meat: number): string {
  if (meat > 1000) return '#7c1d00';
  if (meat > 750)  return '#b91c1c';
  if (meat > 500)  return '#dc2626';
  if (meat > 300)  return '#f87171';
  return '#fecaca';
}

function getCheeseColor(cheese: number): string {
  if (cheese > 200) return '#713f12';
  if (cheese > 150) return '#92400e';
  if (cheese > 100) return '#d97706';
  if (cheese > 60)  return '#fbbf24';
  return '#fde68a';
}

// FitBounds must be a separate client component loaded dynamically
const FitBoundsComponent = dynamic(
  () => import('react-leaflet').then(m => {
    const FitBounds = () => {
      const { useMap } = m;
      const map = useMap();
      useEffect(() => {
        import('leaflet').then(L => {
          const bounds = L.latLngBounds(L.latLng(13.844, 121.166), L.latLng(13.910, 121.278));
          map.fitBounds(bounds, { padding: [20, 20] });
        });
      }, [map]);
      return null;
    };
    return FitBounds;
  }),
  { ssr: false }
);

export default function GISMapPage() {
  const router = useRouter();
  const [mapLayer, setMapLayer] = useState<MapLayer>('cattle');
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayData | null>(null);

  const centerPosition: [number, number] = [13.8777, 121.2116];

  const getLayerColor = (data: BarangayData): string => {
    switch (mapLayer) {
      case 'cattle':  return getCattleColor(data.cattle);
      case 'disease': return getDiseaseColor(data.diseaseRisk);
      case 'milk':    return getMilkColor(data.milk);
      case 'meat':    return getMeatColor(data.meat);
      case 'cheese':  return getCheeseColor(data.cheese);
    }
  };

  const getGeoJSONStyle = (feature: GeoJSON.Feature | undefined) => {
    if (!feature?.properties?.name) return {};
    const data = BARANGAY_DATA[feature.properties.name];
    if (!data) return { fillColor: '#ccc', color: '#666', weight: 1.5, fillOpacity: 0.5 };
    return {
      fillColor: getLayerColor(data),
      fillOpacity: 0.70,
      color: '#1a3d15',
      weight: 1.8,
      opacity: 1,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: any) => {
    const name = feature.properties?.name as string;
    const data = BARANGAY_DATA[name];
    if (!data) return;

    const riskColor = data.diseaseRisk === 'high' ? '#D32F2F' : data.diseaseRisk === 'medium' ? '#e67e22' : '#27ae60';

    layer.bindTooltip(`<strong>${name}</strong>`, {
      permanent: false,
      direction: 'center',
      className: 'barangay-tooltip',
    });

    layer.bindPopup(`
      <div style="font-family: sans-serif; min-width: 185px; padding: 4px;">
        <div style="font-size: 14px; font-weight: 700; color: #1a3d15; margin-bottom: 8px; border-bottom: 2px solid #2D5A27; padding-bottom: 4px;">
          Brgy. ${name}
        </div>
        <div style="font-size: 12px; line-height: 2;">
          <div>🐄 <strong>Cattle:</strong> ${data.cattle.toLocaleString()} heads</div>
          <div>🩺 <strong>Disease Risk:</strong> <span style="color:${riskColor}; font-weight:600">${data.diseaseRisk.toUpperCase()}</span></div>
          ${data.activeCases > 0 ? `<div style="color:#D32F2F;">⚠️ <strong>Active Cases:</strong> ${data.activeCases}</div>` : ''}
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:6px 0;" />
          <div style="font-weight:600; color:#555; margin-bottom:2px;">Monthly Production</div>
          <div>🥛 <strong>Milk:</strong> ${data.milk.toLocaleString()} L</div>
          <div>🥩 <strong>Katay (Meat):</strong> ${data.meat.toLocaleString()} kg</div>
          <div>🧀 <strong>Cheese:</strong> ${data.cheese.toLocaleString()} kg</div>
        </div>
      </div>
    `);

    layer.on({
      mouseover: (e: any) => {
        e.target.setStyle({ weight: 3, fillOpacity: 0.88, color: '#fff' });
        e.target.bringToFront();
      },
      mouseout: (e: any) => {
        e.target.setStyle(getGeoJSONStyle(feature));
      },
      click: () => setSelectedBarangay(data),
    });
  };

  const allData = Object.values(BARANGAY_DATA);
  const sortedBarangays = [...allData].sort((a, b) => b.cattle - a.cattle);
  const totalCattle = allData.reduce((s, b) => s + b.cattle, 0);
  const totalMilk   = allData.reduce((s, b) => s + b.milk, 0);
  const totalMeat   = allData.reduce((s, b) => s + b.meat, 0);
  const totalCheese = allData.reduce((s, b) => s + b.cheese, 0);
  const activeAlerts = allData.filter(b => b.activeCases > 0).length;

  const LEGENDS: Record<MapLayer, { color: string; label: string }[]> = {
    cattle: [
      { color: '#1a3d15', label: '200+ heads' },
      { color: '#2D5A27', label: '150–200 heads' },
      { color: '#5A8F4F', label: '100–150 heads' },
      { color: '#8AB877', label: '60–100 heads' },
      { color: '#C5E0A8', label: 'Under 60 heads' },
    ],
    disease: [
      { color: '#D32F2F', label: 'High — Active outbreak' },
      { color: '#FFA726', label: 'Medium — Suspected cases' },
      { color: '#66BB6A', label: 'Low — No active cases' },
    ],
    milk: [
      { color: '#0c4a6e', label: '3,000+ L/mo' },
      { color: '#075985', label: '2,000–3,000 L/mo' },
      { color: '#0284c7', label: '1,500–2,000 L/mo' },
      { color: '#38bdf8', label: '1,000–1,500 L/mo' },
      { color: '#bae6fd', label: 'Under 1,000 L/mo' },
    ],
    meat: [
      { color: '#7c1d00', label: '1,000+ kg/mo' },
      { color: '#b91c1c', label: '750–1,000 kg/mo' },
      { color: '#dc2626', label: '500–750 kg/mo' },
      { color: '#f87171', label: '300–500 kg/mo' },
      { color: '#fecaca', label: 'Under 300 kg/mo' },
    ],
    cheese: [
      { color: '#713f12', label: '200+ kg/mo' },
      { color: '#92400e', label: '150–200 kg/mo' },
      { color: '#d97706', label: '100–150 kg/mo' },
      { color: '#fbbf24', label: '60–100 kg/mo' },
      { color: '#fde68a', label: 'Under 60 kg/mo' },
    ],
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="lgu" onLogout={() => router.push('/')} />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 md:p-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h1 className="text-2xl mb-1 flex items-center gap-2">
                <MapIcon className="w-6 h-6 text-[#2D5A27]" />
                GIS Mapping — Padre Garcia
              </h1>
              <p className="text-gray-600 text-sm">Barangay-level cattle, production & disease heat map · 18 barangays</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="bg-[#f0f7ee] border border-[#c3dbb8] rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#2D5A27]">{totalCattle.toLocaleString()}</div>
                <div className="text-gray-600 text-xs">🐄 Total Cattle</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-blue-700">{(totalMilk / 1000).toFixed(1)}k L</div>
                <div className="text-gray-600 text-xs">🥛 Milk/mo</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-red-700">{totalMeat.toLocaleString()} kg</div>
                <div className="text-gray-600 text-xs">🥩 Katay/mo</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-amber-700">{totalCheese.toLocaleString()} kg</div>
                <div className="text-gray-600 text-xs">🧀 Cheese/mo</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-red-600">{activeAlerts}</div>
                <div className="text-gray-600 text-xs">⚠️ Alerts</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Layer Controls */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="w-5 h-5 text-[#2D5A27]" />
                <span className="font-medium text-sm text-gray-700 mr-1">Map Layer:</span>
                {(Object.keys(LAYER_CONFIG) as MapLayer[]).map(layer => (
                  <button
                    key={layer}
                    onClick={() => setMapLayer(layer)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      mapLayer === layer
                        ? 'bg-[#2D5A27] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {LAYER_CONFIG[layer].icon} {LAYER_CONFIG[layer].label}
                  </button>
                ))}
              </div>
              {activeAlerts > 0 && (
                <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-[#D32F2F]" />
                  <span className="text-red-700 font-medium">{activeAlerts} Barangay{activeAlerts > 1 ? 's' : ''} with Active Cases</span>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
            <div className="bg-[#2D5A27] px-4 py-2 flex items-center justify-between">
              <span className="text-white text-sm font-medium">
                Municipality of Padre Garcia, Batangas — {LAYER_CONFIG[mapLayer].icon} {LAYER_CONFIG[mapLayer].label}
              </span>
              <span className="text-green-200 text-xs">Click a barangay for details</span>
            </div>
            <div className="h-[560px]">
              <style>{`
                .barangay-tooltip { background: rgba(45, 90, 39, 0.92); border: none; border-radius: 4px; color: white; font-size: 12px; font-weight: 600; padding: 4px 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
                .barangay-tooltip::before { display: none; }
                .leaflet-popup-content-wrapper { border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
              `}</style>
              <MapContainer center={centerPosition} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                <FitBoundsComponent />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <GeoJSON
                  key={`geojson-${mapLayer}`}
                  data={PADRE_GARCIA_GEOJSON}
                  style={getGeoJSONStyle}
                  onEachFeature={onEachFeature}
                />
              </MapContainer>
            </div>
          </div>

          {/* Bottom panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Legend */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-4 bg-[#2D5A27] rounded-sm inline-block"></span>
                Legend — {LAYER_CONFIG[mapLayer].icon} {LAYER_CONFIG[mapLayer].label}
              </h3>
              <div className="space-y-2">
                {LEGENDS[mapLayer].map(item => (
                  <div key={item.label} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <div className="w-6 h-6 rounded border border-gray-300 flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Top barangays */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-4 bg-[#2D5A27] rounded-sm inline-block"></span>
                Top 5 by Cattle Population
              </h3>
              <div className="space-y-2.5">
                {sortedBarangays.slice(0, 5).map((b, i) => (
                  <div key={b.name} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#2D5A27] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-800 truncate">{b.name}</span>
                        <span className="text-sm font-semibold text-[#2D5A27] ml-2">{b.cattle}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="h-1.5 rounded-full bg-[#2D5A27]" style={{ width: `${(b.cattle / sortedBarangays[0].cattle) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected barangay detail OR disease alerts */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              {selectedBarangay ? (
                <>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-4 bg-[#2D5A27] rounded-sm inline-block"></span>
                      Brgy. {selectedBarangay.name}
                    </span>
                    <button onClick={() => setSelectedBarangay(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕ close</button>
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#f0f7ee] rounded-lg p-3">
                      <div className="text-xl font-bold text-[#2D5A27]">{selectedBarangay.cattle}</div>
                      <div className="text-xs text-gray-600">🐄 cattle heads</div>
                    </div>
                    <div className={`rounded-lg p-3 ${selectedBarangay.diseaseRisk === 'high' ? 'bg-red-50' : selectedBarangay.diseaseRisk === 'medium' ? 'bg-orange-50' : 'bg-green-50'}`}>
                      <div className={`text-sm font-bold ${selectedBarangay.diseaseRisk === 'high' ? 'text-red-700' : selectedBarangay.diseaseRisk === 'medium' ? 'text-orange-700' : 'text-green-700'}`}>
                        {selectedBarangay.diseaseRisk.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-600">
                        {selectedBarangay.activeCases > 0
                          ? `⚠️ ${selectedBarangay.activeCases} active case${selectedBarangay.activeCases > 1 ? 's' : ''}`
                          : '✅ No active cases'}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Production</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-blue-800">🥛 Milk</span>
                        <span className="text-sm font-bold text-blue-700">{selectedBarangay.milk.toLocaleString()} L</span>
                      </div>
                      <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-red-800">🥩 Katay (Meat)</span>
                        <span className="text-sm font-bold text-red-700">{selectedBarangay.meat.toLocaleString()} kg</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-amber-800">🧀 Cheese</span>
                        <span className="text-sm font-bold text-amber-700">{selectedBarangay.cheese.toLocaleString()} kg</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-4 bg-red-500 rounded-sm inline-block"></span>
                    Disease Alerts
                  </h3>
                  <div className="space-y-2">
                    {allData.filter(b => b.activeCases > 0).map(b => (
                      <div
                        key={b.name}
                        className="flex items-center justify-between text-sm border border-red-100 bg-red-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-red-100 transition-colors"
                        onClick={() => setSelectedBarangay(b)}
                      >
                        <span className="text-gray-800">{b.name}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.diseaseRisk === 'high' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'}`}>
                          {b.activeCases} case{b.activeCases > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                    {allData.filter(b => b.activeCases > 0).length === 0 && (
                      <p className="text-sm text-green-600">✅ No active disease cases</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2 pt-2 border-t">Click any barangay on the map to inspect production details.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Production Summary Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#2D5A27]" />
              <h3 className="text-sm font-semibold text-gray-800">Production Summary — All Barangays (Monthly)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Barangay</th>
                    <th className="text-right px-4 py-3 font-semibold">🐄 Cattle</th>
                    <th className="text-right px-4 py-3 font-semibold">🥛 Milk (L)</th>
                    <th className="text-right px-4 py-3 font-semibold">🥩 Katay (kg)</th>
                    <th className="text-right px-4 py-3 font-semibold">🧀 Cheese (kg)</th>
                    <th className="text-center px-4 py-3 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedBarangays.map((b) => (
                    <tr key={b.name} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedBarangay(b)}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{b.name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{b.cattle}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700 font-medium">{b.milk.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-red-700 font-medium">{b.meat.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-amber-700 font-medium">{b.cheese.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          b.diseaseRisk === 'high' ? 'bg-red-100 text-red-700' :
                          b.diseaseRisk === 'medium' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {b.diseaseRisk.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f0f7ee] font-bold border-t-2 border-[#c3dbb8]">
                    <td className="px-4 py-3 text-[#2D5A27]">TOTAL</td>
                    <td className="px-4 py-3 text-right text-[#2D5A27]">{totalCattle.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{totalMilk.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-700">{totalMeat.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{totalCheese.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}