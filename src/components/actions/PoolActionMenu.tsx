import React, { useState } from 'react';
import { Button, Stack, Tooltip } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import { useWallet } from '../../context/WalletContext';
import { TradeModal, CommitModal } from './PoolActionModals';
import { sanitizeOnChainString } from '../../utils/security';

interface PoolActionMenuProps {
    poolAddress: string;
    tokenSymbol?: string;
    /**
     * The creator token's native TokenFactory denom (factory/{pool}/{sub}).
     * The prop keeps its historical name because every pool summary in the
     * data layer still exposes it as `creatorTokenAddress`.
     */
    creatorTokenAddress?: string | null;
    thresholdReached?: boolean;
    // Compact variant uses icon-only buttons for tight contexts (table rows).
    compact?: boolean;
}

type ActionKind = 'trade' | 'commit' | null;

// Post-threshold pools get a consolidated Trade modal (Buy / Sell /
// Commit tabs) plus a link out to Osmosis for liquidity — LP flows live
// on the native GAMM pool now, not in this app. Pools still in their
// funding phase keep the standalone Commit button — trading doesn't
// exist for them yet.
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
        key: Exclude<ActionKind, null> | 'osmosis-lp';
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
            key: 'osmosis-lp',
            label: 'LP on Osmosis',
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

    const onButtonClick = (key: (typeof buttons)[number]['key']) => {
        if (key === 'osmosis-lp') {
            // Liquidity lives in the native Osmosis pool — send the user to
            // the Osmosis app rather than a contract flow that no longer
            // exists.
            window.open('https://app.osmosis.zone/pools', '_blank', 'noopener');
            return;
        }
        setOpenModal(key);
    };

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
                                onClick={() => onButtonClick(b.key)}
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
                            onClick={() => onButtonClick(b.key)}
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
                creatorTokenDenom={creatorTokenAddress || undefined}
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
