import { reactive } from 'vue';
import { apiGet, apiPost, setNonce } from './api';

export const NS = 'bgrally/v1/';

export interface User {
  id: number;
  name: string;
}

export interface Player {
  id: number;
  city_id: number;
  city: string;
  money: number;
  xp: number;
  xp_level: number;
  xp_next: number | null;
  level: number;
  energy: number;
  energy_max: number;
}

export interface City {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface Registration {
  username: string;
  email: string;
  password: string;
  city_id: number;
}

interface State {
  user: User | null;
  player: Player | null;
  nonce: string;
}

export const session = reactive({
  loaded: false,
  error: '',
  user: null as User | null,
  player: null as Player | null,
});

function apply(state: State) {
  setNonce(state.nonce);
  session.user = state.user;
  session.player = state.player;
  session.loaded = true;
  session.error = '';
}

export async function loadSession() {
  apply(await apiGet<State>(NS + 'me'));
}

export async function login(login: string, password: string, remember: boolean) {
  apply(await apiPost<State>(NS + 'auth/login', { login, password, remember }));
}

export async function register(data: Registration) {
  apply(await apiPost<State>(NS + 'auth/register', data));
}

export async function createPlayer(cityId: number) {
  apply(await apiPost<State>(NS + 'player', { city_id: cityId }));
}

export async function logout() {
  apply(await apiPost<State>(NS + 'auth/logout'));
}

export function fetchCities() {
  return apiGet<City[]>(NS + 'cities');
}
