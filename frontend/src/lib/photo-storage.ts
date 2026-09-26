/**
 * Photo Storage Utility for SmartLivestock
 * Manages photo attachments for farmer observation reports and SIBAT field inspections.
 */

export interface AttachedPhotoData {
  photoUrl: string;
  photoName: string;
  timestamp?: string;
  uploaderRole?: "FARMER" | "SIBAT";
  uploaderName?: string;
}

/**
 * Curated authentic on-farm livestock photos utility.
 * Dummy stock photos have been removed so the UI strictly shows real farmer-submitted or inspector photos.
 */
export function getDefaultLivestockPhoto(
  _livestockType?: string,
  _conditionName?: string,
  _seedId?: string
): { photoUrl: string; photoName: string } {
  return {
    photoUrl: "",
    photoName: "",
  };
}

/**
 * Persists an attached photo to client local storage.
 */
export function saveAttachedPhoto(key: string, data: AttachedPhotoData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`smartlivestock_photo_${key}`, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to persist attached photo:", err);
  }
}

/**
 * Retrieves the photo attached to a record.
 * Only returns a photo if the farmer or SIBAT actually uploaded one.
 * Never returns fake/dummy fallback images.
 */
export function getAttachedPhoto(
  recordId?: string,
  livestockTag?: string,
  _livestockType?: string,
  _conditionName?: string
): { photoUrl: string; photoName: string; isFarmerUpload: boolean } {
  if (typeof window !== "undefined") {
    try {
      const keysToTry = [
        recordId ? `smartlivestock_photo_${recordId}` : null,
        livestockTag ? `smartlivestock_photo_tag_${livestockTag}` : null,
      ].filter(Boolean) as string[];

      for (const k of keysToTry) {
        const stored = localStorage.getItem(k);
        if (stored) {
          const parsed = JSON.parse(stored) as AttachedPhotoData;
          if (parsed?.photoUrl && parsed.photoUrl.trim() !== "") {
            return {
              photoUrl: parsed.photoUrl,
              photoName: parsed.photoName || "farmer_attached_evidence.jpg",
              isFarmerUpload: true,
            };
          }
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve attached photo:", err);
    }
  }

  // No dummy fallback photos: return blank so UI renders real state
  return {
    photoUrl: "",
    photoName: "",
    isFarmerUpload: false,
  };
}
