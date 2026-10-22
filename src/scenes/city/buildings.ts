import { bank, hall, jobs, police } from './civic';
import { bar, mall, market, shop, sponsors } from './commerce';
import type { BuildingDef } from './kit';
import { black, garage, track } from './motor';

export type { BuildingDef, BuildingKey, Sign } from './kit';
export { residential } from './kit';

export const BUILDINGS: BuildingDef[] = [hall, bank, police, jobs, mall, sponsors, bar, shop, market, garage, track, black];
