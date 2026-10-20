import { reactive } from 'vue';
import { apiGet, apiPost, setNonce, setToken } from './api';
import { deviceName, isApp } from './platform';

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
  job: { name: string; pay: number; energy: number } | null;
  loan: { remaining: number; next: number; overdue: number } | null;
  perks: { discount: number; retry: boolean };
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

export interface Providers {
  google: string | null;
  facebook: string | null;
  facebook_token: string | null;
}

export interface Links {
  privacy: string | null;
  deletion: string | null;
}

interface State {
  user: User | null;
  player: Player | null;
  nonce: string;
  token?: string;
  providers: Providers;
  links: Links;
  message?: string;
}

export const session = reactive({
  loaded: false,
  error: '',
  fatal: '',
  user: null as User | null,
  player: null as Player | null,
  providers: { google: null, facebook: null, facebook_token: null } as Providers,
  links: { privacy: null, deletion: null } as Links,
});

function apply(state: State) {
  if (state.token) {
    setToken(state.token);
  } else if (!state.user) {
    setToken('');
  }
  setNonce(state.nonce);
  session.user = state.user;
  session.player = state.player;
  session.providers = state.providers;
  session.links = state.links;
  session.loaded = true;
  session.error = '';
}

const appMode = () => (isApp ? { mode: 'token', device: deviceName() } : {});

export async function loadSession() {
  apply(await apiGet<State>(NS + 'me'));
}

export async function login(login: string, password: string, remember: boolean) {
  apply(await apiPost<State>(NS + 'auth/login', { login, password, remember, ...appMode() }));
}

export async function register(data: Registration) {
  apply(await apiPost<State>(NS + 'auth/register', { ...data, ...appMode() }));
}

export async function socialLogin(provider: 'google' | 'facebook', token: string) {
  apply(await apiPost<State>(NS + 'auth/social', { provider, token, ...appMode() }));
}

export async function createPlayer(cityId: number) {
  apply(await apiPost<State>(NS + 'player', { city_id: cityId }));
}

export async function logout() {
  apply(await apiPost<State>(NS + 'auth/logout'));
  setToken('');
}

export async function deleteAccount(confirm: string) {
  const state = await apiPost<State>(NS + 'account/delete', { confirm });
  setToken('');
  apply(state);
  return state.message ?? '';
}

export function fetchCities() {
  return apiGet<City[]>(NS + 'cities');
}
