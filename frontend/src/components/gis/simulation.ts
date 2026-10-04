/**
 * Haversine Epidemic Spread & Wind-Drift Simulation Model (V2)
 * SmartLivestock-Batangas — Municipal Agriculture Office
 * 
 * ============================================================================
 * IMPORTANT EPIDEMIOLOGICAL METHODOLOGY NOTE:
 * ============================================================================
 * This is a stylized decision-support simulation model designed for municipal
 * veterinary contingency planning and visualization. It is NOT a clinical or
 * laboratory-verified transmission model of Foot-and-Mouth Disease (FMD).
 * 
 * Terminology:
 *   - "Simulated Transmission Pressure": A dimensionless relative hazard index
 *     representing infectious aerosol and contact pressure from known infected herds.
 *   - It is explicitly NOT a confirmed diagnosis or clinical infection probability.
 * 
 * Mathematical Formulation:
 * -------------------------
 * For a target barangay T receiving pressure from all infected source barangays S:
 * 
 *   Pressure(T) = Sum_S [ Contact(S -> T) + WindDrift(S -> T) ] * (1 + beta * Density(T))
 * 
 * 1. Proximity Contact:
 *    Contact(S -> T) = exp(-d(S, T) / D_contact) * ln(1 + Cases(S)) * alpha_contact
 *    Where:
 *      - d(S, T) is the great-circle Haversine distance in kilometers.
 *      - D_contact = 3.5 km (transmission decay distance).
 *      - Cases(S) is the active confirmed or reported disease count in source S.
 * 
 * 2. Directional Wind Drift (Environmental Input):
 *    WindDrift(S -> T) = (WindSpeed / 10) * max(0, cos(theta_ST - theta_wind)) * exp(-d(S, T) / D_wind) * ln(1 + Cases(S))
 *    Where:
 *      - theta_ST is the compass bearing from source S to target T.
 *      - theta_wind is the prevailing wind direction (heading angle).
 *      - Environmental input sourced from PAGASA Climatological observations.
 * 
 * 3. Livestock Population Density Weighting:
 *    Target barangays with higher cattle counts experience higher reception pressure
 *    due to greater host density: (1 + beta * CattleCount(T)).
 */

import {
  BarangayGISData,
  EnvironmentalWindInput,
  SimulatedBarangayState,
  TimelineMonth,
} from './types';

// Standard 10-month simulation timeline (2026)
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
];

// Documented environmental wind input based on PAGASA Batangas Climatology
export const DEFAULT_PAGASA_WIND: EnvironmentalWindInput = {
  speedKmH: 14.0,              // Typical Batangas inland wind speed: 12-16 km/h
  directionDegrees: 45.0,      // 45 degrees: Southwest to Northeast (prevailing Habagat flow)
  cardinalDirection: 'SW → NE',
  sourceAttribution: 'PAGASA Climatological Data (Batangas Station)',
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
 * Calculates the forward azimuth / compass bearing from coordinate 1 to coordinate 2 (0 - 360 deg)
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
  const bearingDegrees = ((theta * 180) / Math.PI + 360) % 360;
  return bearingDegrees;
}

const DECAY_KM = 3.5;
const WIND_DECAY_KM = 4.2;
const SPREAD_RATE = 0.16;
const CATTLE_WEIGHT = 0.005;
const MAX_SIMULATED_CASES = 50;

/**
 * Runs a deterministic spatial epidemic transmission simulation across time steps.
 */
export function computeSimulatedSpread(
  barangays: BarangayGISData[],
  monthIndex: number = 3, // 0 to 9
  windInput: EnvironmentalWindInput = DEFAULT_PAGASA_WIND
): Record<string, SimulatedBarangayState> {
  const distances: Record<string, Record<string, number>> = {};
  const bearings: Record<string, Record<string, number>> = {};
  const cattleMap: Record<string, number> = {};
  const seedCases: Record<string, number> = {};

  // Step 1: Initialize baseline values from database ground truth
  for (const b of barangays) {
    distances[b.name] = {};
    bearings[b.name] = {};
    cattleMap[b.name] = b.cattle || b.total_livestock || 10;

    // Use active confirmed cases from database, or reported symptoms as baseline
    const dbCases = b.active_cases > 0 ? b.active_cases : (b.disease_cases > 0 ? 1 : 0);
    seedCases[b.name] = dbCases;
  }

  // Ensure an initial seed exists if the database currently has 0 active cases
  const totalSeeds = Object.values(seedCases).reduce((sum, v) => sum + v, 0);
  if (totalSeeds === 0) {
    seedCases['Manggas'] = 2; // Default demonstration epicenter
  }

  // Step 2: Pre-compute pairwise distances and directional bearings
  for (const a of barangays) {
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

  // Step 3: Simulate month-by-month deterministic progression
  let currentSnapshot: Record<string, number> = { ...seedCases };
  const rawPressures: Record<string, number> = {};
  const windExposures: Record<string, number> = {};

  const clampedSteps = Math.max(0, Math.min(TIMELINE_MONTHS.length - 1, monthIndex));

  for (let s = 0; s <= clampedSteps; s++) {
    const nextSnapshot: Record<string, number> = { ...currentSnapshot };

    for (const target of barangays) {
      const tName = target.name;
      let totalPressure = 0;
      let downwindFactor = 0;

      for (const source of barangays) {
        const sName = source.name;
        if (sName === tName) continue;

        const srcCases = currentSnapshot[sName] || 0;
        if (srcCases === 0) continue;

        const dist = distances[sName]?.[tName] || 999;
        const bearing = bearings[sName]?.[tName] || 0;

        // 1. Proximity Contact Pressure
        const contactContribution =
          Math.exp(-dist / DECAY_KM) * Math.log1p(srcCases) * SPREAD_RATE;

        // 2. Directional Wind Drift (PAGASA input)
        // Angle difference between source->target bearing and wind heading
        const angleDiffRad = ((bearing - windInput.directionDegrees) * Math.PI) / 180;
        const windAlignment = Math.max(0, Math.cos(angleDiffRad)); // Downwind alignment [0, 1]

        const windContribution =
          (windInput.speedKmH / 10.0) *
          windAlignment *
          Math.exp(-dist / WIND_DECAY_KM) *
          Math.log1p(srcCases) *
          0.12;

        downwindFactor += windAlignment * (srcCases > 0 ? 1 : 0);
        totalPressure += contactContribution + windContribution;
      }

      // 3. Livestock Population Density Reception Factor
      const targetCattle = cattleMap[tName] || 10;
      const densityWeightedPressure = totalPressure * (1 + targetCattle * CATTLE_WEIGHT);

      rawPressures[tName] = densityWeightedPressure;
      windExposures[tName] = downwindFactor;

      // Only grow cases if step > 0 (Month 0 is baseline ground truth)
      if (s > 0) {
        const existing = currentSnapshot[tName] || 0;
        const newInfections = Math.floor(
          densityWeightedPressure + (existing > 0 ? existing * 0.18 : 0)
        );
        nextSnapshot[tName] = Math.min(MAX_SIMULATED_CASES, existing + newInfections);
      }
    }

    if (s > 0) {
      currentSnapshot = nextSnapshot;
    }
  }

  // Step 4: Map final snapshot into standardized SimulatedBarangayState
  const result: Record<string, SimulatedBarangayState> = {};
  for (const b of barangays) {
    const cases = currentSnapshot[b.name] || 0;
    const pressure = rawPressures[b.name] || 0;

    let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (cases >= 18 || pressure >= 4.0) risk = 'critical';
    else if (cases >= 8 || pressure >= 2.0) risk = 'high';
    else if (cases >= 2 || pressure >= 0.8) risk = 'medium';

    result[b.name] = {
      cases,
      risk,
      transmissionPressure: Number(pressure.toFixed(2)),
      windExposureFactor: Number((windExposures[b.name] || 0).toFixed(2)),
      projectedPeak: Math.min(MAX_SIMULATED_CASES, Math.round(cases * 1.35) + 2),
    };
  }

  return result;
}
