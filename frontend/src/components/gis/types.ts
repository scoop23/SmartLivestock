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
 *    - `DiseaseSubMode`: 'reported' (PostgreSQL data) vs. 'simulation' (Haversine/wind) vs. 'trend' (current surveillance status).
 * 
 * 3. Spatial Epidemiological Simulation Types:
 *    - `SimulatedBarangayState`: Dynamic pressure (0-1), infected status, and infection source per barangay.
 *    - `MonthlyWindData`: Climatological environmental wind speed (km/h) and vector direction baseline used for scenario simulation.
 *    - `SimulationParameters`: User-tunable epidemic thresholds (contact scale, wind scale, alert threshold).
 */

export type MapLayer =
  | 'cattle'
  | 'disease'
  | 'milk'
  | 'farmer_meat'
  | 'slaughter_yield'
  | 'mortality'
  | 'movement'
  | 'meat'; // Legacy alias for slaughter_yield

export type ViewMode = '2D' | '3D';

export type DiseaseSubMode = 'reported' | 'simulation' | 'trend';

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
  farmer_meat: number;        // Farmer-reported on-farm meat production in kg (ProductionRecord)
  slaughter_yield: number;    // Inspected carcass meat yield in kg (SlaughterRecord)
  slaughter_heads: number;    // Heads slaughtered
  meat: number;               // Legacy alias for slaughter_yield
  cheese?: number;
  mortality: number;          // Total deaths recorded
  mortality_causes: string[]; // Reported causes of mortality
  mortality_by_species?: SpeciesCount[]; // Species-specific deaths in this barangay
  recent_mortality?: number;  // Deaths reported within recent surveillance window
  movement_out: number;       // Outbound inspected livestock heads
  movement_in: number;        // Inbound inspected livestock heads
  inspections_count: number;  // Movement inspection events
  is_in_scope?: boolean;      // True if user is authorized to inspect this barangay's detailed data
}

export type GISScope =
  | 'MUNICIPAL'
  | 'ASSIGNED_BARANGAYS'
  | 'OWN_BARANGAY'
  | 'OPERATIONAL_MOVEMENT'
  | 'OPERATIONAL_SLAUGHTER'
  | 'RESTRICTED';

export interface GISUserScope {
  role: string;
  scope: GISScope;
  allowed_barangays: string[];
  can_view_all_barangays: boolean;
  allowed_layers: MapLayer[];
  allowed_modes: ViewMode[];
  can_use_simulation: boolean;
  can_use_advanced_analytics: boolean;
  title: string;
}

export interface FarmerPersonalStats {
  my_cattle: number;
  my_total_livestock: number;
  my_milk: number;
  my_farmer_meat?: number;
  my_barangay: string;
}

export interface MovementItemBreakdown {
  species: string;
  quantity: number;
  sex: string;
  classification: string;
}

export interface MovementRecord {
  id: number;
  type: 'export' | 'import';
  origin: string;
  destination: string;
  direction?: 'INTERNAL' | 'INBOUND' | 'OUTBOUND' | 'UNKNOWN';
  from: [number, number];
  to: [number, number];
  heads: number;
  species: string;
  purpose: string;
  date: string;
  shipper_name: string;
  clearance_status: string;
  control_number: string;
  items_breakdown?: MovementItemBreakdown[];
}

export type MovementDatePreset = 'all' | '30d' | '90d' | 'this_year' | 'last_year';

export interface MovementFilterState {
  datePreset: MovementDatePreset;
  status: string; // 'ALL' | 'APPROVED' | 'PENDING' | 'VERIFIED' | 'SUBJECT_TO_REVISION'
  direction: string; // 'ALL' | 'OUTBOUND' | 'INBOUND' | 'INTERNAL'
  originSearch: string;
  destinationSearch: string;
  speciesSearch: string;
}

export interface MovementSummaryStats {
  totalMovements: number;
  totalHeads: number;
  approvedMovements: number;
  pendingMovements: number;
  outboundHeads: number;
  inboundHeads: number;
  internalHeads: number;
  topOrigins: { name: string; count: number; heads: number }[];
  topDestinations: { name: string; count: number; heads: number }[];
}

export interface MortalitySummary {
  total_deaths: number;
  affected_barangays: number;
  recent_deaths: number;
  by_species: SpeciesCount[];
  top_barangays: { name: string; deaths: number }[];
  by_barangay?: {
    barangay: string;
    deaths: number;
    causes?: string[];
    species?: string[];
  }[];
}

export interface MunicipalSummary {
  total_livestock: number;
  total_cattle: number;
  available_livestock_types?: string[];
  total_milk: number;
  total_farmer_meat?: number;
  total_slaughter_yield?: number;
  total_slaughter_heads?: number;
  total_meat: number;         // Legacy alias for total_slaughter_yield
  total_disease_cases: number;
  active_disease_cases: number;
  total_mortality: number;
  mortality?: MortalitySummary;
  total_farmers: number;
  total_movements: number;
  top_cattle: { name: string; cattle: number }[];
  top_milk: { name: string; milk: number }[];
  top_farmer_meat?: { name: string; farmer_meat: number }[];
  top_slaughter_yield?: { name: string; slaughter_yield: number; slaughter_heads?: number; heads?: number }[];
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
  period?: string;
  user_scope?: GISUserScope;
  farmer_stats?: FarmerPersonalStats | null;
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
  isDemoScenario?: boolean; // True when baseline DB cases are 0 and explicit demonstration seeds are activated
}

export interface TimelineMonth {
  index: number;
  monthName: string;
  label: string;
  year: number;
}

