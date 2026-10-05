/**
 * ============================================================================
 * SmartLivestock GIS — TypeScript Domain Models & Contracts (`types.ts`)
 * ============================================================================
 * 
 * ARCHITECTURAL PURPOSE & LEARNING GUIDE:
 * ----------------------------------------------------------------------------
 * In modern full-stack development (Django REST Framework + Next.js TypeScript),
 * the TypeScript contract ensures strict type safety between backend database
 * queries and client-side UI components:
 * 
 * 1. Backend REST Payload Contracts:
 *    - `GISTelemetryResponse`: The root JSON object returned by `GET /api/analytics/gis/`.
 *    - `BarangayGISData`: Granular statistics per barangay (herds, species breakdown,
 *      disease cases, dairy milk, slaughter meat, and mortality).
 *    - `MovementRecord`: Live shipment clearances with [latitude, longitude] origin/destination.
 *    - `MunicipalSummary`: High-level municipal totals and Top 5 leaderboards.
 * 
 * 2. Visual & Architectural State Types:
 *    - `MapLayer`: Cattle (🐄), Disease (🩺), Dairy Milk (🥛), Meat Yield (🥩), Movement (🚛).
 *    - `ViewMode`: 2D Orthogonal Map vs. 3D Volumetric Extrusion.
 *    - `DiseaseSubMode`: 'reported' (PostgreSQL data) vs. 'simulation' (Haversine/wind) vs. 'forecast' (predictive).
 * 
 * 3. Spatial Epidemiological Simulation Types:
 *    - `SimulatedBarangayState`: Dynamic pressure (0-1), infected status, and infection source per barangay.
 *    - `MonthlyWindData`: Meteorological wind speed (m/s) and vector direction for atmospheric plume drift.
 *    - `SimulationParameters`: User-tunable epidemic thresholds (contact scale, wind scale, alert threshold).
 */

export type MapLayer = 'cattle' | 'disease' | 'milk' | 'meat' | 'movement';

export type ViewMode = '2D' | '3D';

export type DiseaseSubMode = 'reported' | 'simulation' | 'forecast';

export interface SpeciesCount {
  species: string;
  heads: number;
}

export interface BarangayGISData {
  name: string;               // Normalized official GeoJSON key (e.g. "Banaba", "Quilo-quilo North")
  db_name: string;            // Name in database (e.g. "Banay-Banay")
  barangay_id: number | null; // Database primary key
  position: [number, number]; // [latitude, longitude] centroid
  cattle: number;             // Real cattle head count
  total_livestock: number;    // All livestock species combined
  species_breakdown: SpeciesCount[];
  farmers_count: number;      // Registered farmers in this barangay
  batches_count: number;      // Active livestock batches/herds
  disease_cases: number;      // Historical/total disease cases count
  active_cases: number;       // Current active/unresolved disease cases
  affected_heads: number;     // Animals affected by disease
  disease_risk: 'low' | 'medium' | 'high'; // Derived from active outbreaks
  recent_diseases: string[];  // Symptoms / disease names reported
  milk: number;               // Total milk production in Liters
  meat: number;               // Total carcass weight from slaughter in kg
  slaughter_heads: number;    // Heads slaughtered
  cheese?: number;
  mortality: number;          // Total deaths recorded
  mortality_causes: string[]; // Reported causes of mortality
  movement_out: number;       // Outbound inspected livestock heads
  movement_in: number;        // Inbound inspected livestock heads
  inspections_count: number;  // Movement inspection events
}

export interface MovementRecord {
  id: number;
  type: 'export' | 'import';
  origin: string;
  destination: string;
  from: [number, number];
  to: [number, number];
  heads: number;
  species: string;
  purpose: string;
  date: string;
  shipper_name: string;
  clearance_status: string;
  control_number: string;
}

export interface MunicipalSummary {
  total_livestock: number;
  total_cattle: number;
  total_milk: number;
  total_meat: number;
  total_disease_cases: number;
  active_disease_cases: number;
  total_mortality: number;
  total_farmers: number;
  total_movements: number;
  top_cattle: { name: string; cattle: number }[];
  top_milk: { name: string; milk: number }[];
  alert_barangays: {
    name: string;
    active_cases: number;
    disease_cases: number;
    disease_risk: 'low' | 'medium' | 'high';
    recent_diseases: string[];
  }[];
}

export interface GISTelemetryResponse {
  barangays: BarangayGISData[];
  barangays_dict: Record<string, BarangayGISData>;
  movements: MovementRecord[];
  summary: MunicipalSummary;
  period: string;
}

export interface EnvironmentalWindInput {
  speedKmH: number;           // Average wind velocity (e.g. 14 km/h)
  directionDegrees: number;   // Heading direction (45 deg = Southwest to Northeast)
  cardinalDirection: string;  // e.g. "SW → NE"
  sourceAttribution: string;  // e.g. "PAGASA Climatological Data (Batangas Station)"
}

export interface MonthlyWindData {
  month: number;
  monthName: string;
  speedKmH: number;
  windToDegrees: number;
  cardinal: string;
}

export interface SimulationParameters {
  L_contact: number; // Transmission decay distance (km), e.g. 3.5
  L_wind: number;    // Wind drift decay distance (km), e.g. 5.0
  threshold: number; // Pressure threshold [0, 1] to trigger new infections, e.g. 0.35
}

export interface SimulatedBarangayState {
  cases: number;              // Simulated active cases at this time step
  risk: 'low' | 'medium' | 'high' | 'critical';
  transmissionPressure: number; // Normalized pressure score [0, 1]
  rawPressure: number;        // Unnormalized pressure
  windExposureFactor: number; // Downwind influence multiplier
  projectedPeak: number;
}

export interface MonthlySimulationResult {
  monthIndex: number;
  month: TimelineMonth;
  wind: MonthlyWindData;
  states: Record<string, SimulatedBarangayState>;
  totalPressure: number;
  totalInfected: number;
}

export interface ForecastBarangayState {
  projectedCases: number;
  lowerBound: number;
  upperBound: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: number;
  model: string;
}

export interface TimelineMonth {
  index: number;
  monthName: string;
  label: string;
  year: number;
}

