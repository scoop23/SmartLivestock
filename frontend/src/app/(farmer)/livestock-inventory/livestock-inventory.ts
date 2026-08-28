import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type EntryType = "INDIVIDUAL" | "BATCH";
export type StatusType = "PENDING" | "APPROVED" | "REJECTED";

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

export const mapInventory = (item: InventoryApiItem): LivestockInventoryItem => ({
  id: item.id,
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
  const res = await api.get<InventoryApiItem[]>("livestock/inventory/");
  return res.data.map(mapInventory);
}

export async function createInventoryRecord(payload: CreateInventoryPayload) {
  const res = await api.post("livestock/create/", payload);
  return res.data;
}

export async function updateInventoryRecord(id: string, payload: UpdateInventoryPayload) {
  const res = await api.put(`livestock/inventory_update/${id}/`, payload);
  return res.data;
}

export async function deleteInventoryRecord(id: string) {
  const res = await api.delete(`livestock/inventory_delete/${id}/`);
  return res.data;
}

export const INVENTORY_QUERY_KEYS = {
  types: ["livestock-types"] as const,
  inventory: ["user-inventory"] as const,
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
