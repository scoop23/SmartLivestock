'use client';

/**
 * SmartLivestock GIS — God's-Eye View (Admin / MAO)
 * Municipality of Padre Garcia, Batangas
 * 
 * Reuses the unified RoleAwareGISContainer engine.
 * Full municipal scope, all 18 barangays, 2D/3D perspective, and epidemic simulation enabled.
 */

import React from 'react';
import { RoleAwareGISContainer } from '@/components/gis/RoleAwareGISContainer';

export default function GISMapPage() {
  return <RoleAwareGISContainer backRoute="/admin" backLabel="Back to Admin" />;
}
