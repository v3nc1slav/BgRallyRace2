import { Capacitor } from '@capacitor/core';

export const isApp = Capacitor.isNativePlatform();
export const platform = isApp ? 'app' : 'web';
export const deviceName = () => (isApp ? `${Capacitor.getPlatform()} app` : 'web');
