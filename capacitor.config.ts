import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bgrallyrace.app',
  appName: 'BG Rally Race',
  webDir: 'dist-app',
  android: {
    backgroundColor: '#15171c',
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: true,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
