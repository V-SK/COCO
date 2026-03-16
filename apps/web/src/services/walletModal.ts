import {
  appKitAdapter,
  bsc,
  metadata,
  networks,
  projectId,
  walletModalEnabled,
} from '@/config/wagmi';

type ModalView = 'Account' | 'Connect';
type AppKitInstance = {
  open: (options?: { view?: ModalView }) => Promise<void>;
};

let appKitPromise: Promise<AppKitInstance | null> | null = null;

async function loadAppKit(): Promise<AppKitInstance | null> {
  if (!walletModalEnabled || !appKitAdapter) {
    return null;
  }

  if (!appKitPromise) {
    appKitPromise = (async () => {
      const { createAppKit } = await import('@reown/appkit/react');

      return createAppKit({
        adapters: [appKitAdapter],
        networks: [...networks],
        defaultNetwork: bsc,
        projectId,
        metadata,
        themeMode: 'dark',
        themeVariables: {
          '--w3m-accent': '#F0B90B',
          '--w3m-border-radius-master': '12px',
        },
        features: {
          analytics: false,
        },
      }) as AppKitInstance;
    })();
  }

  return appKitPromise;
}

export async function openWalletModal(view?: ModalView): Promise<boolean> {
  const appKit = await loadAppKit();
  if (!appKit) {
    return false;
  }

  await appKit.open(view ? { view } : undefined);
  return true;
}
