/**
 * Haversine Epidemic Spread & Wind-Drift Simulation Model (V2 - Gods-Eye View)
 * SmartLivestock-Batangas — Municipal Agriculture Office (MAO)
 * 
 * ============================================================================
 * EPIDEMIOLOGICAL METHODOLOGY NOTE:
 * ============================================================================
 * Mathematical formulation per Capstone Requirement 4:
 * 
 * For each target barangay j at month t:
 *   Infected_Contact_j = SUM_{i != j} [ infected_i(t) * exp(-d_ij / L_contact) ]
 *   Wind_Drift_j = SUM_{i != j} [ infected_i(t) * (W_t / 15) * max(0, cos(bearing_ij - windTo_t)) * exp(-d_ij / L_wind) ]
 *   Pressure_j(t) = (Infected_Contact_j + Wind_Drift_j) * PopDensity_j
 *   PopDensity_j = cloven-hoofed heads (cattle, carabao, goat, swine, sheep) / barangay area km2.
 * 
 * - Normalized pressure: 0 to 1 across barangays for coloring and alert tiering.
 * - Infection progression: infected_j(t+1) updates when normalized pressure crosses threshold.
 * - Environmental wind: Mean monthly wind speed & vector direction from Open-Meteo
 *   archive API with vector averaging (u,v components) and static offline fallback.
 */

import {
  BarangayGISData,
  EnvironmentalWindInput,
  MonthlySimulationResult,
  MonthlyWindData,
  SimulatedBarangayState,
  SimulationParameters,
  TimelineMonth,
} from './types';

// Official geodesic areas (km²) calculated from polygon coordinates in padre-garcia-barangays.json
export const BARANGAY_AREAS_KM2: Record<string, number> = {
  Banaba: 0.39,
  Banaybanay: 2.48,
  Bawi: 2.93,
  Bukal: 2.93,
  Castillo: 3.61,
  Cawongan: 1.84,
  Manggas: 1.63,
  'Maugat East': 2.44,
  'Maugat West': 3.00,
  Pansol: 1.46,
  Payapa: 2.68,
  Poblacion: 0.77,
  'Quilo-quilo North': 3.94,
  'Quilo-quilo South': 3.83,
  'San Felipe': 2.94,
  'San Miguel': 2.77,
  Tamak: 1.84,
  Tangob: 1.34,
};

// Full 12-Month Simulation Timeline (2026)
export const TIMELINE_MONTHS: TimelineMonth[] = [
  { index: 0, monthName: 'January', label: 'Jan 2026', year: 2026 },
  { index: 1, monthName: 'February', label: 'Feb 2026', year: 2026 },
  { index: 2, monthName: 'March', label: 'Mar 2026', year: 2026 },
  { index: 3, monthName: 'April', label: 'Apr 2026', year: 2026 },
  { index: 4, monthName: 'May', label: 'May 2026', year: 2026 },
  { index: 5, monthName: 'June', label: 'Jun 2026', year: 2026 },
  { index: 6, monthName: 'July', label: 'Jul 2026', year: 2026 },
  { index: 7, monthName: 'August', label: 'Aug 2026', year: 2026 },
  { index: 8, monthName: 'September', label: 'Sep 2026', year: 2026 },
  { index: 9, monthName: 'October', label: 'Oct 2026', year: 2026 },
  { index: 10, monthName: 'November', label: 'Nov 2026', year: 2026 },
  { index: 11, monthName: 'December', label: 'Dec 2026', year: 2026 },
];

/**
 * Converts meteorological heading degrees (0-360) into compass cardinal string
 */
export function degreesToCardinal(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

// Static Monthly Wind Baseline for Padre Garcia (13.88N, 121.22E)
// Pre-calculated from Open-Meteo archive using vector (u, v) component averaging.
// Direction indicates "blowing toward" (windTo).
export const STATIC_MONTHLY_WIND: MonthlyWindData[] = [
  { month: 1, monthName: 'January', speedKmH: 18.1, windToDegrees: 247.9, cardinal: 'WSW' },
  { month: 2, monthName: 'February', speedKmH: 21.4, windToDegrees: 266.8, cardinal: 'W' },
  { month: 3, monthName: 'March', speedKmH: 19.0, windToDegrees: 274.0, cardinal: 'W' },
  { month: 4, monthName: 'April', speedKmH: 19.7, windToDegrees: 285.1, cardinal: 'WNW' },
  { month: 5, monthName: 'May', speedKmH: 18.2, windToDegrees: 284.1, cardinal: 'WNW' },
  { month: 6, monthName: 'June', speedKmH: 13.1, windToDegrees: 290.3, cardinal: 'WNW' },
  { month: 7, monthName: 'July', speedKmH: 17.2, windToDegrees: 309.9, cardinal: 'NW' },
  { month: 8, monthName: 'August', speedKmH: 14.9, windToDegrees: 98.2, cardinal: 'E' },
  { month: 9, monthName: 'September', speedKmH: 18.2, windToDegrees: 83.6, cardinal: 'E' },
  { month: 10, monthName: 'October', speedKmH: 17.2, windToDegrees: 99.7, cardinal: 'E' },
  { month: 11, monthName: 'November', speedKmH: 15.7, windToDegrees: 240.7, cardinal: 'WSW' },
  { month: 12, monthName: 'December', speedKmH: 17.2, windToDegrees: 248.9, cardinal: 'WSW' },
];

export const DEFAULT_PAGASA_WIND: EnvironmentalWindInput = {
  speedKmH: 17.2,
  directionDegrees: 285.1,
  cardinalDirection: 'ESE → WNW',
  sourceAttribution: 'Open-Meteo & PAGASA Batangas Climatology',
};

export const DEFAULT_SIMULATION_PARAMETERS: SimulationParameters = {
  L_contact: 3.5, // 3.5 km transmission distance
  L_wind: 5.0,    // 5.0 km aerosol drift distance
  threshold: 0.35, // 0.35 normalized pressure threshold to spread
};

/**
 * Calculates great-circle distance between two coordinates using the Haversine formula (km)
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates forward azimuth / compass bearing from coordinate 1 to coordinate 2 (0 - 360 deg)
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Fetches monthly wind speed and direction for Padre Garcia from Open-Meteo Archive API.
 * Converts "from" meteorological direction to "toward" direction: (dir + 180) % 360.
 * Averages directions using vector (u, v) components instead of raw arithmetic mean.
 * Caches in localStorage; falls back to STATIC_MONTHLY_WIND on failure.
 */
export async function fetchPadreGarciaMonthlyWind(): Promise<MonthlyWindData[]> {
  const CACHE_KEY = 'smartlivestock_padre_garcia_wind_v2';
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length === 12) {
          return parsed;
        }
      }
    } catch {}
  }

  try {
    const url =
      'https://archive-api.open-meteo.com/v1/archive?latitude=13.88&longitude=121.22&start_date=2024-01-01&end_date=2024-12-31&daily=wind_speed_10m_max,wind_direction_10m_dominant';
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Open-Meteo responded with status ${res.status}`);
    const json = await res.json();

    const months = Array.from({ length: 12 }, () => ({
      sumX: 0,
      sumY: 0,
      sumSpeed: 0,
      count: 0,
    }));

    const times: string[] = json.daily?.time || [];
    const speeds: number[] = json.daily?.wind_speed_10m_max || [];
    const directions: number[] = json.daily?.wind_direction_10m_dominant || [];

    times.forEach((t, i) => {
      const monthIdx = parseInt(t.split('-')[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        const speed = speeds[i] || 0;
        const dirFrom = directions[i] || 0;
        // Met direction is "from" -> convert to "toward"
        const dirTo = (dirFrom + 180) % 360;
        const radTo = (dirTo * Math.PI) / 180;
        // Vector components (East = x, North = y)
        months[monthIdx].sumX += speed * Math.sin(radTo);
        months[monthIdx].sumY += speed * Math.cos(radTo);
        months[monthIdx].sumSpeed += speed;
        months[monthIdx].count += 1;
      }
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const result: MonthlyWindData[] = months.map((m, idx) => {
      const count = m.count || 1;
      const meanX = m.sumX / count;
      const meanY = m.sumY / count;
      const meanSpeed = Number((m.sumSpeed / count).toFixed(1));
      const meanDirTo = Number((((Math.atan2(meanX, meanY) * 180) / Math.PI + 360) % 360).toFixed(1));
      return {
        month: idx + 1,
        monthName: monthNames[idx],
        speedKmH: meanSpeed > 0 ? meanSpeed : STATIC_MONTHLY_WIND[idx].speedKmH,
        windToDegrees: meanDirTo,
        cardinal: degreesToCardinal(meanDirTo),
      };
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      } catch {}
    }

    return result;
  } catch (err) {
    console.warn('Falling back to static Open-Meteo/PAGASA monthly wind table:', err);
    return STATIC_MONTHLY_WIND;
  }
}

/**
 * Precomputes 18x18 distance (km) and compass bearing (deg) matrices once via useMemo.
 */
export function precomputeSpatialMatrices(barangays: BarangayGISData[]): {
  distances: Record<string, Record<string, number>>;
  bearings: Record<string, Record<string, number>>;
} {
  const distances: Record<string, Record<string, number>> = {};
  const bearings: Record<string, Record<string, number>> = {};

  for (const a of barangays) {
    distances[a.name] = {};
    bearings[a.name] = {};
    for (const b of barangays) {
      if (a.name === b.name) {
        distances[a.name][b.name] = 0;
        bearings[a.name][b.name] = 0;
      } else {
        distances[a.name][b.name] = haversineKm(
          a.position[0],
          a.position[1],
          b.position[0],
          b.position[1]
        );
        bearings[a.name][b.name] = calculateBearing(
          a.position[0],
          a.position[1],
          b.position[0],
          b.position[1]
        );
      }
    }
  }

  return { distances, bearings };
}

const CLOVEN_SPECIES = ['cattle', 'carabao', 'goat', 'swine', 'sheep', 'pig', 'cow'];

/**
 * Returns cloven-hoofed heads count for host density calculations
 */
export function getClovenHoofedHeads(b: BarangayGISData): number {
  if (b.species_breakdown && b.species_breakdown.length > 0) {
    const sum = b.species_breakdown.reduce((acc, curr) => {
      const s = curr.species.toLowerCase();
      if (CLOVEN_SPECIES.some((k) => s.includes(k))) {
        return acc + curr.heads;
      }
      return acc;
    }, 0);
    if (sum > 0) return sum;
  }
  return b.cattle || b.total_livestock || 10;
}

/**
 * Precomputes the entire 12-month simulation trajectory.
 * Scrubbing the slider simply indexes into this trajectory in O(1) time.
 */
export function computeAnnualSimulationTrajectory(
  barangays: BarangayGISData[],
  matrices: {
    distances: Record<string, Record<string, number>>;
    bearings: Record<string, Record<string, number>>;
  },
  monthlyWind: MonthlyWindData[] = STATIC_MONTHLY_WIND,
  params: SimulationParameters = DEFAULT_SIMULATION_PARAMETERS
): MonthlySimulationResult[] {
  if (!barangays || barangays.length === 0) return [];

  const { distances, bearings } = matrices;

  // Step 1: Initial ground truth seeds from PostgreSQL database
  let currentInfected: Record<string, number> = {};
  for (const b of barangays) {
    const liveCases = b.active_cases > 0 ? b.active_cases : b.disease_cases > 0 ? 1 : 0;
    currentInfected[b.name] = liveCases;
  }

  // Ensure demonstration epicenter if active outbreaks are 0 in DB
  const totalSeeds = Object.values(currentInfected).reduce((sum, v) => sum + v, 0);
  if (totalSeeds === 0) {
    currentInfected['Manggas'] = 2;
    currentInfected['Bawi'] = 1;
  }

  const results: MonthlySimulationResult[] = [];

  for (let mIdx = 0; mIdx < TIMELINE_MONTHS.length; mIdx++) {
    const month = TIMELINE_MONTHS[mIdx];
    const wind = monthlyWind[mIdx] || STATIC_MONTHLY_WIND[mIdx] || STATIC_MONTHLY_WIND[0];
    const windSpeed = wind.speedKmH;
    const windToDegrees = wind.windToDegrees;

    const rawPressures: Record<string, number> = {};
    const windExposures: Record<string, number> = {};
    let maxPressure = 0;

    // Model per month t for each target barangay j
    for (const target of barangays) {
      const tName = target.name;
      let contactSum = 0;
      let windSum = 0;
      let downwindAlignmentSum = 0;

      for (const source of barangays) {
        const sName = source.name;
        if (sName === tName) continue;

        const infSource = currentInfected[sName] || 0;
        if (infSource <= 0) continue;

        const d_ij = distances[sName]?.[tName] ?? 999;
        const bearing_ij = bearings[sName]?.[tName] ?? 0;

        // 1. Proximity Contact: SUM_i!=j [ infected_i(t) * exp(-d_ij / L_contact) ]
        const contactTerm = infSource * Math.exp(-d_ij / params.L_contact);
        contactSum += contactTerm;

        // 2. Wind Drift: SUM_i!=j [ infected_i(t) * W_t * max(0, cos(bearing_ij - windTo_t)) * exp(-d_ij / L_wind) ]
        const angleDiffRad = ((bearing_ij - windToDegrees) * Math.PI) / 180;
        const windAlignment = Math.max(0, Math.cos(angleDiffRad));
        const windTerm =
          infSource * (windSpeed / 15.0) * windAlignment * Math.exp(-d_ij / params.L_wind);
        windSum += windTerm;

        downwindAlignmentSum += windAlignment * (infSource > 0 ? 1 : 0);
      }

      // 3. Population Density: cloven-hoofed heads / barangay area km2
      const areaKm2 = BARANGAY_AREAS_KM2[tName] || 2.0;
      const popDensity = getClovenHoofedHeads(target) / areaKm2;

      // Pressure_j(t) = (Infected_Contact_j + Wind_Drift_j) * PopDensity_j (scaled for stability)
      const rawPressure = (contactSum + windSum) * (popDensity / 50.0);
      rawPressures[tName] = rawPressure;
      windExposures[tName] = downwindAlignmentSum;

      if (rawPressure > maxPressure) {
        maxPressure = rawPressure;
      }
    }

    if (maxPressure <= 0) maxPressure = 1;

    // Normalize pressure 0 - 1 and assign alert tiers
    const states: Record<string, SimulatedBarangayState> = {};
    let monthTotalPressure = 0;
    let monthTotalInfected = 0;

    for (const b of barangays) {
      const rawP = rawPressures[b.name] || 0;
      const normP = Number(Math.min(1.0, Math.max(0.0, rawP / maxPressure)).toFixed(3));
      monthTotalPressure += normP;

      const cases = currentInfected[b.name] || 0;
      monthTotalInfected += cases;

      let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (normP >= 0.70 || cases >= 15) risk = 'critical';
      else if (normP >= 0.40 || cases >= 6) risk = 'high';
      else if (normP >= 0.20 || cases >= 2) risk = 'medium';

      states[b.name] = {
        cases,
        risk,
        transmissionPressure: normP,
        rawPressure: Number(rawP.toFixed(2)),
        windExposureFactor: Number((windExposures[b.name] || 0).toFixed(2)),
        projectedPeak: Math.min(50, Math.round(cases * 1.35) + 2),
      };
    }

    results.push({
      monthIndex: mIdx,
      month,
      wind,
      states,
      totalPressure: Number(monthTotalPressure.toFixed(2)),
      totalInfected: monthTotalInfected,
    });

    // Update infected_i(t+1) when pressure crosses threshold
    const nextInfected: Record<string, number> = { ...currentInfected };
    for (const b of barangays) {
      const normP = states[b.name].transmissionPressure;
      const currentCases = currentInfected[b.name] || 0;

      if (normP >= params.threshold) {
        // Crosses threshold -> new infections propagate
        const newCases = Math.max(1, Math.round(normP * 3.5));
        nextInfected[b.name] = Math.min(50, currentCases + newCases);
      } else {
        // Natural recovery / resolution if below threshold
        nextInfected[b.name] = currentCases > 0 ? Math.max(0, currentCases - 1) : 0;
      }
    }

    currentInfected = nextInfected;
  }

  return results;
}

/**
 * Backward compatibility helper for page.tsx
 */
export function computeSimulatedSpread(
  barangays: BarangayGISData[],
  monthIndex: number = 3,
  windInput: EnvironmentalWindInput = DEFAULT_PAGASA_WIND
): Record<string, SimulatedBarangayState> {
  const matrices = precomputeSpatialMatrices(barangays);
  const trajectory = computeAnnualSimulationTrajectory(barangays, matrices);
  const clamped = Math.max(0, Math.min(trajectory.length - 1, monthIndex));
  return trajectory[clamped]?.states || {};
}
