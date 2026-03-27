import React, { createContext, useContext, useState, useCallback } from 'react';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Coin } from '@cosmjs/stargate';
import { MAINNET_CONFIG } from '../defi/types';

interface WalletContextType {
    client: SigningCosmWasmClient | null;
    address: string;
    balance: Coin | null;
    connecting: boolean;
    error: string;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
    client: null,
    address: '',
    balance: null,
    connecting: false,
    error: '',
    connect: async () => {},
    disconnect: () => {},
});

export const useWallet = () => useContext(WalletContext);

export const WalletContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [client, setClient] = useState<SigningCosmWasmClient | null>(null);
    const [address, setAddress] = useState('');
    const [balance, setBalance] = useState<Coin | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState('');

    const connect = useCallback(async () => {
        setError('');
        setConnecting(true);

        if (!window.getOfflineSigner || !window.keplr) {
            setError('Please install Keplr extension');
            setConnecting(false);
            return;
        }

        try {
            await window.keplr.experimentalSuggestChain(MAINNET_CONFIG);
            await window.keplr.enable(MAINNET_CONFIG.chainId);

            const offlineSigner = window.getOfflineSigner(MAINNET_CONFIG.chainId);
            const accounts = await offlineSigner.getAccounts();
            const addr = accounts[0].address;

            const signingClient = await SigningCosmWasmClient.connectWithSigner(
                MAINNET_CONFIG.rpc,
                offlineSigner
            );

            const bal = await signingClient.getBalance(addr, 'ubluechip');

            setClient(signingClient);
            setAddress(addr);
            setBalance(bal);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to connect: ${message}`);
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setClient(null);
        setAddress('');
        setBalance(null);
        setError('');
    }, []);

    return (
        <WalletContext.Provider value={{ client, address, balance, connecting, error, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
};
