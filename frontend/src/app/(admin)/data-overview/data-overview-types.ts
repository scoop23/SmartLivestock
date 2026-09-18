// Data Overview Domain Types & Datasets for Padre Garcia MAO
// Aligned with Django backend models (livestock, production, diseases, movements)

export type DataTab =
  | 'overall'
  | 'livestock'
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
  monthlyMilkLiters: number;
  monthlyMeatKg: number;
  activeIncidents: number;
  registeredFarmers: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
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
  registrationDate: string;
  rfidTag?: string;
  notes?: string;
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
  qualityGrade: 'Grade A' | 'Grade B' | 'Standard';
  collectionCenter: string;
  estValuePhp: number;
  date: string;
  status: 'Certified' | 'Pending Review' | 'Flagged';
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
  amountNumber: number;
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
  status: 'Under Treatment' | 'Quarantined' | 'Recovered' | 'Under Investigation';
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
  purpose: 'Commercial Wholesale' | 'Local Retail' | 'Special Event' | 'Emergency Slaughter';
  anteMortemStatus: 'Passed' | 'Suspect';
  postMortemStatus: 'Fit for Human Consumption' | 'Condemned' | 'Partially Condemned';
  destinationMarket: string;
  date: string;
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

export const BARANGAY_MASTER_SUMMARIES: BarangaySummary[] = [
  { barangay: 'Maugat East', totalLivestock: 36, cattleCount: 36, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 24500, monthlyMeatKg: 4200, activeIncidents: 0, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Maugat West', totalLivestock: 36, cattleCount: 36, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 19800, monthlyMeatKg: 3800, activeIncidents: 0, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Cawongan', totalLivestock: 36, cattleCount: 36, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 16500, monthlyMeatKg: 3100, activeIncidents: 0, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Castillo', totalLivestock: 34, cattleCount: 34, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 14200, monthlyMeatKg: 2900, activeIncidents: 0, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Banaba', totalLivestock: 29, cattleCount: 21, carabaoCount: 0, swineCount: 8, goatCount: 0, monthlyMilkLiters: 12400, monthlyMeatKg: 2400, activeIncidents: 1, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Pansol', totalLivestock: 25, cattleCount: 25, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 11800, monthlyMeatKg: 2200, activeIncidents: 0, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Payapa', totalLivestock: 25, cattleCount: 25, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 11000, monthlyMeatKg: 2100, activeIncidents: 0, registeredFarmers: 10, riskLevel: 'LOW' },
  { barangay: 'Manggas', totalLivestock: 21, cattleCount: 21, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 10200, monthlyMeatKg: 1950, activeIncidents: 0, registeredFarmers: 7, riskLevel: 'LOW' },
  { barangay: 'Banay-Banay', totalLivestock: 18, cattleCount: 18, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 9600, monthlyMeatKg: 1800, activeIncidents: 0, registeredFarmers: 5, riskLevel: 'LOW' },
  { barangay: 'Bawi', totalLivestock: 16, cattleCount: 16, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 9100, monthlyMeatKg: 1750, activeIncidents: 0, registeredFarmers: 5, riskLevel: 'LOW' },
  { barangay: 'San Miguel', totalLivestock: 15, cattleCount: 15, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 8600, monthlyMeatKg: 1600, activeIncidents: 0, registeredFarmers: 5, riskLevel: 'LOW' },
  { barangay: 'Bukal', totalLivestock: 14, cattleCount: 14, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 8100, monthlyMeatKg: 1550, activeIncidents: 0, registeredFarmers: 4, riskLevel: 'LOW' },
  { barangay: 'San Felipe', totalLivestock: 12, cattleCount: 12, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 7800, monthlyMeatKg: 1450, activeIncidents: 0, registeredFarmers: 3, riskLevel: 'LOW' },
  { barangay: 'Tamak', totalLivestock: 10, cattleCount: 10, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 7400, monthlyMeatKg: 1400, activeIncidents: 0, registeredFarmers: 2, riskLevel: 'LOW' },
  { barangay: 'Quilo Quilo North', totalLivestock: 9, cattleCount: 9, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 7000, monthlyMeatKg: 1300, activeIncidents: 0, registeredFarmers: 2, riskLevel: 'LOW' },
  { barangay: 'Quilo Quilo South', totalLivestock: 9, cattleCount: 9, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 6500, monthlyMeatKg: 1250, activeIncidents: 0, registeredFarmers: 2, riskLevel: 'LOW' },
  { barangay: 'Tangob', totalLivestock: 8, cattleCount: 8, carabaoCount: 0, swineCount: 0, goatCount: 0, monthlyMilkLiters: 6100, monthlyMeatKg: 1180, activeIncidents: 0, registeredFarmers: 2, riskLevel: 'LOW' },
];

export const SEED_LIVESTOCK: LivestockRecord[] = [
  {
    id: 'LIV-2026-001',
    farmerName: 'Juan Dela Cruz',
    farmerContact: '0917-555-0192',
    barangay: 'Banaba',
    purok: 'Purok 3',
    cattleId: 'PG-CAT-0941',
    specie: 'Cattle',
    breed: 'Brahman Cross',
    sex: 'Female',
    ageMonths: 34,
    weightKg: 460,
    entryType: 'BATCH',
    quantity: 10,
    lastVaccinationDate: '2026-03-14',
    status: 'APPROVED',
    registrationDate: '2026-01-14',
    rfidTag: 'RFID-982-004-112',
    notes: 'High dairy yield lineage. Vaccinated for FMD and hemorrhagic septicemia.',
  },
  {
    id: 'LIV-2026-002',
    farmerName: 'Mark Angelo Bathan',
    farmerContact: '0918-444-8821',
    barangay: 'Manggas',
    purok: 'Purok 1',
    cattleId: 'PG-CAT-0942',
    specie: 'Cattle',
    breed: 'Holstein-Friesian',
    sex: 'Female',
    ageMonths: 28,
    weightKg: 520,
    entryType: 'BATCH',
    quantity: 5,
    lastVaccinationDate: '2026-02-28',
    status: 'APPROVED',
    registrationDate: '2026-02-03',
    rfidTag: 'RFID-982-004-113',
    notes: 'Imported dairy line with certified pedigree documents.',
  },
  {
    id: 'LIV-2026-003',
    farmerName: 'Peter Comia',
    farmerContact: '0922-111-9034',
    barangay: 'Manggas',
    purok: 'Purok 4',
    cattleId: 'PG-CAT-0943',
    specie: 'Cattle',
    breed: 'Simmental Beef',
    sex: 'Male',
    ageMonths: 22,
    weightKg: 490,
    entryType: 'BATCH',
    quantity: 5,
    lastVaccinationDate: '2026-01-20',
    status: 'APPROVED',
    registrationDate: '2026-02-18',
    rfidTag: 'RFID-982-004-114',
    notes: 'Premium commercial feeder steer.',
  },
  {
    id: 'LIV-2026-004',
    farmerName: 'Jose Fernandez',
    farmerContact: '0919-888-3344',
    barangay: 'Castillo',
    purok: 'Purok 5',
    cattleId: 'PG-CAT-0945',
    specie: 'Cattle',
    breed: 'Black Angus',
    sex: 'Male',
    ageMonths: 19,
    weightKg: 440,
    entryType: 'INDIVIDUAL',
    quantity: 1,
    lastVaccinationDate: '2026-03-05',
    status: 'PENDING',
    registrationDate: '2026-03-12',
    rfidTag: 'RFID-982-004-116',
    notes: 'Routine health check completed on March 2026.',
  },
  {
    id: 'LIV-2026-005',
    farmerName: 'Danilo Ramos',
    farmerContact: '0915-333-1122',
    barangay: 'Maugat East',
    purok: 'Purok 1',
    cattleId: 'PG-CAR-0112',
    specie: 'Carabao',
    breed: 'Bulgarian Murrah',
    sex: 'Female',
    ageMonths: 36,
    weightKg: 510,
    entryType: 'BATCH',
    quantity: 4,
    lastVaccinationDate: '2026-01-15',
    status: 'APPROVED',
    registrationDate: '2026-03-18',
    rfidTag: 'RFID-982-004-201',
    notes: 'Carabao milk cooperative program member.',
  },
  {
    id: 'LIV-2026-006',
    farmerName: 'Elena Dimaculangan',
    farmerContact: '0928-999-4455',
    barangay: 'Cawongan',
    purok: 'Purok 3',
    cattleId: 'PG-GOA-0087',
    specie: 'Goat',
    breed: 'Anglo-Nubian',
    sex: 'Female',
    ageMonths: 18,
    weightKg: 45,
    entryType: 'BATCH',
    quantity: 6,
    lastVaccinationDate: '2026-03-22',
    status: 'APPROVED',
    registrationDate: '2026-04-02',
    rfidTag: 'RFID-982-004-305',
    notes: 'Goat milk raiser under MAO livelihood grant.',
  },
];

export const SEED_PRODUCTION: ProductionRecord[] = [
  {
    id: 'PRD-2026-101',
    farmerName: 'Juan Dela Cruz',
    farmerContact: '0917-555-0192',
    barangay: 'Banaba',
    cattleId: 'PG-CAT-0941',
    type: 'Cow Milk',
    quantity: '4.70 Liters',
    quantityNumber: 4.7,
    unit: 'Liters',
    fatContentPercentage: 4.2,
    qualityGrade: 'Grade A',
    collectionCenter: 'Banaba Dairy Collection Point',
    estValuePhp: 282,
    date: '2026-04-20',
    status: 'Certified',
  },
  {
    id: 'PRD-2026-102',
    farmerName: 'Juan Dela Cruz',
    farmerContact: '0917-555-0192',
    barangay: 'Banaba',
    cattleId: 'PG-CAT-0942',
    type: 'Cow Milk',
    quantity: '2.65 Liters',
    quantityNumber: 2.65,
    unit: 'Liters',
    fatContentPercentage: 4.5,
    qualityGrade: 'Grade A',
    collectionCenter: 'Banaba Dairy Collection Point',
    estValuePhp: 159,
    date: '2026-04-21',
    status: 'Certified',
  },
  {
    id: 'PRD-2026-103',
    farmerName: 'Jose Fernandez',
    farmerContact: '0919-888-3344',
    barangay: 'Castillo',
    cattleId: 'PG-CAT-0945',
    type: 'Cow Milk',
    quantity: '41 Liters',
    quantityNumber: 41,
    unit: 'Liters',
    fatContentPercentage: 3.9,
    qualityGrade: 'Standard',
    collectionCenter: 'Castillo Milk Tank',
    estValuePhp: 2460,
    date: '2026-04-24',
    status: 'Certified',
  },
  {
    id: 'PRD-2026-104',
    farmerName: 'Danilo Ramos',
    farmerContact: '0915-333-1122',
    barangay: 'Maugat East',
    cattleId: 'PG-CAR-0112',
    type: 'Carabao Milk',
    quantity: '18 Liters',
    quantityNumber: 18,
    unit: 'Liters',
    fatContentPercentage: 7.8,
    qualityGrade: 'Grade A',
    collectionCenter: 'Maugat Dairy Chiller',
    estValuePhp: 2160,
    date: '2026-04-25',
    status: 'Certified',
  },
  {
    id: 'PRD-2026-105',
    farmerName: 'Elena Dimaculangan',
    farmerContact: '0928-999-4455',
    barangay: 'Cawongan',
    cattleId: 'PG-GOA-0087',
    type: 'Cow Milk',
    quantity: '12 Liters',
    quantityNumber: 12,
    unit: 'Liters',
    fatContentPercentage: 4.0,
    qualityGrade: 'Standard',
    collectionCenter: 'Cawongan Agri Drop-off',
    estValuePhp: 960,
    date: '2026-04-25',
    status: 'Pending Review',
  },
];

export const SEED_SALES: SalesRecord[] = [
  {
    id: 'SAL-2026-301',
    farmerName: 'Juan Dela Cruz',
    buyer: 'Batangas Dairy Cooperative Federation',
    buyerContact: '0920-999-1234',
    barangay: 'Banaba',
    product: 'Bulk Raw Cow Milk (Weekly)',
    specie: 'Dairy Milk',
    cattleId: 'PG-CAT-0941',
    quantity: '320 Liters',
    amount: '₱19,200',
    amountNumber: 19200,
    paymentMethod: 'Bank Transfer',
    transportPermitNumber: 'TP-2026-0419',
    date: '2026-04-22',
    status: 'Completed',
  },
  {
    id: 'SAL-2026-302',
    farmerName: 'Peter Comia',
    buyer: 'Calabarzon Meat Processors Inc.',
    buyerContact: '0917-888-5678',
    barangay: 'Manggas',
    product: 'Finished Feeder Steer (Live)',
    specie: 'Cattle',
    cattleId: 'PG-CAT-0943',
    quantity: '1 Head (490 kg)',
    amount: '₱58,800',
    amountNumber: 58800,
    paymentMethod: 'Cash',
    transportPermitNumber: 'TP-2026-0420',
    date: '2026-04-23',
    status: 'Completed',
  },
  {
    id: 'SAL-2026-303',
    farmerName: 'Jose Fernandez',
    buyer: 'Laguna Breeding Farm Co.',
    buyerContact: '0919-444-7788',
    barangay: 'Castillo',
    product: 'Certified Stud Bull',
    specie: 'Cattle',
    cattleId: 'PG-CAT-0945',
    quantity: '1 Head (680 kg)',
    amount: '₱95,000',
    amountNumber: 95000,
    paymentMethod: 'Bank Transfer',
    transportPermitNumber: 'TP-2026-0422',
    date: '2026-04-24',
    status: 'Completed',
  },
];

export const SEED_DISEASE: DiseaseRecord[] = [
  {
    id: 'DIS-2026-012',
    farmerName: 'Juan Dela Cruz',
    barangay: 'Banaba',
    cattleId: 'PG-CAT-0881',
    specie: 'Cattle',
    disease: 'Suspected Foot-and-Mouth Disease (FMD)',
    symptoms: ['Salivation', 'Oral Blisters', 'Lameness in Rear Feet'],
    affectedHeads: 1,
    severity: 'Critical',
    status: 'Quarantined',
    veterinarian: 'Dr. Arthur Cruz (Municipal Vet)',
    quarantineZone: true,
    dateReported: '2026-04-18',
    lastUpdated: '2026-04-24',
  },
  {
    id: 'DIS-2026-013',
    farmerName: 'Mark Angelo Bathan',
    barangay: 'Manggas',
    cattleId: 'PG-CAT-0892',
    specie: 'Cattle',
    disease: 'Bovine Mastitis (Subclinical)',
    symptoms: ['Swollen Udder', 'Abnormal Milk Texture'],
    affectedHeads: 1,
    severity: 'Mild',
    status: 'Under Treatment',
    veterinarian: 'Dr. Clara Santos (MAO Officer)',
    quarantineZone: false,
    dateReported: '2026-04-21',
    lastUpdated: '2026-04-25',
  },
  {
    id: 'DIS-2026-014',
    farmerName: 'Jose Fernandez',
    barangay: 'Castillo',
    cattleId: 'PG-CAT-0905',
    specie: 'Cattle',
    disease: 'Hemorrhagic Septicemia (HS)',
    symptoms: ['High Fever', 'Respiratory Distress', 'Throat Swelling'],
    affectedHeads: 1,
    severity: 'Moderate',
    status: 'Under Treatment',
    veterinarian: 'Dr. Arthur Cruz (Municipal Vet)',
    quarantineZone: false,
    dateReported: '2026-04-23',
    lastUpdated: '2026-04-25',
  },
];

export const SEED_MORTALITY: MortalityRecord[] = [
  {
    id: 'MOR-2026-041',
    farmerName: 'Jose Fernandez',
    barangay: 'Castillo',
    cattleId: 'PG-CAT-0711',
    specie: 'Cattle',
    breed: 'Native Cross',
    cause: 'Old Age & Heart Failure (Post-calving)',
    dateOfDeath: '2026-03-15',
    necropsyPerformed: true,
    necropsyFindings: 'No infectious pathogen detected. Natural senescence.',
    disposalMethod: 'Burial with Lime',
    insuranceClaimStatus: 'Approved',
    verifiedBy: 'SIBAT Officer Danilo M.',
  },
  {
    id: 'MOR-2026-042',
    farmerName: 'Juan Dela Cruz',
    barangay: 'Banaba',
    cattleId: 'PG-CAT-0734',
    specie: 'Cattle',
    breed: 'Brahman Steer',
    cause: 'Acute Tympany / Severe Bloat',
    dateOfDeath: '2026-04-05',
    necropsyPerformed: true,
    necropsyFindings: 'Frothy bloat confirmed resulting in ruminal distension.',
    disposalMethod: 'Burial with Lime',
    insuranceClaimStatus: 'In Review',
    verifiedBy: 'Dr. Clara Santos',
  },
];

export const SEED_SLAUGHTER: SlaughterRecord[] = [
  {
    id: 'SLG-2026-088',
    farmerName: 'Jose Fernandez',
    meatInspector: 'Insp. Rolando Bautista (NAMI)',
    barangay: 'Castillo',
    cattleId: 'PG-CAT-0650',
    specie: 'Cattle (Steer)',
    carcassWeightKg: 285,
    inspectionCertNo: 'MIC-2026-0418',
    purpose: 'Commercial Wholesale',
    anteMortemStatus: 'Passed',
    postMortemStatus: 'Fit for Human Consumption',
    destinationMarket: 'Padre Garcia Public Meat Market',
    date: '2026-04-23',
  },
  {
    id: 'SLG-2026-089',
    farmerName: 'Juan Dela Cruz',
    meatInspector: 'Insp. Rolando Bautista (NAMI)',
    barangay: 'Banaba',
    cattleId: 'PG-SWI-0219',
    specie: 'Swine (Market Hog)',
    carcassWeightKg: 88,
    inspectionCertNo: 'MIC-2026-0419',
    purpose: 'Local Retail',
    anteMortemStatus: 'Passed',
    postMortemStatus: 'Fit for Human Consumption',
    destinationMarket: 'Padre Garcia Livestock Trading Market',
    date: '2026-04-24',
  },
];

export const SEED_CENSUS: CensusRecord[] = [
  {
    id: 'CEN-2026-Q1-01',
    barangay: 'Banaba',
    quarter: 'Q1',
    year: 2026,
    totalHeads: 29,
    cattleCount: 21,
    carabaoCount: 0,
    swineCount: 8,
    goatCount: 0,
    enumerator: 'SIBAT Officer Danilo M.',
    verifiedByMAO: true,
    submissionDate: '2026-04-05',
    status: 'MAO Verified',
  },
  {
    id: 'CEN-2026-Q1-02',
    barangay: 'Manggas',
    quarter: 'Q1',
    year: 2026,
    totalHeads: 21,
    cattleCount: 21,
    carabaoCount: 0,
    swineCount: 0,
    goatCount: 0,
    enumerator: 'SIBAT Officer R. Castillo',
    verifiedByMAO: true,
    submissionDate: '2026-04-08',
    status: 'MAO Verified',
  },
  {
    id: 'CEN-2026-Q1-03',
    barangay: 'Maugat East',
    quarter: 'Q1',
    year: 2026,
    totalHeads: 36,
    cattleCount: 36,
    carabaoCount: 0,
    swineCount: 0,
    goatCount: 0,
    enumerator: 'SIBAT Officer Teresa B.',
    verifiedByMAO: true,
    submissionDate: '2026-04-10',
    status: 'MAO Verified',
  },
];

export const SEED_ACTIVITY_FEED: ActivityFeedItem[] = [
  {
    id: 'ACT-101',
    timestamp: '15 mins ago',
    domain: 'production',
    title: 'Daily Milk Batch Certified',
    description: 'Farmer Juan Dela Cruz delivered 4.70L Grade A milk at Banaba Hub.',
    actor: 'Banaba Dairy Co-op',
    barangay: 'Banaba',
    badge: '4.70 L',
    badgeVariant: 'emerald',
  },
  {
    id: 'ACT-102',
    timestamp: '1 hour ago',
    domain: 'sales',
    title: 'Auction Lot Sold & Cleared',
    description: 'Feeder steer sold to Calabarzon Meat Processors for ₱58,800.',
    actor: 'Padre Garcia Trading Center',
    barangay: 'Manggas',
    badge: '₱58,800',
    badgeVariant: 'sky',
  },
  {
    id: 'ACT-103',
    timestamp: '3 hours ago',
    domain: 'disease',
    title: 'Biosecurity Quarantine Enforced',
    description: '1 head placed under FMD observation in Banaba.',
    actor: 'Dr. Arthur Cruz (Vet)',
    barangay: 'Banaba',
    badge: 'Quarantine Active',
    badgeVariant: 'rose',
  },
  {
    id: 'ACT-104',
    timestamp: '5 hours ago',
    domain: 'livestock',
    title: 'New Livestock Tagged & Registered',
    description: 'New Brahman Cross batch registered under Juan Dela Cruz.',
    actor: 'SIBAT Officer Danilo',
    barangay: 'Banaba',
    badge: 'Registered',
    badgeVariant: 'emerald',
  },
  {
    id: 'ACT-105',
    timestamp: 'Yesterday',
    domain: 'slaughter',
    title: 'Slaughterhouse Meat Inspection Passed',
    description: '285 kg steer carcass cleared with MIC-2026-0418 for wholesale.',
    actor: 'Insp. Rolando Bautista',
    barangay: 'Castillo',
    badge: 'Cleared 285 kg',
    badgeVariant: 'amber',
  },
];
