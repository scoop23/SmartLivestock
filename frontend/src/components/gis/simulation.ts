/**
 * Haversine Epidemic Spread Simulation Model for SmartLivestock GIS
 * 
 * Educational Note:
 * This simulation models spatial infectious disease transmission (e.g. Foot-and-Mouth Disease)
 * between livestock herds across Padre Garcia barangays using:
 *   1. Geographic distance decay (Haversine formula): Transmission risk decreases exponentially
 *      with physical distance (decay radius = 3.5 km).
 *   2. Herd Density Weighting: Barangays with higher cattle counts experience higher transmission
 *      pressure due to greater host availability.
 *   3. Real Seed Cases: Uses active outbreak cases from the database as initial ground truth.
 */

import { BarangayGISData, SimulatedBarangayState } from './types';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

const DECAY_KM = 3.5;
const SPREAD_RATE = 0.18;
const CATTLE_WEIGHT = 0.004;
const MAX_CASES = 50;

export function computeSimulatedSpread(
  barangays: BarangayGISData[],
  step: number = 7 // Day in simulation timeline (1 to 30)
): Record<string, SimulatedBarangayState> {
  // Pre-compute distance matrix between all barangay centroids
  const distances: Record<string, Record<string, number>> = {};
  const cattleMap: Record<string, number> = {};
  const seedCases: Record<string, number> = {};

  for (const b of barangays) {
    distances[b.name] = {};
    cattleMap[b.name] = b.cattle || b.total_livestock || 10;
    // Use real active cases or reported disease cases as seed
    seedCases[b.name] = b.active_cases > 0 ? b.active_cases : (b.disease_cases > 0 ? 1 : 0);
  }

  // Ensure at least one seed exists for demonstration if municipality currently has 0 active cases
  const totalSeeds = Object.values(seedCases).reduce((sum, v) => sum + v, 0);
  if (totalSeeds === 0) {
    seedCases['Manggas'] = 2; // Default demonstration seed
  }

  for (const a of barangays) {
    for (const b of barangays) {
      distances[a.name][b.name] =
        a.name === b.name
          ? 0
          : haversineKm(a.position[0], a.position[1], b.position[0], b.position[1]);
    }
  }

  // Simulate spread step by step
  let currentSnapshot: Record<string, number> = { ...seedCases };

  const clampedStep = Math.max(1, Math.min(30, step));
  for (let s = 1; s <= clampedStep; s++) {
    const nextSnapshot: Record<string, number> = { ...currentSnapshot };

    for (const target of barangays) {
      const tName = target.name;
      if (currentSnapshot[tName] >= MAX_CASES) continue;

      let transmissionPressure = 0;
      for (const source of barangays) {
        const sName = source.name;
        if (sName === tName) continue;

        const srcCases = currentSnapshot[sName] || 0;
        if (srcCases === 0) continue;

        const dist = distances[sName]?.[tName] || 999;
        const cattle = cattleMap[tName] || 10;

        // Exponential decay distance model combined with herd density
        const contribution =
          Math.exp(-dist / DECAY_KM) *
          Math.log1p(srcCases) *
          SPREAD_RATE *
          (1 + cattle * CATTLE_WEIGHT);

        if (Number.isFinite(contribution)) {
          transmissionPressure += contribution;
        }
      }

      const existing = currentSnapshot[tName] || 0;
      const growth = Math.floor(
        transmissionPressure + (existing > 0 ? existing * 0.15 : 0)
      );
      nextSnapshot[tName] = Math.min(MAX_CASES, existing + growth);
    }

    currentSnapshot = nextSnapshot;
  }

  // Format into SimulatedBarangayState
  const result: Record<string, SimulatedBarangayState> = {};
  for (const b of barangays) {
    const projected = currentSnapshot[b.name] || 0;
    let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (projected >= 20) risk = 'critical';
    else if (projected >= 8) risk = 'high';
    else if (projected >= 2) risk = 'medium';

    result[b.name] = {
      cases: projected,
      risk,
      projectedPeak: Math.min(MAX_CASES, Math.round(projected * 1.4)),
    };
  }

  return result;
}
