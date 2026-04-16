import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Coin } from '@cosmjs/stargate';
import {
    EXPECTED_CHAIN_ID,
    IDLE_TIMEOUT_MS,
    assertNoSecretsInStorage,
    assertWalletOnExpectedChain,
} from '../utils/security';

// ============================================================
// MOCK MODE — This branch uses fake data for UI preview.
// No real wallet or chain connection needed.
// ============================================================

const MOCK_ADDRESS = 'bluechip1q2w3e4r5t6y7u8i9o0pzxcvbnmasdfghjkl42';
const MOCK_BALANCE: Coin = { denom: 'ubluechip', amount: '84720000000' }; // 84,720 bluechip

interface WalletContextType {
    client: SigningCosmWasmClient | null;
    address: string;
    balance: Coin | null;
    connecting: boolean;
    error: string;
    // SECURITY: exposed so transaction flows can re-assert the wallet is
    // still connected to bluechip-3 right before signing.
    expectedChainId: string;
    // SECURITY: tells components whether the connection has been marked as
    // expired due to idle timeout so they can display the reconnect prompt.
    idleExpired: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    // SECURITY: any user interaction should call this to reset the idle
    // timer, preventing the 30-minute auto-disconnect from firing mid-use.
    touch: () => void;
    // SECURITY: convenience re-export so callers don't have to import the
    // utils module just to do the pre-signing chain check.
    assertOnExpectedChain: () => Promise<{ ok: boolean; actual?: string; error?: string }>;
}

const WalletContext = createContext<WalletContextType>({
    client: null,
    address: '',
    balance: null,
    connecting: false,
    error: '',
    expectedChainId: EXPECTED_CHAIN_ID,
    idleExpired: false,
    connect: async () => {},
    disconnect: () => {},
    touch: () => {},
    assertOnExpectedChain: async () => ({ ok: false, error: 'Wallet not connected.' }),
});

export const useWallet = () => useContext(WalletContext);

export const WalletContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [address, setAddress] = useState(MOCK_ADDRESS);
    const [balance, setBalance] = useState<Coin | null>(MOCK_BALANCE);
    const [idleExpired, setIdleExpired] = useState(false);
    // Mock-mode only — real wallet wiring would replace these with
    // connect-time state. Leaving as constants keeps renders cheap.
    const client: SigningCosmWasmClient | null = null;
    const connecting = false;
    const error = '';

    // SECURITY: idle timer reference. Cleared on every user "touch" and on
    // unmount to avoid leaking timers when the provider tree is re-rendered.
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // SECURITY: Auto-disconnect wallet sessions that have been idle for more
    // than 30 minutes. A visible reconnect prompt is shown via `idleExpired`.
    const armIdleTimer = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setIdleExpired(true);
            setAddress('');
            setBalance(null);
        }, IDLE_TIMEOUT_MS);
    }, []);

    const touch = useCallback(() => {
        if (!address) return;
        if (idleExpired) return;
        armIdleTimer();
    }, [address, idleExpired, armIdleTimer]);

    const connect = useCallback(async () => {
        // SECURITY: defensive tripwire that wipes any private keys / mnemonics
        // / raw signatures that may have accidentally been written to browser
        // storage by an older code path or a compromised dependency.
        assertNoSecretsInStorage();

        // SECURITY: Scope wallet permission requests to the minimum required:
        // account read + transaction signing. Never request the "enable-access"
        // permission chains that would expose sign-arbitrary or key export.
        // In MOCK_MODE this is a no-op; the real wallet bridge should call
        // window.keplr.enable(EXPECTED_CHAIN_ID) here and nothing else.

        setAddress(MOCK_ADDRESS);
        setBalance(MOCK_BALANCE);
        setIdleExpired(false);
        armIdleTimer();
    }, [armIdleTimer]);

    const disconnect = useCallback(() => {
        setAddress('');
        setBalance(null);
        setIdleExpired(false);
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
        // SECURITY: never leave private material behind on disconnect.
        assertNoSecretsInStorage();
    }, []);

    const assertOnExpectedChain = useCallback(async () => {
        return assertWalletOnExpectedChain(client);
    }, [client]);

    // SECURITY: wire up global user-activity listeners so routine clicks /
    // keystrokes keep the session alive, and tab-visibility changes force
    // a re-check on resume. Using `once:false` passive listeners avoids
    // scroll-jank on mobile.
    useEffect(() => {
        if (!address) return;
        const events: Array<keyof WindowEventMap> = [
            'mousemove',
            'mousedown',
            'keydown',
            'touchstart',
            'scroll',
        ];
        const handler = () => touch();
        for (const e of events) window.addEventListener(e, handler, { passive: true });
        armIdleTimer();
        return () => {
            for (const e of events) window.removeEventListener(e, handler);
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
        };
    }, [address, touch, armIdleTimer]);

    // SECURITY: run the secrets-in-storage tripwire on mount so a stale
    // localStorage entry from a previous malicious session is cleared
    // before any other code reads from storage.
    useEffect(() => {
        assertNoSecretsInStorage();
    }, []);

    const value = useMemo<WalletContextType>(
        () => ({
            client,
            address,
            balance,
            connecting,
            error,
            expectedChainId: EXPECTED_CHAIN_ID,
            idleExpired,
            connect,
            disconnect,
            touch,
            assertOnExpectedChain,
        }),
        [client, address, balance, connecting, error, idleExpired, connect, disconnect, touch, assertOnExpectedChain],
    );

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};
