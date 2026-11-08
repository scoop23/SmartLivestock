import type { BarangayGISData, MovementRecord } from './types';

/** Match either endpoint using official/map and database spellings. */
export function movementEndpointMatches(record: MovementRecord, barangay: Pick<BarangayGISData, 'name' | 'db_name'>, endpoint: 'origin' | 'destination'): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const names = [barangay.name, barangay.db_name].filter(Boolean).map(normalize);
  const recorded = record[endpoint === 'origin' ? 'origin_barangay' : 'destination_barangay'];
  if (recorded) return names.some(name => name.replaceAll(' ', '') === normalize(recorded).replaceAll(' ', ''));
  const place = ` ${normalize(record[endpoint])} `;
  return names.some(name => place.includes(` ${name} `));
}

/** Group the visible permits by mapped route; keep every original permit intact. */
export function groupMovementRoutes(records: MovementRecord[]): MovementRecord[] {
  const routes = new Map<string, MovementRecord[]>();
  for (const record of records) {
    const key = JSON.stringify([record.direction, record.from, record.to]);
    const group = routes.get(key) ?? [];
    group.push(record);
    routes.set(key, group);
  }
  return Array.from(routes.values(), group => group.length === 1
    ? group[0]
    : {...group[0], route_records: group});
}
