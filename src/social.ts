import { SocialLogin } from '@capgo/capacitor-social-login';
import { ApiError } from './api';
import { t } from './i18n';
import { session, socialLogin } from './session';

let ready: Promise<void> | null = null;

function initialize() {
  ready ??= SocialLogin.initialize({
    google: session.providers.google ? { webClientId: session.providers.google, mode: 'online' } : undefined,
    facebook: session.providers.facebook
      ? { appId: session.providers.facebook, clientToken: session.providers.facebook_token ?? undefined, locale: 'bg_BG' }
      : undefined,
  });
  return ready;
}

async function providerToken(provider: 'google' | 'facebook') {
  await initialize();
  if (provider === 'google') {
    const { result } = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
    return 'idToken' in result ? result.idToken : null;
  }
  const { result } = await SocialLogin.login({ provider: 'facebook', options: { permissions: ['email', 'public_profile'] } });
  return result.accessToken?.token ?? null;
}

export async function loginWith(provider: 'google' | 'facebook') {
  let token: string | null;
  try {
    token = await providerToken(provider);
  } catch {
    throw new ApiError(t('auth.socialCancelled'), 0);
  }
  if (!token) {
    throw new ApiError(t('auth.socialEmpty'), 0);
  }
  await socialLogin(provider, token);
}
