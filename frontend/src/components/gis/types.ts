/**
 * TypeScript Interfaces for SmartLivestock GIS Telemetry
 * 
 * Educational Note:
 * Defining strict types for API contracts ensures frontend-backend contract
 * synchronization, prevents runtime undefined errors, and provides full IDE
 * autocompletion for real municipal data fields.
 */

export type MapLayer = 'cattle' | 'disease' | 'milk' | 'meat' | 'movement';

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

export interface SimulatedBarangayState {
  cases: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  projectedPeak: number;
}
