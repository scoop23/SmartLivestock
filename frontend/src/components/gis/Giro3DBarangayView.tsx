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
  selectedMovement?: MovementRecord | null;
  onSelectMovement?: (movement: MovementRecord | null) => void;
  showMovementOverlay?: boolean;
  movementDisplayMode?: Movement3DDisplayMode;
  isTimelineActive?: boolean;
}

interface AnimatedPulse {
  headMesh: import('three').Mesh;
  trailMeshes: import('three').Mesh[];
  curve: import('three').CatmullRomCurve3;
  speed: number;
  offset: number;
  isSelected?: boolean;
}

interface AnimatedRing {
  mesh: import('three').Mesh;
  speed: number;
  phase: number;
  maxScale: number;
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
      return diseaseSubMode === 'simulation' && simulation
        ? simulationColorMode === 'pressure' ? simulation.transmissionPressure : simulation.cases
        : data.active_cases;
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
      return data.movement_out;
  }
}

// Each map layer has its own four-step palette; ratio is the feature's value relative to the layer maximum.
function getLayerColor(
  layer: MapLayer,
  ratio: number,
  diseaseSubMode: DiseaseSubMode,
  simulationColorMode: SimulationColorMode,
  simulation: SimulatedBarangayState | undefined,
): string {
  if (layer === 'disease' && diseaseSubMode === 'simulation') {
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

  const palettes: Record<MapLayer, [string, string, string, string]> = {
    cattle: ['#eaf3e4', '#c5e0a8', '#5a8f4f', '#1a3d15'],
    disease: ['#dcfce7', '#fde68a', '#fb923c', '#991b1b'],
    milk: ['#e0f2fe', '#7dd3fc', '#0284c7', '#0c4a6e'],
    farmer_meat: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    slaughter_yield: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    meat: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    mortality: ['#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'],
    movement: ['#e0f2fe', '#38bdf8', '#0284c7', '#0c4a6e'],
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
    ? Math.log1p(value) / Math.log1p(largestMetric)
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
  selectedMovement,
  onSelectMovement,
  showMovementOverlay = false,
  movementDisplayMode = 'both',
  isTimelineActive = false,
}: Giro3DBarangayViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const collectionRef = useRef<FeatureCollection | null>(null);
  const sceneExtentRef = useRef<Extent | null>(null);
  const controlsRef = useRef<MapControls | null>(null);
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
  }, [barangaysByName]);
  const heightScaleRef = useRef(heightScale);
  const appliedHeightScaleRef = useRef(heightScale);
  const borderLinesRef = useRef(new Map<Feature<Geometry>, import('three').LineSegments>());
  const borderLinesByNameRef = useRef(new Map<string, import('three').LineSegments>());
  const labelElementsRef = useRef(new Map<Feature<Geometry>, HTMLDivElement>());
  const labelAnchorsRef = useRef(new Map<Feature<Geometry>, [number, number]>());
  const syncLabelPositionsRef = useRef<(() => void) | null>(null);
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
          source: new tiledImageSourceModule.default({ source: new osmModule.OSM() }),
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
                ) : '#475569',
                opacity: hovered ? 1 : inScope ? 0.94 : 0.48,
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
            material.color.set(feature.get('selected') ? '#ffffff' : feature.get('hovered') ? '#fff200' : '#000000');
          }
          instance?.notifyChange();
        };

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
        controls.update();
        controls.saveState();
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
            label.textContent = activeLayer === 'disease' && diseaseSubMode === 'simulation' && simState
              ? `${name}\n${simState.cases} case${simState.cases === 1 ? '' : 's'} | ${(simState.transmissionPressure * 100).toFixed(0)}% pressure`
              : name;
            const anchor = labelAnchors.get(feature);
            if (!anchor) continue;
            const height = displayedHeightsRef.current.get(feature) ?? 50;
            projectedLabelPoint.set(anchor[0], anchor[1], height + 30).project(instance.view.camera);
            const inFrontOfCamera = projectedLabelPoint.z >= -1 && projectedLabelPoint.z <= 1;
            label.style.display = inFrontOfCamera ? 'block' : 'none';
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

          // Ray-pick 3D movement arcs / beacon markers / rings across the Philippines
          const movementGroup = movementGroupRef.current;
          const three = threeModuleRef.current;
          if (movementGroup && movementGroup.children.length > 0 && three) {
            const bounds = host.getBoundingClientRect();
            const mouse = new three.Vector2(
              ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
              -((event.clientY - bounds.top) / bounds.height) * 2 + 1
            );
            const raycaster = new three.Raycaster();
            raycaster.params.Line = { threshold: 40 };
            raycaster.setFromCamera(mouse, instance.view.camera);
            const intersects = raycaster.intersectObjects(movementGroup.children, true);
            if (intersects.length > 0) {
              let hitObj: import('three').Object3D | null = intersects[0].object;
              let pickedMove: MovementRecord | undefined;
              while (hitObj) {
                if (hitObj.userData?.movement) {
                  pickedMove = hitObj.userData.movement as MovementRecord;
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
            }
          }

          // Clicking outside dismisses movement selection and hides destination labels
          onSelectMovementRef.current?.(null);
          syncLabelPositionsRef.current?.();

          if (!featureCollection) return;
          // Giro3D ray-picks the feature under the pointer; React receives the selected barangay data.
          const picked = instance.pickObjectsAt(event, { where: [featureCollection] })[0];
          const pickedFeature = picked?.object.userData.feature as Feature<Geometry> | undefined;
          if (!pickedFeature) return;

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
          onSelectRef.current(data);
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
    userScope,
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

  // Render dynamic 3D parabolic movement arcs across the Philippine archipelago with forward animation
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
    destinationBeaconsRef.current = [];

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

    const shouldShow = (activeLayer === 'movement' || Boolean(showMovementOverlay)) && (activeLayer !== 'movement' || movementDisplayMode !== 'density');
    if (!shouldShow || !movements || movements.length === 0) {
      instance.notifyChange();
      return;
    }

    // Render 3D parabolic arcs, destination beacons, origin anchors, and animated flow pulses
    for (const move of movements) {
      if (!move.from || !move.to) continue;
      const [fromLat, fromLng] = move.from;
      const [toLat, toLng] = move.to;
      if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng) || !Number.isFinite(toLat) || !Number.isFinite(toLng)) {
        continue;
      }

      const [startX, startY] = latLngToWebMercator(fromLat, fromLng);
      const [endX, endY] = latLngToWebMercator(toLat, toLng);

      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const isSelected = selectedMovement?.id === move.id;
      const isApproved = move.clearance_status === 'APPROVED';

      // Directional & status color coding matching 2D transport flow styling
      let hexColor = '#f59e0b'; // Amber for pending/other
      if (isSelected) {
        hexColor = '#facc15'; // Bright Gold for selected
      } else if (isApproved) {
        if (move.direction === 'INBOUND') hexColor = '#38bdf8'; // Electric Sky Blue
        else if (move.direction === 'INTERNAL') hexColor = '#10b981'; // Emerald Green
        else hexColor = '#f43f5e'; // Vibrant Rose / Red for outbound
      }

      // Parabolic apex altitude in 3D WebGL space: higher arc for long-range transport across the Philippines
      const apexHeight = Math.min(Math.max(dist * 0.16, 2200), 85000);

      // Construct smooth parabolic curve points
      const sampleCount = 32;
      const curvePoints: import('three').Vector3[] = [];
      for (let i = 0; i <= sampleCount; i++) {
        const t = i / sampleCount;
        const px = startX + dx * t;
        const py = startY + dy * t;
        const pz = 4 * apexHeight * t * (1 - t) + 25;
        curvePoints.push(new three.Vector3(px, py, pz));
      }

      const curve = new three.CatmullRomCurve3(curvePoints);
      const tubeRadius = isSelected
        ? Math.min(Math.max(dist * 0.004, 50), 2200)
        : Math.min(Math.max(dist * 0.0022, 28), 1200);

      // Base atmospheric flight corridor tube
      const tubeGeom = new three.TubeGeometry(curve, 32, tubeRadius, 6, false);
      const tubeMat = new three.MeshBasicMaterial({
        color: hexColor,
        opacity: isSelected ? 0.95 : 0.45,
        transparent: true,
      });

      const tubeMesh = new three.Mesh(tubeGeom, tubeMat);
      tubeMesh.userData = { movement: move };
      movementGroup.add(tubeMesh);

      // Destination terminal beacon (cone pointing down toward target municipality/barangay)
      const beaconHeight = Math.min(Math.max(dist * 0.04, 300), 9000);
      const beaconRadius = beaconHeight * 0.35;
      const coneGeom = new three.ConeGeometry(beaconRadius, beaconHeight, 8);
      coneGeom.rotateX(Math.PI); // Point downward to ground
      const coneMat = new three.MeshBasicMaterial({
        color: hexColor,
        opacity: isSelected ? 1 : 0.85,
        transparent: true,
      });
      const coneMesh = new three.Mesh(coneGeom, coneMat);
      coneMesh.position.set(endX, endY, beaconHeight / 2 + 10);
      coneMesh.userData = { movement: move };
      movementGroup.add(coneMesh);
      destinationBeaconsRef.current.push(coneMesh);

      // Ground anchor ring at origin
      const ringRadius = beaconRadius * 0.9;
      const ringGeom = new three.RingGeometry(ringRadius * 0.6, ringRadius, 16);
      const ringMat = new three.MeshBasicMaterial({
        color: '#10b981',
        side: three.DoubleSide,
        opacity: 0.8,
        transparent: true,
      });
      const ringMesh = new three.Mesh(ringGeom, ringMat);
      ringMesh.position.set(startX, startY, 15);
      ringMesh.userData = { movement: move };
      movementGroup.add(ringMesh);

      // Origin polygon launch ripple ring
      const originRippleGeom = new three.RingGeometry(ringRadius * 0.65, ringRadius * 1.05, 24);
      const originRippleMat = new three.MeshBasicMaterial({
        color: isSelected ? '#facc15' : '#38bdf8',
        side: three.DoubleSide,
        opacity: 0.85,
        transparent: true,
      });
      const originRippleMesh = new three.Mesh(originRippleGeom, originRippleMat);
      originRippleMesh.position.set(startX, startY, 18);
      movementGroup.add(originRippleMesh);
      animatedRingsRef.current.push({
        mesh: originRippleMesh,
        speed: isSelected ? 1.8 : 1.2,
        phase: 0,
        maxScale: 2.4,
      });

      // Destination arrival landing ripple ring
      const destRippleGeom = new three.RingGeometry(beaconRadius * 0.45, beaconRadius * 0.85, 24);
      const destRippleMat = new three.MeshBasicMaterial({
        color: hexColor,
        side: three.DoubleSide,
        opacity: 0.85,
        transparent: true,
      });
      const destRippleMesh = new three.Mesh(destRippleGeom, destRippleMat);
      destRippleMesh.position.set(endX, endY, 18);
      movementGroup.add(destRippleMesh);
      animatedRingsRef.current.push({
        mesh: destRippleMesh,
        speed: isSelected ? 2.0 : 1.4,
        phase: 0.5,
        maxScale: 2.6,
      });

      // Animated streaming transport pulses flying along the curve toward the destination
      const pulseCount = isSelected ? 3 : 2;
      for (let pIdx = 0; pIdx < pulseCount; pIdx++) {
        const offset = pIdx / pulseCount;
        // Travel duration scaled so short trips are quick and long cross-archipelago flights remain visible
        const travelDuration = Math.min(Math.max(Math.sqrt(dist) * 0.01, 2.0), 4.8);
        const speed = (isSelected ? 1.35 : 1.0) / travelDuration;

        // Leading glowing pulse head
        const headRadius = isSelected ? tubeRadius * 3.2 : tubeRadius * 2.4;
        const headGeom = new three.SphereGeometry(headRadius, 12, 12);
        const headMat = new three.MeshBasicMaterial({
          color: isSelected ? '#ffffff' : (move.direction === 'INBOUND' ? '#bae6fd' : '#ffffff'),
          transparent: true,
          opacity: 0.95,
        });
        const headMesh = new three.Mesh(headGeom, headMat);
        headMesh.userData = { movement: move };
        movementGroup.add(headMesh);

        // Multiple trailing comet segments
        const trailMeshes: import('three').Mesh[] = [];
        const trailScales = [0.8, 0.55, 0.35];
        const trailOpacities = [0.8, 0.55, 0.3];

        for (let tIdx = 0; tIdx < 3; tIdx++) {
          const tGeom = new three.SphereGeometry(headRadius * trailScales[tIdx], 10, 10);
          const tMat = new three.MeshBasicMaterial({
            color: hexColor,
            transparent: true,
            opacity: trailOpacities[tIdx],
          });
          const tMesh = new three.Mesh(tGeom, tMat);
          tMesh.userData = { movement: move };
          movementGroup.add(tMesh);
          trailMeshes.push(tMesh);
        }

        animatedPulsesRef.current.push({
          headMesh,
          trailMeshes,
          curve,
          speed,
          offset,
          isSelected,
        });
      }

      // Floating 3D destination label badge (hidden until this line is clicked/selected)
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
        padding: '3px 8px',
        borderRadius: '9999px',
        background: 'rgba(15, 23, 42, 0.98)',
        border: '2px solid #facc15',
        color: '#fef08a',
        font: '700 11px/1.2 system-ui, sans-serif',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        pointerEvents: 'auto',
        boxShadow: '0 0 16px rgba(250, 204, 21, 0.65)',
        transition: 'transform 0.15s ease',
      });

      destLabel.innerHTML = `
        <span style="color: #facc15; margin-right: 3px;">📍</span>
        <span>${cleanDest}</span>
        <span style="margin-left: 4px; padding: 1px 4px; border-radius: 4px; background: rgba(250, 204, 21, 0.25); font-family: monospace; font-size: 10px; color: #fef08a;">${move.heads}</span>
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
      destinationAnchorsRef.current.set(destKey, [endX, endY, beaconHeight + 40]);
    }

    // Start forward pulse transport animation loop
    if (animatedPulsesRef.current.length > 0 || animatedRingsRef.current.length > 0) {
      const animatePulses = () => {
        const now = performance.now() * 0.001; // seconds
        for (const pulse of animatedPulsesRef.current) {
          // Progress parameter t advances towards destination (0 to 1)
          const t = (now * pulse.speed + pulse.offset) % 1.0;

          const headPt = pulse.curve.getPointAt(t);
          pulse.headMesh.position.copy(headPt);

          for (let i = 0; i < pulse.trailMeshes.length; i++) {
            const trailT = Math.max(0, t - (0.02 + i * 0.025));
            const trailPt = pulse.curve.getPointAt(trailT);
            pulse.trailMeshes[i].position.copy(trailPt);
          }

          // Fade smoothly at departure from origin polygon and arrival at destination
          const fade = t < 0.06 ? t / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1;
          (pulse.headMesh.material as import('three').MeshBasicMaterial).opacity = (pulse.isSelected ? 1.0 : 0.92) * fade;
          pulse.trailMeshes.forEach((tm, i) => {
            (tm.material as import('three').MeshBasicMaterial).opacity = (0.75 - i * 0.2) * fade;
          });
        }

        // Pulse the destination terminal beacons gently
        const beaconPulse = 1 + 0.14 * Math.sin(now * 3.8);
        for (const beacon of destinationBeaconsRef.current) {
          beacon.scale.set(beaconPulse, beaconPulse, beaconPulse);
        }

        // Pulse and expand ripple rings at origin polygon and destination landing
        for (const ring of animatedRingsRef.current) {
          const cycle = (now * ring.speed + ring.phase) % 1.0;
          const scale = 1 + cycle * (ring.maxScale - 1);
          ring.mesh.scale.set(scale, scale, 1);
          (ring.mesh.material as import('three').MeshBasicMaterial).opacity = 0.85 * (1 - cycle);
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
    };
  }, [isSceneReady, activeLayer, showMovementOverlay, movements, selectedMovement, movementDisplayMode]);

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

    movementDisplayModeRef.current = movementDisplayMode;

    const isMovementLayer = activeLayer === 'movement';
    const isFlat = isMovementLayer && movementDisplayMode === 'lines';
    const durationMs = 450;
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

    // Aggregate active movement volume (heads) per origin barangay from active timeline movements
    const activeHeadsByBarangay = new Map<string, number>();
    if (isMovementLayer && isTimelineActive && movements && movements.length > 0) {
      const sortedKeys = Array.from(featuresByNameRef.current.keys()).sort((a, b) => b.length - a.length);
      for (const move of movements) {
        const originKey = getMovementOriginKey(move, sortedKeys, barangaysByNameRef.current);
        if (originKey) {
          const heads = Math.max(1, move.heads || 1);
          activeHeadsByBarangay.set(originKey, (activeHeadsByBarangay.get(originKey) ?? 0) + heads);
        }
      }
    }

    const maxMovementMetric = Math.max(
      largestMetricRef.current,
      ...(movements || []).map((m) => m.heads || 0),
      1,
    );

    const targets = new Map<Feature<Geometry>, { name: string; startH: number; targetH: number; fullH: number }>();
    for (const [lowerName, feature] of featuresByNameRef.current) {
      const name = String(feature.get('name') ?? lowerName);
      const data = barangaysByName[name] || barangaysByName[lowerName];
      const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStatesRef.current?.[name], selectedLivestockType, simulationColorMode);
      const baseFullH = fullExtrusionHeightsRef.current.get(feature) ?? Math.max(10, getExtrusionHeight(value, largestMetricRef.current, heightScaleRef.current));
      const currentH = displayedHeightsRef.current.get(feature) ?? (isFlat ? 2 : baseFullH);

      let targetH = isFlat ? 2 : baseFullH;
      if (isMovementLayer) {
        if (isFlat) {
          targetH = 2;
        } else if (isTimelineActive) {
          const heads = activeHeadsByBarangay.get(lowerName) ?? 0;
          targetH = heads > 0
            ? getExtrusionHeight(heads, maxMovementMetric, heightScaleRef.current)
            : 2;
        } else {
          // Timeline not active -> use municipal baseline movement_out
          const heads = data?.movement_out ?? 0;
          targetH = heads > 0
            ? getExtrusionHeight(heads, largestMetricRef.current, heightScaleRef.current)
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
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-white/20 bg-slate-950/95 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
        >
          Brgy. {hoverInfo.name}
        </div>
      )}
      {error && (
        <div role="alert" className="absolute inset-x-4 top-4 z-10 rounded-lg bg-red-950/90 p-3 text-sm text-white">
          3D map could not load: {error}
        </div>
      )}
    </div>
  );
}
