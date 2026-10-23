import { bank, hall, jobs, police } from './civic';
import { bar, mall, market, shop, sponsors } from './commerce';
import type { BuildingDef } from './kit';
import { black, garage, officialSign } from './motor';
import { own } from './own';

export type { BuildingDef, BuildingKey, Sign } from './kit';
export { residential } from './kit';

// Официалната писта (track от motor.ts) временно не се рисува: на картата е само пътната табела officialSign.
export const BUILDINGS: BuildingDef[] = [hall, bank, police, jobs, mall, sponsors, bar, shop, market, garage, black, officialSign, own];
