export type MortalityCategoryValue =
  | "SUSPECTED_INFECTIOUS"
  | "INJURY_ACCIDENT"
  | "REPRODUCTIVE_PERINATAL"
  | "OTHER_REPORTED_CAUSE"
  | "UNDETERMINED";

export interface MortalityClassificationEvaluation {
  category: MortalityCategoryValue;
  label: string;
  matchedClues: string[];
  explanation: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export const MORTALITY_CATEGORY_LABELS: Record<MortalityCategoryValue, string> = {
  SUSPECTED_INFECTIOUS: "Suspected infectious",
  INJURY_ACCIDENT: "Injury or accident",
  REPRODUCTIVE_PERINATAL: "Reproductive or perinatal",
  OTHER_REPORTED_CAUSE: "Other reported cause",
  UNDETERMINED: "Undetermined",
};

const INFECTIOUS_KEYWORDS = [
  "lagnat", "fever", "mainit", "hot", "sipon", "cough", "ubo",
  "asf", "swine fever", "cholera", "tae", "diarrhea", "dugo", "bloody",
  "infectious", "contagious", "virus", "bacterial", "septicemia", "peste",
  "pulmonya", "pneumonia", "nangisay", "convulsion", "shivering", "nanginginig",
  "nangitim", "purple", "cyanosis", "drool", "laway", "saliva", "blister",
  "sores", "singaw", "lethargic", "matamlay",
];

const ACCIDENT_KEYWORDS = [
  "nahulog", "fall", "fell", "kanal", "ditch", "bangin", "creek",
  "nabali", "broken", "fracture", "naipit", "trapped", "bakod", "fence",
  "strangled", "nasakal", "tali", "rope", "nabangga", "hit", "struck",
  "kidlat", "lightning", "trauma", "kagat", "snake", "ahas", "bitten",
  "accident", "aksidente", "leeg", "drowned", "nalunod", "suffocat",
];

const REPRODUCTIVE_KEYWORDS = [
  "nanganak", "giving birth", "gave birth", "calving", "farrowing",
  "prolapse", "matris", "labas matris", "stillborn", "patay na nung nilabas",
  "weak calf", "biik", "premature", "dystocia", "nahirapan manganak",
  "placenta", "cord", "perinatal", "fetus", "buntis", "labor",
];

const OTHER_CAUSE_KEYWORDS = [
  "bloat", "kabag", "namaga tyan", "lason", "poison", "nakakain",
  "plastic", "tuka", "heat stroke", "sobrang init", "bilad",
  "starvation", "gutom", "dehydration", "uhaw", "tanda", "old age",
];

function sanitizeString(val: unknown): string {
  if (typeof val === "string") return val.trim();
  if (val && typeof val === "object" && "label" in val) {
    return String((val as { label: unknown }).label || "").trim();
  }
  return "";
}

/**
 * Syndromic Decision Tree evaluation for animal mortalities.
 * Evaluates CBAT-verified inspection signs and farmer narrative text safely.
 */
export function evaluateMortalityCategory(input?: {
  details?: string;
  cause?: string;
  conditionName?: string;
  symptoms?: unknown[];
  confirmedSymptoms?: unknown[];
} | null): MortalityClassificationEvaluation {
  if (!input) {
    return {
      category: "UNDETERMINED",
      label: MORTALITY_CATEGORY_LABELS.UNDETERMINED,
      matchedClues: ["No input recorded"],
      explanation: "No symptoms or cause details available.",
      confidence: "LOW",
    };
  }

  const allTexts = [
    sanitizeString(input.cause),
    sanitizeString(input.details),
    sanitizeString(input.conditionName),
    ...((Array.isArray(input.symptoms) ? input.symptoms : []).map(sanitizeString)),
  ]
    .join(" ")
    .toLowerCase();

  const confirmed = (Array.isArray(input.confirmedSymptoms) ? input.confirmedSymptoms : [])
    .map(sanitizeString)
    .filter(Boolean);

  // 1. Check for Suspected Infectious
  const infectiousSignsFound: string[] = [];
  if (confirmed.some((s) => /fever|hot ear/i.test(s))) infectiousSignsFound.push("High Fever / Hot Ears");
  if (confirmed.some((s) => /cough|runny nose/i.test(s))) infectiousSignsFound.push("Coughing / Runny Nose");
  if (confirmed.some((s) => /drool|saliva/i.test(s))) infectiousSignsFound.push("Excessive Drooling");
  if (confirmed.some((s) => /sores|blisters|lesion/i.test(s))) infectiousSignsFound.push("Skin Sores / Blisters");

  const infectiousKeywordsMatched = INFECTIOUS_KEYWORDS.filter((kw) => allTexts.includes(kw));

  if (infectiousSignsFound.length > 0 || infectiousKeywordsMatched.length >= 2) {
    const clues = [...infectiousSignsFound, ...infectiousKeywordsMatched.slice(0, 3).map((w) => `matched '${w}'`)];
    return {
      category: "SUSPECTED_INFECTIOUS",
      label: MORTALITY_CATEGORY_LABELS.SUSPECTED_INFECTIOUS,
      matchedClues: clues,
      explanation: `Clinical indicators indicate potential infectious etiology (${clues.join(", ")}).`,
      confidence: infectiousSignsFound.length > 0 && infectiousKeywordsMatched.length > 0 ? "HIGH" : "MEDIUM",
    };
  }

  // 2. Check for Reproductive / Perinatal
  const reproKeywordsMatched = REPRODUCTIVE_KEYWORDS.filter((kw) => allTexts.includes(kw));
  if (reproKeywordsMatched.length > 0) {
    const clues = reproKeywordsMatched.slice(0, 3).map((w) => `matched '${w}'`);
    return {
      category: "REPRODUCTIVE_PERINATAL",
      label: MORTALITY_CATEGORY_LABELS.REPRODUCTIVE_PERINATAL,
      matchedClues: clues,
      explanation: `Maternal or perinatal complication detected (${clues.join(", ")}).`,
      confidence: reproKeywordsMatched.length >= 2 ? "HIGH" : "MEDIUM",
    };
  }

  // 3. Check for Injury / Accident
  const accidentKeywordsMatched = ACCIDENT_KEYWORDS.filter((kw) => allTexts.includes(kw));
  const hasLimping = confirmed.some((s) => /limp|weak leg/i.test(s));
  if (hasLimping && !infectiousSignsFound.length) {
    accidentKeywordsMatched.push("Limping / Weak Legs (physical trauma)");
  }

  if (accidentKeywordsMatched.length > 0) {
    const clues = accidentKeywordsMatched.slice(0, 3).map((w) => (w.includes("(") ? w : `matched '${w}'`));
    return {
      category: "INJURY_ACCIDENT",
      label: MORTALITY_CATEGORY_LABELS.INJURY_ACCIDENT,
      matchedClues: clues,
      explanation: `Physical injury or accidental event detected (${clues.join(", ")}).`,
      confidence: accidentKeywordsMatched.length >= 2 ? "HIGH" : "MEDIUM",
    };
  }

  // 4. Check for Other Reported Cause (Bloat, Heat Stroke, Poisoning)
  const otherKeywordsMatched = OTHER_CAUSE_KEYWORDS.filter((kw) => allTexts.includes(kw));
  const hasBloat = confirmed.some((s) => /bloat/i.test(s));
  if (hasBloat) {
    otherKeywordsMatched.push("Bloated Belly (non-febrile)");
  }

  if (otherKeywordsMatched.length > 0) {
    const clues = otherKeywordsMatched.slice(0, 3).map((w) => (w.includes("(") ? w : `matched '${w}'`));
    return {
      category: "OTHER_REPORTED_CAUSE",
      label: MORTALITY_CATEGORY_LABELS.OTHER_REPORTED_CAUSE,
      matchedClues: clues,
      explanation: `Non-infectious physiological or environmental cause (${clues.join(", ")}).`,
      confidence: "MEDIUM",
    };
  }

  // 5. If single infectious keyword was present without confirmed signs
  if (infectiousKeywordsMatched.length === 1) {
    const clue = `matched '${infectiousKeywordsMatched[0]}'`;
    return {
      category: "SUSPECTED_INFECTIOUS",
      label: MORTALITY_CATEGORY_LABELS.SUSPECTED_INFECTIOUS,
      matchedClues: [clue],
      explanation: `Possible infectious sign reported (${clue}). Verification recommended.`,
      confidence: "LOW",
    };
  }

  // 6. Default Undetermined
  return {
    category: "UNDETERMINED",
    label: MORTALITY_CATEGORY_LABELS.UNDETERMINED,
    matchedClues: ["No definitive syndromic signs recorded"],
    explanation: "Insufficient specific symptoms to suggest an infectious or traumatic cause.",
    confidence: "LOW",
  };
}
