import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ── Capacitor native bridge ──
async function initCapacitor() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    document.body.classList.add('native-app');

    // Status bar — match app color, no overlay
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#212121' });
    await StatusBar.setOverlaysWebView({ overlay: false });

    // Get actual status bar height and apply as CSS variable
    const info = await StatusBar.getInfo();
    // Fallback: if overlay is somehow still on, push content down
    // Also set a CSS var for any component that needs it
    const sbHeight = (info as unknown as Record<string, unknown>).height;
    if (typeof sbHeight === 'number' && sbHeight > 0) {
      document.documentElement.style.setProperty('--status-bar-height', `${sbHeight}px`);
    } else {
      // Safe default for Android
      document.documentElement.style.setProperty('--status-bar-height', '28px');
    }

    // Splash screen
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });

    // Android back button
    const { App: CapApp } = await import('@capacitor/app');
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    // Haptics
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    (window as unknown as Record<string, unknown>).__haptics = {
      light: () => Haptics.impact({ style: ImpactStyle.Light }),
      medium: () => Haptics.impact({ style: ImpactStyle.Medium }),
      heavy: () => Haptics.impact({ style: ImpactStyle.Heavy }),
    };
  } catch {
    // Not native
  }
}

initCapacitor();
