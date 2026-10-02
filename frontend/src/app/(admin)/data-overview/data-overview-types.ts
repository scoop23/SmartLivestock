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
  record?: any;
}

export interface LivestockRecord {
  id: string;
  farmerName: string;
  farmerContact?: string;
  barangay: string;
  purok?: string;
  cattleId: string;
  specie: string;
  breed: string;
  sex: 'Male' | 'Female' | 'Mixed' | string;
  ageMonths?: number;
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
  animals?: any[];
}

export interface ProductionRecord {
  id: string;
  farmerName: string;
  farmerContact?: string;
  barangay: string;
  cattleId: string;
  type: 'Cow Milk' | 'Carabao Milk' | 'Eggs' | 'Wool' | 'Manure Fertilizer';
  quantity: string;
  quantityNumber: number;
  unit: string;
  fatContentPercentage?: number;
  qualityGrade: string;
  collectionCenter: string;
  estValuePhp: number | null;
  date: string;
  status: 'Certified' | 'Pending Review' | 'Subject for Revision' | 'Flagged';
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
