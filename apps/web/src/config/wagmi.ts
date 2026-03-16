import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { bsc } from '@reown/appkit/networks';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WC_PROJECT_ID || '';

const metadata = {
  name: 'Coco AI',
  description: 'BNB Chain AI Trading Agent',
  url: 'https://coco.ai',
  icons: ['/favicon.svg'],
};

const networks = [bsc] as const;

export const walletModalEnabled = Boolean(projectId);
export { bsc, metadata, networks, projectId };

export const appKitAdapter = walletModalEnabled
  ? new WagmiAdapter({
      projectId,
      networks: [...networks],
    })
  : null;

export const wagmiConfig =
  appKitAdapter?.wagmiConfig ??
  createConfig({
    chains: [bsc],
    connectors: [injected()],
    transports: {
      [bsc.id]: http('https://bsc-dataseed.binance.org'),
    },
  });
