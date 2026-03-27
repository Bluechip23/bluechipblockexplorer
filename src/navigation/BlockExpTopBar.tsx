import React from 'react';
import { Button, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useThemeMode } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';

const BlockExpTopBar: React.FC = () => {
    const { mode, toggleTheme } = useThemeMode();
    const { address, balance, connecting, connect, disconnect } = useWallet();

    return (
        <Stack direction="row" justifyContent="space-evenly" width={'100%'}>
            <Stack
                justifyContent="flex-start"
                width="100%"
                alignItems="center"
                direction='row'
                spacing={8}
            >
                <Link
                    to="/frontpage"
                    style={{
                        color: 'inherit',
                        textDecoration: 'none',
                        fontSize: 'x-large',
                    }}
                >
                    Bluechip Explorer
                </Link>
                <Typography>
                    blue chip price:
                </Typography>
            </Stack>
            <Stack
                width="100%"
                justifyContent="flex-end"
                direction="row"
                alignItems="center"
                spacing={1}
            >
                {address ? (
                    <>
                        {balance && (
                            <Typography variant="body2" sx={{ mr: 1 }}>
                                {(parseInt(balance.amount) / 1_000_000).toFixed(2)} BLUECHIP
                            </Typography>
                        )}
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {address.slice(0, 12)}...{address.slice(-6)}
                        </Typography>
                        <Button size="small" variant="outlined" onClick={disconnect} sx={{ ml: 1, textTransform: 'none' }}>
                            Disconnect
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <AccountBalanceWalletIcon />}
                        onClick={connect}
                        disabled={connecting}
                        sx={{ textTransform: 'none' }}
                    >
                        {connecting ? 'Connecting...' : 'Connect Wallet'}
                    </Button>
                )}
                <IconButton color="inherit" onClick={toggleTheme} title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
                    {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
                </IconButton>
            </Stack>
        </Stack>
    );
};

export default BlockExpTopBar;
