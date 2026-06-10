import React, { useState } from 'react';
import { Button, Stack, Tooltip } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import { useWallet } from '../../context/WalletContext';
import { TradeModal, LiquidityModal, CommitModal } from './PoolActionModals';
import { sanitizeOnChainString } from '../../utils/security';

interface PoolActionMenuProps {
    poolAddress: string;
    tokenSymbol?: string;
    creatorTokenAddress?: string | null;
    thresholdReached?: boolean;
    // Compact variant uses icon-only buttons for tight contexts (table rows).
    compact?: boolean;
}

type ActionKind = 'trade' | 'liquidity' | 'commit' | null;

// Post-threshold pools get two consolidated entry points: a Trade modal
// (Buy / Sell / Commit tabs) and a Liquidity modal (Provide / Remove
// tabs). Pools still in their funding phase keep the standalone Commit
// button — trading and liquidity don't exist for them yet.
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
            key: 'trade',
            label: `Trade ${symbol}`,
            icon: <ShoppingCartIcon fontSize="small" />,
            color: 'success',
            show: thresholdReached,
        },
        {
            key: 'liquidity',
            label: 'Liquidity',
            icon: <WaterDropIcon fontSize="small" />,
            color: 'primary',
            show: thresholdReached,
        },
        {
            key: 'commit',
            label: 'Commit',
            icon: <VolunteerActivismIcon fontSize="small" />,
            color: 'warning',
            show: !thresholdReached,
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

            <TradeModal
                open={openModal === 'trade'}
                onClose={() => setOpenModal(null)}
                poolAddress={poolAddress}
                tokenSymbol={tokenSymbol}
                creatorTokenAddress={creatorTokenAddress || undefined}
            />
            <LiquidityModal
                open={openModal === 'liquidity'}
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
        </>
    );
};

export default PoolActionMenu;
