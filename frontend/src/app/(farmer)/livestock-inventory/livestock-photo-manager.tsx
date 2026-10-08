"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIVESTOCK_AVATAR_PRESETS, getAvatarById, type LivestockAvatarOption } from "./livestock-inventory";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type LivestockPhotoChange = {
  file: File | null;
  removePhoto: boolean;
  avatarKey?: string;
};

export function LivestockPhotoManager({
  title,
  subject,
  currentPhotoUrl,
  currentAvatarKey,
  species,
  fallback,
  allowAvatar = true,
  compactOnMobile = false,
  onSave,
}: {
  title: string;
  subject: string;
  currentPhotoUrl?: string | null;
  currentAvatarKey?: string | null;
  species?: string;
  fallback: ReactNode;
  allowAvatar?: boolean;
  compactOnMobile?: boolean;
  onSave: (change: LivestockPhotoChange) => Promise<void>;
}) {
  const defaultAvatar = getAvatarById(null, species);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [avatarKey, setAvatarKey] = useState(currentAvatarKey || defaultAvatar.id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  const avatarOptions: LivestockAvatarOption[] = LIVESTOCK_AVATAR_PRESETS.filter(
    (option) => !species || option.species.toLowerCase() === species.toLowerCase(),
  );
  const selectedAvatar = getAvatarById(avatarKey, species);
  const displayedPhoto = previewUrl || (!removePhoto ? currentPhotoUrl : null);
  const avatarChanged = allowAvatar && avatarKey !== (currentAvatarKey || defaultAvatar.id);
  const hasChanges = Boolean(file || removePhoto || avatarChanged);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function resetAndClose() {
    setFile(null);
    setRemovePhoto(false);
    setAvatarKey(currentAvatarKey || defaultAvatar.id);
    setError("");
    setOpen(false);
  }

  async function save() {
    if (!hasChanges || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        file,
        removePhoto,
        ...(avatarChanged ? { avatarKey } : {}),
      });
      resetAndClose();
    } catch {
      setError("The photo could not be saved. Your current saved image is still in place; please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title={`Change ${subject} photo`}
        aria-label={`Change ${subject} photo`}
        className={`min-h-11 rounded-xl border-emerald-200 bg-white/10 text-white hover:bg-white/20 ${compactOnMobile ? "min-w-11 px-0 sm:min-h-10 sm:min-w-0 sm:px-3" : ""}`}
      >
        <Camera className={`${compactOnMobile ? "size-5 sm:mr-2 sm:size-4" : "mr-2 size-4"}`} />
        <span className={compactOnMobile ? "hidden sm:inline" : ""}>Change {subject} photo</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : resetAndClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Upload a JPEG, PNG, or WebP image up to 5 MB. The current saved photo stays in place until the new one is accepted.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex min-h-52 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {displayedPhoto ? (
                <img src={displayedPhoto} alt={`${subject} photo preview`} className="max-h-64 max-w-full rounded-xl object-contain" />
              ) : allowAvatar && avatarKey ? (
                <div className={`flex size-36 items-center justify-center rounded-2xl border-2 bg-gradient-to-br text-6xl ${selectedAvatar.bgGradient}`} aria-label={`${selectedAvatar.name} fallback`}>
                  {selectedAvatar.emoji}
                </div>
              ) : fallback}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`livestock-photo-${subject.replaceAll(" ", "-")}`}>Choose image</Label>
              <Input
                id={`livestock-photo-${subject.replaceAll(" ", "-")}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const nextFile = event.currentTarget.files?.[0] || null;
                  setError("");
                  if (!nextFile) return;
                  if (!ALLOWED_PHOTO_TYPES.has(nextFile.type)) {
                    setError("Choose a JPEG, PNG, or WebP image.");
                    event.currentTarget.value = "";
                    return;
                  }
                  if (nextFile.size <= 0 || nextFile.size > MAX_PHOTO_BYTES) {
                    setError("Choose a non-empty image that is 5 MB or smaller.");
                    event.currentTarget.value = "";
                    return;
                  }
                  setFile(nextFile);
                  setRemovePhoto(false);
                }}
              />
            </div>
            {allowAvatar && avatarOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor={`livestock-avatar-${subject.replaceAll(" ", "-")}`}>Fallback avatar</Label>
                <Select value={avatarKey} onValueChange={setAvatarKey}>
                  <SelectTrigger id={`livestock-avatar-${subject.replaceAll(" ", "-")}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {avatarOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.emoji} {option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">The avatar appears whenever no photo is saved.</p>
              </div>
            )}
            {currentPhotoUrl && !removePhoto && (
              <Button type="button" variant="ghost" onClick={() => { setFile(null); setRemovePhoto(true); }} className="text-rose-700 hover:text-rose-800">
                <Trash2 className="mr-2 size-4" /> {allowAvatar ? "Use avatar instead" : "Remove herd photo"}
              </Button>
            )}
            {error && <p role="alert" className="text-sm font-medium text-rose-700">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={save} disabled={!hasChanges || saving} className="bg-emerald-700 text-white hover:bg-emerald-800">
              <ImagePlus className="mr-2 size-4" /> {saving ? "Saving…" : "Save photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
