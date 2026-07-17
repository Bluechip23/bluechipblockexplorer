// The BlueChip contracts live on Osmosis: payments are OSMO (uosmo),
// addresses are osmo1..., and creator tokens are native TokenFactory
// denoms (factory/{pool_addr}/{subdenom}).
export const NATIVE_DENOM = 'uosmo';
export const COIN_DECIMALS = 6;

export interface ChainConfig {
    chainId: string;
    chainName: string;
    rpc: string;
    rest: string;
}

export const MAINNET_CONFIG: ChainConfig = {
    chainId: 'osmosis-1',
    chainName: 'Osmosis',
    rpc: 'https://rpc.osmosis.zone',
    rest: 'https://lcd.osmosis.zone',
};

// Keplr-compatible injected wallet API. Leap implements the same
// surface (enable, per-provider getOfflineSigner), so a single
// interface covers both extensions. Osmosis ships built-in with both,
// so no experimentalSuggestChain step is needed.
export interface InjectedWallet {
    enable: (chainId: string) => Promise<void>;
    getOfflineSigner?: (chainId: string) => import('@cosmjs/proto-signing').OfflineSigner;
}

declare global {
    interface Window {
        keplr?: InjectedWallet;
        leap?: InjectedWallet;
        getOfflineSigner?: (chainId: string) => import('@cosmjs/proto-signing').OfflineSigner;
    }
}

// Prefer Keplr when both extensions are installed (it registers the
// window-level getOfflineSigner fallback older code relies on).
export function detectInjectedWallet(): { name: 'Keplr' | 'Leap'; wallet: InjectedWallet } | null {
    if (window.keplr) return { name: 'Keplr', wallet: window.keplr };
    if (window.leap) return { name: 'Leap', wallet: window.leap };
    return null;
}
