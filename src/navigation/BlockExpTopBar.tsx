import React from 'react';
import { IconButton, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeMode } from '../context/ThemeContext';

const BlockExpTopBar: React.FC = () => {
    const { mode, toggleTheme } = useThemeMode();

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
            >
                <IconButton color="inherit" onClick={toggleTheme} title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
                    {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
                </IconButton>
            </Stack>
        </Stack>
    );
};

export default BlockExpTopBar;
