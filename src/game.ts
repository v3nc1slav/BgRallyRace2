import { apiGet, apiPost } from './api';
import { NS, session, type Player } from './session';

export interface Stats {
  power: number;
  handling: number;
  braking: number;
  reliability: number;
}

export interface Grip {
  asphalt_dry: number;
  asphalt_wet: number;
  gravel: number;
  snow: number;
}

export interface PartItem {
  id: number;
  name: string;
  type: string;
  type_label: string;
  health: number;
  max_health: number;
  defect: boolean;
  bonuses: Stats;
  can_repair: boolean;
  repair_cost: number;
}

export interface TyreItem {
  id: number;
  name: string;
  type_label: string;
  compound_label: string;
  health: number;
  grip: Grip;
}

export interface StorageItem {
  id: number;
  kind: 'part' | 'tyre' | 'spare_tyre';
  name: string;
  type_label: string;
  health: number;
  max_health: number;
  compatible: boolean;
  spare: boolean;
}

export interface CrewMember {
  id: number;
  role: string;
  role_label: string;
  name: string;
  skill: number;
  morale: number | null;
  reputation: number | null;
  energy: number | null;
  physical: number | null;
  fitness_today: boolean;
  salary: number;
  unpaid: boolean;
}

export interface TrainingStage {
  id: number;
  name: string;
  length_km: number;
  surface_label: string;
  profile_label: string;
  difficulty: number;
  fuel: number;
}

export interface TrackInfo {
  stages: TrainingStage[];
  weekday: boolean;
  trained_today: boolean;
  energy: number;
  skill_chance: number;
  risk: number;
  fine: number;
}

export interface BribeInfo {
  active_until: string | null;
  refused: boolean;
  chance: number;
  price: number;
}

export interface PoliceInfo {
  police: BribeInfo;
  mayor: BribeInfo & { level: number; days: number };
  energy: number;
  risks: { official: number; black: number };
}

export interface BlackInfo {
  stages: TrainingStage[];
  limits: { min: number; max: number };
  energy: number;
  risk: number;
  fine: number;
  skill_chance: number;
  trained_today: boolean;
  challenges: { id: number; team: string; stage: string; bet: number; mine: boolean }[];
  history: { id: number; rival: string; stage: string; bet: number; won: boolean; my_ms: number; rival_ms: number; caught: boolean; at: string }[];
}

export interface MallInfo {
  crew: CrewMember[];
  energy: number;
  price: number;
  gain: number;
}

export interface GarageLevel {
  level: number;
  car_slots: number;
  next: { level: number; price: number; min_level: number; unlocks: string } | null;
}

export interface Garage {
  garage: GarageLevel;
  cars: { player_car_id: number; name: string; class_label: string; active: boolean }[];
  worker: string;
  car: {
    player_car_id: number;
    name: string;
    class: number;
    class_label: string;
    base: Stats;
    stats: Stats;
    fuel_consumption: number;
    health: number;
    problems: string[];
  } | null;
  slots: { type: string; label: string; item: PartItem | null }[];
  tyre: TyreItem | null;
  storage: StorageItem[];
  crew: CrewMember[];
  energy_costs: { mount: number; tyres: number; repair: number };
  spares: { tyres: number; parts: number };
}

export interface ShopCar {
  id: number;
  name: string;
  class_label: string;
  stats: Stats;
  fuel_consumption: number;
  price: number;
  min_level: number;
  locked: boolean;
  owned: boolean;
}

export interface Shop {
  cars: ShopCar[];
  trade_in: { name: string; value: number } | null;
  parts: ShopPart[];
  tyres: ShopTyre[];
  privileges: string[];
}

export interface BarRole {
  role: string;
  label: string;
  unlocked: boolean;
  unlock_level: number;
  current: { name: string; skill: number; salary: number } | null;
  candidates: { id: number; name: string; skill: number; salary: number }[];
}

export interface Contract {
  sponsor: string;
  city: string;
  status: string;
  status_label: string;
  progress: number;
  payment: number;
  goal_place: number;
  bonus: number;
  weeks: number;
  misses: number;
  ends_at: string | null;
}

export interface SponsorOffer {
  id: number;
  name: string;
  city: string;
  slot_label: string;
  min_level: number;
  locked: boolean;
  available: boolean;
  progress_step: number;
  risk: number;
  local: boolean;
  payment: number;
  goal_place: number;
  bonus: number;
  weeks: number;
}

export interface Sponsors {
  slots: { slot: string; label: string; unlock_level: number; unlocked: boolean; contract: Contract | null }[];
  offers: SponsorOffer[];
  energy_cost: number;
  misses_limit: number;
}

export interface InboxItem {
  text: string;
  at: string;
}

export interface ShopPart {
  id: number;
  name: string;
  type_label: string;
  class_label: string;
  bonuses: Stats;
  wear: number;
  price: number;
  base_price: number;
  min_level: number;
  locked: boolean;
}

export interface ShopTyre {
  id: number;
  name: string;
  type_label: string;
  compound_label: string;
  grip: Grip;
  wear: number;
  price: number;
  single_price: number;
  base_price: number;
  min_level: number;
  locked: boolean;
}

export interface SpareSelection {
  tyres: number[];
  parts: number[];
}

export interface SpareOption {
  id: number;
  name: string;
  type_label: string;
  health: number;
}

export interface TimelineStage {
  seq: number;
  id: number;
  name: string;
  length_km: number;
  turns: number;
  surface: string;
  difficulty: number;
  route: StageRoute | null;
}

export type { StageRoute } from './scenes/map/layout';
import type { StageRoute } from './scenes/map/layout';

export interface Leg {
  start: number;
  end: number | null;
  stop: boolean;
  pauses: [number, number][];
}

export interface TimelineCrew {
  id: number;
  number: number;
  pilot: string;
  class: number;
  is_me: boolean;
  legs: Record<string, Leg>;
}

export interface Timeline {
  start_at: string;
  weather: { start: 'dry' | 'rain' | 'snow'; change: { at: number; to: 'dry' | 'rain' | 'snow' } | null };
  revealed: number;
  duration: number;
  scale: number;
  finished: boolean;
  stages: TimelineStage[];
  crews: TimelineCrew[];
}

export interface Stage {
  id: number;
  name: string;
  length_km: number;
  surface: string;
  surface_label: string;
  profile_label: string;
  difficulty: number;
  turns: number;
}

export type RallyStatus = 'open' | 'closed' | 'live' | 'finished';

export interface RallySummary {
  id: number;
  name: string;
  season: number;
  city: string;
  home: boolean;
  start_at: string;
  deadline: string;
  recon_date: string;
  status: RallyStatus;
  stages: Stage[];
  total_km: number;
  costs: { entry_fee: number; travel: number; fuel: number; total: number };
  registered: boolean;
}

export interface ClassGroup<T> {
  class: number;
  label: string;
  rows: T[];
}

export interface LiveRow {
  team: string;
  pilot: string;
  stages: number;
  total_ms: number;
  dns: boolean;
  is_me: boolean;
}

export interface ResultRow {
  place: number;
  team: string;
  pilot: string;
  total_ms: number;
  status: string;
  points: number;
  prize: number;
  is_me: boolean;
}

export interface Broadcast {
  state: 'waiting' | 'live' | 'finished';
  progress?: number;
  ends_at?: string;
  events?: { offset: number; type: string; text: string }[];
  table?: ClassGroup<LiveRow>[];
  classification?: ClassGroup<ResultRow>[];
  timeline?: Timeline;
}

export interface RallyDetail extends RallySummary {
  weather: string | null;
  spares: {
    capacity: { tyres: number; parts: number };
    selected: SpareSelection;
    tyres: SpareOption[];
    parts: SpareOption[];
  };
  entry: { start_number: number; recon: boolean; styles: Record<string, string>; costs: number } | null;
  can_register: boolean;
  can_recon: boolean;
  can_change_styles: boolean;
  style_options: Record<string, string>;
  start_list: { start_number: number; team: string; class_label: string; is_me: boolean }[];
  broadcast: Broadcast | null;
}

export interface StandingRow {
  position: number;
  team: string;
  points: number;
  rallies: number;
  wins: number;
  is_me: boolean;
}

interface Response {
  message: string;
  player: Player | null;
}

function sync<T extends Response>(data: T): T {
  if (data.player) {
    session.player = data.player;
  }
  return data;
}

async function get<T>(path: string) {
  return sync(await apiGet<T & Response>(NS + path));
}

async function post<T>(path: string, body: unknown = {}) {
  return sync(await apiPost<T & Response>(NS + path, body));
}

export const getGarage = () => get<{ garage: Garage }>('garage');
export const mountItem = (itemId: number) => post<{ garage: Garage }>('garage/mount', { item_id: itemId });
export const repairItem = (itemId: number) => post<{ garage: Garage }>('garage/repair', { item_id: itemId });

export const upgradeGarage = () => post<{ garage: Garage }>('garage/upgrade');
export const setActiveCar = (playerCarId: number) => post<{ garage: Garage }>('garage/active', { player_car_id: playerCarId });
export const fireStaff = (staffId: number) => post<{ garage: Garage }>('staff/fire', { staff_id: staffId });

export const getShop = () => get<Shop>('shop');
export const buyItem = (kind: 'part' | 'tyre' | 'spare_tyre', id: number) => post<object>('shop/buy', { kind, id });
export const buyCar = (id: number) => post<Shop>('shop/buy-car', { id });

export const getBar = () => get<{ bar: { city: string; roles: BarRole[] } }>('bar');
export const hire = (candidateId: number) => post<{ bar: { city: string; roles: BarRole[] } }>('bar/hire', { candidate_id: candidateId });

export const getSponsors = () => get<{ sponsors: Sponsors }>('sponsors');
export const negotiate = (id: number) => post<{ sponsors: Sponsors }>(`sponsors/${id}/negotiate`);

export const getInbox = () => get<{ inbox: InboxItem[] }>('inbox');
export const getCity = () => get<{ city: { name: string; privileges: string[] } }>('city');

export const getTrack = () => get<{ track: TrackInfo }>('track');
export const trainOfficial = (stageId: number) => post<{ track: TrackInfo }>('track/train', { stage_id: stageId });

export const getPolice = () => get<{ police: PoliceInfo }>('police');
export const bribe = (institution: 'police' | 'mayor') => post<{ police: PoliceInfo }>('police/bribe', { institution });

export const getBlack = () => get<{ black: BlackInfo }>('black');
export const postChallenge = (stageId: number, bet: number) => post<{ black: BlackInfo }>('black/challenge', { stage_id: stageId, bet });
export const acceptChallenge = (id: number) => post<{ black: BlackInfo }>('black/accept', { challenge_id: id });
export const cancelChallenge = (id: number) => post<{ black: BlackInfo }>('black/cancel', { challenge_id: id });
export const raceBot = (stageId: number, bet: number) => post<{ black: BlackInfo }>('black/bot', { stage_id: stageId, bet });
export const trainBlack = (stageId: number) => post<{ black: BlackInfo }>('black/train', { stage_id: stageId });

export const getMall = () => get<{ mall: MallInfo }>('mall');
export const trainFitness = (staffId: number) => post<{ mall: MallInfo }>('mall/fitness', { staff_id: staffId });

export const getRallies = () => get<{ season: number; rallies: RallySummary[] }>('rallies');
export const getRally = (id: number) => get<{ rally: RallyDetail }>(`rallies/${id}`);
export const registerRally = (id: number, styles: Record<string, string>, spares: SpareSelection) =>
  post<{ rally: RallyDetail }>(`rallies/${id}/register`, { styles, spares });
export const saveStyles = (id: number, styles: Record<string, string>, spares: SpareSelection) =>
  post<{ rally: RallyDetail }>(`rallies/${id}/styles`, { styles, spares });
export const doRecon = (id: number) => post<{ rally: RallyDetail }>(`rallies/${id}/recon`);

export const getStandings = (season = 0) =>
  get<{ season: number; seasons: number[]; classes: ClassGroup<StandingRow>[] }>(`standings${season ? `?season=${season}` : ''}`);
