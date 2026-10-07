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
  // The shared GIS container fetches role-scoped map data; backend GIS service
  // includes only MAO-approved inspection movements in the official movement layer.
  return <RoleAwareGISContainer backRoute="/auction" backLabel="Back to Market Hub" />;
}
