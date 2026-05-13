import React, { useState } from 'react';
import { Button, Stack, Tooltip } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SellIcon from '@mui/icons-material/Sell';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { useWallet } from '../../context/WalletContext';
import { BuyModal, SellModal, CommitModal, DepositLiquidityModal, RemoveLiquidityModal } from './PoolActionModals';
import { sanitizeOnChainString } from '../../utils/security';

interface PoolActionMenuProps {
    poolAddress: string;
    tokenSymbol?: string;
    creatorTokenAddress?: string | null;
    thresholdReached?: boolean;
    // Compact variant uses icon-only buttons for tight contexts (table rows).
    compact?: boolean;
}

type ActionKind = 'buy' | 'sell' | 'commit' | 'deposit' | 'remove' | null;

const PoolActionMenu: React.FC<PoolActionMenuProps> = ({
    poolAddress,
    tokenSymbol,
    creatorTokenAddress,
    thresholdReached = true,
    compact = false,
}) => {
    const { address } = useWallet();
    const [openModal, setOpenModal] = useState<ActionKind>(null);

    if (!address) return null;

    const symbol = sanitizeOnChainString(tokenSymbol, 16) || 'Token';

    const buttons: {
        key: Exclude<ActionKind, null>;
        label: string;
        icon: React.ReactElement;
        color: 'primary' | 'error' | 'success' | 'warning' | 'info';
        show: boolean;
    }[] = [
        {
            key: 'buy',
            label: `Buy ${symbol}`,
            icon: <ShoppingCartIcon fontSize="small" />,
            color: 'success',
            show: thresholdReached,
        },
        {
            key: 'sell',
            label: `Sell ${symbol}`,
            icon: <SellIcon fontSize="small" />,
            color: 'error',
            show: thresholdReached,
        },
        {
            key: 'commit',
            label: 'Commit',
            icon: <VolunteerActivismIcon fontSize="small" />,
            color: 'warning',
            show: !thresholdReached,
        },
        {
            key: 'deposit',
            label: 'Deposit LP',
            icon: <AddCircleIcon fontSize="small" />,
            color: 'primary',
            show: thresholdReached,
        },
        {
            key: 'remove',
            label: 'Remove LP',
            icon: <RemoveCircleIcon fontSize="small" />,
            color: 'info',
            show: thresholdReached,
        },
    ];

    const visible = buttons.filter((b) => b.show);

    return (
        <>
            <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
                sx={{ rowGap: 1 }}
            >
                {visible.map((b) =>
                    compact ? (
                        <Tooltip key={b.key} title={b.label}>
                            <Button
                                size="small"
                                variant="outlined"
                                color={b.color}
                                onClick={() => setOpenModal(b.key)}
                                sx={{ minWidth: 36, px: 1 }}
                            >
                                {b.icon}
                            </Button>
                        </Tooltip>
                    ) : (
                        <Button
                            key={b.key}
                            size="small"
                            variant="contained"
                            color={b.color}
                            startIcon={b.icon}
                            onClick={() => setOpenModal(b.key)}
                        >
                            {b.label}
                        </Button>
                    )
                )}
            </Stack>

            <BuyModal
                open={openModal === 'buy'}
                onClose={() => setOpenModal(null)}
                poolAddress={poolAddress}
                tokenSymbol={tokenSymbol}
            />
            <SellModal
                open={openModal === 'sell'}
                onClose={() => setOpenModal(null)}
                poolAddress={poolAddress}
                tokenSymbol={tokenSymbol}
                creatorTokenAddress={creatorTokenAddress || undefined}
            />
            <CommitModal
                open={openModal === 'commit'}
                onClose={() => setOpenModal(null)}
                poolAddress={poolAddress}
                tokenSymbol={tokenSymbol}
            />
            <DepositLiquidityModal
                open={openModal === 'deposit'}
                onClose={() => setOpenModal(null)}
                poolAddress={poolAddress}
                tokenSymbol={tokenSymbol}
                creatorTokenAddress={creatorTokenAddress || undefined}
            />
            <RemoveLiquidityModal
                open={openModal === 'remove'}
                onClose={() => setOpenModal(null)}
                poolAddress={poolAddress}
                tokenSymbol={tokenSymbol}
            />
        </>
    );
};

export default PoolActionMenu;
