'use client';

import { useEffect, useRef, useState } from 'react';
import type Feature from 'ol/Feature.js';
import type { Geometry } from 'ol/geom.js';
import type Polygon from 'ol/geom/Polygon.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type Instance from '@giro3d/giro3d/core/Instance.js';
import type FeatureCollection from '@giro3d/giro3d/entities/FeatureCollection.js';
import type Extent from '@giro3d/giro3d/core/geographic/Extent.js';
import type { BarangayGISData, DiseaseSubMode, GISUserScope, MapLayer, SimulatedBarangayState } from './types';
import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';

// Shared camera coordinates keep the first 3D view and the Reset button consistent.
const DEFAULT_3D_CAMERA_POSITION = { x: 13_492_381.19, y: 1_541_389.26, z: 14_328.31 };

interface Giro3DBarangayViewProps {
  barangaysByName: Record<string, BarangayGISData>;
  activeLayer: MapLayer;
  diseaseSubMode: DiseaseSubMode;
  selectedBarangay: BarangayGISData | null;
  onSelectBarangay: (barangay: BarangayGISData) => void;
  resetTrigger: number;
  simulatedStates?: Record<string, SimulatedBarangayState>;
  selectedLivestockType: string;
  userScope?: GISUserScope;
  heightScale: number;
  suppressClickUntilRef: { current: number };
}

// One shared metric lookup keeps each barangay's extrusion height tied to the active GIS layer.
function getMetricValue(
  data: BarangayGISData | undefined,
  layer: MapLayer,
  diseaseSubMode: DiseaseSubMode,
  simulation: SimulatedBarangayState | undefined,
  livestockType: string,
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
        ? simulation.transmissionPressure
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
function getLayerColor(layer: MapLayer, ratio: number): string {
  const palettes: Record<MapLayer, [string, string, string, string]> = {
    cattle: ['#eaf3e4', '#c5e0a8', '#5a8f4f', '#1a3d15'],
    disease: ['#dcfce7', '#fde68a', '#fb923c', '#991b1b'],
    milk: ['#e0f2fe', '#7dd3fc', '#0284c7', '#0c4a6e'],
    farmer_meat: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    slaughter_yield: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    meat: ['#fef3c7', '#fbbf24', '#ea580c', '#7c2d12'],
    mortality: ['#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'],
    movement: ['#f1f5f9', '#cbd5e1', '#64748b', '#1e293b'],
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

export function Giro3DBarangayView({
  barangaysByName,
  activeLayer,
  diseaseSubMode,
  selectedBarangay,
  onSelectBarangay,
  resetTrigger,
  simulatedStates,
  selectedLivestockType,
  userScope,
  heightScale,
  suppressClickUntilRef,
}: Giro3DBarangayViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const collectionRef = useRef<FeatureCollection | null>(null);
  const sceneExtentRef = useRef<Extent | null>(null);
  const controlsRef = useRef<MapControls | null>(null);
  const featuresByNameRef = useRef(new Map<string, Feature<Geometry>>());
  // Refs let the long-lived Giro3D scene read current slider values without being recreated.
  const heightScaleRef = useRef(heightScale);
  const appliedHeightScaleRef = useRef(heightScale);
  const borderLinesRef = useRef(new Map<Feature<Geometry>, import('three').LineSegments>());
  const hoveredFeatureRef = useRef<Feature<Geometry> | null>(null);
  const onSelectRef = useRef(onSelectBarangay);
  const selectedBarangayRef = useRef(selectedBarangay);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ name: string; x: number; y: number } | null>(null);

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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let instance: Instance | null = null;
    let controls: MapControls | null = null;
    let featureCollection: FeatureCollection | null = null;
    const borderLines = borderLinesRef.current;
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

        // Add breathing room around the municipal bounds for the camera and basemap tiles.
        const margin = Math.max(maxX - minX, maxY - minY) * 0.08;
        const extent = new extentModule.default(crs, minX - margin, maxX + margin, minY - margin, maxY + margin);
        sceneExtentRef.current = extent;
        const largestMetric = Math.max(
          0,
          ...Object.values(barangaysByName).map((data) =>
            getMetricValue(data, activeLayer, diseaseSubMode, simulatedStates?.[data.name], selectedLivestockType)
          ),
        );
        const featureByName = new Map<string, Feature<Geometry>>();
        for (const feature of features) {
          const name = String(feature.get('name') ?? '');
          if (name) featureByName.set(name.toLowerCase(), feature as Feature<Geometry>);
        }
        featuresByNameRef.current = featureByName;

        // Giro3D owns the scene/canvas; Three.js supplies the renderer, camera, and 3D objects underneath it.
        instance = new instanceModule.default({ target: host, crs, backgroundColor: '#07111f' });
        const map = new mapModule.default({
          extent,
          backgroundColor: '#0f172a',
          terrain: false,
          lighting: { enabled: true },
        });
        // Entity initialization is asynchronous, so wait before adding layers or configuring the camera.
        await instance.add(map);
        if (cancelled) return;
        await map.addLayer(new colorLayerModule.default({
          name: 'OpenStreetMap',
          extent,
          source: new tiledImageSourceModule.default({ source: new osmModule.OSM() }),
        }));
        if (cancelled) return;

        // FeatureCollection converts the OpenLayers polygons into Three.js meshes inside the Giro3D scene.
        featureCollection = new featureCollectionModule.default({
          name: 'Padre Garcia barangays',
          source,
          extent,
          dataProjection: crs,
          ignoreZ: true,
          minLevel: 0,
          maxLevel: 0,
          extrusionOffset: (feature) => {
            const name = String(feature.get('name') ?? '');
            const data = barangaysByName[name];
            const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStates?.[name], selectedLivestockType);
            // Log scaling prevents one unusually large barangay value from flattening all other columns.
            const ratio = value > 0 && largestMetric > 0
              ? Math.log1p(value) / Math.log1p(largestMetric)
              : 0;
            // Every polygon gets a small base height; its metric controls up to 2,200 additional scene units.
            return (50 + ratio * 2_200) * heightScaleRef.current;
          },
          style: (feature) => {
            // Giro3D calls this for each feature; feature properties drive selection and hover appearance.
            const name = String(feature.get('name') ?? '');
            const data = barangaysByName[name];
            const inScope = data?.is_in_scope ?? (
              !userScope || userScope.can_view_all_barangays || userScope.allowed_barangays.includes(name)
            );
            const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStates?.[name], selectedLivestockType);
            const ratio = largestMetric > 0 ? value / largestMetric : 0;
            const hovered = Boolean(feature.get('hovered'));

            return {
              fill: {
                color: hovered ? '#facc15' : inScope ? getLayerColor(activeLayer, ratio) : '#475569',
                opacity: hovered ? 1 : inScope ? 0.94 : 0.48,
                // The GIS choropleth should keep its data colors without depending on scene lights.
                shading: false,
              },
            };
          },
        });
        await instance.add(featureCollection);
        if (cancelled) return;

        // Draw the roof perimeter and vertical corners at the same extrusion height as each 3D barangay.
        // These lines depth-test against the meshes, so hidden edges stay hidden instead of creating x-ray lines.
        for (const feature of features) {
          const geometry = feature.getGeometry();
          if (!geometry) continue;
          const name = String(feature.get('name') ?? '');
          const data = barangaysByName[name];
          const value = getMetricValue(data, activeLayer, diseaseSubMode, simulatedStates?.[name], selectedLivestockType);
          const ratio = value > 0 && largestMetric > 0
            ? Math.log1p(value) / Math.log1p(largestMetric)
            : 0;
          const height = (50 + ratio * 2_200) * heightScaleRef.current;
          const outlineLift = 1;
          const positions: number[] = [];

          for (const ring of getPolygonRings(geometry)) {
            for (let index = 0; index < ring.length - 1; index += 1) {
              const [x, y, z = 0] = ring[index];
              const [nextX, nextY, nextZ = 0] = ring[index + 1];
              // Roof boundary segment
              positions.push(x, y, z + height + outlineLift, nextX, nextY, nextZ + height + outlineLift);
              // Vertical corner at this boundary vertex
              positions.push(x, y, z, x, y, z + height + outlineLift);
            }
          }

          const lineGeometry = new three.BufferGeometry();
          lineGeometry.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
          const material = new three.LineBasicMaterial({ color: '#000000', depthTest: true });
          const lines = new three.LineSegments(lineGeometry, material);
          lines.renderOrder = 2;
          instance.threeObjects.add(lines);
          borderLines.set(feature as Feature<Geometry>, lines);
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
        controls.target.copy(center);
        controls.update();
        controls.saveState();
        instance.view.setControls(controls);

        // Log once after camera motion settles, instead of printing a new line for every animation frame.
        cameraChangeHandler = () => {
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
          if (!instance || !featureCollection) return;
          // Giro3D ray-picks the feature under the pointer; React receives the selected barangay data.
          const picked = instance.pickObjectsAt(event, { where: [featureCollection] })[0];
          const pickedFeature = picked?.object.userData.feature as Feature<Geometry> | undefined;
          if (!pickedFeature) return;

          const name = String(pickedFeature.get('name') ?? '');
          const data = barangaysByName[name];
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
          if (!instance || !featureCollection) return;
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
      for (const [feature, lines] of borderLines) {
        instance?.threeObjects.remove(lines);
        lines.geometry.dispose();
        (lines.material as import('three').Material).dispose();
        borderLines.delete(feature);
      }
      controls?.dispose();
      instance?.dispose();
      instanceRef.current = null;
      collectionRef.current = null;
      sceneExtentRef.current = null;
      controlsRef.current = null;
      featuresByNameRef.current.clear();
      hoveredFeatureRef.current = null;
      setHoverInfo(null);
    };
  }, [
    activeLayer,
    barangaysByName,
    diseaseSubMode,
    selectedLivestockType,
    simulatedStates,
    suppressClickUntilRef,
    userScope,
  ]);

  // When the slider changes, update the existing polygon meshes and their raised border lines in place.
  useEffect(() => {
    const collection = collectionRef.current;
    const instance = instanceRef.current;
    const previousScale = appliedHeightScaleRef.current;
    if (!collection || !instance || previousScale === heightScale) return;

    // updateStyles rebuilds an extruded polygon only when its extrusion height changed.
    collection.updateStyles();

    // Borders are separate Three.js lines, so scale each line vertex's Z coordinate by the same ratio.
    const scaleRatio = heightScale / previousScale;
    for (const lines of borderLinesRef.current.values()) {
      const positions = lines.geometry.getAttribute('position');
      for (let vertex = 0; vertex < positions.count; vertex += 1) {
        positions.setZ(vertex, positions.getZ(vertex) * scaleRatio);
      }
      positions.needsUpdate = true;
      lines.geometry.computeBoundingSphere();
    }

    appliedHeightScaleRef.current = heightScale;
    instance.notifyChange();
  }, [heightScale]);

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
    controls.target.set(centerX, centerY, 0);
    if (resetRequested) {
      // Reset restores the same saved position used when the 3D scene first opens.
      instance.view.camera.position.set(
        DEFAULT_3D_CAMERA_POSITION.x,
        DEFAULT_3D_CAMERA_POSITION.y,
        DEFAULT_3D_CAMERA_POSITION.z,
      );
    } else {
      // Selecting a barangay still frames that polygon using its own bounds.
      const distance = Math.max(maxX - minX, maxY - minY) * 1.6;
      instance.view.camera.position.set(
        centerX - distance * 0.4,
        centerY - distance * 0.4,
        distance * 1.5,
      );
    }
    controls.update();
    instance.notifyChange(instance.view.camera);
  }, [resetTrigger, selectedBarangay]);

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
