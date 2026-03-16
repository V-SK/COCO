import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coco.ai',
  appName: 'Coco AI',
  webDir: 'dist',
  server: {
    // In production, load from local files
    // For dev, uncomment to use live server:
    // url: 'http://192.168.1.x:5173',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
    overScrollMode: 'never',
  },
};

export default config;
