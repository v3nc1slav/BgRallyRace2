import { PushNotifications } from '@capacitor/push-notifications';
import { ApiError } from './api';
import { addPushDevice, removePushDevice, type NotifyInfo } from './game';
import { isApp, platform } from './platform';

const TOKEN_KEY = 'bgr_push_token';

export function storedPushToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function store(token: string) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    return;
  }
}

async function webToken(info: NotifyInfo) {
  if (!info.web) {
    throw new ApiError('Известията в браузъра още не са настроени от администратора.', 0);
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new ApiError('Този браузър или адрес не поддържа известия (нужен е HTTPS).', 0);
  }
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new ApiError('Известията са забранени в настройките на браузъра.', 0);
  }

  const [firebase, messaging] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  if (!(await messaging.isSupported())) {
    throw new ApiError('Този браузър не поддържа известия.', 0);
  }
  const { vapidKey, ...config } = info.web;
  const app = firebase.getApps()[0] ?? firebase.initializeApp(config);
  const registration = await navigator.serviceWorker.ready;
  return messaging.getToken(messaging.getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
}

async function appToken() {
  if ((await PushNotifications.requestPermissions()).receive !== 'granted') {
    throw new ApiError('Известията са забранени в настройките на телефона.', 0);
  }
  return new Promise<string>((resolve, reject) => {
    PushNotifications.addListener('registration', (token) => resolve(token.value));
    PushNotifications.addListener('registrationError', () => reject(new ApiError('Телефонът не можа да се регистрира за известия.', 0)));
    PushNotifications.register().catch(() => reject(new ApiError('Телефонът не можа да се регистрира за известия.', 0)));
  });
}

export async function enablePush(info: NotifyInfo) {
  if (!info.enabled) {
    throw new ApiError('Известията още не са настроени от администратора.', 0);
  }
  const token = isApp ? await appToken() : await webToken(info);
  const result = await addPushDevice(token, platform);
  store(token);
  return result;
}

export async function disablePush() {
  const result = await removePushDevice(storedPushToken());
  store('');
  return result;
}

export function listenPushTaps(navigate: (path: string) => void) {
  if (!isApp) {
    return;
  }
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const route = String(action.notification.data?.url ?? '').split('#')[1];
    if (route) {
      navigate(route);
    }
  });
}
