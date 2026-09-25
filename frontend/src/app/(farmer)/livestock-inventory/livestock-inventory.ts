import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type EntryType = "INDIVIDUAL" | "BATCH";
export type StatusType = "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";

export interface LivestockType {
  id: number;
  name: string;
}

export interface LivestockInventoryItem {
  id: string;
  farmerName: string;
  livestockTypeName: string;
  entryType: EntryType;
  quantity: number;
  tagNumber: string;
  breed: string;
  sex: string;
  weight: number | null;
  lastVaccinationDate: string | null;
  status: StatusType;
  reviewRemarks?: string | null;
  createdAt: string;
  photoUrl?: string | null;
  avatarKey?: string | null;
  batchId?: number | null;
  batchCode?: string | null;
  batchName?: string | null;
}

export interface InventoryApiItem {
  id: string;
  farmer_name: string;
  livestock_type_name: string;
  entry_type: EntryType;
  quantity: number;
  tag_number: string;
  breed: string;
  sex: string;
  weight: number | null;
  last_vaccination_date: string | null;
  status: StatusType;
  review_remarks: string | null;
  created_at: string;
  photo?: string | null;
  photo_url?: string | null;
  avatar_key?: string | null;
  batch?: number | null;
  batch_code?: string | null;
  batch_name?: string | null;
}

export interface LivestockBatchItem {
  id: number;
  farmer: number;
  farmerName: string;
  barangayId: number;
  barangayName: string;
  livestockType: number;
  livestockTypeName: string;
  batchName: string;
  batchCode: string;
  housingPen: string;
  feedType: string;
  targetWeight: number | null;
  targetHarvestDate: string | null;
  status: "ACTIVE" | "HARVESTED" | "SOLD" | "ARCHIVED";
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  reviewRemarks?: string;
  notes: string;
  totalAnimals: number;
  averageWeight: number | null;
  animals?: LivestockInventoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBatchPayload {
  livestock_type: number;
  batch_name: string;
  batch_code?: string;
  housing_pen?: string;
  feed_type?: string;
  target_weight?: number | null;
  target_harvest_date?: string | null;
  status?: string;
  notes?: string;
  animals?: Array<{
    tag_number: string;
    breed: string;
    sex: string;
    weight?: number | null;
    last_vaccination_date?: string | null;
    avatar_key?: string | null;
  }>;
}

export interface CreateInventoryPayload {
  entry_type: EntryType;
  livestock_type: number;
  quantity: number;
  tag_number?: string;
  breed?: string;
  sex?: string;
  weight?: number | null;
  last_vaccination_date?: string | null;
  photo?: string | null;
  avatar_key?: string | null;
  batch?: number | null;
}

export interface UpdateInventoryPayload {
  entry_type: EntryType;
  livestock_type: number;
  quantity: number;
  tag_number?: string;
  breed?: string;
  sex?: string;
  weight?: number | null;
  last_vaccination_date?: string | null;
  photo?: string | null;
  avatar_key?: string | null;
  batch?: number | null;
}

// ── Common Species Presets & Guidelines ────────────────────────────────────

export interface SpeciesPreset {
  name: string;
  tagPrefix: string;
  commonBreeds: string[];
  suggestedWeightKg: string;
  iconName: string;
}

export const SPECIES_PRESETS: Record<string, SpeciesPreset> = {
  Cattle: {
    name: "Cattle",
    tagPrefix: "CAT",
    commonBreeds: [
      "Brahman",
      "Holstein-Friesian",
      "Jersey",
      "Black Angus",
      "Simmental",
      "Philippine Native (Batangas)",
      "Crossbred Dairy",
    ],
    suggestedWeightKg: "350 - 450",
    iconName: "beef",
  },
  Carabao: {
    name: "Carabao",
    tagPrefix: "CAR",
    commonBreeds: [
      "Philippine Carabao (Native)",
      "Murrah Buffalo",
      "Bulgarian Murrah",
      "Crossbred Dairy Carabao",
    ],
    suggestedWeightKg: "400 - 550",
    iconName: "shield",
  },
  Goat: {
    name: "Goat",
    tagPrefix: "GOAT",
    commonBreeds: [
      "Boer",
      "Anglo-Nubian",
      "Saanen",
      "Toggenburg",
      "Alpine",
      "Philippine Native Goat",
    ],
    suggestedWeightKg: "30 - 55",
    iconName: "sparkles",
  },
  Sheep: {
    name: "Sheep",
    tagPrefix: "SHP",
    commonBreeds: [
      "Philippine Native Sheep",
      "Katahdin",
      "Dorper",
      "St. Croix",
      "Barbados Blackbelly",
    ],
    suggestedWeightKg: "35 - 60",
    iconName: "package",
  },
  Swine: {
    name: "Swine",
    tagPrefix: "SWN",
    commonBreeds: [
      "Large White",
      "Landrace",
      "Duroc",
      "Pietrain",
      "Philippine Native Pig",
    ],
    suggestedWeightKg: "85 - 110",
    iconName: "layers",
  },
  Poultry: {
    name: "Poultry",
    tagPrefix: "PLT",
    commonBreeds: [
      "Broiler (Cobb/Ross)",
      "Layer (Lohmann/Hy-Line)",
      "Philippine Native Chicken",
      "Pekin Duck",
      "Mallard Duck (Itik)",
    ],
    suggestedWeightKg: "1.5 - 2.5",
    iconName: "egg",
  },
};

export function getSpeciesPreset(typeName?: string): SpeciesPreset {
  if (!typeName) return SPECIES_PRESETS.Cattle;
  const match = Object.keys(SPECIES_PRESETS).find((key) =>
    typeName.toLowerCase().includes(key.toLowerCase())
  );
  return match ? SPECIES_PRESETS[match] : SPECIES_PRESETS.Cattle;
}

export function generateSuggestedTag(typeName?: string): string {
  const preset = getSpeciesPreset(typeName);
  const year = new Date().getFullYear();
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${preset.tagPrefix}-${year}-${randomNum}`;
}

// ── Livestock Avatar Gallery Presets ───────────────────────────────────────

export interface LivestockAvatarOption {
  id: string;
  name: string;
  species: string;
  emoji: string;
  bgGradient: string;
  badge: string;
}

export const LIVESTOCK_AVATAR_PRESETS: LivestockAvatarOption[] = [
  // Cattle
  {
    id: "cow-brahman",
    name: "Brahman Bull",
    species: "Cattle",
    emoji: "🐂",
    bgGradient: "from-amber-100 via-amber-200 to-orange-100 text-amber-950 border-amber-300",
    badge: "Beef Bull",
  },
  {
    id: "cow-dairy",
    name: "Holstein Dairy",
    species: "Cattle",
    emoji: "🐄",
    bgGradient: "from-emerald-100 via-teal-100 to-emerald-200 text-emerald-950 border-emerald-300",
    badge: "Dairy Cow",
  },
  {
    id: "cow-calf",
    name: "Young Calf",
    species: "Cattle",
    emoji: "🐮",
    bgGradient: "from-lime-100 via-emerald-100 to-teal-100 text-emerald-900 border-emerald-300",
    badge: "Calf / Weaner",
  },
  // Carabao
  {
    id: "carabao-native",
    name: "Batangas Carabao",
    species: "Carabao",
    emoji: "🐃",
    bgGradient: "from-slate-200 via-indigo-100 to-slate-300 text-indigo-950 border-indigo-300",
    badge: "Draft & Work",
  },
  {
    id: "carabao-murrah",
    name: "Murrah Buffalo",
    species: "Carabao",
    emoji: "🐃",
    bgGradient: "from-sky-100 via-indigo-100 to-blue-200 text-blue-950 border-blue-300",
    badge: "Dairy Buffalo",
  },
  // Swine
  {
    id: "pig-large-white",
    name: "Large White",
    species: "Swine",
    emoji: "🐷",
    bgGradient: "from-rose-100 via-pink-100 to-rose-200 text-rose-950 border-rose-300",
    badge: "Commercial Sow",
  },
  {
    id: "pig-landrace",
    name: "Landrace Boar",
    species: "Swine",
    emoji: "🐖",
    bgGradient: "from-pink-100 via-rose-100 to-fuchsia-100 text-pink-950 border-pink-300",
    badge: "Breeder Boar",
  },
  {
    id: "pig-native",
    name: "Native Pig",
    species: "Swine",
    emoji: "🐗",
    bgGradient: "from-stone-200 via-amber-100 to-stone-300 text-stone-900 border-stone-300",
    badge: "Native Lechon",
  },
  // Goat
  {
    id: "goat-boer",
    name: "Boer Meat Goat",
    species: "Goat",
    emoji: "🐐",
    bgGradient: "from-amber-100 via-yellow-100 to-amber-200 text-amber-950 border-amber-300",
    badge: "Meat Buck",
  },
  {
    id: "goat-nubian",
    name: "Anglo-Nubian",
    species: "Goat",
    emoji: "🥛",
    bgGradient: "from-emerald-100 via-teal-100 to-cyan-100 text-teal-950 border-teal-300",
    badge: "Dairy Doe",
  },
  // Sheep
  {
    id: "sheep-dorper",
    name: "Dorper Sheep",
    species: "Sheep",
    emoji: "🐑",
    bgGradient: "from-sky-100 via-cyan-100 to-sky-200 text-sky-950 border-sky-300",
    badge: "Hair Sheep",
  },
  // Poultry
  {
    id: "poultry-layer",
    name: "Lohmann Layer",
    species: "Poultry",
    emoji: "🐔",
    bgGradient: "from-amber-100 via-orange-100 to-yellow-200 text-amber-950 border-amber-300",
    badge: "Egg Layer",
  },
  {
    id: "poultry-rooster",
    name: "Heritage Rooster",
    species: "Poultry",
    emoji: "🐓",
    bgGradient: "from-red-100 via-orange-100 to-amber-200 text-red-950 border-red-300",
    badge: "Rooster",
  },
  {
    id: "poultry-broiler",
    name: "White Broiler",
    species: "Poultry",
    emoji: "🐥",
    bgGradient: "from-yellow-100 via-amber-100 to-lime-100 text-yellow-950 border-yellow-300",
    badge: "Meat Broiler",
  },
  // Horse
  {
    id: "horse-batangas",
    name: "Batangas Stallion",
    species: "Horse",
    emoji: "🐴",
    bgGradient: "from-amber-100 via-stone-200 to-amber-200 text-amber-950 border-amber-300",
    badge: "Equine",
  },
];

export function getDefaultAvatarForSpecies(speciesName?: string): LivestockAvatarOption {
  if (!speciesName) return LIVESTOCK_AVATAR_PRESETS[0];
  const lower = speciesName.toLowerCase();
  const match = LIVESTOCK_AVATAR_PRESETS.find((a) =>
    lower.includes(a.species.toLowerCase())
  );
  return match || LIVESTOCK_AVATAR_PRESETS[0];
}

export function getAvatarById(avatarId?: string | null, speciesName?: string): LivestockAvatarOption {
  if (avatarId) {
    const found = LIVESTOCK_AVATAR_PRESETS.find((a) => a.id === avatarId);
    if (found) return found;
  }
  return getDefaultAvatarForSpecies(speciesName);
}

export const mapInventory = (item: InventoryApiItem): LivestockInventoryItem => ({
  id: String(item.id),
  farmerName: item.farmer_name,
  livestockTypeName: item.livestock_type_name,
  entryType: item.entry_type,
  quantity: item.quantity,
  tagNumber: item.tag_number,
  breed: item.breed,
  sex: item.sex,
  weight: item.weight,
  lastVaccinationDate: item.last_vaccination_date,
  status: item.status,
  reviewRemarks: item.review_remarks,
  createdAt: item.created_at,
  photoUrl: (item as any).photo || (item as any).photo_url || null,
  avatarKey: (item as any).avatar_key || null,
  batchId: item.batch || null,
  batchCode: item.batch_code || null,
  batchName: item.batch_name || null,
});

export async function fetchLivestockTypesList(): Promise<LivestockType[]> {
  const res = await api.get<LivestockType[]>("livestock/livestock_types/");
  return res.data;
}

export async function fetchLivestockTypesMap(): Promise<Record<string, number>> {
  const types = await fetchLivestockTypesList();
  const map: Record<string, number> = {};
  types.forEach((t) => {
    map[t.name] = t.id;
  });
  return map;
}

export async function fetchUserInventory(): Promise<LivestockInventoryItem[]> {
  const res = await api.get<InventoryApiItem[]>("livestock/inventory/?mine=true");
  return res.data.map(mapInventory);
}

export async function createInventoryRecord(payload: CreateInventoryPayload) {
  const res = await api.post("livestock/inventory/", payload);
  return res.data;
}

export async function updateInventoryRecord(id: string, payload: UpdateInventoryPayload) {
  const res = await api.put(`livestock/inventory/${id}/`, payload);
  return res.data;
}

export async function deleteInventoryRecord(id: string) {
  const res = await api.delete(`livestock/inventory/${id}/`);
  return res.data;
}

// ── Livestock Batches API ──────────────────────────────────────────────────

export async function fetchLivestockBatches(): Promise<LivestockBatchItem[]> {
  const res = await api.get<any[]>("livestock/batches/");
  return res.data.map((b) => ({
    id: b.id,
    farmer: b.farmer,
    farmerName: b.farmer_name,
    barangayId: b.barangay_id,
    barangayName: b.barangay_name,
    livestockType: b.livestock_type,
    livestockTypeName: b.livestock_type_name,
    batchName: b.batch_name,
    batchCode: b.batch_code,
    housingPen: b.housing_pen,
    feedType: b.feed_type,
    targetWeight: b.target_weight ? Number(b.target_weight) : null,
    targetHarvestDate: b.target_harvest_date,
    status: b.status,
    reviewStatus: b.review_status,
    reviewRemarks: b.review_remarks,
    notes: b.notes,
    totalAnimals: b.total_animals,
    averageWeight: b.average_weight ? Number(b.average_weight) : null,
    animals: b.animals ? b.animals.map(mapInventory) : [],
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  }));
}

export async function createLivestockBatch(payload: CreateBatchPayload) {
  const res = await api.post("livestock/batches/", payload);
  return res.data;
}

export const INVENTORY_QUERY_KEYS = {
  types: ["livestock-types"] as const,
  inventory: ["inventory"] as const,
  batches: ["livestock-batches"] as const,
};

export function useLivestockTypes() {
  return useQuery<Record<string, number>>({
    queryKey: INVENTORY_QUERY_KEYS.types,
    queryFn: fetchLivestockTypesMap,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserInventory() {
  return useQuery<LivestockInventoryItem[]>({
    queryKey: INVENTORY_QUERY_KEYS.inventory,
    queryFn: fetchUserInventory,
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInventoryRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.inventory });
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInventoryRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.inventory });
    },
  });
}

export function useLivestockBatches() {
  return useQuery<LivestockBatchItem[]>({
    queryKey: INVENTORY_QUERY_KEYS.batches,
    queryFn: fetchLivestockBatches,
  });
}

export function useCreateLivestockBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLivestockBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.inventory });
    },
  });
}

