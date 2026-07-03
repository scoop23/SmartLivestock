import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import type { PathOptions } from 'leaflet';

const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }

); interface SibatLeafletMapProps {
  geojsonStyle: (feature?: GeoJSON.Feature) => PathOptions;
  PADRE_GARCIA_GEOJSON: GeoJSON.FeatureCollection;
  setHoveredBarangay: (name: string | null) => void;
}
const SibatLeafletMap = ({ geojsonStyle, PADRE_GARCIA_GEOJSON, setHoveredBarangay }: SibatLeafletMapProps) => {
  return (
    <>
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
              mouseover: (e: any) => {
                const l = e.target;
                l.setStyle({ fillOpacity: 0.7, weight: 3 });
                setHoveredBarangay(feature.properties.name);
              },
              mouseout: (e: any) => {
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
    </>
  )
}

export default SibatLeafletMap;
