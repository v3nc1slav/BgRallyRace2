import { createRouter, createWebHashHistory } from 'vue-router';
import { errorMessage } from './api';
import { loadSession, session } from './session';
import BankView from './views/BankView.vue';
import BarView from './views/BarView.vue';
import BlackTrackView from './views/BlackTrackView.vue';
import CityHallView from './views/CityHallView.vue';
import CityView from './views/CityView.vue';
import ForumTopicView from './views/ForumTopicView.vue';
import ForumView from './views/ForumView.vue';
import GarageView from './views/GarageView.vue';
import HomeView from './views/HomeView.vue';
import JobsView from './views/JobsView.vue';
import LoginView from './views/LoginView.vue';
import MallView from './views/MallView.vue';
import MarketView from './views/MarketView.vue';
import PoliceView from './views/PoliceView.vue';
import ProfileView from './views/ProfileView.vue';
import RalliesView from './views/RalliesView.vue';
import RallyView from './views/RallyView.vue';
import RegisterView from './views/RegisterView.vue';
import SettingsView from './views/SettingsView.vue';
import ShopView from './views/ShopView.vue';
import SponsorsView from './views/SponsorsView.vue';
import StandingsView from './views/StandingsView.vue';
import StartView from './views/StartView.vue';
import TrackView from './views/TrackView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/garage', component: GarageView },
    { path: '/city', component: CityView },
    { path: '/city/bar', component: BarView },
    { path: '/city/track', component: TrackView },
    { path: '/city/police', component: PoliceView },
    { path: '/city/hall', component: CityHallView },
    { path: '/city/jobs', component: JobsView },
    { path: '/city/black', component: BlackTrackView },
    { path: '/city/mall', component: MallView },
    { path: '/city/market', component: MarketView },
    { path: '/city/bank', component: BankView },
    { path: '/forum', component: ForumView },
    { path: '/forum/:id', component: ForumTopicView },
    { path: '/profile', component: ProfileView },
    { path: '/settings', component: SettingsView },
    { path: '/shop', component: ShopView },
    { path: '/sponsors', component: SponsorsView },
    { path: '/rallies', component: RalliesView },
    { path: '/rallies/:id', component: RallyView },
    { path: '/standings', component: StandingsView },
    { path: '/login', component: LoginView, meta: { guest: true } },
    { path: '/register', component: RegisterView, meta: { guest: true } },
    { path: '/start', component: StartView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  if (!session.loaded) {
    try {
      await loadSession();
    } catch (error) {
      session.fatal = errorMessage(error);
      session.loaded = true;
    }
  }

  if (!session.user) {
    return to.meta.guest ? true : '/login';
  }
  if (!session.player) {
    return to.path === '/start' ? true : '/start';
  }
  if (to.meta.guest || to.path === '/start') {
    return '/';
  }
  return true;
});
