import React, { useState } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Coin } from '@cosmjs/stargate';
import { WalletConnectProps, ChainConfig, MAINNET_CONFIG } from './types';

const WalletConnect: React.FC<WalletConnectProps> = ({ setClient, setAddress, setBalance }) => {
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [error, setError] = useState<string>('');

    const connectToChain = async (config: ChainConfig, denom: string): Promise<void> => {
        setError('');

        if (!window.getOfflineSigner || !window.keplr) {
            setError('Please install Keplr extension');
            return;
        }

        try {
            await window.keplr.experimentalSuggestChain(config);
            await window.keplr.enable(config.chainId);

            const offlineSigner = window.getOfflineSigner(config.chainId);
            const accounts = await offlineSigner.getAccounts();
            const address = accounts[0].address;

            setWalletAddress(address);
            setAddress(address);

            const client = await SigningCosmWasmClient.connectWithSigner(
                config.rpc,
                offlineSigner
            );
            setClient(client);

            const balance = await client.getBalance(address, denom);
            setBalance(balance);

        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed to connect: ${message}`);
        }
    };

    const connectMainnet = (): Promise<void> => {
        return connectToChain(MAINNET_CONFIG, 'ubluechip');
    };

    const disconnect = () => {
        setWalletAddress('');
        setAddress('');
        setClient(null);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {walletAddress ? (
                <>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {walletAddress.slice(0, 14)}...{walletAddress.slice(-6)}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={disconnect}>
                        Disconnect
                    </Button>
                </>
            ) : (
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AccountBalanceWalletIcon />}
                    onClick={connectMainnet}
                >
                    Connect Wallet
                </Button>
            )}
            {error && <Typography color="error" variant="caption">{error}</Typography>}
        </Box>
    );
};

export default WalletConnect;
