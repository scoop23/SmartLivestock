'use client';

import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';
import type Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import type Instance from '@giro3d/giro3d/core/Instance.js';
import type FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import type Feature from 'ol/Feature.js';
import type { Geometry } from 'ol/geom.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type Polygon from 'ol/geom/Polygon.js';
import { useEffect,useRef,useState } from 'react';
import type { Object3D } from 'three';
import { groupMovementRoutes, movementEndpointMatches } from './movement-routes';
import type { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { BarangayGISData,DiseaseSubMode,GISUserScope,MapLayer,Movement3DDisplayMode,MovementRecord,SimulationColorMode,SimulatedBarangayState } from './types';

// Shared camera coordinates keep the first 3D view and the Reset button consistent.
const DEFAULT_3D_CAMERA_POSITION = { x: 13_492_381.19, y: 1_541_389.26, z: 14_328.31 };

// Official geographic bounding extent of the Philippine archipelago in EPSG:3857 (Web Mercator)
// Spans latitude 4.5° N to 21.5° N and longitude 116.0° E to 127.0° E (Luzon, Visayas, Mindanao, Palawan)
const PHILIPPINES_EXTENT_3857 = {
  minX: 12_913_000,
  maxX: 14_138_000,
  minY: 501_000,
  maxY: 2_452_000,
};

interface Giro3DBarangayViewProps {
  barangaysByName: Record<string, BarangayGISData>;
  activeLayer: MapLayer;
  diseaseSubMode: DiseaseSubMode;
  simulationColorMode: SimulationColorMode;
  selectedBarangay: BarangayGISData | null;
  onSelectBarangay: (barangay: BarangayGISData) => void;
  resetTrigger: number;
  simulatedStates?: Record<string, SimulatedBarangayState>;
  selectedLivestockType: string;
  userScope?: GISUserScope;
  heightScale: number;
  suppressClickUntilRef: { current: number };
  movements?: MovementRecord[];
  movementLabelRecords?: MovementRecord[];
  selectedMovement?: MovementRecord | null;
  onSelectMovement?: (movement: MovementRecord | null) => void;
  showMovementOverlay?: boolean;
  movementDisplayMode?: Movement3DDisplayMode;
  isTimelineActive?: boolean;
  enableCirclingCamera?: boolean;
  isCircling?: boolean;
  onCirclingChange?: (circling: boolean) => void;
}

interface AnimatedPulse {
  headMesh: import('three').Mesh;
  haloMesh?: import('three').Mesh;
  trailMeshes: import('three').Mesh[];
  curve: import('three').CubicBezierCurve3;
  speed: number;
  offset: number;
  isSelected?: boolean;
}

interface AnimatedRing {
  mesh: import('three').Mesh;
  speed: number;
  phase: number;
  maxScale: number;
  baseOpacity?: number;
}

// Convert latitude/longitude (EPSG:4326) into Web Mercator meters (EPSG:3857)
function latLngToWebMercator(lat: number, lng: number): [number, number] {
  const x = (lng * 20037508.34) / 180;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const y = (Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) / (Math.PI / 180) * 20037508.34) / 180;
  return [x, y];
}

// One shared metric lookup keeps each barangay's extrusion height tied to the active GIS layer.
function getMetricValue(
  data: BarangayGISData | undefined,
  layer: MapLayer,
  diseaseSubMode: DiseaseSubMode,
  simulation: SimulatedBarangayState | undefined,
  livestockType: string,
  simulationColorMode: SimulationColorMode,
): number {
  if (!data) return 0;

  switch (layer) {
    case 'cattle': {
      if (!livestockType || livestockType.toLowerCase() === 'cattle') return data.cattle;
      if (livestockType.toUpperCase() === 'ALL') return data.total_livestock;
      return data.species_breakdown.find((item) => item.species.toLowerCase() === livestockType.toLowerCase())?.heads ?? 0;
    }
    case 'disease':
      if (diseaseSubMode === 'simulation' && simulation) {
        return simulationColorMode === 'pressure' ? simulation.transmissionPressure : simulation.cases;
      }
      if (diseaseSubMode === 'reported') return data.disease_cases ?? 0;
      if ((data.active_cases ?? 0) > 0 || (data.fmd_active_cases ?? 0) > 0) {
        return Math.max(data.active_cases, data.fmd_active_cases ?? 0);
      }
      // Haversine buffer zone elevated warning tier in 3D
      if (Boolean(data.is_in_monitoring_radius) || data.disease_risk === 'medium' || data.disease_zone === 'monitoring_radius') {
        return 0;
      }
      return 0;
    case 'milk':
      return data.milk;
    case 'farmer_meat':
      return data.farmer_meat ?? 0;
    case 'slaughter_yield':
    case 'meat':
      return data.slaughter_yield ?? data.meat ?? 0;
    case 'mortality':
      if (livestockType.toUpperCase() === 'ALL') return data.mortality;
      return data.mortality_by_species?.find((item) =>
        item.species.toLowerCase() === livestockType.toLowerCase()
      )?.heads ?? (livestockType.toLowerCase() === 'cattle' ? data.mortality : 0);
    case 'movement':
      return (data?.inspections_count ?? 0) > 0
        ? data!.inspections_count
        : ((data?.movement_out ?? 0) > 0 ? 1 : 0);
  }
}

/**
 * Thematic Movement / Livestock Inspection Clearance Choropleth Fill Colors (Indigo Palette)
 * Scaled by total inspection / clearance records filed for this origin barangay.
 * Matches 2D GISMap.tsx: 10+ (#312e81), 6-9 (#4f46e5), 3-5 (#818cf8), 1-2 (#c7d2fe), 0 (#f8fafc).
 */
function getMovementColor(recordCount: number): string {
  if (recordCount >= 10) return '#312e81'; // 10+ records: Very High (indigo-900)
  if (recordCount >= 6) return '#4f46e5';  // 6–9 records: High (indigo-600)
  if (recordCount >= 3) return '#818cf8';  // 3–5 records: Moderate (indigo-400)
  if (recordCount >= 1) return '#c7d2fe';  // 1–2 records: Low (indigo-200)
  return '#f8fafc';                        // 0 records: Baseline (clean slate-50)
}

// Each map layer has its own four-step palette; ratio is the feature's value relative to the layer maximum.
function getLayerColor(
  layer: MapLayer,
  ratio: number,
  diseaseSubMode: DiseaseSubMode,
  simulationColorMode: SimulationColorMode,
  simulation: SimulatedBarangayState | undefined,
  value?: number,
  data?: BarangayGISData,
): string {
  if (layer === 'movement') {
    return getMovementColor(value ?? 0);
  }

  if (layer === 'disease') {
    if (diseaseSubMode === 'reported') return (data?.disease_cases ?? 0) > 0 ? '#0284c7' : '#94a3b8';
    if (diseaseSubMode === 'simulation') {
      if (simulation && !simulation.hasLivestock && simulation.cases === 0) return '#94a3b8';
      if (simulationColorMode === 'pressure') {
        const pressure = simulation?.transmissionPressure ?? 0;
        if (pressure >= 0.70) return '#991b1b';
        if (pressure >= 0.40) return '#ea580c';
        if (pressure >= 0.20) return '#f59e0b';
        return '#10b981';
      }
      const cases = simulation?.cases ?? 0;
      if (cases >= 6) return '#991b1b';
      if (cases >= 3) return '#ea580c';
      if (cases >= 1) return '#f59e0b';
      return '#10b981';
    }

    // 3-Tier Classification for Disease:
    // Red: Approved disease report
    // Orange: Within Haversine distance monitoring radius
    // Green: No recent report
    const hasApprovedReport = (data?.active_cases ?? 0) > 0 || (data?.fmd_active_cases ?? 0) > 0 || data?.disease_risk === 'high' || data?.disease_zone === 'outbreak';
    if (hasApprovedReport) return '#ef4444';

    const isHaversineBuffer = Boolean(data?.is_in_monitoring_radius) || data?.disease_risk === 'medium' || data?.disease_zone === 'monitoring_radius';
    if (isHaversineBuffer) return '#f97316';

    return '#10b981';
  }

  const palettes: Record<MapLayer, [string, string, string, string]> = {
    cattle: ['#eaf3e4', '#c5e0a8', '#5a8f4f', '#1a3d15'],
    disease: ['#10b981', '#f97316', '#ea580c', '#ef4444'],
    milk: ['#e0f2fe', '#7dd3fc', '#0284c7', '#0c4a6e'],
    farmer_meat: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    slaughter_yield: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    meat: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    mortality: ['#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'],
    movement: ['#c7d2fe', '#818cf8', '#4f46e5', '#312e81'],
  };
  const palette = palettes[layer];
  return palette[Math.min(3, Math.floor(Math.min(0.999, ratio) * palette.length))];
}

// Outline coordinates must be raised with the polygon; FeatureCollection's native
// polygon stroke follows the original ground ring, so it can be hidden by the 3D fill.
function getPolygonRings(geometry: Geometry): number[][][] {
  if (geometry.getType() === 'Polygon') return (geometry as Polygon).getCoordinates();
  if (geometry.getType() === 'MultiPolygon') return (geometry as MultiPolygon).getCoordinates().flat();
  return [];
}

// Use an interior point so the name sits inside its barangay instead of at a possibly empty bounds corner.
function getPolygonLabelAnchor(geometry: Geometry): [number, number] {
  let coordinate: number[] | undefined;
  if (geometry.getType() === 'Polygon') {
    coordinate = (geometry as Polygon).getInteriorPoint().getCoordinates();
  } else if (geometry.getType() === 'MultiPolygon') {
    coordinate = (geometry as MultiPolygon).getInteriorPoints().getCoordinates()[0];
  }
  if (coordinate) return [coordinate[0], coordinate[1]];

  // Fall back to the geometry bounds center for any unexpected polygon geometry type.
  const extent = geometry.getExtent();
  return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
}

// Convert a layer value into the extrusion height shared by the polygon mesh and its outline.
function getExtrusionHeight(value: number, largestMetric: number, heightScale: number): number {
  const ratio = value > 0 && largestMetric > 0
    ? Math.min(1, Math.log1p(value) / Math.log1p(largestMetric))
    : 0;
  return (50 + ratio * 2_200) * heightScale;
}

// Create roof edges and vertical corners from a polygon's rings at its current extrusion height.
function getBorderPositions(geometry: Geometry, height: number): number[] {
  const positions: number[] = [];
  for (const ring of getPolygonRings(geometry)) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [x, y, z = 0] = ring[index];
      const [nextX, nextY, nextZ = 0] = ring[index + 1];
      positions.push(x, y, z + height + 1, nextX, nextY, nextZ + height + 1);
      positions.push(x, y, z, x, y, z + height + 1);
    }
  }
  return positions;
}

// Update a Three.js object's Z scale and matrix together so the renderer sees the new transform.
function setVerticalScale(object: Object3D, scale: number): void {
  object.scale.setZ(scale);
  object.updateMatrix();
  object.matrixWorldNeedsUpdate = true;
  object.updateMatrixWorld(true);
  if (object.parent) {
    object.parent.matrixWorldNeedsUpdate = true;
    object.parent.updateMatrixWorld(true);
  }
}

// Match a movement shipment's origin string or coordinates to an official Padre Garcia barangay name key
function getMovementOriginKey(
  move: MovementRecord,
  barangayKeys: string[],
  barangaysByName: Record<string, BarangayGISData>,
): string | null {
  const origin = (move.origin || '').toLowerCase().trim();
  if (origin) {
    const firstPart = origin.split(',')[0].trim();
    // 1. Exact match with first comma segment or full origin string
    for (const key of barangayKeys) {
      if (firstPart === key || origin === key) return key;
    }
    // 2. Substring match (keys sorted by length descending)
    for (const key of barangayKeys) {
      if (origin.includes(key)) return key;
    }
  }

  // 3. Proximity fallback: match coordinate origin to barangay position
  if (move.from && Number.isFinite(move.from[0]) && Number.isFinite(move.from[1])) {
    const [fromLat, fromLng] = move.from;
    for (const [name, bData] of Object.entries(barangaysByName)) {
      if (bData?.position) {
        const [bLat, bLng] = bData.position;
        if (Math.abs(fromLat - bLat) < 0.005 && Math.abs(fromLng - bLng) < 0.005) {
          return name.toLowerCase();
        }
      }
    }
  }

  return null;
}

export function Giro3DBarangayView({
  barangaysByName,
  activeLayer,
  diseaseSubMode,
  simulationColorMode,
  selectedBarangay,
  onSelectBarangay,
  resetTrigger,
  simulatedStates,
  selectedLivestockType,
  userScope,
  heightScale,
  suppressClickUntilRef,
  movements = [],
  movementLabelRecords,
  selectedMovement,
  onSelectMovement,
  showMovementOverlay = false,
  movementDisplayMode = 'both',
  isTimelineActive = false,
  enableCirclingCamera = false,
  isCircling = false,
  onCirclingChange,
}: Giro3DBarangayViewProps) {
  // Snapshot responses allocate a new scope object on every date change.
  // Scene lifetime follows permission values, not the response object's identity.
  const sceneScopeKey = JSON.stringify(userScope ?? null);
  const movementLabelRecordsRef = useRef(movementLabelRecords ?? movements);
  useEffect(() => {
    movementLabelRecordsRef.current = movementLabelRecords ?? movements;
    syncLabelPositionsRef.current?.();
  }, [movementLabelRecords, movements]);
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const collectionRef = useRef<FeatureCollection | null>(null);
  const sceneExtentRef = useRef<Extent | null>(null);
  const controlsRef = useRef<MapControls | null>(null);
  useEffect(() => {
    if (controlsRef.current && enableCirclingCamera) {
      controlsRef.current.autoRotate = Boolean(isCircling);
    }
  }, [isCircling, enableCirclingCamera]);

  const featuresByNameRef = useRef(new Map<string, Feature<Geometry>>());
  const threeModuleRef = useRef<typeof import('three') | null>(null);
  const movementGroupRef = useRef<import('three').Group | null>(null);
  const onSelectMovementRef = useRef(onSelectMovement);
  const movementDisplayModeRef = useRef<Movement3DDisplayMode>(movementDisplayMode);

  useEffect(() => {
    movementDisplayModeRef.current = movementDisplayMode;
  }, [movementDisplayMode]);

  useEffect(() => {
    onSelectMovementRef.current = onSelectMovement;
  }, [onSelectMovement]);
  // Refs let the long-lived Giro3D scene read current slider and data values without being recreated.
  const barangaysByNameRef = useRef(barangaysByName);
  useEffect(() => {
    barangaysByNameRef.current = barangaysByName;
    const collection = collectionRef.current;
    if (collection) {
      largestMetricRef.current = Math.max(
        0,
        ...Object.values(barangaysByName).map((data) =>
          getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[data.name], selectedLivestockType, simulationColorMode)
        ),
      );
      collection.updateStyles();
      refreshBorderColorsRef.current?.();
      syncLabelPositionsRef.current?.();
      instanceRef.current?.notifyChange();
    }
  }, [barangaysByName, activeLayer, diseaseSubMode, selectedLivestockType, simulationColorMode]);
  const heightScaleRef = useRef(heightScale);
  const appliedHeightScaleRef = useRef(heightScale);
  const borderLinesRef = useRef(new Map<Feature<Geometry>, import('three').LineSegments>());
  const borderLinesByNameRef = useRef(new Map<string, import('three').LineSegments>());
  const labelElementsRef = useRef(new Map<Feature<Geometry>, HTMLDivElement>());
  const labelAnchorsRef = useRef(new Map<Feature<Geometry>, [number, number]>());
  const syncLabelPositionsRef = useRef<(() => void) | null>(null);
  const refreshBorderColorsRef = useRef<(() => void) | null>(null);
  const simulatedStatesRef = useRef(simulatedStates);
  const largestMetricRef = useRef(0);
  const surfaceMeshesRef = useRef(new Map<Feature<Geometry>, Object3D[]>());
  const displayedHeightsRef = useRef(new Map<Feature<Geometry>, number>());
  const fullExtrusionHeightsRef = useRef(new Map<Feature<Geometry>, number>());
  const simulationAnimationFrameRef = useRef<number | null>(null);
  const heightAnimFrameRef = useRef<number | null>(null);
  const cameraAnimRef = useRef<number | null>(null);
  const hoveredFeatureRef = useRef<Feature<Geometry> | null>(null);
  const onSelectRef = useRef(onSelectBarangay);
  const selectedBarangayRef = useRef(selectedBarangay);
  const destinationLabelsRef = useRef(new Map<string, HTMLDivElement>());
  const destinationAnchorsRef = useRef(new Map<string, [number, number, number]>());
  const animatedPulsesRef = useRef<AnimatedPulse[]>([]);
  const animatedRingsRef = useRef<AnimatedRing[]>([]);
  const pulseAnimFrameRef = useRef<number | null>(null);
  const destinationBeaconsRef = useRef<import('three').Mesh[]>([]);
  const destinationPillarsRef = useRef<import('three').Mesh[]>([]);
  const materialsToFadeRef = useRef<{ material: import('three').MeshBasicMaterial; targetOpacity: number; mountTime: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ name: string; x: number; y: number } | null>(null);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const selectedMovementRef = useRef<MovementRecord | null | undefined>(selectedMovement);
  const flyToDestinationRef = useRef<((move: MovementRecord) => void) | null>(null);

  const flyToDestination = (move: MovementRecord) => {
    const instance = instanceRef.current;
    const controls = controlsRef.current;
    if (!instance || !controls || !move.to) return;

    const [destLat, destLng] = move.to;
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return;

    const [destX, destY] = latLngToWebMercator(destLat, destLng);

    const startTargetX = controls.target.x;
    const startTargetY = controls.target.y;
    const startTargetZ = controls.target.z;

    const startCamX = instance.view.camera.position.x;
    const startCamY = instance.view.camera.position.y;
    const startCamZ = instance.view.camera.position.z;

    const targetTargetX = destX;
    const targetTargetY = destY;
    const targetTargetZ = 0;

    // Generous view distance framing the destination terminal beacon and regional context
    const viewDistance = 9000;
    const targetCamX = destX - viewDistance * 0.45;
    const targetCamY = destY - viewDistance * 0.55;
    const targetCamZ = viewDistance * 1.5;

    if (cameraAnimRef.current) {
      cancelAnimationFrame(cameraAnimRef.current);
    }

    const startTime = performance.now();
    const duration = 800; // ms

    const animateCamera = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      controls.target.set(
        startTargetX + (targetTargetX - startTargetX) * ease,
        startTargetY + (targetTargetY - startTargetY) * ease,
        startTargetZ + (targetTargetZ - startTargetZ) * ease,
      );

      instance.view.camera.position.set(
        startCamX + (targetCamX - startCamX) * ease,
        startCamY + (targetCamY - startCamY) * ease,
        startCamZ + (targetCamZ - startCamZ) * ease,
      );

      controls.update();
      syncLabelPositionsRef.current?.();
      instance.notifyChange();

      if (progress < 1) {
        cameraAnimRef.current = requestAnimationFrame(animateCamera);
      } else {
        cameraAnimRef.current = null;
      }
    };

    cameraAnimRef.current = requestAnimationFrame(animateCamera);
  };

  useEffect(() => {
    flyToDestinationRef.current = flyToDestination;
  });

  useEffect(() => {
    selectedMovementRef.current = selectedMovement;
    if (selectedMovement && selectedMovement.to) {
      flyToDestination(selectedMovement);
    }
    syncLabelPositionsRef.current?.();
  }, [selectedMovement]);

  useEffect(() => {
    onSelectRef.current = onSelectBarangay;
  }, [onSelectBarangay]);

  // Keep the ref in sync after each commit so async scene callbacks read the latest slider value.
  useEffect(() => {
    heightScaleRef.current = heightScale;
  }, [heightScale]);

  useEffect(() => {
    selectedBarangayRef.current = selectedBarangay;
  }, [selectedBarangay]);

  // Keep the newest month of simulated values available to long-lived scene callbacks.
  useEffect(() => {
    simulatedStatesRef.current = simulatedStates;
  }, [simulatedStates]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let instance: Instance | null = null;
    let controls: MapControls | null = null;
    let featureCollection: FeatureCollection | null = null;
    const borderLines = borderLinesRef.current;
    const labelElements = labelElementsRef.current;
    const labelAnchors = labelAnchorsRef.current;
    const surfaceMeshes = surfaceMeshesRef.current;
    const displayedHeights = displayedHeightsRef.current;
    let clickHandler: ((event: MouseEvent) => void) | null = null;
    let pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
    let pointerLeaveHandler: (() => void) | null = null;
    let cameraChangeHandler: (() => void) | null = null;
    let cameraLogTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const initialize = async () => {
      try {
        // These browser-only modules are loaded here so Next.js does not evaluate WebGL code during server rendering.
        const [instanceModule, mapModule, colorLayerModule, tiledImageSourceModule, osmModule, featureCollectionModule, coordinateSystemModule, extentModule, geoJsonModule, vectorSourceModule, mapControlsModule, three] = await Promise.all([
          import('@giro3d/giro3d/core/Instance.js'),
          import('@giro3d/giro3d/entities/Map.js'),
          import('@giro3d/giro3d/core/layer/ColorLayer.js'),
          import('@giro3d/giro3d/sources/TiledImageSource.js'),
          import('ol/source.js'),
          import('@giro3d/giro3d/entities/FeatureCollection.js'),
          import('@giro3d/giro3d/core/geographic/CoordinateSystem.js'),
          import('@giro3d/giro3d/core/geographic/Extent.js'),
          import('ol/format/GeoJSON.js'),
          import('ol/source/Vector.js'),
          import('three/examples/jsm/controls/MapControls.js'),
          import('three'),
        ]);

        if (cancelled) return;

        // GeoJSON stores longitude/latitude; project it to meter-based Web Mercator for the 3D scene.
        const crs = coordinateSystemModule.default.epsg3857;
        const geoJsonReader = new geoJsonModule.default();
        const features = geoJsonReader.readFeatures(padreGarciaGeojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        const source = new vectorSourceModule.default({ features });
        const sourceExtent = source.getExtent();
        if (!sourceExtent || !sourceExtent.every(Number.isFinite)) {
          throw new Error('The barangay GeoJSON has no valid map extent.');
        }
        const [minX, minY, maxX, maxY] = sourceExtent;

        // Municipal extent for Padre Garcia 3D polygon meshes and local focus
        const margin = Math.max(maxX - minX, maxY - minY) * 0.08;
        const municipalExtent = new extentModule.default(crs, minX - margin, maxX + margin, minY - margin, maxY + margin);
        sceneExtentRef.current = municipalExtent;

        // Expanded 3D basemap extent encompassing the whole Philippine archipelago
        const mapExtent = new extentModule.default(
          crs,
          PHILIPPINES_EXTENT_3857.minX,
          PHILIPPINES_EXTENT_3857.maxX,
          PHILIPPINES_EXTENT_3857.minY,
          PHILIPPINES_EXTENT_3857.maxY,
        );
        const largestMetric = Math.max(
          0,
          ...Object.values(barangaysByNameRef.current).map((data) =>
            getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[data.name], selectedLivestockType, simulationColorMode)
          ),
        );
        largestMetricRef.current = largestMetric;
        const featureByName = new Map<string, Feature<Geometry>>();
        for (const feature of features) {
          const name = String(feature.get('name') ?? '');
          if (name) featureByName.set(name.toLowerCase(), feature as Feature<Geometry>);
        }
        featuresByNameRef.current = featureByName;

        // Giro3D owns the scene/canvas; Three.js supplies the renderer, camera, and 3D objects underneath it.
        instance = new instanceModule.default({ target: host, crs, backgroundColor: '#07111f' });
        instance.scene.matrixWorldAutoUpdate = true;
        const map = new mapModule.default({
          extent: mapExtent,
          backgroundColor: '#0f172a',
          terrain: false,
          lighting: { enabled: true },
        });
        // Entity initialization is asynchronous, so wait before adding layers or configuring the camera.
        await instance.add(map);
        if (cancelled) return;
        await map.addLayer(new colorLayerModule.default({
          name: 'OpenStreetMap',
          extent: mapExtent,
          source: new tiledImageSourceModule.default({ source: new osmModule.OSM({ url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" }) }),
        }));
        if (cancelled) return;

        // FeatureCollection converts the OpenLayers polygons into Three.js meshes inside the Giro3D scene.
        featureCollection = new featureCollectionModule.default({
          name: 'Padre Garcia barangays',
          source,
          extent: municipalExtent,
          dataProjection: crs,
          ignoreZ: true,
          minLevel: 0,
          maxLevel: 0,
          extrusionOffset: (feature) => {
            const name = String(feature.get('name') ?? '');
            const data = barangaysByNameRef.current[name];
            const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
            // Every polygon gets a small base height; its metric controls up to 2,200 additional scene units.
            return getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current);
          },
          style: (feature) => {
            // Giro3D calls this for each feature; feature properties drive selection and hover appearance.
            const name = String(feature.get('name') ?? '');
            const data = barangaysByNameRef.current[name];
            const inScope = data?.is_in_scope ?? (
              !userScope || userScope.can_view_all_barangays || userScope.allowed_barangays.includes(name)
            );
            const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
            const ratio = largestMetricRef.current > 0 ? value / largestMetricRef.current : 0;
            const hovered = Boolean(feature.get('hovered'));

            return {
              fill: {
                color: hovered ? '#facc15' : inScope ? getLayerColor(
                  activeLayer,
                  ratio,
                  diseaseSubMode,
                  simulationColorMode,
                  simulatedStatesRef.current?.[name],
                  value,
                  data,
                ) : '#475569',
                opacity: hovered || (activeLayer === 'movement' && inScope) ? 1 : inScope ? 0.94 : 0.48,
                // The GIS choropleth should keep its data colors without depending on scene lights.
                shading: false,
              },
            };
          },
        });
        await instance.add(featureCollection);
        if (cancelled) return;

        // Cache each roof mesh by its source feature so playback can animate the actual polygon objects.
        surfaceMeshesRef.current.clear();
        featureCollection.traverse((object) => {
          if (object.type !== 'SurfaceMesh') return;
          const feature = object.userData.feature as Feature<Geometry> | undefined;
          if (!feature) return;
          const surfaces = surfaceMeshesRef.current.get(feature) ?? [];
          surfaces.push(object);
          surfaceMeshesRef.current.set(feature, surfaces);
        });

        // Draw the roof perimeter and vertical corners at full extrusion height for each 3D barangay.
        // These lines depth-test against the meshes, so hidden edges stay hidden instead of creating x-ray lines.
        borderLinesByNameRef.current.clear();
        for (const feature of features) {
          const geometry = feature.getGeometry();
          if (!geometry) continue;
          const name = String(feature.get('name') ?? '');
          const lowerName = name.toLowerCase();
          const data = barangaysByNameRef.current[name] || barangaysByNameRef.current[lowerName];
          const isFlat = activeLayer === 'movement' && movementDisplayModeRef.current === 'lines';
          const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
          const fullHeight = getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current);
          const positions = getBorderPositions(geometry, fullHeight);

          const lineGeometry = new three.BufferGeometry();
          lineGeometry.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
          const material = new three.LineBasicMaterial({ color: '#000000', depthTest: true });
          const lines = new three.LineSegments(lineGeometry, material);
          lines.renderOrder = 2;

          instance.threeObjects.add(lines);
          borderLines.set(feature as Feature<Geometry>, lines);
          borderLinesByNameRef.current.set(lowerName, lines);
          fullExtrusionHeightsRef.current.set(feature as Feature<Geometry>, Math.max(10, fullHeight));

          const initialHeight = isFlat ? 2 : fullHeight;
          const initialScaleZ = isFlat && fullHeight > 0 ? 2 / fullHeight : 1.0;
          if (isFlat) {
            setVerticalScale(lines, initialScaleZ);
          }
          displayedHeightsRef.current.set(feature as Feature<Geometry>, initialHeight);
        }

        // If starting in flat lines mode on movement layer, scale roof meshes to flat height (2)
        if (activeLayer === 'movement' && movementDisplayModeRef.current === 'lines') {
          for (const feature of features) {
            const typedFeature = feature as Feature<Geometry>;
            const name = String(feature.get('name') ?? '');
            const data = barangaysByNameRef.current[name];
            const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
            const fullHeight = getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current);
            const initialScaleZ = fullHeight > 0 ? 2 / fullHeight : 0.001;
            for (const surface of surfaceMeshesRef.current.get(typedFeature) ?? []) {
              setVerticalScale(surface, initialScaleZ);
            }
          }
        }

        // Dedicated Group for 3D Movement Flows across the Philippine archipelago
        threeModuleRef.current = three;
        const movementGroup = new three.Group();
        movementGroup.name = '3D Livestock Movement Flows';
        movementGroupRef.current = movementGroup;
        instance.threeObjects.add(movementGroup);

        // HTML labels are projected over the WebGL canvas, so text remains readable and sits above every polygon.
        for (const feature of features) {
          const geometry = feature.getGeometry();
          const name = String(feature.get('name') ?? '');
          if (!geometry || !name) continue;

          const typedFeature = feature as Feature<Geometry>;
          const label = document.createElement('div');
          label.textContent = name;
          label.setAttribute('aria-hidden', 'true');
          Object.assign(label.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            zIndex: '20',
            display: 'none',
            transform: 'translate(-50%, -110%)',
            padding: '3px 7px',
            border: '1px solid rgba(255,255,255,0.8)',
            borderRadius: '5px',
            background: 'rgba(15,23,42,0.92)',
            color: '#fff',
            font: '600 11px/1.25 sans-serif',
            whiteSpace: 'pre-line',
            textAlign: 'center',
            pointerEvents: 'none',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          });
          host.appendChild(label);
          labelElements.set(typedFeature, label);
          labelAnchors.set(typedFeature, getPolygonLabelAnchor(geometry));
        }
        // Record the scale used for these borders; later slider changes scale them by a ratio.
        appliedHeightScaleRef.current = heightScaleRef.current;

        const refreshBorderColors = () => {
          for (const [feature, lines] of borderLines) {
            const material = lines.material as import('three').LineBasicMaterial;
            if (feature.get('selected')) {
              material.color.set('#ffffff');
            } else if (feature.get('hovered')) {
              material.color.set('#fff200');
            } else {
              material.color.set('#000000');
            }
          }
          instance?.notifyChange();
        };
        refreshBorderColorsRef.current = refreshBorderColors;

        // Focus a selected barangay on entry; otherwise fit the whole municipality.
        const initialSelected = selectedBarangayRef.current?.name.toLowerCase();
        const selectedGeometry = initialSelected
          ? featureByName.get(initialSelected)?.getGeometry()
          : undefined;
        const initialExtent = selectedGeometry?.getExtent() ?? [minX, minY, maxX, maxY];
        const initialCenterX = (initialExtent[0] + initialExtent[2]) / 2;
        const initialCenterY = (initialExtent[1] + initialExtent[3]) / 2;
        const center = new three.Vector3(initialCenterX, initialCenterY, 0);
        instance.view.camera.up.set(0, 0, 1);
        // Extend camera far plane to view the full Philippine archipelago when orbiting or zooming out
        instance.view.camera.far = 15_000_000;
        instance.view.camera.updateProjectionMatrix();

        // Start at the saved camera position while aiming at the selected barangay or municipal center.
        instance.view.camera.position.set(
          DEFAULT_3D_CAMERA_POSITION.x,
          DEFAULT_3D_CAMERA_POSITION.y,
          DEFAULT_3D_CAMERA_POSITION.z,
        );
        instance.view.camera.lookAt(center);
        // MapControls lets the user orbit, pan, and zoom the Three.js camera with mouse/touch input.
        controls = new mapControlsModule.MapControls(instance.view.camera, instance.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
        controls.maxPolarAngle = Math.PI / 2.15;
        controls.maxDistance = 6_000_000;
        controls.target.copy(center);
        if (enableCirclingCamera) {
          controls.autoRotate = Boolean(isCircling);
          controls.autoRotateSpeed = 0.75;
          controls.addEventListener('start', () => {
            onCirclingChange?.(false);
          });
        }
        controls.update();
        controls.saveState();
        controlsRef.current = controls;
        instance.view.setControls(controls);

        // Convert each 3D top-face anchor into canvas pixels; CSS labels then render above the WebGL canvas.
        const projectedLabelPoint = new three.Vector3();
        syncLabelPositionsRef.current = () => {
          if (!instance) return;
          const bounds = host.getBoundingClientRect();
          instance.view.camera.updateMatrixWorld(true);
          for (const [feature, label] of labelElements) {
            const name = String(feature.get('name') ?? '');
            const simState = simulatedStatesRef.current?.[name];
            const bData = barangaysByNameRef.current[name] || barangaysByNameRef.current[name.toLowerCase()];

            let labelExtraHeight = 30;

            if (activeLayer === 'disease') {
              if (diseaseSubMode === 'simulation' && simState) {
                label.innerHTML = !simState.hasLivestock && simState.cases === 0
                  ? `<div style="font-weight:800;font-size:11px;color:#cbd5e1;">${name}</div><div style="font-size:9px;color:#94a3b8;">Not modeled · 0 livestock</div>`
                  : `<div style="font-weight:800;font-size:11px;color:#fff;">${name}</div><div style="display:inline-flex;align-items:center;gap:4px;margin-top:2px;padding:1px 6px;border-radius:9999px;background:rgba(234,88,12,0.25);border:1px solid #ea580c;color:#fdba74;font-size:9.5px;font-weight:700;">${simState.cases} case${simState.cases === 1 ? '' : 's'} · ${(simState.transmissionPressure * 100).toFixed(0)}% spread</div>`;
                label.style.border = '1px solid rgba(234,88,12,0.7)';
                label.style.boxShadow = '0 4px 12px rgba(234,88,12,0.3)';
              } else {
                if (diseaseSubMode === 'reported') {
                  const count = bData?.disease_cases ?? 0;
                  label.innerHTML = `<div style="font-weight:800;color:white">${name}</div><div style="color:#bae6fd;font-size:10px">${count} approved reports in 90-day window</div>`;
                  label.style.background = 'rgba(15,23,42,0.94)';
                  label.style.border = '1px solid #38bdf8';
                } else {
                const hasApprovedReport = (bData?.active_cases ?? 0) > 0 || (bData?.fmd_active_cases ?? 0) > 0 || bData?.disease_risk === 'high' || bData?.disease_zone === 'outbreak';
                const isOrangeBuffer = !hasApprovedReport && (Boolean(bData?.is_in_monitoring_radius) || bData?.disease_risk === 'medium' || bData?.disease_zone === 'monitoring_radius');

                if (hasApprovedReport) {
                  labelExtraHeight = 90; // Float comfortably above rotating 3D crystal beacon
                  const cases = bData?.active_cases || 1;
                  label.innerHTML = `<div style="font-weight:800;font-size:11px;color:#fff;letter-spacing:0.02em;">${name}</div>` +
                    `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:2px;padding:1px 7px;border-radius:9999px;background:rgba(239,68,68,0.28);border:1px solid #ef4444;color:#fca5a5;font-size:9.5px;font-weight:800;white-space:nowrap;">` +
                    `<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;display:inline-block;"></span>` +
                    `Approved Report · ${cases} ${cases === 1 ? 'Case' : 'Cases'}</div>`;
                  label.style.border = '1.5px solid rgba(239, 68, 68, 0.9)';
                  label.style.boxShadow = '0 4px 18px rgba(239, 68, 68, 0.55)';
                  label.style.background = 'rgba(15, 23, 42, 0.94)';
                } else if (isOrangeBuffer) {
                  labelExtraHeight = 55;
                  const dist = bData?.nearest_outbreak_dist_km != null ? `${bData.nearest_outbreak_dist_km.toFixed(1)} km` : 'Near Outbreak';
                  label.innerHTML = `<div style="font-weight:800;font-size:11px;color:#fff;letter-spacing:0.02em;">${name}</div>` +
                    `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:2px;padding:1px 7px;border-radius:9999px;background:rgba(249,115,22,0.28);border:1px solid #f97316;color:#fdba74;font-size:9.5px;font-weight:800;white-space:nowrap;">` +
                    `<span style="width:6px;height:6px;border-radius:50%;background:#f97316;box-shadow:0 0 6px #f97316;display:inline-block;"></span>` +
                    `Buffer Zone · ${dist}</div>`;
                  label.style.border = '1.5px solid rgba(249, 115, 22, 0.9)';
                  label.style.boxShadow = '0 4px 16px rgba(249, 115, 22, 0.45)';
                  label.style.background = 'rgba(15, 23, 42, 0.94)';
                } else {
                  labelExtraHeight = 35;
                  label.innerHTML = `<div style="font-weight:800;font-size:11px;color:#fff;letter-spacing:0.02em;">${name}</div>` +
                    `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:2px;padding:1px 7px;border-radius:9999px;background:rgba(16,185,129,0.22);border:1px solid #10b981;color:#86efac;font-size:9.5px;font-weight:800;white-space:nowrap;">` +
                    `<span style="width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;display:inline-block;"></span>` +
                    `No Recent Report</div>`;
                  label.style.border = '1.5px solid rgba(16, 185, 129, 0.8)';
                  label.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.3)';
                  label.style.background = 'rgba(15, 23, 42, 0.94)';
                }
                }
              }
            } else {
              if (activeLayer === 'movement' && bData) {
                const records = movementLabelRecordsRef.current;
                const outgoing = records.filter(record => movementEndpointMatches(record, bData, 'origin')).reduce((sum, record) => sum + record.heads, 0);
                const inbound = records.filter(record => movementEndpointMatches(record, bData, 'destination')).reduce((sum, record) => sum + record.heads, 0);
                label.textContent = `${name} ? ${outgoing} outgoing / ${inbound} inbound heads`;
              } else {
                label.textContent = name;
              }
              label.style.border = '1px solid rgba(255,255,255,0.8)';
              label.style.boxShadow = 'none';
              label.style.background = 'rgba(15,23,42,0.92)';
            }

            const anchor = labelAnchors.get(feature);
            if (!anchor) continue;
            const height = displayedHeightsRef.current.get(feature) ?? 50;
            projectedLabelPoint.set(anchor[0], anchor[1], height + labelExtraHeight).project(instance.view.camera);
            const inFrontOfCamera = projectedLabelPoint.z >= -1 && projectedLabelPoint.z <= 1;
            const showName = activeLayer !== 'movement' || Boolean(feature.get('selected')) || Boolean(feature.get('hovered'));
            label.style.display = inFrontOfCamera && showName ? 'block' : 'none';
            label.style.left = `${((projectedLabelPoint.x + 1) / 2) * bounds.width}px`;
            label.style.top = `${((1 - projectedLabelPoint.y) / 2) * bounds.height}px`;
          }

          // Project 3D movement destination label above terminal beacon ONLY when that movement line is selected/clicked
          const activeMovement = selectedMovementRef.current;
          for (const [key, label] of destinationLabelsRef.current) {
            const moveId = Number(label.dataset.movementId);
            const isTarget = activeMovement != null && moveId === activeMovement.id;
            if (!isTarget) {
              label.style.display = 'none';
              continue;
            }
            const anchor = destinationAnchorsRef.current.get(key);
            if (!anchor) {
              label.style.display = 'none';
              continue;
            }
            projectedLabelPoint.set(anchor[0], anchor[1], anchor[2]).project(instance.view.camera);
            const inFrontOfCamera = projectedLabelPoint.z >= -1 && projectedLabelPoint.z <= 1;
            label.style.display = inFrontOfCamera ? 'flex' : 'none';
            label.style.left = `${((projectedLabelPoint.x + 1) / 2) * bounds.width}px`;
            label.style.top = `${((1 - projectedLabelPoint.y) / 2) * bounds.height}px`;
          }
        };
        syncLabelPositionsRef.current();

        // Log once after camera motion settles, instead of printing a new line for every animation frame.
        cameraChangeHandler = () => {
          // Camera controls fire this as the view moves, keeping the screen labels over their 3D positions.
          syncLabelPositionsRef.current?.();
          if (cameraLogTimer) clearTimeout(cameraLogTimer);
          cameraLogTimer = setTimeout(() => {
            if (!instance) return;
            const { x, y, z } = instance.view.camera.position;
            console.log('[GIS 3D camera position]', {
              x: Number(x.toFixed(2)),
              y: Number(y.toFixed(2)),
              z: Number(z.toFixed(2)),
            });
          }, 200);
        };
        controls.addEventListener('change', cameraChangeHandler);
        cameraChangeHandler(); // Also print the starting camera position.

        if (initialSelected) featureByName.get(initialSelected)?.set('selected', true);
        featureCollection.updateStyles();
        refreshBorderColors();

        clickHandler = (event) => {
          // Use the same drag guard as Leaflet so ending a pan over a polygon does not select it.
          if (performance.now() < suppressClickUntilRef.current) return;
          if (!instance) return;

          // Priority 1: Ray-pick 3D movement arcs / beacon markers / rings across the Philippines
          // When a user clicks a movement line, terminal beacon, or landing pad, select the movement permit
          const movementGroup = movementGroupRef.current;
          const three = threeModuleRef.current;
          if (movementGroup && movementGroup.children.length > 0 && three) {
            const bounds = host.getBoundingClientRect();
            const mouse = new three.Vector2(
              ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
              -((event.clientY - bounds.top) / bounds.height) * 2 + 1
            );
            const raycaster = new three.Raycaster();
            raycaster.params.Line = { threshold: 50 };
            raycaster.setFromCamera(mouse, instance.view.camera);
            const intersects = raycaster.intersectObjects(movementGroup.children, true);
            if (intersects.length > 0) {
              let hitObj: import('three').Object3D | null = intersects[0].object;
              let pickedMove: MovementRecord | undefined;
              let pickedBarangay: BarangayGISData | undefined;
              while (hitObj) {
                if (hitObj.userData?.movement) {
                  pickedMove = hitObj.userData.movement as MovementRecord;
                  break;
                }
                if (hitObj.userData?.barangay) {
                  pickedBarangay = hitObj.userData.barangay as BarangayGISData;
                  break;
                }
                hitObj = hitObj.parent;
              }
              if (pickedMove) {
                onSelectMovementRef.current?.(pickedMove);
                syncLabelPositionsRef.current?.();
                flyToDestinationRef.current?.(pickedMove);
                return;
              }
              if (pickedBarangay) {
                onSelectRef.current(pickedBarangay);
                syncLabelPositionsRef.current?.();
                return;
              }
            }
          }

          // Priority 2: Barangay polygons are picked only when no movement route/beacon was hit
          if (featureCollection) {
            const picked = instance.pickObjectsAt(event, { where: [featureCollection] })[0];
            const pickedFeature = picked?.object.userData.feature as Feature<Geometry> | undefined;
            if (pickedFeature) {
              const name = String(pickedFeature.get('name') ?? '');
              const data = barangaysByNameRef.current[name];
              if (!data) return;
              const inScope = data.is_in_scope ?? (
                !userScope || userScope.can_view_all_barangays || userScope.allowed_barangays.includes(name)
              );
              if (!inScope) return;
              for (const feature of featureByName.values()) feature.set('selected', feature === pickedFeature);
              featureCollection.updateStyles();
              refreshBorderColors();
              onSelectMovementRef.current?.(null);
              onSelectRef.current(data);
              syncLabelPositionsRef.current?.();
              return;
            }
          }

          // Clicking outside dismisses movement selection and hides destination labels
          onSelectMovementRef.current?.(null);
          syncLabelPositionsRef.current?.();
        };
        pointerMoveHandler = (event) => {
          if (!instance) return;

          // Check if hovering over 3D movement flight lines/beacons to set pointer cursor
          const movementGroup = movementGroupRef.current;
          const three = threeModuleRef.current;
          let hoveringMovement = false;
          if (movementGroup && movementGroup.children.length > 0 && three) {
            const bounds = host.getBoundingClientRect();
            const mouse = new three.Vector2(
              ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
              -((event.clientY - bounds.top) / bounds.height) * 2 + 1
            );
            const raycaster = new three.Raycaster();
            raycaster.params.Line = { threshold: 30 };
            raycaster.setFromCamera(mouse, instance.view.camera);
            const hits = raycaster.intersectObjects(movementGroup.children, true);
            if (hits.length > 0) {
              hoveringMovement = true;
            }
          }
          host.style.cursor = hoveringMovement ? 'pointer' : 'default';

          if (!featureCollection) return;
          const picked = instance.pickObjectsAt(event, { where: [featureCollection] })[0];
          const pickedFeature = picked?.object.userData.feature as Feature<Geometry> | undefined;
          const name = String(pickedFeature?.get('name') ?? '');
          const hoveredFeature = name ? featureByName.get(name.toLowerCase()) ?? null : null;

          if (hoveredFeatureRef.current !== hoveredFeature) {
            hoveredFeatureRef.current?.set('hovered', false);
            hoveredFeature?.set('hovered', true);
            hoveredFeatureRef.current = hoveredFeature;
            featureCollection.updateStyles();
            refreshBorderColors();
            syncLabelPositionsRef.current?.();
          }

          if (hoveredFeature) {
            const bounds = host.getBoundingClientRect();
            // Store canvas-relative coordinates so the React tooltip follows the pointer over the map.
            setHoverInfo({
              name,
              x: event.clientX - bounds.left,
              y: event.clientY - bounds.top,
            });
          } else {
            setHoverInfo(null);
          }
        };
        pointerLeaveHandler = () => {
          if (hoveredFeatureRef.current) {
            hoveredFeatureRef.current.set('hovered', false);
            hoveredFeatureRef.current = null;
            featureCollection?.updateStyles();
            refreshBorderColors();
          }
          setHoverInfo(null);
          syncLabelPositionsRef.current?.();
        };
        instance.domElement.addEventListener('click', clickHandler);
        instance.domElement.addEventListener('pointermove', pointerMoveHandler);
        instance.domElement.addEventListener('pointerleave', pointerLeaveHandler);
        instance.notifyChange(instance.view.camera);

        instanceRef.current = instance;
        collectionRef.current = featureCollection;
        controlsRef.current = controls;
        setIsSceneReady(true);
        setError(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Giro3D could not initialize.');
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      if (clickHandler && instance) instance.domElement.removeEventListener('click', clickHandler);
      if (pointerMoveHandler && instance) instance.domElement.removeEventListener('pointermove', pointerMoveHandler);
      if (pointerLeaveHandler && instance) instance.domElement.removeEventListener('pointerleave', pointerLeaveHandler);
      if (cameraChangeHandler) controls?.removeEventListener('change', cameraChangeHandler);
      if (cameraLogTimer) clearTimeout(cameraLogTimer);
      if (simulationAnimationFrameRef.current != null) {
        cancelAnimationFrame(simulationAnimationFrameRef.current);
        simulationAnimationFrameRef.current = null;
      }
      if (heightAnimFrameRef.current != null) {
        cancelAnimationFrame(heightAnimFrameRef.current);
        heightAnimFrameRef.current = null;
      }
      if (pulseAnimFrameRef.current != null) {
        cancelAnimationFrame(pulseAnimFrameRef.current);
        pulseAnimFrameRef.current = null;
      }
      animatedPulsesRef.current = [];
      destinationBeaconsRef.current = [];
      destinationPillarsRef.current = [];
      for (const [feature, lines] of borderLines) {
        instance?.threeObjects.remove(lines);
        lines.geometry.dispose();
        (lines.material as import('three').Material).dispose();
        borderLines.delete(feature);
      }
      for (const [feature, label] of labelElements) {
        label.remove();
        labelElements.delete(feature);
      }
      for (const [, label] of destinationLabelsRef.current) {
        label.remove();
      }
      destinationLabelsRef.current.clear();
      destinationAnchorsRef.current.clear();
      labelAnchors.clear();
      syncLabelPositionsRef.current = null;
      refreshBorderColorsRef.current = null;
      if (movementGroupRef.current && instance) {
        instance.threeObjects.remove(movementGroupRef.current);
        while (movementGroupRef.current.children.length > 0) {
          const child = movementGroupRef.current.children[0] as import('three').Mesh;
          movementGroupRef.current.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        }
        movementGroupRef.current = null;
      }
      threeModuleRef.current = null;
      setIsSceneReady(false);
      controls?.dispose();
      instance?.dispose();
      instanceRef.current = null;
      collectionRef.current = null;
      sceneExtentRef.current = null;
      controlsRef.current = null;
      featuresByNameRef.current.clear();
      surfaceMeshes.clear();
      displayedHeights.clear();
      hoveredFeatureRef.current = null;
      setHoverInfo(null);
    };
  }, [
    activeLayer,
    diseaseSubMode,
    simulationColorMode,
    selectedLivestockType,
    suppressClickUntilRef,
    sceneScopeKey,
  ]);

  // A timeline step changes the metric values, not the map itself, so update and animate the existing scene.
  useEffect(() => {
    simulatedStatesRef.current = simulatedStates;
    if (activeLayer !== 'disease' || diseaseSubMode !== 'simulation') return;

    const collection = collectionRef.current;
    const instance = instanceRef.current;
    if (!collection || !instance) return;

    // If playback advances mid-animation, continue from the last height the user actually saw.
    if (simulationAnimationFrameRef.current != null) {
      cancelAnimationFrame(simulationAnimationFrameRef.current);
      simulationAnimationFrameRef.current = null;
    }

    const largestMetric = Math.max(
      0,
      ...Object.values(barangaysByName).map((data) =>
        getMetricValue(data, activeLayer, diseaseSubMode, simulatedStates?.[data.name], selectedLivestockType, simulationColorMode)
      ),
    );
    largestMetricRef.current = largestMetric;

    const startingHeights = new Map(displayedHeightsRef.current);
    const targetHeights = new Map<Feature<Geometry>, number>();
    for (const [lowerName, feature] of featuresByNameRef.current) {
      const name = String(feature.get('name') ?? lowerName);
      const value = getMetricValue(
        barangaysByName[name],
        activeLayer,
        diseaseSubMode,
        simulatedStates?.[name],
        selectedLivestockType, simulationColorMode);
      targetHeights.set(feature, getExtrusionHeight(value, largestMetric, heightScaleRef.current));
    }

    // updateStyles builds each new destination mesh once; the animation below only scales those meshes.
    collection.updateStyles();
    surfaceMeshesRef.current.clear();
    collection.traverse((object) => {
      if (object.type !== 'SurfaceMesh') return;
      const feature = object.userData.feature as Feature<Geometry> | undefined;
      if (!feature) return;
      const surfaces = surfaceMeshesRef.current.get(feature) ?? [];
      surfaces.push(object);
      surfaceMeshesRef.current.set(feature, surfaces);
    });

    // Rebuild borders at their destination height, then scale them in sync with the polygon roofs.
    for (const [feature, lines] of borderLinesRef.current) {
      const geometry = feature.getGeometry();
      const targetHeight = targetHeights.get(feature);
      if (!geometry || targetHeight == null) continue;
      const startingHeight = startingHeights.get(feature) ?? targetHeight;
      const position = lines.geometry.getAttribute('position');
      const borderPositions = getBorderPositions(geometry, targetHeight);
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        position.setXYZ(vertex, borderPositions[vertex * 3], borderPositions[vertex * 3 + 1], borderPositions[vertex * 3 + 2]);
      }
      position.needsUpdate = true;
      lines.geometry.computeBoundingSphere();
      setVerticalScale(lines, startingHeight / targetHeight);
    }

    // Mesh scale multiplies only Z, so the polygon footprint stays fixed while its height eases to the next month.
    for (const [feature, targetHeight] of targetHeights) {
      const startingHeight = startingHeights.get(feature) ?? targetHeight;
      for (const surface of surfaceMeshesRef.current.get(feature) ?? []) {
        setVerticalScale(surface, startingHeight / targetHeight);
      }
    }

    const startTime = performance.now();
    const durationMs = 850;
    const animateHeights = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = progress * progress * (3 - 2 * progress); // Smoothstep eases in and out between timeline months.

      for (const [feature, targetHeight] of targetHeights) {
        const startingHeight = startingHeights.get(feature) ?? targetHeight;
        const currentHeight = startingHeight + (targetHeight - startingHeight) * eased;
        displayedHeightsRef.current.set(feature, currentHeight);

        for (const surface of surfaceMeshesRef.current.get(feature) ?? []) {
          setVerticalScale(surface, currentHeight / targetHeight);
        }
        const lines = borderLinesRef.current.get(feature);
        if (lines) {
          setVerticalScale(lines, currentHeight / targetHeight);
        }
      }

      syncLabelPositionsRef.current?.();
      instance.notifyChange();
      if (progress < 1) {
        simulationAnimationFrameRef.current = requestAnimationFrame(animateHeights);
      } else {
        simulationAnimationFrameRef.current = null;
      }
    };

    simulationAnimationFrameRef.current = requestAnimationFrame(animateHeights);
    return () => {
      if (simulationAnimationFrameRef.current != null) {
        cancelAnimationFrame(simulationAnimationFrameRef.current);
        simulationAnimationFrameRef.current = null;
      }
    };
  }, [activeLayer, barangaysByName, diseaseSubMode, selectedLivestockType, simulatedStates, simulationColorMode]);

  // When the slider changes, update the polygon meshes and their raised border lines in lockstep.
  useEffect(() => {
    const collection = collectionRef.current;
    const instance = instanceRef.current;
    const previousScale = appliedHeightScaleRef.current;
    if (!collection || !instance || previousScale === heightScale) return;

    // Stop active animation before applying new height scale
    if (simulationAnimationFrameRef.current != null) {
      cancelAnimationFrame(simulationAnimationFrameRef.current);
      simulationAnimationFrameRef.current = null;
    }

    heightScaleRef.current = heightScale;
    appliedHeightScaleRef.current = heightScale;

    // Rebuild Giro3D polygon meshes at new extrusion height
    collection.updateStyles();

    // Re-cache active surface meshes created by updateStyles
    surfaceMeshesRef.current.clear();
    collection.traverse((object) => {
      if (object.type !== 'SurfaceMesh') return;
      const feature = object.userData.feature as Feature<Geometry> | undefined;
      if (!feature) return;
      const surfaces = surfaceMeshesRef.current.get(feature) ?? [];
      surfaces.push(object);
      surfaceMeshesRef.current.set(feature, surfaces);
    });

    // Rebuild border lines at the exact matching height
    const isFlat = activeLayer === 'movement' && movementDisplayModeRef.current === 'lines';
    for (const [feature, lines] of borderLinesRef.current) {
      const geometry = feature.getGeometry();
      if (!geometry) continue;
      const name = String(feature.get('name') ?? '');
      const data = barangaysByName[name];
      const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
      const fullHeight = getExtrusionHeight(value, largestMetricRef.current, heightScale);
      fullExtrusionHeightsRef.current.set(feature, Math.max(10, fullHeight));
      const borderPositions = getBorderPositions(geometry, fullHeight);
      const position = lines.geometry.getAttribute('position');
      if (position && position.count * 3 === borderPositions.length) {
        for (let vertex = 0; vertex < position.count; vertex += 1) {
          position.setXYZ(vertex, borderPositions[vertex * 3], borderPositions[vertex * 3 + 1], borderPositions[vertex * 3 + 2]);
        }
        position.needsUpdate = true;
        lines.geometry.computeBoundingSphere();
      }

      const scaleZ = isFlat && fullHeight > 0 ? 2 / fullHeight : 1.0;
      for (const surface of surfaceMeshesRef.current.get(feature) ?? []) {
        setVerticalScale(surface, scaleZ);
      }
      setVerticalScale(lines, scaleZ);
      displayedHeightsRef.current.set(feature, isFlat ? 2 : fullHeight);
    }

    syncLabelPositionsRef.current?.();
    instance.notifyChange();
  }, [heightScale, activeLayer, barangaysByName, diseaseSubMode, selectedLivestockType, simulationColorMode]);

  // Render movement arcs with vertical takeoff/landing at their geographic anchors.
  useEffect(() => {
    if (!isSceneReady) return;
    const instance = instanceRef.current;
    const movementGroup = movementGroupRef.current;
    const three = threeModuleRef.current;
    const host = hostRef.current;
    if (!instance || !movementGroup || !three || !host) return;

    // Stop active pulse animation loop
    if (pulseAnimFrameRef.current != null) {
      cancelAnimationFrame(pulseAnimFrameRef.current);
      pulseAnimFrameRef.current = null;
    }
    animatedPulsesRef.current = [];
    animatedRingsRef.current = [];
    destinationBeaconsRef.current = [];
    destinationPillarsRef.current = [];
    materialsToFadeRef.current = [];
    const mountTime = performance.now() * 0.001;

    // Clear previous 3D movement meshes
    while (movementGroup.children.length > 0) {
      const child = movementGroup.children[0] as import('three').Mesh;
      movementGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }

    // Remove previous destination labels from DOM
    for (const [, label] of destinationLabelsRef.current) {
      label.remove();
    }
    destinationLabelsRef.current.clear();
    destinationAnchorsRef.current.clear();

    const shouldShowMovement = (activeLayer === 'movement' || Boolean(showMovementOverlay)) && (activeLayer !== 'movement' || movementDisplayMode !== 'density') && Boolean(movements && movements.length > 0);
    const shouldShowDisease = activeLayer === 'disease' && diseaseSubMode !== 'simulation';

    if (!shouldShowMovement && !shouldShowDisease) {
      instance.notifyChange();
      return;
    }

    if (shouldShowMovement && movements && movements.length > 0) {

    // Helper to extract top extrusion height of a barangay polygon
    const getBarangayExtrusionHeight = (name: string | null | undefined) => {
      if (!name) return 25;
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [featName, feat] of featuresByNameRef.current) {
        if (normalize(featName) === normalize(name)) {
          return displayedHeightsRef.current.get(feat) ?? 25;
        }
      }
      return 25;
    };

    // Render 3D parabolic arcs, destination beacons, origin anchors, and animated flow pulses
    for (const move of groupMovementRoutes(movements)) {
      if (!move.from || !move.to) continue;
      // Use the local barangay centroid when explicitly identified; retain external coordinates.
      const findCentroid = (name: string | null | undefined) => {
        if (!name) return undefined;
        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
        return Object.values(barangaysByName).find(barangay =>
          [barangay.name, barangay.db_name].some(value => value && normalize(value) === normalize(name))
        )?.position;
      };
      const [fromLat, fromLng] = findCentroid(move.origin_barangay) ?? move.from;
      const [toLat, toLng] = findCentroid(move.destination_barangay) ?? move.to;
      if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng) || !Number.isFinite(toLat) || !Number.isFinite(toLng)) {
        continue;
      }

      const [startX, startY] = latLngToWebMercator(fromLat, fromLng);
      const [endX, endY] = latLngToWebMercator(toLat, toLng);

      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const isSelected = selectedMovement?.id === move.id || Boolean(move.route_records?.some(record => record.id === selectedMovement?.id));
      const isApproved = move.clearance_status === 'APPROVED';

      // Futuristic vibrant darker palettes (deep, richly pigmented cyber tones)
      let coreColor = '#d97706';  // Vibrant rich amber (amber-600)
      let glowColor = '#b45309';  // Deep saturated amber glow (amber-700)
      let accentHex = '#d97706';

      if (isSelected) {
        coreColor = '#f59e0b';    // Brilliant vibrant solar gold (amber-500)
        glowColor = '#b45309';    // Rich deep amber glow
        accentHex = '#f59e0b';
      } else if (isApproved) {
        if (move.direction === 'INBOUND') {
          coreColor = '#0284c7';  // Vibrant deep electric azure / cyan (sky-600)
          glowColor = '#0369a1';  // Rich deep cobalt glow (sky-700)
          accentHex = '#0284c7';
        } else if (move.direction === 'INTERNAL') {
          coreColor = '#059669';  // Vibrant deep emerald green (emerald-600)
          glowColor = '#047857';  // Rich deep jade green glow (emerald-700)
          accentHex = '#059669';
        } else {
          coreColor = '#e11d48';  // Vibrant deep laser crimson ruby (rose-600)
          glowColor = '#be123c';  // Rich deep blood ruby glow (rose-700)
          accentHex = '#e11d48';
        }
      }

      // Smooth flight elevations
      const startZ = Math.max(28, getBarangayExtrusionHeight(move.origin_barangay) + 16);
      const endZ = Math.max(28, getBarangayExtrusionHeight(move.destination_barangay) + 16);

      // Controlled parabolic altitude in 3D WebGL space:
      // Minimum apex height gives every line clear 3D loft above barangay extrusion
      const apexHeight = Math.min(Math.max(dist * 0.12, 420), 1500);

      // Organic, non-linear lateral curvature:
      // Perpendicular normal vector in the horizontal plane (X, Y)
      const nx = -dy / dist;
      const ny = dx / dist;

      // Determine a natural bowing direction and magnitude:
      // - Inbound routes bow to one side (-1), Outbound routes bow to the other (+1),
      //   forming distinct, non-overlapping dual curved lanes between municipalities.
      // - Internal routes alternate naturally based on endpoint string hashes.
      let bowSign = 1;
      if (move.direction === 'INBOUND') {
        bowSign = -1;
      } else if (move.direction === 'INTERNAL') {
        const hash = ((move.origin_barangay?.charCodeAt(0) || 0) * 31 + (move.destination_barangay?.charCodeAt(0) || 0)) % 2;
        bowSign = hash === 0 ? 1 : -1;
      }

      // Lateral deviation distance: scales gracefully with path length (~16% of distance, clamped between 150m and 850m)
      const lateralDeviation = Math.min(Math.max(dist * 0.16, 150), 850) * bowSign;

      // Smooth 3D Cubic Bezier trajectory with graceful lateral sweep & parabolic loft:
      // CP1 rises smoothly from the launch pad (~28% forward) while arching laterally
      const cp1 = new three.Vector3(
        startX + dx * 0.28 + nx * lateralDeviation * 0.88,
        startY + dy * 0.28 + ny * lateralDeviation * 0.88,
        startZ + apexHeight * 1.25
      );
      // CP2 crests past the apex (~72% forward) and curves smoothly down toward the destination landing pad
      const cp2 = new three.Vector3(
        startX + dx * 0.72 + nx * lateralDeviation * 0.88,
        startY + dy * 0.72 + ny * lateralDeviation * 0.88,
        endZ + apexHeight * 1.25
      );
      const curve = new three.CubicBezierCurve3(
        new three.Vector3(startX, startY, startZ),
        cp1,
        cp2,
        new three.Vector3(endX, endY, endZ),
      );

      // Strictly uniform, consistent girth across ALL routes (selected and unselected)
      const coreRadius = 24;
      const glowRadius = 42;

      // 1. Core Luminous Laser Conduit (Smooth 96-segment high-fidelity tube)
      const coreGeom = new three.TubeGeometry(curve, isSelected ? 128 : 96, coreRadius, 12, false);
      const targetCoreOpacity = 1.0;
      const coreMat = new three.MeshBasicMaterial({
        color: coreColor,
        opacity: 0.0,
        transparent: true,
        depthTest: true,
        depthWrite: true,
      });
      materialsToFadeRef.current.push({ material: coreMat, targetOpacity: targetCoreOpacity, mountTime });
      const coreMesh = new three.Mesh(coreGeom, coreMat);
      coreMesh.userData = { movement: move };
      movementGroup.add(coreMesh);

      // 2. Outer Holographic Glow Sheath (Additive cyber bloom halo)
      const glowGeom = new three.TubeGeometry(curve, isSelected ? 128 : 96, glowRadius, 10, false);
      const targetGlowOpacity = isSelected ? 0.55 : 0.38;
      const glowMat = new three.MeshBasicMaterial({
        color: glowColor,
        opacity: 0.0,
        transparent: true,
        blending: three.AdditiveBlending,
        side: three.BackSide,
        depthTest: true,
        depthWrite: false,
      });
      materialsToFadeRef.current.push({ material: glowMat, targetOpacity: targetGlowOpacity, mountTime });
      const glowMesh = new three.Mesh(glowGeom, glowMat);
      glowMesh.userData = { movement: move };
      movementGroup.add(glowMesh);

      // 3. Directional Flow Chevrons (Forward arrows along the conduit: Origin -> Destination)
      const arrowFractions = [0.35, 0.65];
      for (const tFrac of arrowFractions) {
        const arrowPt = curve.getPointAt(tFrac);
        const arrowDir = curve.getTangentAt(tFrac).normalize();
        const arrowGeom = new three.ConeGeometry(coreRadius * 1.7, coreRadius * 3.2, 12);
        arrowGeom.rotateX(Math.PI / 2); // Align cone apex with forward +Z vector
        const targetArrowOpacity = isSelected ? 0.95 : 0.82;
        const arrowMat = new three.MeshBasicMaterial({
          color: isSelected ? '#ffffff' : coreColor,
          transparent: true,
          opacity: 0.0,
          depthTest: true,
          depthWrite: false,
        });
        materialsToFadeRef.current.push({ material: arrowMat, targetOpacity: targetArrowOpacity, mountTime });
        const arrowMesh = new three.Mesh(arrowGeom, arrowMat);
        arrowMesh.position.copy(arrowPt);
        arrowMesh.quaternion.setFromUnitVectors(new three.Vector3(0, 0, 1), arrowDir);
        arrowMesh.userData = { movement: move };
        movementGroup.add(arrowMesh);
      }

      // 3. Futuristic Destination Terminal:
      // a) Vertical Holographic Light Pillar (Cyber Laser Column)
      const beaconHeight = 550;
      const beaconRadius = 120;
      const pillarGeom = new three.CylinderGeometry(beaconRadius * 0.2, beaconRadius * 0.55, beaconHeight, 16, 1, true);
      const pillarMat = new three.MeshBasicMaterial({
        color: glowColor,
        opacity: isSelected ? 0.65 : 0.35,
        transparent: true,
        blending: three.AdditiveBlending,
        side: three.DoubleSide,
        depthTest: true,
        depthWrite: false,
      });
      const pillarMesh = new three.Mesh(pillarGeom, pillarMat);
      pillarMesh.position.set(endX, endY, endZ + beaconHeight / 2);
      pillarMesh.userData = { movement: move };
      movementGroup.add(pillarMesh);
      destinationPillarsRef.current.push(pillarMesh);

      // b) Rotating Holographic Waypoint Crystal (Hovering Diamond)
      const crystalRadius = 60;
      const crystalGeom = new three.OctahedronGeometry(crystalRadius, 0);
      const crystalMat = new three.MeshBasicMaterial({
        color: isSelected ? '#ffffff' : coreColor,
        opacity: isSelected ? 1.0 : 0.85,
        transparent: true,
        depthTest: true,
        depthWrite: true,
      });
      const crystalMesh = new three.Mesh(crystalGeom, crystalMat);
      crystalMesh.position.set(endX, endY, endZ + beaconHeight + crystalRadius);
      crystalMesh.userData = { movement: move };
      movementGroup.add(crystalMesh);
      destinationBeaconsRef.current.push(crystalMesh);

      // c) Destination Ground Landing Reticle
      const destRingGeom = new three.RingGeometry(beaconRadius * 0.3, beaconRadius * 0.6, 24);
      const destRingMat = new three.MeshBasicMaterial({
        color: glowColor,
        side: three.DoubleSide,
        opacity: isSelected ? 0.9 : 0.6,
        transparent: true,
        blending: three.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
      });
      const destRingMesh = new three.Mesh(destRingGeom, destRingMat);
      destRingMesh.position.set(endX, endY, endZ + 2);
      destRingMesh.userData = { movement: move };
      movementGroup.add(destRingMesh);

      // d) Destination Expanding Holographic Radar Ripple
      const destRippleGeom = new three.RingGeometry(beaconRadius * 0.35, beaconRadius * 0.7, 24);
      const destRippleMat = new three.MeshBasicMaterial({
        color: isSelected ? '#facc15' : glowColor,
        side: three.DoubleSide,
        opacity: 0.8,
        transparent: true,
        blending: three.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
      });
      const destRippleMesh = new three.Mesh(destRippleGeom, destRippleMat);
      destRippleMesh.position.set(endX, endY, endZ + 4);
      destRippleMesh.userData = { movement: move };
      movementGroup.add(destRippleMesh);
      animatedRingsRef.current.push({
        mesh: destRippleMesh,
        speed: isSelected ? 0.7 : 0.45,
        phase: 0.5,
        maxScale: 1.8,
      });

      // 4. Futuristic Origin Terminal:
      // a) Ground Telemetry Pad
      const originRadius = 120;
      const originRingGeom = new three.RingGeometry(originRadius * 0.3, originRadius * 0.65, 24);
      const originRingMat = new three.MeshBasicMaterial({
        color: '#10b981',
        side: three.DoubleSide,
        opacity: 0.85,
        transparent: true,
        blending: three.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
      });
      const originRingMesh = new three.Mesh(originRingGeom, originRingMat);
      originRingMesh.position.set(startX, startY, startZ + 2);
      originRingMesh.userData = { movement: move };
      movementGroup.add(originRingMesh);

      // b) Origin Expanding Sonar Ripple
      const originRippleGeom = new three.RingGeometry(originRadius * 0.35, originRadius * 0.75, 24);
      const originRippleMat = new three.MeshBasicMaterial({
        color: isSelected ? '#facc15' : '#38bdf8',
        side: three.DoubleSide,
        opacity: 0.85,
        transparent: true,
        blending: three.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
      });
      const originRippleMesh = new three.Mesh(originRippleGeom, originRippleMat);
      originRippleMesh.position.set(startX, startY, startZ + 4);
      originRippleMesh.userData = { movement: move };
      movementGroup.add(originRippleMesh);
      animatedRingsRef.current.push({
        mesh: originRippleMesh,
        speed: isSelected ? 0.65 : 0.4,
        phase: 0,
        maxScale: 1.9,
      });

      // c) Origin Upward Launch Emitter (Vertical ascension column signaling departure flow)
      const originLaunchHeight = 320;
      const originPillarGeom = new three.CylinderGeometry(
        originRadius * 0.15,
        originRadius * 0.40,
        originLaunchHeight,
        16,
        1,
        true
      );
      const originPillarMat = new three.MeshBasicMaterial({
        color: '#10b981',
        opacity: isSelected ? 0.65 : 0.35,
        transparent: true,
        blending: three.AdditiveBlending,
        side: three.DoubleSide,
        depthTest: true,
        depthWrite: false,
      });
      const originPillarMesh = new three.Mesh(originPillarGeom, originPillarMat);
      originPillarMesh.position.set(startX, startY, startZ + originLaunchHeight / 2);
      originPillarMesh.userData = { movement: move };
      movementGroup.add(originPillarMesh);
      destinationPillarsRef.current.push(originPillarMesh);

      // 5. Streaming Cyber Energy Packets (Surges upward at origin -> follows through to destination)
      const pulseCount = isSelected ? 3 : 2;
      for (let pIdx = 0; pIdx < pulseCount; pIdx++) {
        const offset = pIdx / pulseCount;
        const travelDuration = Math.min(Math.max(Math.sqrt(dist) * 0.018, 2.8), 6.0);
        const speed = (isSelected ? 1.3 : 1.0) / travelDuration;

        // Glowing Photon Core Head (Strictly uniform packet sizing)
        const headRadius = 36;
        const headGeom = new three.SphereGeometry(headRadius, 12, 12);
        const headMat = new three.MeshBasicMaterial({
          color: isSelected ? '#ffffff' : coreColor,
          transparent: true,
          opacity: 0.95,
          depthTest: true,
          depthWrite: false,
        });
        const headMesh = new three.Mesh(headGeom, headMat);
        headMesh.userData = { movement: move };
        movementGroup.add(headMesh);

        // Holographic Photon Aura Halo
        const haloGeom = new three.SphereGeometry(headRadius * 1.6, 12, 12);
        const haloMat = new three.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: isSelected ? 0.7 : 0.45,
          blending: three.AdditiveBlending,
          depthTest: true,
          depthWrite: false,
        });
        const haloMesh = new three.Mesh(haloGeom, haloMat);
        haloMesh.userData = { movement: move };
        movementGroup.add(haloMesh);

        // Trailing Comet Beads
        const trailMeshes: import('three').Mesh[] = [];
        const trailScales = [0.8, 0.6, 0.4, 0.25];
        const trailOpacities = [0.75, 0.55, 0.35, 0.2];

        for (let tIdx = 0; tIdx < trailScales.length; tIdx++) {
          const tGeom = new three.SphereGeometry(headRadius * trailScales[tIdx], 10, 10);
          const tMat = new three.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            blending: three.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            opacity: trailOpacities[tIdx],
          });
          const tMesh = new three.Mesh(tGeom, tMat);
          tMesh.userData = { movement: move };
          movementGroup.add(tMesh);
          trailMeshes.push(tMesh);
        }

        animatedPulsesRef.current.push({
          headMesh,
          haloMesh,
          trailMeshes,
          curve,
          speed,
          offset,
          isSelected,
        });
      }

      // Floating 3D destination label badge (glassmorphism cyber badge)
      const cleanDest = (move.destination || 'Destination').split(',')[0].trim();
      const destKey = `dest-${move.id}-${cleanDest}`;
      const destLabel = document.createElement('div');
      destLabel.dataset.movementId = String(move.id);
      destLabel.setAttribute('aria-label', `Destination: ${cleanDest}`);
      destLabel.className = 'movement-dest-badge';
      Object.assign(destLabel.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        zIndex: '30',
        display: 'none', // Only shown when line is clicked/selected
        transform: 'translate(-50%, -130%)',
        padding: '4px 10px',
        borderRadius: '8px',
        background: 'rgba(10, 15, 29, 0.92)',
        backdropFilter: 'blur(10px)',
        border: `1.5px solid ${accentHex}`,
        color: '#f8fafc',
        font: '600 11px/1.3 system-ui, sans-serif',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        pointerEvents: 'auto',
        boxShadow: `0 0 20px ${accentHex}55, 0 4px 12px rgba(0,0,0,0.6)`,
        letterSpacing: '0.02em',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      });

      destLabel.innerHTML = `
        <span style="color: ${accentHex}; margin-right: 4px; font-size: 11px;">◈</span>
        <span style="font-weight: 700; letter-spacing: 0.02em;">${cleanDest}</span>
        <span style="margin-left: 6px; padding: 1px 6px; border-radius: 4px; background: ${accentHex}25; border: 1px solid ${accentHex}50; font-family: monospace; font-size: 10px; font-weight: 700; color: #ffffff;">${move.route_records ? move.route_records.reduce((total, record) => total + record.heads, 0) : move.heads} heads</span>
      `;

      destLabel.addEventListener('mouseenter', () => {
        destLabel.style.transform = 'translate(-50%, -135%) scale(1.08)';
      });
      destLabel.addEventListener('mouseleave', () => {
        destLabel.style.transform = 'translate(-50%, -130%) scale(1)';
      });
      destLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectMovementRef.current?.(move);
        syncLabelPositionsRef.current?.();
        flyToDestinationRef.current?.(move);
      });

      host.appendChild(destLabel);
      destinationLabelsRef.current.set(destKey, destLabel);
      destinationAnchorsRef.current.set(destKey, [endX, endY, endZ + beaconHeight + crystalRadius * 2 + 35]);
    }
  }

    if (shouldShowDisease) {
      // Build 3D Outbreak Radar Waves, Rotating Crystal Beacons, and Glowing Pillars
      for (const [name, bData] of Object.entries(barangaysByName)) {
        if (!bData) continue;
        const hasApprovedReport = (bData.active_cases ?? 0) > 0 || (bData.fmd_active_cases ?? 0) > 0 || bData.disease_risk === 'high' || bData.disease_zone === 'outbreak';
        const isOrangeBuffer = !hasApprovedReport && (Boolean(bData.is_in_monitoring_radius) || bData.disease_risk === 'medium' || bData.disease_zone === 'monitoring_radius');

        if (!hasApprovedReport && !isOrangeBuffer) continue;

        const lowerName = name.toLowerCase();
        const feat = featuresByNameRef.current.get(lowerName);
        const topHeight = feat ? displayedHeightsRef.current.get(feat) ?? 150 : 150;

        let anchorX: number | undefined;
        let anchorY: number | undefined;
        if (feat) {
          const geom = feat.getGeometry();
          if (geom) {
            const anchor = labelAnchorsRef.current.get(feat) ?? getPolygonLabelAnchor(geom);
            anchorX = anchor[0];
            anchorY = anchor[1];
          }
        }
        if (anchorX == null || anchorY == null) {
          if (bData.position) {
            const [x, y] = latLngToWebMercator(bData.position[0], bData.position[1]);
            anchorX = x;
            anchorY = y;
          } else {
            continue;
          }
        }

        if (hasApprovedReport) {
          // RED: Approved Disease Outbreak Hotspot
          const ringRadius = 380;
          const ringConfigs = [
            { phase: 0.0, speed: 0.42, maxScale: 2.7, baseOpacity: 0.95, color: '#ef4444' },
            { phase: 0.33, speed: 0.42, maxScale: 2.7, baseOpacity: 0.88, color: '#ef4444' },
            { phase: 0.66, speed: 0.42, maxScale: 2.7, baseOpacity: 0.80, color: '#f87171' },
          ];

          for (const cfg of ringConfigs) {
            const ringGeom = new three.RingGeometry(ringRadius * 0.25, ringRadius * 0.55, 32);
            const ringMat = new three.MeshBasicMaterial({
              color: cfg.color,
              side: three.DoubleSide,
              opacity: 0,
              transparent: true,
              blending: three.AdditiveBlending,
              depthTest: true,
              depthWrite: false,
            });
            const ringMesh = new three.Mesh(ringGeom, ringMat);
            ringMesh.position.set(anchorX, anchorY, topHeight + 4);
            ringMesh.userData = { barangay: bData };
            movementGroup.add(ringMesh);
            animatedRingsRef.current.push({
              mesh: ringMesh,
              speed: cfg.speed,
              phase: cfg.phase,
              maxScale: cfg.maxScale,
              baseOpacity: cfg.baseOpacity,
            });
          }

          // Rotating 3D Outbreak Crystal Beacon
          const crystalRadius = 55;
          const crystalGeom = new three.OctahedronGeometry(crystalRadius, 0);
          const crystalMat = new three.MeshBasicMaterial({
            color: '#ef4444',
            wireframe: false,
            transparent: true,
            opacity: 0.95,
            depthTest: true,
            depthWrite: true,
          });
          const crystalMesh = new three.Mesh(crystalGeom, crystalMat);
          crystalMesh.position.set(anchorX, anchorY, topHeight + 55);
          crystalMesh.userData = { barangay: bData };
          movementGroup.add(crystalMesh);
          destinationBeaconsRef.current.push(crystalMesh);

          // Additive Wireframe Crystal Aura
          const wireGeom = new three.OctahedronGeometry(crystalRadius * 1.35, 0);
          const wireMat = new three.MeshBasicMaterial({
            color: '#fca5a5',
            wireframe: true,
            transparent: true,
            opacity: 0.85,
            blending: three.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
          });
          const wireMesh = new three.Mesh(wireGeom, wireMat);
          wireMesh.position.set(anchorX, anchorY, topHeight + 55);
          wireMesh.userData = { barangay: bData };
          movementGroup.add(wireMesh);
          destinationBeaconsRef.current.push(wireMesh);

          // Vertical Light Column Pillar
          const pillarHeight = 110;
          const pillarGeom = new three.CylinderGeometry(18, 45, pillarHeight, 16, 1, true);
          const pillarMat = new three.MeshBasicMaterial({
            color: '#ef4444',
            transparent: true,
            opacity: 0.45,
            blending: three.AdditiveBlending,
            side: three.DoubleSide,
            depthTest: true,
            depthWrite: false,
          });
          const pillarMesh = new three.Mesh(pillarGeom, pillarMat);
          pillarMesh.position.set(anchorX, anchorY, topHeight + pillarHeight / 2);
          pillarMesh.userData = { barangay: bData };
          movementGroup.add(pillarMesh);
          destinationPillarsRef.current.push(pillarMesh);
        } else if (isOrangeBuffer) {
          // ORANGE: Precautionary Buffer Zone (Haversine Algorithm)
          const ringRadius = 260;
          const ringConfigs = [
            { phase: 0.0, speed: 0.35, maxScale: 2.2, baseOpacity: 0.85, color: '#f97316' },
            { phase: 0.5, speed: 0.35, maxScale: 2.2, baseOpacity: 0.75, color: '#fb923c' },
          ];

          for (const cfg of ringConfigs) {
            const ringGeom = new three.RingGeometry(ringRadius * 0.25, ringRadius * 0.55, 32);
            const ringMat = new three.MeshBasicMaterial({
              color: cfg.color,
              side: three.DoubleSide,
              opacity: 0,
              transparent: true,
              blending: three.AdditiveBlending,
              depthTest: true,
              depthWrite: false,
            });
            const ringMesh = new three.Mesh(ringGeom, ringMat);
            ringMesh.position.set(anchorX, anchorY, topHeight + 4);
            ringMesh.userData = { barangay: bData };
            movementGroup.add(ringMesh);
            animatedRingsRef.current.push({
              mesh: ringMesh,
              speed: cfg.speed,
              phase: cfg.phase,
              maxScale: cfg.maxScale,
              baseOpacity: cfg.baseOpacity,
            });
          }

          // Floating Warning Diamond Beacon
          const diamondRadius = 32;
          const diamondGeom = new three.OctahedronGeometry(diamondRadius, 0);
          const diamondMat = new three.MeshBasicMaterial({
            color: '#f97316',
            wireframe: false,
            transparent: true,
            opacity: 0.85,
            depthTest: true,
            depthWrite: false,
          });
          const diamondMesh = new three.Mesh(diamondGeom, diamondMat);
          diamondMesh.position.set(anchorX, anchorY, topHeight + 35);
          diamondMesh.userData = { barangay: bData };
          movementGroup.add(diamondMesh);
          destinationBeaconsRef.current.push(diamondMesh);
        }
      }
    }

    // Start forward pulse transport animation loop
    if (animatedPulsesRef.current.length > 0 || animatedRingsRef.current.length > 0 || destinationBeaconsRef.current.length > 0) {
      const animatePulses = () => {
        const now = performance.now() * 0.001; // seconds

        // Animate packet stream along curves
        for (const pulse of animatedPulsesRef.current) {
          // Progress parameter t advances towards destination (0 to 1)
          const t = (now * pulse.speed + pulse.offset) % 1.0;

          const headPt = pulse.curve.getPointAt(t);
          pulse.headMesh.position.copy(headPt);
          if (pulse.haloMesh) {
            pulse.haloMesh.position.copy(headPt);
          }

          for (let i = 0; i < pulse.trailMeshes.length; i++) {
            const trailT = Math.max(0, t - (0.015 + i * 0.022));
            const trailPt = pulse.curve.getPointAt(trailT);
            pulse.trailMeshes[i].position.copy(trailPt);
          }

          // Fade smoothly at departure from origin polygon and arrival at destination
          const fade = t < 0.06 ? t / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1;
          (pulse.headMesh.material as import('three').MeshBasicMaterial).opacity = (pulse.isSelected ? 1.0 : 0.9) * fade;
          if (pulse.haloMesh) {
            (pulse.haloMesh.material as import('three').MeshBasicMaterial).opacity = (pulse.isSelected ? 0.75 : 0.45) * fade;
          }
          pulse.trailMeshes.forEach((tm, i) => {
            (tm.material as import('three').MeshBasicMaterial).opacity = (0.75 - i * 0.16) * fade;
          });
        }

        // Animate destination waypoint crystals (rotation + subtle breathing)
        const beaconPulse = 1 + 0.12 * Math.sin(now * 3.5);
        for (const beacon of destinationBeaconsRef.current) {
          beacon.rotation.y += 0.025;
          beacon.rotation.z += 0.012;
          beacon.scale.set(beaconPulse, beaconPulse, beaconPulse);
        }

        // Animate vertical light columns (pulsing laser beam intensity)
        const pillarBreath = 0.35 + 0.12 * Math.sin(now * 3.0);
        for (const pillar of destinationPillarsRef.current) {
          (pillar.material as import('three').MeshBasicMaterial).opacity = pillarBreath;
        }

        // Pulse and expand ripple rings at origin polygon, destination landing, and disease outbreak zones
        for (const ring of animatedRingsRef.current) {
          const cycle = (now * ring.speed + ring.phase) % 1.0;
          const scale = 1 + cycle * (ring.maxScale - 1);
          ring.mesh.scale.set(scale, scale, 1);
          // Seamless cyclic wave: sine window starts at 0, peaks smoothly at cycle 0.5, and fades to 0 before wrapping
          // Guarantees zero popping when cycle wraps from 1.0 back to 0.0
          const envelope = Math.sin(cycle * Math.PI);
          const baseOpacity = ring.baseOpacity ?? 0.85;
          (ring.mesh.material as import('three').MeshBasicMaterial).opacity = baseOpacity * envelope;
        }

        // Smoothly fade in newly materialized laser lines & chevrons during timeline cycles (seamless transition)
        for (let i = materialsToFadeRef.current.length - 1; i >= 0; i--) {
          const item = materialsToFadeRef.current[i];
          const progress = Math.min(1.0, (now - item.mountTime) / 0.32);
          item.material.opacity = item.targetOpacity * progress;
          if (progress >= 1.0) {
            if (item.targetOpacity >= 0.99) {
              item.material.transparent = false;
            }
            materialsToFadeRef.current.splice(i, 1);
          }
        }

        // Continuously notify Giro3D to render the animated frame at 60fps
        instance.notifyChange();
        pulseAnimFrameRef.current = requestAnimationFrame(animatePulses);
      };

      pulseAnimFrameRef.current = requestAnimationFrame(animatePulses);
    }

    syncLabelPositionsRef.current?.();
    instance.notifyChange();

    return () => {
      if (pulseAnimFrameRef.current != null) {
        cancelAnimationFrame(pulseAnimFrameRef.current);
        pulseAnimFrameRef.current = null;
      }
      animatedPulsesRef.current = [];
      animatedRingsRef.current = [];
      destinationBeaconsRef.current = [];
      destinationPillarsRef.current = [];
      materialsToFadeRef.current = [];
    };
  }, [isSceneReady, activeLayer, diseaseSubMode, showMovementOverlay, movements, selectedMovement, movementDisplayMode, barangaysByName, heightScale]);

  // Animate the polygon column extrusion heights in response to movementDisplayMode,
  // timeline scrubber date changes, and timeline activation
  useEffect(() => {
    if (!isSceneReady) return;
    const collection = collectionRef.current;
    const instance = instanceRef.current;
    if (!collection || !instance) return;

    if (heightAnimFrameRef.current != null) {
      cancelAnimationFrame(heightAnimFrameRef.current);
      heightAnimFrameRef.current = null;
    }

    // Simulation has its own geometry animation; never run two height writers.
    if (activeLayer === 'disease' && diseaseSubMode === 'simulation') return;

    // Rebase geometry and borders to this snapshot before applying height ratios.
    // Cached heights from an earlier date are not the dimensions of rebuilt meshes.
    largestMetricRef.current = Math.max(1, ...Object.values(barangaysByName).map(data =>
      getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[data.name], selectedLivestockType, simulationColorMode)
    ));
    collection.traverse(object => {
      if (object.type === 'SurfaceMesh') setVerticalScale(object, 1);
    });
    collection.updateStyles();
    for (const [feature, lines] of borderLinesRef.current) {
      const name = String(feature.get('name') ?? '');
      const value = getMetricValue(barangaysByName[name], activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
      const height = getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current);
      fullExtrusionHeightsRef.current.set(feature, height);
      const geometry = feature.getGeometry();
      if (!geometry) continue;
      const positions = getBorderPositions(geometry, height);
      const attribute = lines.geometry.getAttribute('position');
      if (attribute && attribute.count * 3 === positions.length) {
        for (let vertex = 0; vertex < attribute.count; vertex++) {
          attribute.setXYZ(vertex, positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
        }
        attribute.needsUpdate = true;
        lines.geometry.computeBoundingSphere();
      }
      setVerticalScale(lines, 1);
    }

    movementDisplayModeRef.current = movementDisplayMode;

    const isMovementLayer = activeLayer === 'movement';
    const isFlat = isMovementLayer && movementDisplayMode === 'lines';
    const durationMs = activeLayer === 'cattle' || activeLayer === 'mortality' ? 700 : 450;
    const startTime = performance.now();

    // Query live SurfaceMesh objects directly from collection hierarchy
    const getSurfacesByName = () => {
      const map = new Map<string, Object3D[]>();
      collection.traverse((object) => {
        if (object.type !== 'SurfaceMesh') return;
        const feat = object.userData.feature as Feature<Geometry> | undefined;
        const bName = String(feat?.get('name') ?? '').toLowerCase();
        if (bName) {
          const arr = map.get(bName) ?? [];
          arr.push(object);
          map.set(bName, arr);
        }
      });
      return map;
    };
    let surfacesByName = getSurfacesByName();

    // Aggregate active movement inspection records per origin barangay from active timeline movements
    const activeRecordsByBarangay = new Map<string, number>();
    if (isMovementLayer && isTimelineActive && movements && movements.length > 0) {
      const sortedKeys = Array.from(featuresByNameRef.current.keys()).sort((a, b) => b.length - a.length);
      for (const move of movements) {
        const originKey = getMovementOriginKey(move, sortedKeys, barangaysByNameRef.current);
        if (originKey) {
          activeRecordsByBarangay.set(originKey, (activeRecordsByBarangay.get(originKey) ?? 0) + 1);
        }
      }
    }

    const maxMovementMetric = Math.max(
      largestMetricRef.current,
      ...Array.from(activeRecordsByBarangay.values()),
      1,
    );

    const targets = new Map<Feature<Geometry>, { name: string; startH: number; targetH: number; fullH: number }>();
    for (const [lowerName, feature] of featuresByNameRef.current) {
      const name = String(feature.get('name') ?? lowerName);
      const data = barangaysByName[name] || barangaysByName[lowerName];
      const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
      const baseFullH = fullExtrusionHeightsRef.current.get(feature) ?? Math.max(10, getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current));
      const currentH = displayedHeightsRef.current.get(feature) ?? (isFlat ? 2 : baseFullH);

      let targetH = isFlat ? 2 : Math.max(10, getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current));
      if (isMovementLayer) {
        if (isFlat) {
          targetH = 2;
        } else if (isTimelineActive) {
          const recCount = activeRecordsByBarangay.get(lowerName) ?? 0;
          targetH = recCount > 0
            ? getExtrusionHeight(recCount, maxMovementMetric, heightScaleRef.current)
            : 2;
        } else {
          // Timeline not active -> use municipal baseline inspections_count / movement records
          const recCount = (data?.inspections_count ?? 0) > 0
            ? data!.inspections_count
            : ((data?.movement_out ?? 0) > 0 ? 1 : 0);
          targetH = recCount > 0
            ? getExtrusionHeight(recCount, largestMetricRef.current, heightScaleRef.current)
            : 2;
        }
      }

      targets.set(feature, {
        name: lowerName,
        startH: currentH,
        targetH,
        fullH: baseFullH,
      });
    }

    const animateTransition = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3); // Smooth cubic ease-out

      if (surfacesByName.size === 0) {
        surfacesByName = getSurfacesByName();
      }

      for (const [feature, { name, startH, targetH, fullH }] of targets) {
        const currentH = startH + (targetH - startH) * ease;
        displayedHeightsRef.current.set(feature, currentH);

        const scaleZ = fullH > 0 ? Math.max(0.001, currentH / fullH) : 0.001;

        // Scale live SurfaceMesh geometry
        for (const surface of surfacesByName.get(name) ?? surfaceMeshesRef.current.get(feature) ?? []) {
          setVerticalScale(surface, scaleZ);
        }
        // Scale wireframe borders
        const lines = borderLinesByNameRef.current.get(name) || borderLinesRef.current.get(feature);
        if (lines) {
          setVerticalScale(lines, scaleZ);
        }

        // Keep 3D crystal beacons, laser columns, and ripple rings riding seamlessly atop the extruding column
        if (activeLayer === 'disease') {
          for (const beacon of destinationBeaconsRef.current) {
            if (((beacon.userData?.barangay?.name || '') as string).toLowerCase() === name) {
              beacon.position.z = currentH + 55;
            }
          }
          for (const pillar of destinationPillarsRef.current) {
            if (((pillar.userData?.barangay?.name || '') as string).toLowerCase() === name) {
              pillar.position.z = currentH + 55;
            }
          }
          for (const ring of animatedRingsRef.current) {
            if (((ring.mesh.userData?.barangay?.name || '') as string).toLowerCase() === name) {
              ring.mesh.position.z = currentH + 4;
            }
          }
        }
      }

      syncLabelPositionsRef.current?.();
      instance.notifyChange(instance.view.camera);

      if (progress < 1) {
        heightAnimFrameRef.current = requestAnimationFrame(animateTransition);
      } else {
        heightAnimFrameRef.current = null;
      }
    };

    heightAnimFrameRef.current = requestAnimationFrame(animateTransition);
    return () => {
      if (heightAnimFrameRef.current != null) {
        cancelAnimationFrame(heightAnimFrameRef.current);
        heightAnimFrameRef.current = null;
      }
    };
  }, [
    movementDisplayMode,
    isSceneReady,
    activeLayer,
    isTimelineActive,
    movements,
    barangaysByName,
    diseaseSubMode,
    selectedLivestockType,
    simulationColorMode,
  ]);

  const previousResetTrigger = useRef(resetTrigger);
  useEffect(() => {
    const instance = instanceRef.current;
    const controls = controlsRef.current;
    const featureCollection = collectionRef.current;
    if (!instance || !controls || !featureCollection) return;

    // A changed reset trigger fits the municipality; otherwise selection focuses the clicked polygon.
    const resetRequested = previousResetTrigger.current !== resetTrigger;
    previousResetTrigger.current = resetTrigger;
    const selectedName = selectedBarangay?.name.toLowerCase();
    for (const [name, feature] of featuresByNameRef.current) {
      feature.set('selected', !resetRequested && name === selectedName);
    }
    featureCollection.updateStyles();

    const selectedGeometry = selectedName ? featuresByNameRef.current.get(selectedName)?.getGeometry() : undefined;
    const sceneExtent = sceneExtentRef.current;
    if (!sceneExtent) return;
    const targetExtent = !resetRequested && selectedGeometry
      ? selectedGeometry.getExtent()
      : [sceneExtent.minX, sceneExtent.minY, sceneExtent.maxX, sceneExtent.maxY];
    const [minX, minY, maxX, maxY] = targetExtent;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const startTargetX = controls.target.x;
    const startTargetY = controls.target.y;
    const startTargetZ = controls.target.z;

    const startCamX = instance.view.camera.position.x;
    const startCamY = instance.view.camera.position.y;
    const startCamZ = instance.view.camera.position.z;

    const targetTargetX = centerX;
    const targetTargetY = centerY;
    const targetTargetZ = 0;

    let targetCamX = DEFAULT_3D_CAMERA_POSITION.x;
    let targetCamY = DEFAULT_3D_CAMERA_POSITION.y;
    let targetCamZ = DEFAULT_3D_CAMERA_POSITION.z;

    if (!resetRequested) {
      // Selecting a barangay frames that polygon with wider regional context and comfortable breathing room
      const distance = Math.max(maxX - minX, maxY - minY) * 2.8;
      targetCamX = centerX - distance * 0.45;
      targetCamY = centerY - distance * 0.55;
      targetCamZ = distance * 1.75;
    }

    if (cameraAnimRef.current) {
      cancelAnimationFrame(cameraAnimRef.current);
    }

    const startTime = performance.now();
    const duration = 750; // ms

    const animateCamera = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      controls.target.set(
        startTargetX + (targetTargetX - startTargetX) * ease,
        startTargetY + (targetTargetY - startTargetY) * ease,
        startTargetZ + (targetTargetZ - startTargetZ) * ease,
      );

      instance.view.camera.position.set(
        startCamX + (targetCamX - startCamX) * ease,
        startCamY + (targetCamY - startCamY) * ease,
        startCamZ + (targetCamZ - startCamZ) * ease,
      );

      controls.update();
      syncLabelPositionsRef.current?.();
      instance.notifyChange(instance.view.camera);

      if (progress < 1) {
        cameraAnimRef.current = requestAnimationFrame(animateCamera);
      } else {
        cameraAnimRef.current = null;
      }
    };

    cameraAnimRef.current = requestAnimationFrame(animateCamera);
  }, [resetTrigger, selectedBarangay]);

  useEffect(() => {
    return () => {
      if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-label="3D barangay data map">
      <div ref={hostRef} className="absolute inset-0 overflow-hidden" />
      <div className="pointer-events-none absolute bottom-1 right-2 z-10 rounded bg-slate-950/70 px-1.5 py-0.5 text-[9px] text-white/80">
        © OpenStreetMap contributors
      </div>
      {hoverInfo && (() => {
        const data = barangaysByName[hoverInfo.name] || barangaysByName[hoverInfo.name.toLowerCase()];
        const recCount = data ? ((data.inspections_count ?? 0) > 0 ? data.inspections_count : (data.movement_out > 0 ? 1 : 0)) : 0;
        return (
          <div
            className="pointer-events-none absolute z-20 rounded-md border border-white/20 bg-slate-950/95 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg space-y-0.5"
            style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
          >
            <div className="font-bold">Brgy. {hoverInfo.name}</div>
            {activeLayer === 'movement' && data && (
              <div className="text-[10.5px] text-indigo-300">
                {recCount > 0
                  ? `${recCount} inspection record${recCount === 1 ? '' : 's'} (${data.movement_out} heads)`
                  : 'No inspection records'}
              </div>
            )}
          </div>
        );
      })()}
      {error && (
        <div role="alert" className="absolute inset-x-4 top-4 z-10 rounded-lg bg-red-950/90 p-3 text-sm text-white">
          3D map could not load: {error}
        </div>
      )}
    </div>
  );
}
