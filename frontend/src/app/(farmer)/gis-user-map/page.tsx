'use client';

/**
 * SmartLivestock GIS — Farmer Local Map ("Farm Map")
 * Municipality of Padre Garcia, Batangas
 * 
 * ============================================================================
 * ARCHITECTURAL CONCEPTS & LEARNING GUIDE:
 * ============================================================================
 * Reuses the unified RoleAwareGISContainer engine.
 * 
 * 1. ZERO CODE DUPLICATION:
 *    Instead of a divergent mock map, the farmer uses the exact same Leaflet
 *    polygon renderer, accurate GeoJSON boundaries, and collapsible controls.
 * 
 * 2. DATA PRIVACY & BACKEND RESTRICTION:
 *    - Restricted to the farmer's registered barangay (`user.farmer_profile.barangay`).
 *    - The backend zeros out private counts for other barangays.
 *    - Out-of-scope barangays are styled with a subtle muted outline and clicks are disabled.
 *    - Neighboring farmers' private herds are NEVER leaked; only safe community aggregates
 *      and the farmer's own records (`farmer_stats`) are rendered.
 * 
 * 3. SIMPLIFIED FARMER CONTROLS:
 *    - Layers limited to: Livestock (Cattle) and Dairy Milk.
 *    - Disease simulation, mortality hot-spot analysis, and admin tools are strictly disabled.
 */

import React from 'react';
import { RoleAwareGISContainer } from '@/components/gis/RoleAwareGISContainer';

export default function FarmerGISMapPage() {
  return <RoleAwareGISContainer backRoute="/farmer" backLabel="Back to Farm" />;
}
