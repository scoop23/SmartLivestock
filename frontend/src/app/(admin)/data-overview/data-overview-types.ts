import type { InventoryApiItem } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
// Data Overview Domain Types & Datasets for Padre Garcia MAO
// Aligned with Django backend models (livestock, production, diseases, movements)

export type DataTab =
  | 'overall'
  | 'livestock'
  | 'batches'
  | 'production'
  | 'sales'
  | 'disease'
  | 'mortality'
  | 'slaughter'
  | 'census';

export interface BarangaySummary {
  barangay: string;
  totalLivestock: number;
  cattleCount: number;
  carabaoCount: number;
  swineCount: number;
  goatCount: number;
  otherCount?: number;
  batchCount?: number;
  monthlyMilkLiters: number;
  monthlyMeatKg: number;
  activeIncidents: number;
  registeredFarmers: number;
}

export interface ActivityFeedItem {
  id: string;
  timestamp: string;
  domain: DataTab;
  title: string;
  description: string;
  actor: string;
  barangay: string;
  badge: string;
  badgeVariant: 'emerald' | 'sky' | 'amber' | 'rose' | 'orange' | 'default';
  record?: OverviewRecord;
}

export interface LivestockRecord {
  id: string;
  /** Original database primary key; `id` is formatted for display in this table. */
  rawId?: number | string;
  farmerName: string;
  farmerContact?: string;
  barangay: string;
  purok?: string;
  cattleId: string;
  tagNumber?: string;
  specie: string;
  breed: string;
  sex: 'Male' | 'Female' | 'Mixed' | string;
  birthDate?: string | null;
  age?: { years: number; months: number; total_months: number } | null;
  ageClassification?: "CALF" | "YEARLING" | "ADULT" | "UNKNOWN";
  weightKg?: number | null;
  entryType: 'INDIVIDUAL' | 'BATCH' | string;
  quantity: number;
  lastVaccinationDate?: string | null;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | string;
  operationalStatus?: string;
  registrationDate: string;
  rfidTag?: string;
  notes?: string;
  batchId?: number | null;
  batchCode?: string | null;
  batchName?: string | null;
  housingPen?: string | null;
  feedType?: string | null;
}

export interface BatchRecord {
  id: string;
  rawId: number;
  batchCode: string;
  batchName: string;
  farmerName: string;
  barangay: string;
  specie: string;
  housingPen?: string;
  feedType?: string;
  targetWeight?: number | string | null;
  targetHarvestDate?: string | null;
  totalAnimals: number;
  averageWeight?: number | string | null;
  status: 'APPROVED' | 'PENDING' | 'VERIFIED' | 'SUBJECT_TO_REVISION' | 'SUBJECT_FOR_REVISION' | string;
  reviewRemarks?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
  animals?: InventoryApiItem[];
}

export interface ProductionRecord {
  id: string;
  farmerName: string;
  farmerContact?: string;
  barangay: string;
  cattleId: string;
  type: 'Cow Milk' | 'Carabao Milk' | 'Eggs' | 'Wool' | 'Manure Fertilizer';
  specie?: string;
  quantity: string;
  quantityNumber: number;
  unit: string;
  fatContentPercentage?: number;
  qualityGrade: string;
  collectionCenter: string;
  estValuePhp: number | null;
  date: string;
  status: 'Certified' | 'Pending Review' | 'Subject for Revision' | 'Flagged';
  reviewStatus?: string;
}

export interface SalesRecord {
  id: string;
  farmerName: string;
  buyer: string;
  buyerContact?: string;
  barangay: string;
  product: string;
  specie: string;
  cattleId: string;
  quantity: string;
  amount: string;
  amountNumber: number | null;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Co-op Credit';
  transportPermitNumber: string;
  date: string;
  status: 'Completed' | 'Pending Clearance' | 'Cancelled';
}

export interface DiseaseRecord {
  id: string;
  farmerName: string;
  barangay: string;
  cattleId: string;
  specie: string;
  disease: string;
  symptoms: string[];
  affectedHeads: number;
  severity: 'Mild' | 'Moderate' | 'Critical';
  status: string;
  veterinarian: string;
  quarantineZone: boolean;
  dateReported: string;
  lastUpdated: string;
}

export interface MortalityRecord {
  id: string;
  farmerName: string;
  barangay: string;
  cattleId: string;
  specie: string;
  breed: string;
  cause: string;
  dateOfDeath: string;
  necropsyPerformed: boolean;
  necropsyFindings?: string;
  disposalMethod: 'Burial with Lime' | 'Municipal Crematorium' | 'Rendering Facility';
  insuranceClaimStatus: 'Approved' | 'In Review' | 'Not Insured';
  verifiedBy: string;
}

export interface SlaughterRecord {
  id: string;
  farmerName: string;
  meatInspector: string;
  barangay: string;
  cattleId: string;
  specie: string;
  carcassWeightKg: number;
  inspectionCertNo: string;
  purpose: string;
  anteMortemStatus: string;
  postMortemStatus: string;
  destinationMarket: string;
  date: string;
  status?: string;
}

export interface CensusRecord {
  id: string;
  barangay: string;
  quarter: string;
  year: number;
  totalHeads: number;
  cattleCount: number;
  carabaoCount: number;
  swineCount: number;
  goatCount: number;
  enumerator: string;
  verifiedByMAO: boolean;
  submissionDate: string;
  status: 'MAO Verified' | 'Pending Audit' | 'Revision Requested';
}

/**
 * 17 Official Barangays of the Municipality of Padre Garcia, Batangas
 * Aligned with backend `livestock.models.Barangay` table
 */
export const PADRE_GARCIA_BARANGAYS = [
  'All Barangays',
  'Banaba',
  'Manggas',
  'Pansol',
  'Cawongan',
  'Banay-Banay',
  'Bawi',
  'San Miguel',
  'Bukal',
  'San Felipe',
  'Maugat West',
  'Tamak',
  'Quilo Quilo North',
  'Quilo Quilo South',
  'Castillo',
  'Maugat East',
  'Payapa',
  'Tangob',
] as const;

// ── Live System Data: Empty initial fallbacks (purely database driven) ──
export const BARANGAY_MASTER_SUMMARIES: BarangaySummary[] = [];
export const SEED_LIVESTOCK: LivestockRecord[] = [];
export const SEED_BATCHES: BatchRecord[] = [];
export const SEED_PRODUCTION: ProductionRecord[] = [];
export const SEED_SALES: SalesRecord[] = [];
export const SEED_DISEASE: DiseaseRecord[] = [];
export const SEED_MORTALITY: MortalityRecord[] = [];
export const SEED_SLAUGHTER: SlaughterRecord[] = [];
export const SEED_CENSUS: CensusRecord[] = [];
export const SEED_ACTIVITY_FEED: ActivityFeedItem[] = [];

type DomainRecord = LivestockRecord | BatchRecord | ProductionRecord | SalesRecord | DiseaseRecord | MortalityRecord | SlaughterRecord | CensusRecord;
type DomainKeys<T> = T extends unknown ? keyof T : never;
type DomainValue<T, K> = T extends unknown ? K extends keyof T ? T[K] : never : never;
// A cross-domain display row: each tab supplies its own fields; identity is shared.
export type OverviewRecord = { id: string; healthStatus?: string; reviewStatus?: string; review_status?: string; barangayName?: string; causeOfDeath?: string; deathCount?: number; investigatedBy?: string } & {
  [K in Exclude<DomainKeys<DomainRecord>, "id">]?: DomainValue<DomainRecord, K> extends string ? string : DomainValue<DomainRecord, K>
};
