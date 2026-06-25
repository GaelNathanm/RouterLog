/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { showToast } from './toast';

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Geocodes an address string using OpenStreetMap Nominatim API.
 * Includes a robust fallback generator for offline or error states.
 */
export async function geocodeAddress(address: string, fallbackRegion?: string): Promise<GeocodeResult> {
  if (!address || address.trim() === '') {
    return getRandomRegionCoords(fallbackRegion);
  }

  try {
    // Nominatim requires a descriptive User-Agent
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LogisticaCorporativaRealtimeApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`[Nominatim Geocode] Resolved "${address}" to [${lat}, ${lng}]`);
        return { lat, lng };
      }
    }
    
    console.warn(`[Nominatim Geocode] No results for "${address}". Using smart local fallback.`);
  } catch (error) {
    console.error('[Nominatim Geocode] Geocoding request failed:', error);
  }

  // Smart local fallback to prevent 0,0 placement
  return getRandomRegionCoords(fallbackRegion);
}

function getRandomRegionCoords(region?: string): GeocodeResult {
  // Center coordinates for regions
  const centers: Record<string, { lat: number; lng: number }> = {
    'SP': { lat: -23.55052, lng: -46.633308 },
    'RJ': { lat: -22.906847, lng: -43.172896 },
    'MG': { lat: -19.916681, lng: -43.934493 },
    'PR': { lat: -25.4284, lng: -49.2733 },
    'SC': { lat: -27.5954, lng: -48.5480 }
  };

  const center = (region && centers[region.toUpperCase()]) || centers['SP'];
  
  // Add slight random offset so they don't overlap completely
  const offsetLat = (Math.random() - 0.5) * 0.05;
  const offsetLng = (Math.random() - 0.5) * 0.05;

  return {
    lat: center.lat + offsetLat,
    lng: center.lng + offsetLng
  };
}
