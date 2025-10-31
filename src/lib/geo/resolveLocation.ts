import isoCountries from './iso-countries.json';
import { supabase } from '@/integrations/supabase/client';

export interface ResolvedLocation {
  name: string;
  iso2?: string;
  iso3?: string;
  type: 'country' | 'region' | 'city' | 'suburb' | 'district';
  lat?: number;
  lon?: number;
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  geoId?: string;
}

/**
 * Resolves a location string to standardized geographic data.
 * Checks: ISO codes → geo_catalog cache → Nominatim geocoding → cache result
 */
export async function resolveLocation(query: string): Promise<ResolvedLocation> {
  const normalized = query.trim().toLowerCase();

  // 1. Check if it's an ISO code
  const isoMatch = isoCountries.find(
    c => c.iso2.toLowerCase() === normalized || 
         c.iso3.toLowerCase() === normalized ||
         c.name.toLowerCase() === normalized
  );

  if (isoMatch) {
    // Check if we have it cached
    const { data: cached } = await supabase
      .from('geo_catalog')
      .select('*')
      .eq('iso3', isoMatch.iso3)
      .eq('type', 'country')
      .single();

    if (cached) {
      return {
        name: cached.name,
        iso2: cached.iso2 || undefined,
        iso3: cached.iso3 || undefined,
        type: cached.type as ResolvedLocation['type'],
        lat: cached.lat || undefined,
        lon: cached.lon || undefined,
        bbox: cached.bbox as [number, number, number, number] | undefined,
        geoId: cached.id
      };
    }

    // Not cached, geocode and cache it
    const geocoded = await geocodeNominatim(isoMatch.name);
    if (geocoded) {
      const { data: inserted } = await supabase
        .from('geo_catalog')
        .insert({
          name: isoMatch.name,
          iso2: isoMatch.iso2,
          iso3: isoMatch.iso3,
          type: 'country',
          lat: geocoded.lat,
          lon: geocoded.lon,
          bbox: geocoded.bbox,
          source: 'nominatim',
          raw: geocoded.raw
        })
        .select()
        .single();

      if (inserted) {
        return {
          name: inserted.name,
          iso2: inserted.iso2 || undefined,
          iso3: inserted.iso3 || undefined,
          type: 'country',
          lat: inserted.lat || undefined,
          lon: inserted.lon || undefined,
          bbox: inserted.bbox as [number, number, number, number] | undefined,
          geoId: inserted.id
        };
      }
    }

    // Fallback without geocoding
    return {
      name: isoMatch.name,
      iso2: isoMatch.iso2,
      iso3: isoMatch.iso3,
      type: 'country'
    };
  }

  // 2. Check geo_catalog cache
  const { data: cached } = await supabase
    .from('geo_catalog')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(1)
    .single();

  if (cached) {
    return {
      name: cached.name,
      iso2: cached.iso2 || undefined,
      iso3: cached.iso3 || undefined,
      type: cached.type as ResolvedLocation['type'],
      lat: cached.lat || undefined,
      lon: cached.lon || undefined,
      bbox: cached.bbox as [number, number, number, number] | undefined,
      geoId: cached.id
    };
  }

  // 3. Geocode with Nominatim
  const geocoded = await geocodeNominatim(query);
  if (geocoded) {
    const locationType = determineLocationType(geocoded.raw.type);
    
    const { data: inserted } = await supabase
      .from('geo_catalog')
      .insert({
        name: geocoded.raw.display_name || query,
        type: locationType,
        lat: geocoded.lat,
        lon: geocoded.lon,
        bbox: geocoded.bbox,
        source: 'nominatim',
        raw: geocoded.raw
      })
      .select()
      .single();

    if (inserted) {
      return {
        name: inserted.name,
        type: locationType,
        lat: inserted.lat || undefined,
        lon: inserted.lon || undefined,
        bbox: inserted.bbox as [number, number, number, number] | undefined,
        geoId: inserted.id
      };
    }
  }

  // 4. Fallback: return as-is
  return {
    name: query,
    type: 'region' // default type
  };
}

async function geocodeNominatim(query: string): Promise<{
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  raw: any;
} | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'AICIS/1.0' } }
    );

    if (!response.ok) return null;

    const results = await response.json();
    if (!results || results.length === 0) return null;

    const first = results[0];
    return {
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      bbox: first.boundingbox ? [
        parseFloat(first.boundingbox[2]), // minLon
        parseFloat(first.boundingbox[0]), // minLat
        parseFloat(first.boundingbox[3]), // maxLon
        parseFloat(first.boundingbox[1])  // maxLat
      ] : undefined,
      raw: first
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

function determineLocationType(osmType?: string): ResolvedLocation['type'] {
  if (!osmType) return 'region';
  
  const type = osmType.toLowerCase();
  if (type.includes('country')) return 'country';
  if (type.includes('city') || type.includes('town')) return 'city';
  if (type.includes('suburb') || type.includes('neighbourhood')) return 'suburb';
  if (type.includes('district') || type.includes('county')) return 'district';
  
  return 'region';
}
