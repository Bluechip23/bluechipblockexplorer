import React, { createContext, useContext, useState, useCallback } from 'react';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Coin } from '@cosmjs/stargate';

// ============================================================
// MOCK MODE — This branch uses fake data for UI preview.
// No real wallet or chain connection needed.
// ============================================================

const MOCK_ADDRESS = 'bluechip1q2w3e4r5t6y7u8i9o0pzxcvbnmasdfghjkl42';
const MOCK_BALANCE: Coin = { denom: 'ubluechip', amount: '84720000000' }; // 84,720 BLUECHIP

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
    const [address, setAddress] = useState(MOCK_ADDRESS);
    const [balance, setBalance] = useState<Coin | null>(MOCK_BALANCE);
    const [connecting] = useState(false);
    const [error] = useState('');

    const connect = useCallback(async () => {
        setAddress(MOCK_ADDRESS);
        setBalance(MOCK_BALANCE);
    }, []);

    const disconnect = useCallback(() => {
        setAddress('');
        setBalance(null);
    }, []);

    return (
        <WalletContext.Provider value={{ client: null, address, balance, connecting, error, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
};
