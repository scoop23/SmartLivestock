"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Loader2, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import axios from "axios";
import { lookupRegisteredLivestock, RegisteredLivestockLookup } from "./auction-analytics";

export function MovementLivestockQrDialog({
  open,
  onOpenChange,
  onFound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (animal: RegisteredLivestockLookup) => string | null;
}) {
  const [code, setCode] = useState("");
  const [record, setRecord] = useState<RegisteredLivestockLookup | null>(null);
  const [error, setError] = useState("");
  const [addError, setAddError] = useState("");
  const [searching, setSearching] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const eligible = record?.registration_status === "APPROVED" && record.operational_status === "ACTIVE";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCameraOn(false);
      setRecord(null);
      setCode("");
      setError("");
      setAddError("");
    }
    onOpenChange(nextOpen);
  };

  const lookupCode = async (value: string) => {
    if (!value.trim()) return;
    setSearching(true);
    setError("");
    setAddError("");
    setRecord(null);
    try {
      setRecord(await lookupRegisteredLivestock(value.trim()));
    } catch (cause: unknown) {
      const data = axios.isAxiosError(cause) ? cause.response?.data as { detail?: string } | undefined : undefined;
      setError(data?.detail || "Livestock record not found. Check the QR or tag and try again.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let running = true;
    let frame = 0;
    if (open && cameraOn) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
        .then((media) => {
          stream = media;
          if (videoRef.current) {
            videoRef.current.srcObject = media;
            void videoRef.current.play();
          }
          const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
          if (!Detector) {
            setError("QR camera decoding is not supported by this browser. Use a handheld scanner or type the tag below.");
            return;
          }
          const detector = new Detector({ formats: ["qr_code"] });
          const scan = async () => {
            if (!running) return;
            const video = videoRef.current;
            if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              try {
                const result = await detector.detect(video);
                if (result[0]?.rawValue) {
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
        .catch(() => setError("Camera access is unavailable. You can still scan with a handheld reader or enter the tag."));
    }
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, cameraOn]);

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
              <Button type="button" variant="outline" onClick={() => setCameraOn((active) => !active)} className="h-11 flex-1 gap-1.5 sm:flex-none"><Camera className="size-4" />{cameraOn ? "Stop" : "Camera"}</Button>
              <Button type="button" onClick={() => void lookupCode(code)} disabled={!code.trim() || searching} className="h-11 flex-1 gap-1.5 bg-violet-700 hover:bg-violet-800 sm:flex-none">{searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Lookup</Button>
            </div>
          </div>
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
          {record && <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase text-slate-500">Registered livestock found</p><h3 className="mt-1 text-lg font-black text-slate-900">{record.tag_number || `#${record.id}`}</h3></div><Badge className={eligible ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}>{eligible ? "Eligible to add" : "Cannot add"}</Badge></div>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Species / breed</dt><dd className="font-semibold text-slate-900">{record.livestock_type_name}{record.breed ? ` · ${record.breed}` : ""}</dd></div>
              <div><dt className="text-xs text-slate-500">Owner</dt><dd className="font-semibold text-slate-900">{record.owner_name}</dd></div>
              <div><dt className="text-xs text-slate-500">Barangay / origin</dt><dd className="font-semibold text-slate-900">{record.barangay || record.origin || "Not recorded"}</dd></div>
              <div><dt className="text-xs text-slate-500">Registry / operational status</dt><dd className="font-semibold text-slate-900">{record.registration_status} · {record.operational_status}</dd></div>
            </dl>
            {!eligible && <p className="mt-3 text-xs leading-5 text-amber-900">Only approved, active registered livestock can be linked. If this animal is genuinely outside the registry, encode it through Add External Livestock.</p>}
            {addError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">{addError}</p>}
            <Button type="button" disabled={!eligible} onClick={() => { const failure = onFound(record); if (failure) setAddError(failure); else onOpenChange(false); }} className="mt-4 min-h-11 w-full bg-violet-700 text-white hover:bg-violet-800">Add to Movement Log</Button>
          </section>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
