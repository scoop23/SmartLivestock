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

export const INVENTORY_QUERY_KEYS = {
  types: ["livestock-types"] as const,
  inventory: ["inventory"] as const,
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

