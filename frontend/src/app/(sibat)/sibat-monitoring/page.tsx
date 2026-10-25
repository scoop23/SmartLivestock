'use client';

/**
 * SmartLivestock GIS — SIBAT Field Monitoring & GIS Map
 * Municipality of Padre Garcia, Batangas
 * 
 * ============================================================================
 * ARCHITECTURAL CONCEPTS & LEARNING GUIDE:
 * ============================================================================
 * Reuses the unified RoleAwareGISContainer engine.
 * 
 * 1. JURISDICTION-BASED FIELD MONITORING:
 *    - Default: Scoped to the SIBAT reviewer's assigned barangays (`user.assigned_barangay`).
 *    - Wide-access exception: If the user has `access_scope == "ALL_BARANGAYS"`,
 *      the system expands operational access across all 18 barangays without
 *      modifying their approval authority.
 * 
 * 2. OPERATIONAL LAYERS:
 *    - SIBAT can inspect field inventory, disease, production, mortality, and movement layers.
 *      CBAT keeps the reported disease and production layers without movement,
 *      mortality, or the disease trend view.
 *    - Restricted: Disease epidemic simulation and municipal decision-support tools
 *      are reserved strictly for MAO/Admin leadership.
 */

import { RoleAwareGISContainer } from '@/components/gis/RoleAwareGISContainer';

export default function SibatMonitoringPage() {
  return <RoleAwareGISContainer backRoute="/sibat" backLabel="Back to Field Hub" />;
}
