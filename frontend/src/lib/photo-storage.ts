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
 * Curated authentic on-farm livestock photos based on animal species and condition.
 */
export function getDefaultLivestockPhoto(
  livestockType?: string,
  conditionName?: string,
  _seedId?: string
): { photoUrl: string; photoName: string } {
  const type = (livestockType || "").toLowerCase();
  const cond = (conditionName || "").toLowerCase();

  // Carabao / Water Buffalo
  if (type.includes("carabao") || type.includes("buffalo")) {
    return {
      photoUrl: "https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=1000&auto=format&fit=crop",
      photoName: "carabao_pasture_observation.jpg",
    };
  }

  // Swine / Pigs
  if (type.includes("swine") || type.includes("pig") || type.includes("hog")) {
    return {
      photoUrl: "https://images.unsplash.com/photo-1516467508483-a7212febe31a?q=80&w=1000&auto=format&fit=crop",
      photoName: "swine_pen_evidence_photo.jpg",
    };
  }

  // Goats & Sheep
  if (type.includes("goat") || type.includes("caprine") || type.includes("sheep")) {
    return {
      photoUrl: "https://images.unsplash.com/photo-1527159347948-59af1feee74c?q=80&w=1000&auto=format&fit=crop",
      photoName: "goat_herd_symptom_photo.jpg",
    };
  }

  // Poultry / Chicken / Duck
  if (type.includes("poultry") || type.includes("chicken") || type.includes("avian") || type.includes("bird") || type.includes("duck")) {
    return {
      photoUrl: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?q=80&w=1000&auto=format&fit=crop",
      photoName: "poultry_coop_inspection.jpg",
    };
  }

  // Cattle (specific condition categories)
  if (cond.includes("fever") || cond.includes("cough") || cond.includes("respiratory") || cond.includes("lethargic") || cond.includes("not eating")) {
    return {
      photoUrl: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?q=80&w=1000&auto=format&fit=crop",
      photoName: "bovine_respiratory_symptom_evidence.jpg",
    };
  }

  if (cond.includes("hoof") || cond.includes("limp") || cond.includes("foot") || cond.includes("wound") || cond.includes("mouth")) {
    return {
      photoUrl: "https://images.unsplash.com/photo-1546445317-29f4545e9d53?q=80&w=1000&auto=format&fit=crop",
      photoName: "cattle_hoof_mobility_examination.jpg",
    };
  }

  // General healthy/observation cattle
  return {
    photoUrl: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?q=80&w=1000&auto=format&fit=crop",
    photoName: "cattle_onfarm_alert_evidence.jpg",
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
 * Retrieves the photo attached to a record, either farmer-uploaded or authentic fallback.
 */
export function getAttachedPhoto(
  recordId?: string,
  livestockTag?: string,
  livestockType?: string,
  conditionName?: string
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
          if (parsed?.photoUrl) {
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

  // Return realistic fallback photo for this animal species & clinical condition
  const fallback = getDefaultLivestockPhoto(livestockType, conditionName, recordId);
  return {
    ...fallback,
    isFarmerUpload: false,
  };
}
