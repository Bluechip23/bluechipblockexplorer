import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Collapse,
    Divider,
    Stack,
    Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PoolActionMenu from '../actions/PoolActionMenu';
import { formatMicroAmount, PoolSummary } from '../../utils/contractQueries';

interface PoolSelectorDropdownProps {
    pools: PoolSummary[];
    selectedPool: PoolSummary | null;
    onSelectPool: (pool: PoolSummary) => void;
    comparedPools: Set<string>;
    onToggleCompare: (poolAddress: string) => void;
    onCompare: () => void;
}

const PoolSelectorDropdown: React.FC<PoolSelectorDropdownProps> = ({
    pools,
    selectedPool,
    onSelectPool,
    comparedPools,
    onToggleCompare,
    onCompare,
}) => {
    const [open, setOpen] = useState(false);

    return (
        <Card
            sx={(theme) => ({
                ...(theme.palette.mode === 'light'
                    ? {
                          bgcolor: theme.palette.primary.main,
                          color: theme.palette.primary.contrastText,
                      }
                    : {}),
            })}
        >
            <CardContent sx={{ pb: '8px !important' }}>
                <Box
                    onClick={() => setOpen(!open)}
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    <Box>
                        <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={(theme) => ({
                                ...(theme.palette.mode === 'dark'
                                    ? { color: '#f5a623' }
                                    : { color: 'inherit' }),
                            })}
                        >
                            Your Pools
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={(theme) => ({
                                color:
                                    theme.palette.mode === 'light'
                                        ? 'rgba(255,255,255,0.7)'
                                        : theme.palette.text.secondary,
                            })}
                        >
                            {selectedPool
                                ? `Viewing: ${selectedPool.tokenSymbol} — ${selectedPool.tokenName}`
                                : 'Select a pool to view its details'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {comparedPools.size > 0 && (
                            <Chip
                                label={`${comparedPools.size} selected`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        )}
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </Box>
                </Box>

                <Collapse in={open}>
                    <Divider
                        sx={(theme) => ({
                            my: 1,
                            ...(theme.palette.mode === 'light'
                                ? { borderColor: 'rgba(255,255,255,0.3)' }
                                : {}),
                        })}
                    />
                    <Stack spacing={0}>
                        {pools.map((pool) => (
                            <Box
                                key={pool.poolAddress}
                                sx={(theme) => ({
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    py: 0.75,
                                    px: 1,
                                    borderRadius: 1,
                                    bgcolor:
                                        selectedPool?.poolAddress === pool.poolAddress
                                            ? theme.palette.mode === 'light'
                                                ? 'rgba(255,255,255,0.15)'
                                                : 'action.selected'
                                            : 'transparent',
                                    '&:hover': {
                                        bgcolor:
                                            theme.palette.mode === 'light'
                                                ? 'rgba(255,255,255,0.1)'
                                                : theme.palette.action.hover,
                                    },
                                })}
                            >
                                {/* Left: checkbox for compare */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                                    <Checkbox
                                        size="small"
                                        checked={comparedPools.has(pool.poolAddress)}
                                        onChange={() => onToggleCompare(pool.poolAddress)}
                                        onClick={(e) => e.stopPropagation()}
                                        sx={(theme) => ({
                                            ...(theme.palette.mode === 'light'
                                                ? { color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#fff' } }
                                                : {}),
                                        })}
                                    />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight="bold" noWrap>
                                            {pool.tokenSymbol}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            noWrap
                                            sx={(theme) => ({
                                                color:
                                                    theme.palette.mode === 'light'
                                                        ? 'rgba(255,255,255,0.7)'
                                                        : theme.palette.text.secondary,
                                            })}
                                        >
                                            {pool.tokenName}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={pool.thresholdReached ? 'Active' : 'Pre-threshold'}
                                        color={pool.thresholdReached ? 'success' : 'warning'}
                                        size="small"
                                        variant="outlined"
                                        sx={(theme) => ({
                                            ml: 1,
                                            ...(theme.palette.mode === 'light'
                                                ? { borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }
                                                : {}),
                                        })}
                                    />
                                    <Typography
                                        variant="caption"
                                        sx={(theme) => ({
                                            ml: 1,
                                            color:
                                                theme.palette.mode === 'light'
                                                    ? 'rgba(255,255,255,0.7)'
                                                    : theme.palette.text.secondary,
                                        })}
                                    >
                                        TVL: {formatMicroAmount(pool.totalLiquidity)}
                                    </Typography>
                                </Box>

                                {/* Right: select button + action menu */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    <Button
                                        size="small"
                                        variant={
                                            selectedPool?.poolAddress === pool.poolAddress
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                        onClick={() => {
                                            onSelectPool(pool);
                                            setOpen(false);
                                        }}
                                        sx={(theme) => ({
                                            ...(theme.palette.mode === 'light'
                                                ? selectedPool?.poolAddress === pool.poolAddress
                                                    ? { bgcolor: '#fff', color: theme.palette.primary.main, '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' } }
                                                    : { borderColor: 'rgba(255,255,255,0.5)', color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }
                                                : {}),
                                        })}
                                    >
                                        {selectedPool?.poolAddress === pool.poolAddress ? 'Viewing' : 'Select'}
                                    </Button>
                                    <PoolActionMenu
                                        poolAddress={pool.poolAddress}
                                        tokenSymbol={pool.tokenSymbol}
                                        creatorTokenAddress={pool.creatorTokenAddress}
                                        thresholdReached={pool.thresholdReached}
                                    />
                                </Box>
                            </Box>
                        ))}
                    </Stack>

                    {/* Compare button */}
                    <Divider
                        sx={(theme) => ({
                            mt: 1,
                            ...(theme.palette.mode === 'light'
                                ? { borderColor: 'rgba(255,255,255,0.3)' }
                                : {}),
                        })}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<CompareArrowsIcon />}
                            disabled={comparedPools.size < 2}
                            onClick={() => {
                                onCompare();
                                setOpen(false);
                            }}
                            sx={(theme) => ({
                                ...(theme.palette.mode === 'light'
                                    ? { bgcolor: '#fff', color: theme.palette.primary.main, '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' } }
                                    : {}),
                            })}
                        >
                            Compare {comparedPools.size > 0 ? `(${comparedPools.size})` : ''}
                        </Button>
                    </Box>
                </Collapse>
            </CardContent>
        </Card>
    );
};

export default PoolSelectorDropdown;
