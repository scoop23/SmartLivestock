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
 *    - Permitted: Livestock (Cattle), Reported Disease Cases, Dairy Milk, Meat Yield,
 *      Mortality Records, and Transport Movement.
 *    - Restricted: Disease epidemic simulation and municipal decision-support tools
 *      are reserved strictly for MAO/Admin leadership.
 */

import React from 'react';
import { RoleAwareGISContainer } from '@/components/gis/RoleAwareGISContainer';

export default function SibatMonitoringPage() {
  return <RoleAwareGISContainer backRoute="/sibat" backLabel="Back to Field Hub" />;
}
