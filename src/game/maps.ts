import type { GameMode, MapId, SpawnPoint, ZoneName } from './types';

export interface MapDefinition {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  landmarkA: string;
  landmarkB: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  spawns: SpawnPoint[];
}

export const MAP_LIST: MapDefinition[] = [
  {
    id: 'peak',
    name: 'Peak & Factory',
    subtitle: 'Alpine Valley Arena',
    description: 'Classic Peak House ridge, Factory steel hangar, wooden crates, and open valley road.',
    landmarkA: 'PEAK HOUSE',
    landmarkB: 'FACTORY',
    skyColor: 0x6ec3f4,
    fogColor: 0x8bd3f5,
    fogDensity: 0.0068,
    spawns: [
      {
        id: 'peak_south_road',
        name: 'South Peak Road',
        subtitle: 'Center Avenue Spawn',
        x: 0,
        z: 19,
        yaw: 0,
        team: 'ally',
      },
      {
        id: 'peak_house_yard',
        name: 'Peak House Yard',
        subtitle: 'West Villa Flank',
        x: -16,
        z: 12,
        yaw: 0.25,
        team: 'ally',
      },
      {
        id: 'peak_factory_approach',
        name: 'Factory South Gate',
        subtitle: 'East Industrial Cover',
        x: 16,
        z: 12,
        yaw: -0.25,
        team: 'ally',
      },
      {
        id: 'peak_north_road',
        name: 'North Ridge Road',
        subtitle: 'Northern Highground',
        x: 0,
        z: -22,
        yaw: Math.PI,
        team: 'enemy',
      },
      {
        id: 'peak_west_ridge',
        name: 'Peak House North',
        subtitle: 'West Overlook',
        x: -14,
        z: -15,
        yaw: Math.PI - 0.2,
        team: 'enemy',
      },
      {
        id: 'peak_factory_north',
        name: 'Factory Courtyard',
        subtitle: 'East Steel Flank',
        x: 14,
        z: -15,
        yaw: Math.PI + 0.2,
        team: 'enemy',
      },
      {
        id: 'peak_valley_west',
        name: 'West Valley',
        subtitle: 'Palm Cover Drop',
        x: -26,
        z: 2,
        yaw: -Math.PI / 2,
        team: 'neutral',
      },
      {
        id: 'peak_valley_east',
        name: 'East Valley',
        subtitle: 'Oak Ridge Drop',
        x: 26,
        z: 2,
        yaw: Math.PI / 2,
        team: 'neutral',
      },
    ],
  },
  {
    id: 'london',
    name: 'London',
    subtitle: 'Big Ben & Tower Bridge',
    description: 'Fight across the River Thames bridges, Big Ben clock plaza, Red Buses, and Underground.',
    landmarkA: 'BIG BEN',
    landmarkB: 'TOWER BRIDGE',
    skyColor: 0x94b8d7,
    fogColor: 0xa8c3da,
    fogDensity: 0.0074,
    spawns: [
      {
        id: 'london_south_embankment',
        name: 'South Embankment',
        subtitle: 'Thames South Approach',
        x: 0,
        z: 21,
        yaw: 0,
        team: 'ally',
      },
      {
        id: 'london_underground',
        name: 'Underground Plaza',
        subtitle: 'West Metro Cover',
        x: -17,
        z: 16,
        yaw: 0.22,
        team: 'ally',
      },
      {
        id: 'london_bus_depot',
        name: 'Red Bus Boulevard',
        subtitle: 'East Street Cover',
        x: 17,
        z: 16,
        yaw: -0.22,
        team: 'ally',
      },
      {
        id: 'london_tower_north',
        name: 'Tower Bridge North',
        subtitle: 'North Bridgehead',
        x: 0,
        z: -21,
        yaw: Math.PI,
        team: 'enemy',
      },
      {
        id: 'london_big_ben',
        name: 'Big Ben Square',
        subtitle: 'Westminster Clocktower',
        x: -16,
        z: -15,
        yaw: Math.PI - 0.2,
        team: 'enemy',
      },
      {
        id: 'london_parliament',
        name: 'East Docklands',
        subtitle: 'Thames North Wharf',
        x: 16,
        z: -15,
        yaw: Math.PI + 0.2,
        team: 'enemy',
      },
      {
        id: 'london_west_bridge',
        name: 'Westminster Bridge',
        subtitle: 'West River Crossing',
        x: -22,
        z: 2,
        yaw: -0.4,
        team: 'neutral',
      },
      {
        id: 'london_east_bridge',
        name: 'Millennium Crossing',
        subtitle: 'East River Crossing',
        x: 22,
        z: 2,
        yaw: 0.4,
        team: 'neutral',
      },
    ],
  },
];

export const MAPS_BY_ID: Record<MapId, MapDefinition> = {
  peak: MAP_LIST[0],
  london: MAP_LIST[1],
};

export function groundHeightAt(x: number, z: number, mapId: MapId = 'peak'): number {
  if (mapId === 'london') {
    // Thames River channel runs East-West from z = -4.5 to z = +4.5;
    // Three stone/steel bridges span across it smoothly!
    const inThamesBand = Math.abs(z) < 4.8;
    const onCenterBridge = Math.abs(x) < 5.6;
    const onWestBridge = Math.abs(x + 22) < 3.6;
    const onEastBridge = Math.abs(x - 22) < 3.6;

    if (inThamesBand && (onCenterBridge || onWestBridge || onEastBridge)) {
      const arch = Math.cos((z / 4.8) * (Math.PI * 0.5)) * 0.45;
      return 0.12 + arch;
    }

    if (Math.abs(z) < 3.8) {
      // Shallow flooded embankment edge outside bridges (players stay on bridges/embankments)
      return -0.55;
    }

    const outerLondonRise = Math.max(0, Math.hypot(x, z) - 62) * 0.14;
    return outerLondonRise;
  }

  const distFromCenter = Math.hypot(x, z);
  const roadFlatten = smoothstep(Math.abs(x), 3.8, 11.0);
  const gentleRoll =
    (Math.sin(x * 0.055) * Math.cos(z * 0.055) * 0.85 +
      Math.sin(x * 0.11 + z * 0.07) * 0.28) *
    roadFlatten;

  const distPeakPad = Math.hypot(x + 22, z + 16);
  const distFactoryPad = Math.hypot(x - 24, z + 18);
  const padFlatten =
    smoothstep(distPeakPad, 7, 13) * smoothstep(distFactoryPad, 8, 15);

  const outerRise = Math.max(0, distFromCenter - 58) * 0.22;
  return gentleRoll * padFlatten + outerRise;
}

function smoothstep(x: number, min: number, max: number): number {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

export function getZoneName(x: number, z: number, mapId: MapId): ZoneName {
  if (mapId === 'london') {
    if (Math.hypot(x + 22, z + 16) < 16) return 'BIG BEN';
    if (Math.abs(z) < 7 && Math.abs(x) < 10) return 'TOWER BRIDGE';
    if (z < 0) return 'WESTMINSTER';
    return 'THAMES BANK';
  }
  if (Math.hypot(x + 22, z + 16) < 16) return 'PEAK';
  if (Math.hypot(x - 24, z + 18) < 17) return 'FACTORY';
  if (Math.abs(x) < 6.5) return 'PEAK ROAD';
  return 'VALLEY';
}

export function getTotalRoundsForMode(mode: GameMode): number {
  // CS 4v4 & Lone Wolf 1v1 use a 4-round system; BR 1v50 has no rounds
  return mode === 'br_1v50' ? 0 : 4;
}

export function getPlayerSelectableSpawns(mapId: MapId): SpawnPoint[] {
  const map = MAPS_BY_ID[mapId];
  return map.spawns.filter((s) => s.team === 'ally' || s.team === 'neutral');
}

export function getDefaultSpawnForTeam(
  mapId: MapId,
  team: 'ally' | 'enemy',
  preferredId?: string
): SpawnPoint {
  const map = MAPS_BY_ID[mapId];
  if (preferredId) {
    const found = map.spawns.find((s) => s.id === preferredId);
    if (found) return found;
  }
  return map.spawns.find((s) => s.team === team) ?? map.spawns[0];
}
