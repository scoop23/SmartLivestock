"use client";

import api from "@/lib/axios";
import { toast } from "sonner";

export interface OfflineFileItem {
  fieldName: string;
  fileName: string;
  dataUrl: string;
  mimeType: string;
}

export interface OfflineQueuedItem {
  id: string;
  title: string;
  role: "CBAT" | "SIBAT" | "FARMER" | "MAO" | "ADMIN";
  category: "VERIFICATION" | "OBSERVATION" | "PRODUCTION" | "CALVING" | "GENERAL";
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  payload: Record<string, unknown>;
  files?: OfflineFileItem[];
  timestamp: string;
  status: "QUEUED" | "SYNCING" | "FAILED";
  error?: string;
  retryCount: number;
}

export const OFFLINE_OUTBOX_STORAGE_KEY = "smartlivestock_offline_outbox";
export const OFFLINE_QUEUE_UPDATED_EVENT = "smartlivestock:offline-queue-updated";
export const OFFLINE_SYNC_COMPLETED_EVENT = "smartlivestock:offline-sync-completed";

// ── File Conversion Helpers ──

export async function fileToOfflineFileItem(fieldName: string, file: File): Promise<OfflineFileItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fieldName,
        fileName: file.name,
        dataUrl: reader.result as string,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export function offlineFileItemToFile(item: OfflineFileItem): File {
  const arr = item.dataUrl.split(",");
  const mime = item.mimeType || arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], item.fileName, { type: mime });
}

// ── Outbox Storage Accessors ──

export function getOfflineQueue(): OfflineQueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineQueuedItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_OUTBOX_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT, { detail: queue }));
  } catch (err) {
    console.error("[OfflineQueue] Failed to save queue to localStorage:", err);
  }
}

export function removeOfflineAction(id: string): void {
  const current = getOfflineQueue();
  const filtered = current.filter((item) => item.id !== id);
  saveOfflineQueue(filtered);
}

export function enqueueOfflineAction(
  item: Omit<OfflineQueuedItem, "id" | "timestamp" | "status" | "retryCount">
): OfflineQueuedItem {
  const current = getOfflineQueue();
  const newItem: OfflineQueuedItem = {
    ...item,
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    status: "QUEUED",
    retryCount: 0,
  };

  current.push(newItem);
  saveOfflineQueue(current);
  return newItem;
}

export function isOffline(): boolean {
  if (typeof window === "undefined") return false;
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; response?: unknown };
  if (!err.response) return true; // No response from server = network/timeout error
  if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return true;
  return false;
}

// ── Background Sync Engine ──

let isSyncing = false;

export async function syncOfflineQueue(): Promise<{ total: number; synced: number; failed: number }> {
  if (isSyncing || typeof window === "undefined") {
    return { total: 0, synced: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { total: 0, synced: 0, failed: 0 };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { total: queue.length, synced: 0, failed: queue.length };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const item of queue) {
      try {
        let requestBody: Record<string, unknown> | FormData = item.payload;

        // If files exist, reconstruct multipart FormData
        if (item.files && item.files.length > 0) {
          const fd = new FormData();
          Object.entries(item.payload).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
              fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
            }
          });
          item.files.forEach((f) => {
            try {
              const fileObj = offlineFileItemToFile(f);
              fd.append(f.fieldName, fileObj);
            } catch (fileErr) {
              console.warn("[OfflineSync] Reconstructing file failed:", fileErr);
            }
          });
          requestBody = fd;
        }

        await api.request({
          url: item.endpoint,
          method: item.method,
          data: requestBody,
        });

        // Successfully synced: remove from queue
        removeOfflineAction(item.id);
        synced++;
        toast.success(`Synced to MAO: ${item.title}`);
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          // If network failed mid-sync, halt remaining queue to preserve order
          failed++;
          console.warn("[OfflineSync] Network lost while syncing:", item.title);
          break;
        } else {
          // Bad request or business logic rejection: mark as failed but don't block subsequent items
          failed++;
          const currentQueue = getOfflineQueue();
          const target = currentQueue.find((q) => q.id === item.id);
          if (target) {
            target.status = "FAILED";
            target.retryCount += 1;
            target.error = (err as { message?: string })?.message || "Sync failed";
            saveOfflineQueue(currentQueue);
          }
        }
      }
    }

    if (synced > 0) {
      window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_COMPLETED_EVENT, { detail: { synced, failed } }));
    }
  } finally {
    isSyncing = false;
  }

  return { total: queue.length, synced, failed };
}

// ── Smart Executor (Executes online or auto-queues offline) ──

export interface ExecuteOrQueueParams<T> {
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH";
  data?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  title: string;
  role: "CBAT" | "SIBAT" | "FARMER" | "MAO" | "ADMIN";
  category?: OfflineQueuedItem["category"];
  files?: Array<{ fieldName: string; file: File }>;
  fallbackResult?: T;
}

export async function executeOrQueueOffline<T>({
  endpoint,
  method = "POST",
  data = {},
  headers,
  title,
  role,
  category = "GENERAL",
  files = [],
  fallbackResult,
}: ExecuteOrQueueParams<T>): Promise<T> {
  // 1. If currently offline, skip network request and queue immediately
  if (isOffline()) {
    return handleOfflineQueueFallback({
      endpoint,
      method,
      data,
      title,
      role,
      category,
      files,
      fallbackResult,
    });
  }

  // 2. Try online execution first
  try {
    const res = await api.request({
      url: endpoint,
      method,
      data,
      headers,
    });
    return res.data;
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      console.warn(`[SmartLivestock] Network unreachable for ${endpoint}. Queueing action for offline sync.`);
      return handleOfflineQueueFallback({
        endpoint,
        method,
        data,
        title,
        role,
        category,
        files,
        fallbackResult,
      });
    }
    // Re-throw genuine 4xx / validation errors so the UI can show validation feedback
    throw err;
  }
}

async function handleOfflineQueueFallback<T>({
  endpoint,
  method,
  data,
  title,
  role,
  category,
  files,
  fallbackResult,
}: ExecuteOrQueueParams<T>): Promise<T> {
  let serializablePayload: Record<string, unknown> = {};
  const offlineFiles: OfflineFileItem[] = [];

  // Convert FormData if provided
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    const entries = Array.from(data.entries());
    for (const [k, v] of entries) {
      if (typeof v === "object" && v instanceof File) {
        try {
          const offlineFile = await fileToOfflineFileItem(k, v);
          offlineFiles.push(offlineFile);
        } catch {
          // ignore file conversion error
        }
      } else {
        serializablePayload[k] = v;
      }
    }
  } else if (typeof data === "object" && data !== null) {
    serializablePayload = { ...data };
  }

  // Also convert any explicitly passed files
  if (files && files.length > 0) {
    for (const f of files) {
      try {
        const converted = await fileToOfflineFileItem(f.fieldName, f.file);
        offlineFiles.push(converted);
      } catch {
        // ignore
      }
    }
  }

  enqueueOfflineAction({
    title,
    role,
    category: category || "GENERAL",
    endpoint,
    method: method || "POST",
    payload: serializablePayload,
    files: offlineFiles.length > 0 ? offlineFiles : undefined,
  });

  toast.info(`Offline: "${title}" saved locally`, {
    description: "It will automatically synchronize with MAO as soon as Wi-Fi reconnects.",
    duration: 5000,
  });

  return (fallbackResult ?? ({ success: true, offline: true, id: Date.now() } as unknown as T));
}

// ── Global Online / Offline Event Listeners ──

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const queue = getOfflineQueue();
    if (queue.length > 0) {
      toast.info(`Wi-Fi reconnected. Syncing ${queue.length} field records to MAO…`);
      syncOfflineQueue();
    }
  });
}
