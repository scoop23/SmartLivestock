'use client';

/**
 * SmartLivestock GIS — Auction Movement & Trade GIS
 * Municipality of Padre Garcia, Batangas
 * 
 * Reuses the unified RoleAwareGISContainer engine.
 * Scoped to livestock transport movements, origin/destination flows, and cattle volume.
 */

import React from 'react';
import { RoleAwareGISContainer } from '@/components/gis/RoleAwareGISContainer';

export default function AuctionGISPage() {
  return <RoleAwareGISContainer backRoute="/auction" backLabel="Back to Market Hub" />;
}
