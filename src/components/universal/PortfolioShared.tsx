import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useWallet } from '../../context/WalletContext';

export const TabPanel: React.FC<{ children: React.ReactNode; value: number; index: number }> = ({
    children, value, index,
}) => (
    <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
);

export const NotConnectedView: React.FC<{ description?: string }> = ({
    description = 'Connect your Keplr wallet to view your portfolio, committed pools, positions, and transaction history.',
}) => {
    const { connect, connecting } = useWallet();
    return (
        <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>Connect Your Wallet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {description}
                </Typography>
                <Box
                    component="button"
                    onClick={connect}
                    disabled={connecting}
                    sx={{
                        px: 4, py: 1.5, fontSize: '1rem', fontWeight: 'bold', border: 'none',
                        borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText',
                        cursor: 'pointer', '&:hover': { bgcolor: 'primary.dark' },
                        '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
                    }}
                >
                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                </Box>
            </CardContent>
        </Card>
    );
};
