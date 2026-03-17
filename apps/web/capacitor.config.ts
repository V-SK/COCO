import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coco.ai',
  appName: 'Coco AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#212121',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#212121',
      overlaysWebView: false,
    },
  },
  android: {
    backgroundColor: '#212121',
    allowMixedContent: true,
    overScrollMode: 'never',
  },
};

export default config;
