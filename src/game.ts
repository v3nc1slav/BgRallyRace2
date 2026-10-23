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
  fuel_pct: number;
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
  own: { status: '' | 'building' | 'open' | 'closed'; km: number; fuel: number };
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
  reports: { id: number; name: string; start_at: string }[];
  report_energy: number;
  report_days: number;
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

export interface ClothingItem {
  id: number;
  name: string;
  slot: string;
  slot_label: string;
  bonus: number;
  price: number;
  min_level: number;
  locked: boolean;
  item_id: number | null;
  equipped: boolean;
}

export interface MallInfo {
  crew: CrewMember[];
  energy: number;
  price: number;
  gain: number;
  clothes: { bonus: number; items: ClothingItem[] };
}

export interface HallInfo {
  energy: number;
  clothes_bonus: number;
  permit: { has: boolean; by_bribe: boolean; chance: number; refused_today: boolean; next_level: number | null };
  track: {
    status: '' | 'building' | 'open' | 'closed';
    status_label: string;
    ready_at: string | null;
    level: number;
    cost: number;
    weeks: number;
    chance: number;
    refused_today: boolean;
    banned: boolean;
  };
  bribe: BribeInfo & { level: number; days: number };
  move: {
    cost: number;
    energy: number;
    sponsor_risk: number;
    blocked: string;
    cities: { id: number; name: string; privileges: string[]; price_pct: number }[];
  };
}

export interface JobInfo {
  id: number;
  name: string;
  building: string;
  pay: number;
  energy: number;
  min_level: number;
  locked: boolean;
}

export interface JobsInfo {
  season: number;
  current: Omit<JobInfo, 'min_level' | 'locked'> | null;
  can_take: boolean;
  locked_reason: string;
  jobs: JobInfo[];
}

export interface NotifyInfo {
  enabled: boolean;
  web: { apiKey: string; messagingSenderId: string; appId: string; vapidKey: string; projectId: string } | null;
  devices: number;
  types: { key: string; label: string; on: boolean }[];
}

export interface AdReward {
  key: 'energy' | 'money' | 'discount' | 'retry';
  label: string;
  daily: number;
  left: number;
  blocked: string;
}

export interface AdsInfo {
  cooldown: number;
  rewards: AdReward[];
}

export interface AdStart {
  view_id: number;
  token: string;
  label: string;
  seconds: number;
  provider: 'test' | 'gpt' | 'admob';
  gpt_unit: string;
  publisher: string;
  admob_unit: string;
  ssv_data: string;
  user: string;
}

export type MarketKind ='part' | 'tyre' | 'spare_tyre' | 'car';

export interface MarketDetails {
  label: string;
  health: number;
  max_health: number;
  defect: boolean | null;
}

export interface MarketListing {
  id: number;
  kind: MarketKind;
  kind_label: string;
  name: string;
  details: MarketDetails;
  base_price: number;
  price: number;
  delivery: number;
  seller: string;
  city: string;
  expires_at: string;
}

export interface MarketAsset {
  kind: MarketKind;
  id: number;
  name: string;
  details: MarketDetails;
  base: number;
  dealer: number;
  min: number;
  max: number;
}

export interface MarketInfo {
  listings: MarketListing[];
  mine: MarketListing[];
  sellable: MarketAsset[];
  rules: { can_sell: boolean; sell_level: number; energy: number; days: number; fee: number; mechanic: boolean; blocked: boolean };
}

export interface MarketQuery {
  scope: 'all' | 'city';
  filter: '' | 'part' | 'tyre' | 'car';
}

export interface FinanceCategory {
  key: string;
  label: string;
  amount: number;
}

export interface FinancePoint {
  id: number;
  name: string;
  income: number;
  expense: number;
  balance: number;
  current: boolean;
}

export interface FinanceInfo {
  season: number;
  seasons: number[];
  current: boolean;
  totals: { income: number; expense: number; opening: number; closing: number };
  income: FinanceCategory[];
  expense: FinanceCategory[];
  rallies: FinancePoint[];
}

export interface Loan {
  principal: number;
  interest: number;
  weeks: number;
  installment: number;
  remaining: number;
  overdue: number;
  missed: number;
  weeks_passed: number;
  next: number;
  payoff: number;
  created_at: string;
}

export interface BankInfo {
  max: number;
  min: number;
  energy: number;
  penalty: number;
  seize_after: number;
  seize_pct: number;
  terms: { weeks: number; rate: number }[];
  loan: Loan | null;
}

export interface ChatMessage {
  id: number;
  author: string;
  own: boolean;
  text: string;
  at: string;
}

export interface ChatInfo {
  messages: ChatMessage[];
  muted_until: string | null;
  max_length: number;
}

export interface ForumTopic {
  id: number;
  section: string;
  section_label: string;
  title: string;
  author: string;
  posts: number;
  last_post_at: string;
}

interface ForumRules {
  can_create: boolean;
  topic_level: number;
  max_length: number;
  muted_until: string | null;
}

export interface ForumInfo extends ForumRules {
  section: string;
  sections: { key: string; label: string; topics: number }[];
  topics: ForumTopic[];
}

export interface TopicInfo extends ForumRules {
  topic: ForumTopic;
  posts: ChatMessage[];
  page: number;
  pages: number;
}

export interface GarageLevel {
  permit: boolean;
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
    fuel_base: number;
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
  base_price: number;
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
  price_pct: number;
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
  fuel_pct: number;
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
  intel: RallyIntel | null;
  broadcast: Broadcast | null;
}

export interface Suspect {
  team: string;
  chance: number;
}

export interface ScoutReport {
  team: string;
  car: string;
  tyre: { name: string; health: number } | null;
  parts: { label: string; name: string; health: number }[] | null;
  crew: { pilot: number; navigator: number } | null;
}

export interface SabotagePanel {
  saboteur: { name: string; skill: number };
  open: boolean;
  used_week: boolean;
  cost: number;
  energy: number;
  level_gap: number;
  kinds: Record<string, string>;
  targets: { id: number; team: string; level: number }[];
  orders: { team: string; kind_label: string; status_label: string; caught: boolean }[];
}

export interface RallyIntel {
  informant: { name: string; skill: number } | null;
  scouting: ScoutReport[] | null;
  warnings: { at: string; suspects: Suspect[] | null }[];
  sabotage: SabotagePanel | null;
}

export interface Rumor {
  text: string;
  at: string;
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

export const resolveComeback = (choice: 'fresh' | 'continue') => post<object>('comeback', { choice });

export const getGarage = () => get<{ garage: Garage }>('garage');
export const mountItem = (itemId: number) => post<{ garage: Garage }>('garage/mount', { item_id: itemId });
export const repairItem = (itemId: number) => post<{ garage: Garage }>('garage/repair', { item_id: itemId });

export const upgradeGarage = () => post<{ garage: Garage }>('garage/upgrade');
export const setActiveCar = (playerCarId: number) => post<{ garage: Garage }>('garage/active', { player_car_id: playerCarId });
export const fireStaff = (staffId: number) => post<{ garage: Garage }>('staff/fire', { staff_id: staffId });

export const getShop = () => get<Shop>('shop');
export const buyItem = (kind: 'part' | 'tyre' | 'spare_tyre', id: number) => post<object>('shop/buy', { kind, id });
export const buyCar = (id: number) => post<Shop>('shop/buy-car', { id });

export interface BarInfo {
  city: string;
  roles: BarRole[];
  rumors: Rumor[];
  rumors_named: boolean;
}

export const getBar = () => get<{ bar: BarInfo }>('bar');
export const hire = (candidateId: number) => post<{ bar: BarInfo }>('bar/hire', { candidate_id: candidateId });

export const getSponsors = () => get<{ sponsors: Sponsors }>('sponsors');
export const negotiate = (id: number) => post<{ sponsors: Sponsors }>(`sponsors/${id}/negotiate`);

export const getInbox = () => get<{ inbox: InboxItem[] }>('inbox');
export interface OwnTrack {
  status: '' | 'building' | 'open' | 'closed';
  ready_at: string | null;
  progress: number;
}

export interface CityBadge {
  key: string;
  text: string;
}

export const getCity = () => get<{ city: { name: string; privileges: string[]; perks: string; own_track: OwnTrack; badges: CityBadge[] } }>('city');

export const getTrack = () => get<{ track: TrackInfo }>('track');
export const trainOfficial = (stageId: number) => post<{ track: TrackInfo }>('track/train', { stage_id: stageId });

export const getPolice = () => get<{ police: PoliceInfo }>('police');
export const bribe = (institution: 'police' | 'mayor') => post<{ police: PoliceInfo }>('police/bribe', { institution });
export const reportSabotage = (rallyId: number) => post<{ police: PoliceInfo }>('police/report', { rally_id: rallyId });

export const getBlack = () => get<{ black: BlackInfo }>('black');
export const postChallenge = (stageId: number, bet: number) => post<{ black: BlackInfo }>('black/challenge', { stage_id: stageId, bet });
export const acceptChallenge = (id: number) => post<{ black: BlackInfo }>('black/accept', { challenge_id: id });
export const cancelChallenge = (id: number) => post<{ black: BlackInfo }>('black/cancel', { challenge_id: id });
export const raceBot = (stageId: number, bet: number) => post<{ black: BlackInfo }>('black/bot', { stage_id: stageId, bet });
export const trainBlack = (stageId: number) => post<{ black: BlackInfo }>('black/train', { stage_id: stageId });

export const getMall = () => get<{ mall: MallInfo }>('mall');
export const trainFitness = (staffId: number) => post<{ mall: MallInfo }>('mall/fitness', { staff_id: staffId });
export const buyClothes = (id: number) => post<{ mall: MallInfo }>('mall/buy', { id });
export const wearClothes = (itemId: number) => post<{ mall: MallInfo }>('mall/wear', { item_id: itemId });

export const getHall = () => get<{ hall: HallInfo }>('hall');
export const negotiateMayor = (kind: 'garage' | 'track') => post<{ hall: HallInfo }>('hall/negotiate', { kind });
export const moveCity = (cityId: number) => post<{ hall: HallInfo }>('hall/move', { city_id: cityId });
export const trainOwn = () => post<{ track: TrackInfo }>('track/own');

export const getJobs = () => get<{ jobs: JobsInfo }>('jobs');
export const takeJob = (id: number) => post<{ jobs: JobsInfo }>('jobs/take', { id });
export const quitJob = () => post<{ jobs: JobsInfo }>('jobs/quit');

type NotifyResult = { notifications: NotifyInfo };
export const getNotifications = () => get<NotifyResult>('notifications');
export const saveNotificationPreferences = (on: string[]) => post<NotifyResult>('notifications/preferences', { on });
export const addPushDevice = (token: string, platform: string) => post<NotifyResult>('notifications/device', { token, platform });
export const removePushDevice = (token: string) => post<NotifyResult>('notifications/device/remove', { token });

export const getAds = () => get<{ ads: AdsInfo }>('ads');
export const startAd = (reward: string, platform: string) => post<{ ad: AdStart }>('ads/start', { reward, platform });
export const claimAd = (viewId: number, token: string) => post<{ ads: AdsInfo }>('ads/claim', { view_id: viewId, token });

type MarketResult = { market: MarketInfo };
export const getMarket = (query: MarketQuery) => get<MarketResult>(`market?scope=${query.scope}&filter=${query.filter}`);
export const listOnMarket = (query: MarketQuery, kind: MarketKind, id: number, price: number) =>
  post<MarketResult>('market/list', { ...query, kind, id, price });
export const cancelListing = (query: MarketQuery, id: number) => post<MarketResult>('market/cancel', { ...query, id });
export const buyListing = (query: MarketQuery, id: number) => post<MarketResult>('market/buy', { ...query, id });
export const sellToDealer = (query: MarketQuery, kind: MarketKind, id: number) => post<MarketResult>('market/dealer', { ...query, kind, id });

export const getBank = () => get<{ bank: BankInfo }>('bank');
export const getFinance = (season?: number) => get<{ finance: FinanceInfo }>(`finance${season === undefined ? '' : `?season=${season}`}`);
export const takeLoan = (amount: number, weeks: number) => post<{ bank: BankInfo }>('bank/loan', { amount, weeks });
export const repayLoan = () => post<{ bank: BankInfo }>('bank/repay');
export const payOverdue = () => post<{ bank: BankInfo }>('bank/pay');

export const getChat = (after = 0) => get<{ chat: ChatInfo }>(`chat${after ? `?after=${after}` : ''}`);
export const sendChat = (text: string, after: number) => post<{ chat: ChatInfo }>('chat', { text, after });
export const reportMessage = (id: number) => post<object>('talk/report', { id });
export const getForum = (section = '') => get<{ forum: ForumInfo }>(`forum${section ? `?section=${section}` : ''}`);
export const getTopic = (id: number, page = 1) => get<{ topic: TopicInfo }>(`forum/topics/${id}?page=${page}`);
export const createTopic = (section: string, title: string, text: string) => post<{ topic: TopicInfo }>('forum/topics', { section, title, text });
export const replyTopic = (id: number, text: string) => post<{ topic: TopicInfo }>(`forum/topics/${id}/reply`, { text });

export const getRallies = () => get<{ season: number; rallies: RallySummary[] }>('rallies');
export const getRally = (id: number) => get<{ rally: RallyDetail }>(`rallies/${id}`);
export const registerRally = (id: number, styles: Record<string, string>, spares: SpareSelection) =>
  post<{ rally: RallyDetail }>(`rallies/${id}/register`, { styles, spares });
export const saveStyles = (id: number, styles: Record<string, string>, spares: SpareSelection) =>
  post<{ rally: RallyDetail }>(`rallies/${id}/styles`, { styles, spares });
export const doRecon = (id: number) => post<{ rally: RallyDetail }>(`rallies/${id}/recon`);
export const orderSabotage = (id: number, targetId: number, kind: string) =>
  post<{ rally: RallyDetail }>(`rallies/${id}/sabotage`, { target_id: targetId, kind });

export const getStandings = (season = 0) =>
  get<{ season: number; seasons: number[]; classes: ClassGroup<StandingRow>[] }>(`standings${season ? `?season=${season}` : ''}`);
