"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Loader2, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LivestockIdentityResult } from "@/components/livestock-identity-result";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import axios from "axios";
import { lookupRegisteredLivestock, RegisteredLivestockLookup } from "./auction-analytics";

export function MovementLivestockQrDialog({
  open,
  onOpenChange,
  onFound,
  actionLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (animal: RegisteredLivestockLookup) => string | null | Promise<string | null>;
  actionLabel?: string;
}) {
  // QR supplies an identifier only. Decoding is followed by the same authenticated
  // lookup used by text search, then an officer explicitly adds the returned record.
  const [code, setCode] = useState("");
  const [record, setRecord] = useState<RegisteredLivestockLookup | null>(null);
  const [error, setError] = useState("");
  const [addError, setAddError] = useState("");
  const [searching, setSearching] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestId.current += 1;
      setSearching(false);
      setCameraOn(false);
      setRecord(null);
      setCode("");
      setError("");
      setAddError("");
    }
    onOpenChange(nextOpen);
  };

  const lookupCode = useCallback(async (value: string) => {
    if (!value.trim()) return;
    const currentRequest = ++requestId.current;
    setSearching(true);
    setError("");
    setAddError("");
    setRecord(null);
    try {
      const animal = await lookupRegisteredLivestock(value.trim());
      if (currentRequest === requestId.current) setRecord(animal);
    } catch (cause: unknown) {
      const data = axios.isAxiosError(cause) ? cause.response?.data as { detail?: string } | undefined : undefined;
      if (currentRequest === requestId.current) setError(data?.detail || "Livestock record not found. Check the QR or tag and try again.");
    } finally {
      if (currentRequest === requestId.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let running = true;
    let frame = 0;
    if (open && cameraOn) {
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (!navigator.mediaDevices?.getUserMedia || !Detector) return;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((media) => {
          if (!running) {
            media.getTracks().forEach((track) => track.stop());
            return;
          }
          stream = media;
          if (videoRef.current) {
            videoRef.current.srcObject = media;
            void videoRef.current.play();
          }
          const detector = new Detector({ formats: ["qr_code"] });
          const scan = async () => {
            if (!running) return;
            const video = videoRef.current;
            if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              try {
                const result = await detector.detect(video);
                if (running && result[0]?.rawValue) {
                  running = false;
                  setCode(result[0].rawValue);
                  setCameraOn(false);
                  void lookupCode(result[0].rawValue);
                  return;
                }
              } catch { /* Continue while the camera adjusts focus. */ }
            }
            frame = requestAnimationFrame(scan);
          };
          frame = requestAnimationFrame(scan);
        })
        .catch(() => {
          if (running) {
            setError("Camera access is unavailable. Use a handheld reader or enter the tag.");
            setCameraOn(false);
          }
        });
    }
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, cameraOn, lookupCode]);

  const toggleCamera = () => {
    if (cameraOn) { setCameraOn(false); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Use a handheld reader or enter the tag.");
      return;
    }
    if (!(window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector) {
      setError("QR camera decoding is not supported by this browser. Use a handheld scanner or type the tag below.");
      return;
    }
    setError("");
    setCameraOn(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="size-5 text-violet-700" /> Scan registered livestock</DialogTitle>
          <DialogDescription>Scan or enter a livestock identifier. SmartLivestock checks the current registry record; the QR does not approve a movement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {cameraOn && <div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} playsInline muted className="max-h-56 w-full object-cover" /></div>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void lookupCode(code); } }} placeholder="QR payload, tag, or inventory ID" className="h-11 min-w-0 flex-1" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={toggleCamera} className="h-11 flex-1 gap-1.5 sm:flex-none"><Camera className="size-4" />{cameraOn ? "Stop" : "Camera"}</Button>
              <Button type="button" onClick={() => void lookupCode(code)} disabled={!code.trim() || searching} className="h-11 flex-1 gap-1.5 bg-violet-700 hover:bg-violet-800 sm:flex-none">{searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Lookup</Button>
            </div>
          </div>
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
          {record && <LivestockIdentityResult record={record} error={addError} actionLabel={actionLabel} onAdd={() => {
            if (!record.eligible) return;
            void Promise.resolve(onFound(record)).then((failure) => {
              if (failure) setAddError(failure);
              else handleOpenChange(false);
            }).catch(() => setAddError("Could not save this gate verification. Try again."));
          }} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
