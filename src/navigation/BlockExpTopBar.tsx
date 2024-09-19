import React from 'react';
import { Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

const BlockExpTopBar: React.FC = () => {
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
                    to="/home"
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
            </Stack>
        </Stack>
    );
};

export default BlockExpTopBar;
