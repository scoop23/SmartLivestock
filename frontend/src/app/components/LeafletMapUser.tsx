import dynamic from 'next/dynamic';
import { useEffect } from 'react';
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapLayer } from '@/app/gis-user-map/page';

interface LeafletMapUserTypes {
  mapLayer: MapLayer;
  SAN_ROQUE_GEOJSON: GeoJSON.GeoJsonObject;
  getGeoJSONStyle: () => L.PathOptions;
  onEachFeature: (feature: any, layer: L.Layer) => void;
}


function FitBounds() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(L.latLng(13.8720, 121.2240), L.latLng(13.8780, 121.2560));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map]);
  return null;
}

const LeafletMapUser = ({ mapLayer, SAN_ROQUE_GEOJSON, getGeoJSONStyle, onEachFeature }: LeafletMapUserTypes) => {
  return (
    <>
      <MapContainer center={[13.8750, 121.2400]} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={`sr-${mapLayer}`}
          data={SAN_ROQUE_GEOJSON}
          style={getGeoJSONStyle}
          onEachFeature={onEachFeature}
        />
        <FitBounds />
      </MapContainer></>
  )
}

export default LeafletMapUser;
