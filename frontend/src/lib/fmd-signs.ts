export const FMD_COMPATIBLE_SIGNS = [
  "Excessive Drooling",
  "Limping / Weak Legs",
  "High Fever / Hot Ears",
  "Not Eating / Off-Feed",
  "Lethargic / Isolated",
];

const FMD_KEYWORD_SIGNS = [
  "drool",
  "saliv",
  "laway",
  "limp",
  "lame",
  "pilay",
  "fever",
  "hot ear",
  "lagnat",
  "mainit",
  "off-feed",
  "not eating",
  "loss of appetite",
  "anorexia",
  "ayaw kumain",
  "walang gana",
  "letharg",
  "matamlay",
  "nanghihina",
  "isolated",
];

export interface FmdEvaluation {
  hasPossibleFmd: boolean;
  isHighSuspicion: boolean;
  matchedSigns: string[];
  indicatorType: "VESICULAR" | "DROOLING_LAMENESS" | "ACUTE_FEVER_LETHARGY" | "KEYWORD" | "NONE";
  summaryTagalog: string;
  summaryEnglish: string;
  checklistToInspect: string[];
}

/**
 * Evaluates whether reported or observed clinical signs present patterns compatible
 * with Foot and Mouth Disease (FMD), ranging from acute systemic onset (fever + lethargy/off-feed)
 * to pathognomonic oral/hoof vesicular lesions.
 */
export function evaluateFmdSigns(signs: string[] | null | undefined): FmdEvaluation {
  if (!signs?.length) {
    return {
      hasPossibleFmd: false,
      isHighSuspicion: false,
      matchedSigns: [],
      indicatorType: "NONE",
      summaryTagalog: "",
      summaryEnglish: "",
      checklistToInspect: [],
    };
  }

  const rawSigns = signs.filter(Boolean);
  const normalized = rawSigns.map((s) => s.trim().toLowerCase());

  // 1. Direct vesicular / blister lesion signs
  const blisterSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return (
      l.includes("blister") ||
      l.includes("vesicle") ||
      l.includes("mouth sore") ||
      l.includes("tongue sore") ||
      l.includes("hoof sore") ||
      l.includes("skin sore") ||
      l.includes("lesion") ||
      l.includes("paltos") ||
      l.includes("sugat") ||
      l.includes("singaw")
    );
  });

  // 2. Functional signs characteristic of FMD lesions
  const droolingSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return l.includes("drool") || l.includes("saliv") || l.includes("laway") || l.includes("bula");
  });

  const limpingSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return l.includes("limp") || l.includes("lame") || l.includes("pilay") || l.includes("weak leg");
  });

  // 3. Acute systemic onset signs
  const feverSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return l.includes("fever") || l.includes("hot ear") || l.includes("lagnat") || l.includes("mainit");
  });

  const lethargicSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return l.includes("letharg") || l.includes("matamlay") || l.includes("nanghihina") || l.includes("isolated");
  });

  const offFeedSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return (
      l.includes("off-feed") ||
      l.includes("not eating") ||
      l.includes("appetite") ||
      l.includes("anorexia") ||
      l.includes("ayaw kumain") ||
      l.includes("walang gana")
    );
  });

  // 4. Explicit FMD keywords
  const explicitKeywordSigns = rawSigns.filter((s) => {
    const l = s.toLowerCase();
    return (
      l.includes("fmd") ||
      l.includes("foot and mouth") ||
      l.includes("foot-and-mouth") ||
      l.includes("aptha")
    );
  });

  const defaultChecklist = [
    "Suriin ang bibig, gilagid, at dila para sa mga sariwang paltos (vesicles) o nagbalat na sugat (erosions).",
    "Suriin ang coronary band at pagitan ng mga kuko (interdigital cleft) sa bawat paa para sa pamumula o sugat.",
    "Obserbahan kung may labis na paglalaway (salivation/drooling) o pag-ngatngat ng labi (lip smacking).",
    "Suriin ang tindig at lakad ng hayop kung may pag-iwas sa pagtayo o malalang pagkapilay.",
  ];

  // Case A: Explicit FMD keyword mentioned
  if (explicitKeywordSigns.length > 0) {
    const matched = Array.from(new Set([...explicitKeywordSigns, ...blisterSigns, ...droolingSigns, ...limpingSigns, ...feverSigns]));
    return {
      hasPossibleFmd: true,
      isHighSuspicion: true,
      matchedSigns: matched,
      indicatorType: "KEYWORD",
      summaryTagalog: "Nabanggit ang Foot and Mouth Disease (FMD) sa ulat. Agarang isagawa ang inspeksyon sa bibig at mga kuko.",
      summaryEnglish: "Foot and Mouth Disease (FMD) is explicitly mentioned in the report. Immediate oral and hoof examination is advised.",
      checklistToInspect: defaultChecklist,
    };
  }

  // Case B: Vesicular lesions present
  if (blisterSigns.length > 0) {
    const matched = Array.from(new Set([...blisterSigns, ...droolingSigns, ...limpingSigns, ...feverSigns, ...lethargicSigns, ...offFeedSigns]));
    const isHighSuspicion = droolingSigns.length > 0 || limpingSigns.length > 0 || feverSigns.length > 0;
    return {
      hasPossibleFmd: true,
      isHighSuspicion,
      matchedSigns: matched,
      indicatorType: "VESICULAR",
      summaryTagalog: "May naitalang mga paltos o sugat (blisters/vesicles). Pangunahing palatandaan ito ng vesicular disease tulad ng FMD.",
      summaryEnglish: "Vesicular sores or blisters reported. This is the primary clinical hallmark of Foot and Mouth Disease.",
      checklistToInspect: defaultChecklist,
    };
  }

  // Case C: Drooling AND/OR Limping (Characteristic clinical signs of mouth/foot lesions)
  if (droolingSigns.length > 0 && (limpingSigns.length > 0 || feverSigns.length > 0 || lethargicSigns.length > 0)) {
    const matched = Array.from(new Set([...droolingSigns, ...limpingSigns, ...feverSigns, ...lethargicSigns, ...offFeedSigns]));
    return {
      hasPossibleFmd: true,
      isHighSuspicion: true,
      matchedSigns: matched,
      indicatorType: "DROOLING_LAMENESS",
      summaryTagalog: "Labis na paglalaway kasama ang lagnat o pagkapilay. Karaniwang dulot ito ng mga paltos sa bibig at dila.",
      summaryEnglish: "Excessive drooling combined with lameness or fever. Characteristic of oral and interdigital vesicular lesions.",
      checklistToInspect: defaultChecklist,
    };
  }

  if (limpingSigns.length > 0 && (feverSigns.length > 0 || offFeedSigns.length > 0)) {
    const matched = Array.from(new Set([...limpingSigns, ...feverSigns, ...offFeedSigns, ...lethargicSigns]));
    return {
      hasPossibleFmd: true,
      isHighSuspicion: false,
      matchedSigns: matched,
      indicatorType: "DROOLING_LAMENESS",
      summaryTagalog: "Pagkapilay na may kasamang lagnat o pagtanggi sa pagkain. Posibleng may sugat o pamamaga sa pagitan ng mga kuko.",
      summaryEnglish: "Lameness combined with fever or off-feed. Inspect the interdigital spaces of hooves for painful vesicular lesions.",
      checklistToInspect: defaultChecklist,
    };
  }

  // Case D: Acute Systemic Onset (e.g. High Fever + Lethargic, High Fever + Off-Feed)
  // In cattle, acute high fever with severe depression/anorexia often precedes visible vesicle rupture.
  if (feverSigns.length > 0 && (lethargicSigns.length > 0 || offFeedSigns.length > 0)) {
    const matched = Array.from(new Set([...feverSigns, ...lethargicSigns, ...offFeedSigns]));
    return {
      hasPossibleFmd: true,
      isHighSuspicion: false,
      matchedSigns: matched,
      indicatorType: "ACUTE_FEVER_LETHARGY",
      summaryTagalog: "Mataas na lagnat at panghihina/walang gana (High Fever + Lethargic). Maagang senyales bago lumabas ang mga paltos ng FMD.",
      summaryEnglish: "High fever combined with lethargy and feed refusal. Acute prodromal phase of FMD before overt vesicles emerge.",
      checklistToInspect: defaultChecklist,
    };
  }

  // If none of the specific FMD combinations matched
  return {
    hasPossibleFmd: false,
    isHighSuspicion: false,
    matchedSigns: [],
    indicatorType: "NONE",
    summaryTagalog: "",
    summaryEnglish: "",
    checklistToInspect: [],
  };
}

/** Flag a possible-FMD pattern for review, without diagnosing the disease. */
export function hasPossibleFmdSigns(signs: string[] | null | undefined): boolean {
  return evaluateFmdSigns(signs).hasPossibleFmd;
}
