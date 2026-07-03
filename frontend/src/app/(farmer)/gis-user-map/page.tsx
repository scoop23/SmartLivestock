"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import MobileNav from "@/app/components/mobilenav";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
// const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
// const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
// const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import {
  Sprout, TrendingUp, AlertTriangle, Package, Bell, Plus, Layers, Map as MapIcon,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
const LeafletMapUser = dynamic(
  () => import("@/app/components/LeafletMapUser"),
  { ssr: false }
);

// Fix for default marker icons in Next.js
// if (typeof window !== 'undefined') {
//   delete (L.Icon.Default.prototype as any)._getIconUrl;
//   L.Icon.Default.mergeOptions({
//     iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//     iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//     shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
//   });
// }

interface BarangayData {
  name: string;
  cattle: number;
  diseaseRisk: 'low' | 'medium' | 'high';
  activeCases: number;
  milk: number;   // liters/month
  meat: number;   // kg/month (katay)
  cheese: number; // kg/month
}

const SAN_ROQUE_GEOJSON: any = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'San Roque' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [121.2260, 13.8870], [121.2380, 13.8780], [121.2430, 13.8760],
          [121.2520, 13.8750], [121.2540, 13.8640], [121.2440, 13.8580],
          [121.2340, 13.8620], [121.2260, 13.8680], [121.2260, 13.8870],
        ]],
      },
    },
  ],
};

const BARANGAY_DATA: BarangayData = {
  name: 'San Roque',
  cattle: 245,
  diseaseRisk: 'low',
  activeCases: 0,
  milk: 3675,
  meat: 1225,
  cheese: 245,
};

export type MapLayer = 'cattle' | 'disease' | 'milk' | 'meat';

const LAYER_CONFIG: Record<MapLayer, { label: string; icon: string; unit: string }> = {
  cattle: { label: 'Cattle Distribution', icon: '🐄', unit: 'heads' },
  disease: { label: 'Disease Heat Map', icon: '🩺', unit: '' },
  milk: { label: 'Milk Production', icon: '🥛', unit: 'L/mo' },
  meat: { label: 'Katay (Meat)', icon: '🥩', unit: 'kg/mo' },
};

function getLayerColor(data: BarangayData, layer: MapLayer): string {
  switch (layer) {
    case 'cattle': return data.cattle > 200 ? '#2D5A27' : data.cattle > 150 ? '#5A8F4F' : data.cattle > 100 ? '#8AB877' : '#B8D99F';
    case 'disease': return data.diseaseRisk === 'high' ? '#D32F2F' : data.diseaseRisk === 'medium' ? '#FFA726' : '#66BB6A';
    case 'milk': return data.milk > 3000 ? '#075985' : data.milk > 2000 ? '#0284c7' : data.milk > 1500 ? '#38bdf8' : '#bae6fd';
    case 'meat': return data.meat > 1000 ? '#b91c1c' : data.meat > 750 ? '#dc2626' : data.meat > 500 ? '#f87171' : '#fecaca';
  }
}

// function FitBounds() {
//   const map = useMap();
//   useEffect(() => {
//     const bounds = L.latLngBounds(L.latLng(13.8720, 121.2240), L.latLng(13.8780, 121.2560));
//     map.fitBounds(bounds, { padding: [50, 50] });
//   }, [map]);
//   return null;
// }

export default function FarmerDashboard() {
  const router = useRouter();
  const [mapLayer, setMapLayer] = useState<MapLayer>('cattle');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const data = BARANGAY_DATA;
  const riskColor = data.diseaseRisk === 'high' ? '#D32F2F' : data.diseaseRisk === 'medium' ? '#e67e22' : '#27ae60';

  const myStats = [
    { label: 'My Cattle', value: '24', icon: Sprout, color: 'bg-[#2D5A27]' },
    { label: 'Avg. Daily Milk', value: '18.5L', icon: TrendingUp, color: 'bg-blue-600' },
    { label: 'Active Alerts', value: '1', icon: AlertTriangle, color: 'bg-[#D32F2F]' },
    { label: 'This Month Sales', value: '₱45,600', icon: Package, color: 'bg-green-600' },
  ];

  const recentAlerts = [
    { id: 1, type: 'warning' as const, title: 'Vaccination Due', message: 'Annual vaccination scheduled for 5 cattle on April 30, 2026', date: '2 days ago' },
    { id: 2, type: 'info' as const, title: 'Production Report', message: 'Your monthly milk production increased by 5%', date: '1 week ago' },
  ];

  const recentActivities = [
    { id: 1, action: 'Logged milk production', value: '450L', date: 'Today, 8:00 AM' },
    { id: 2, action: 'Updated cattle weight', value: 'Cattle #B-042', date: 'Yesterday' },
    { id: 3, action: 'Recorded birth', value: 'New calf - Female', date: '3 days ago' },
  ];

  const getGeoJSONStyle = () => ({
    fillColor: getLayerColor(data, mapLayer),
    fillOpacity: 0.70,
    color: '#1a3d15',
    weight: 2.5,
    opacity: 1,
  });

  const onEachFeature = (_feature: any, layer: L.Layer) => {
    layer.bindTooltip(`<strong>${data.name}</strong>`, {
      permanent: false,
      direction: 'center',
      className: 'barangay-tooltip',
    });

    layer.bindPopup(`
      <div style="font-family: sans-serif; min-width: 185px; padding: 4px;">
        <div style="font-size: 14px; font-weight: 700; color: #1a3d15; margin-bottom: 8px; border-bottom: 2px solid #2D5A27; padding-bottom: 4px;">
          Brgy. ${data.name}
        </div>
        <div style="font-size: 12px; line-height: 2;">
          <div>🐄 <strong>Cattle:</strong> ${data.cattle} heads</div>
          <div>🩺 <strong>Disease Risk:</strong> <span style="color:${riskColor}; font-weight:600">${data.diseaseRisk.toUpperCase()}</span></div>
          ${data.activeCases > 0 ? `<div style="color:#D32F2F;">⚠️ <strong>Active Cases:</strong> ${data.activeCases}</div>` : ''}
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:5px 0;" />
          <div style="font-weight:600; color:#555; margin-bottom:2px;">Monthly Production</div>
          <div>🥛 <strong>Milk:</strong> ${data.milk.toLocaleString()} L</div>
          <div>🥩 <strong>Katay (Meat):</strong> ${data.meat.toLocaleString()} kg</div>
        </div>
      </div>
    `);

    (layer as L.Path).on({
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ weight: 3.5, fillOpacity: 0.88, color: '#fff' });
        l.bringToFront();
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        l.setStyle(getGeoJSONStyle());
      },
    });
  };

  const renderLegend = () => {
    const legends: Record<MapLayer, { color: string; label: string }[]> = {
      cattle: [{ color: '#2D5A27', label: '200+ heads' }, { color: '#5A8F4F', label: '150–200 heads' }, { color: '#8AB877', label: '100–150 heads' }, { color: '#B8D99F', label: 'Under 100 heads' }],
      disease: [{ color: '#D32F2F', label: 'High — Active outbreak' }, { color: '#FFA726', label: 'Medium — Suspected cases' }, { color: '#66BB6A', label: 'Low — No active cases' }],
      milk: [{ color: '#075985', label: '3,000+ L/mo' }, { color: '#0284c7', label: '2,000–3,000 L/mo' }, { color: '#38bdf8', label: '1,500–2,000 L/mo' }, { color: '#bae6fd', label: 'Under 1,500 L/mo' }],
      meat: [{ color: '#b91c1c', label: '1,000+ kg/mo' }, { color: '#dc2626', label: '750–1,000 kg/mo' }, { color: '#f87171', label: '500–750 kg/mo' }, { color: '#fecaca', label: 'Under 500 kg/mo' }],
      // cheese: [{ color: '#92400e', label: '200+ kg/mo' }, { color: '#d97706', label: '150–200 kg/mo' }, { color: '#fbbf24', label: '100–150 kg/mo' }, { color: '#fde68a', label: 'Under 100 kg/mo' }],
    };
    return (
      <div className="space-y-1.5">
        {legends[mapLayer].map(item => (
          <div key={item.label} className="flex items-center gap-2.5 text-sm text-gray-700">
            <div className="w-5 h-5 rounded border border-gray-300 flex-shrink-0" style={{ backgroundColor: item.color }}></div>
            {item.label}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-8 md:pb-0">
        <PageHeader
          title="Welcome, Juan!"
          subtitle="San Roque, Padre Garcia"
          variant="farmer"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
          action={
            <button className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20" aria-label="Notifications">
              <Bell className="h-6 w-6" />
            </button>
          }
        />

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {myStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className={`${stat.color} text-white p-2 rounded-lg inline-block mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-xl mb-1 font-bold">{stat.value}</p>
                  <p className="text-xs text-gray-600">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="mb-4 font-semibold text-gray-800">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/livestock-inventory')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-[#2D5A27] hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-8 h-8 text-[#2D5A27]" />
                <span className="text-sm text-center">Add Livestock</span>
              </button>
              <button
                onClick={() => router.push('/production-logger')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-[#2D5A27] hover:bg-gray-50 transition-colors"
              >
                <Package className="w-8 h-8 text-[#2D5A27]" />
                <span className="text-sm text-center">Log Production</span>
              </button>
            </div>
          </div>

          {/* My Barangay GIS Map */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <MapIcon className="w-5 h-5 text-[#2D5A27]" />
              <h3 className="font-semibold text-gray-800">My Barangay — San Roque</h3>
            </div>

            {/* Map Layer Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-[#2D5A27]" />
              <span className="font-medium text-sm text-gray-700">Layer:</span>
              {(Object.keys(LAYER_CONFIG) as MapLayer[]).map(layer => (
                <button
                  key={layer}
                  onClick={() => setMapLayer(layer)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mapLayer === layer
                    ? 'bg-[#2D5A27] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {LAYER_CONFIG[layer].icon} {LAYER_CONFIG[layer].label}
                </button>
              ))}
            </div>

            {/* Map */}
            <div className="rounded-lg overflow-hidden border border-gray-200 mb-4">
              <div className="bg-[#2D5A27] px-3 py-1.5 text-white text-xs font-medium">
                {LAYER_CONFIG[mapLayer].icon} Viewing: {LAYER_CONFIG[mapLayer].label} · Click polygon for details
              </div>
              <div className="h-[360px]">
                {mounted && (
                  <>
                    <style>{`
                      .barangay-tooltip { background: rgba(45, 90, 39, 0.92); border: none; border-radius: 4px; color: white; font-size: 12px; font-weight: 600; padding: 4px 8px; }
                      .barangay-tooltip::before { display: none; }
                      .leaflet-popup-content-wrapper { border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
                    `}</style>
                    {/* leaflet */}
                    <LeafletMapUser
                      mapLayer={mapLayer}
                      SAN_ROQUE_GEOJSON={SAN_ROQUE_GEOJSON}
                      getGeoJSONStyle={getGeoJSONStyle}
                      onEachFeature={onEachFeature} />
                  </>
                )}
              </div>
            </div>

            {/* Legend + Barangay Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm mb-2 font-medium text-gray-700">
                  {LAYER_CONFIG[mapLayer].icon} {LAYER_CONFIG[mapLayer].label} — Legend
                </p>
                {renderLegend()}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-100">
                <p className="text-sm font-medium text-gray-700">Barangay Info</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-emerald-100 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-[#2D5A27]">{data.cattle}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500">🐄 Cattle Heads</div>
                  </div>
                  <div className="bg-white border border-emerald-100 rounded-lg p-2.5 text-center">
                    <div className="text-sm font-bold text-green-700">{data.diseaseRisk.toUpperCase()}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500">🩺 Disease Risk</div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Monthly Production</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between bg-blue-50/50 rounded-lg px-3 py-1.5 border border-blue-100">
                      <span className="text-sm text-blue-800">🥛 Milk</span>
                      <span className="text-sm font-bold text-blue-700">{data.milk.toLocaleString()} L</span>
                    </div>
                    <div className="flex items-center justify-between bg-red-50/50 rounded-lg px-3 py-1.5 border border-red-100">
                      <span className="text-sm text-red-800">🥩 Katay (Meat)</span>
                      <span className="text-sm font-bold text-red-700">{data.meat.toLocaleString()} kg</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Recent Alerts</h3>
              <button onClick={() => router.push('/alerts')} className="text-sm text-[#2D5A27] font-bold hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500' : 'bg-blue-50 border-blue-500'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1">{alert.title}</h4>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 font-medium">{alert.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="mb-4 font-semibold text-gray-800">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                  <div className="w-2 h-2 bg-[#2D5A27] rounded-full mt-2 group-hover:scale-125 transition-transform"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                    <p className="text-sm text-[#2D5A27] font-bold">{activity.value}</p>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">{activity.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
