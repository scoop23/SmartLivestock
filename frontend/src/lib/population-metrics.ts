import { normalizeSpeciesCategory } from "./species-colors";

export interface PopulationSpecies { species_id: number; species: string; heads: number }
export interface PopulationBarangay {
  barangay_id: number; barangay: string; heads: number; vaccinated: number;
  species: PopulationSpecies[]; registered_farmers: number; active_herds: number;
  monthly_milk_l?: number; monthly_meat_kg?: number; pending_disease_reports?: number;
}
export interface PopulationSummary {
  total_heads: number; by_barangay: PopulationBarangay[]; by_species: PopulationSpecies[];
  registered_farmers: number; barangay_count: number; pending_inventory_records: number;
  active_submitted_heads: number; historical_approved_heads: number;
}
export interface OverviewSummary {
  population: PopulationSummary; period: string; approved_sales_value: number | null;
}

// Presentation categories only: all counts have already been computed by Django.
export function speciesCategories(rows: PopulationSpecies[]) {
  const counts = { cattle: 0, carabao: 0, swine: 0, goat: 0, sheep: 0, poultry: 0, other: 0 };
  for (const row of rows) counts[normalizeSpeciesCategory(row.species)] += row.heads;
  return counts;
}

export function overviewBarangays(summary?: OverviewSummary) {
  return (summary?.population.by_barangay ?? []).map((row) => {
    const counts = speciesCategories(row.species);
    return {
      barangay: row.barangay, totalLivestock: row.heads,
      cattleCount: counts.cattle, carabaoCount: counts.carabao, swineCount: counts.swine,
      goatCount: counts.goat + counts.sheep, otherCount: counts.poultry + counts.other,
      batchCount: row.active_herds, registeredFarmers: row.registered_farmers,
      monthlyMilkLiters: row.monthly_milk_l ?? 0, monthlyMeatKg: row.monthly_meat_kg ?? 0,
      activeIncidents: row.pending_disease_reports ?? 0,
    };
  }).sort((a, b) => b.totalLivestock - a.totalLivestock || a.barangay.localeCompare(b.barangay));
}
