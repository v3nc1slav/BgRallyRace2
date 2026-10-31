import { createRouter, createWebHashHistory } from 'vue-router';
import { errorMessage } from './api';
import { loadSession, session } from './session';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/garage', component: () => import('./views/GarageView.vue') },
    { path: '/garage/staff', component: () => import('./views/GarageStaffView.vue') },
    { path: '/city', component: () => import('./views/CityView.vue') },
    { path: '/city/bar', component: () => import('./views/BarView.vue') },
    { path: '/city/track', component: () => import('./views/TrackView.vue') },
    { path: '/city/police', component: () => import('./views/PoliceView.vue') },
    { path: '/city/hall', component: () => import('./views/CityHallView.vue') },
    { path: '/city/jobs', component: () => import('./views/JobsView.vue') },
    { path: '/city/black', component: () => import('./views/BlackTrackView.vue') },
    { path: '/city/mall', component: () => import('./views/MallView.vue') },
    { path: '/city/market', component: () => import('./views/MarketView.vue') },
    { path: '/city/bank', component: () => import('./views/BankView.vue') },
    { path: '/forum', component: () => import('./views/ForumView.vue') },
    { path: '/forum/:id', component: () => import('./views/ForumTopicView.vue') },
    { path: '/profile', component: () => import('./views/ProfileView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
    { path: '/shop', component: () => import('./views/ShopView.vue') },
    { path: '/sponsors', component: () => import('./views/SponsorsView.vue') },
    { path: '/rallies', component: () => import('./views/RalliesView.vue') },
    { path: '/rallies/:id', component: () => import('./views/RallyView.vue') },
    { path: '/standings', component: () => import('./views/StandingsView.vue') },
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { guest: true } },
    { path: '/register', component: () => import('./views/RegisterView.vue'), meta: { guest: true } },
    { path: '/forgot', component: () => import('./views/ForgotView.vue'), meta: { guest: true } },
    { path: '/reset', component: () => import('./views/ResetView.vue'), meta: { open: true } },
    { path: '/confirm', component: () => import('./views/ConfirmView.vue'), meta: { open: true } },
    { path: '/start', component: () => import('./views/StartView.vue') },
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

  if (to.meta.open) {
    return true;
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
