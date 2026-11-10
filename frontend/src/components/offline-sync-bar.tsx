"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getOfflineQueue,
  isOffline,
  OFFLINE_QUEUE_UPDATED_EVENT,
  OFFLINE_SYNC_COMPLETED_EVENT,
  OfflineQueuedItem,
  removeOfflineAction,
  syncOfflineQueue,
} from "@/lib/offline-sync-queue";
import {
  Activity,
  CheckCircle2,
  Clock,
  CloudOff,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

export function OfflineSyncBar() {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<OfflineQueuedItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    setQueue(getOfflineQueue());

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Online connection restored!");
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are currently in offline mode. Field records will queue locally.");
    };

    const handleQueueUpdate = () => {
      setQueue(getOfflineQueue());
    };

    const handleSyncComplete = () => {
      setQueue(getOfflineQueue());
      setIsSyncing(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdate);
    window.addEventListener(OFFLINE_SYNC_COMPLETED_EVENT, handleSyncComplete);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdate);
      window.removeEventListener(OFFLINE_SYNC_COMPLETED_EVENT, handleSyncComplete);
    };
  }, []);

  const handleSync = async () => {
    if (queue.length === 0 || !navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineQueue();
      if (res.synced > 0) {
        toast.success(`Synchronized ${res.synced} offline record(s) to MAO!`);
      }
    } finally {
      setIsSyncing(false);
      setQueue(getOfflineQueue());
    }
  };

  const handleRemove = (id: string) => {
    removeOfflineAction(id);
    setQueue(getOfflineQueue());
    toast.info("Queued record removed.");
  };

  // Only display if offline OR if there are pending queued actions
  if (isOnline && queue.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Status Pill */}
      <div className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 text-white shadow-xl backdrop-blur-md text-xs font-semibold"
        >
          {!isOnline ? (
            <div className="flex items-center gap-1.5 text-amber-400">
              <WifiOff className="size-3.5 animate-pulse" />
              <span>Offline Mode</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Wifi className="size-3.5" />
              <span>Online</span>
            </div>
          )}

          <div className="h-3.5 w-px bg-slate-700" />

          {queue.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
            >
              {queue.length} record{queue.length === 1 ? "" : "s"} in outbox
            </button>
          ) : (
            <span className="text-slate-400">Changes queue locally</span>
          )}

          {isOnline && queue.length > 0 && (
            <Button
              type="button"
              size="sm"
              disabled={isSyncing}
              onClick={handleSync}
              className="h-6 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-xs cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing…" : "Sync"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Outbox Records Inspection Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock className="size-4" />
              </div>
              <DialogTitle className="text-base font-bold text-white">
                Offline Field Outbox ({queue.length})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              These records were recorded while working offline in the field. They will automatically sync to the Municipal Agriculture Office once connection is restored.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto py-2 pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-100">{item.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300">
                      {item.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Endpoint: {item.endpoint}
                  </p>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Recorded: {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="size-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Discard record"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDetailsOpen(false)}
              className="flex-1 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold h-9"
            >
              Close
            </Button>

            {isOnline && (
              <Button
                type="button"
                disabled={isSyncing || queue.length === 0}
                onClick={() => {
                  handleSync();
                  setIsDetailsOpen(false);
                }}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync All Now</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
