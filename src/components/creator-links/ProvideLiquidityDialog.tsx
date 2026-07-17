import React from 'react';
import { Alert, Button, Dialog, DialogTitle, DialogContent, IconButton, Link, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { sanitizeOnChainString } from '../../utils/security';

export interface ProvideLiquidityDialogProps {
    open: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenSymbol?: string;
    /** The creator token's native TokenFactory denom (factory/{pool}/{sub}). */
    creatorTokenAddress?: string;
}

/**
 * Provide-liquidity dialog for the creator links page. The creator pool
 * has no liquidity entry points anymore — at threshold crossing it seeds
 * a NATIVE Osmosis GAMM pool and locks the seed in the contract, and any
 * additional liquidity is added the normal Osmosis way. This dialog
 * explains that and hands the user off to app.osmosis.zone.
 */
const ProvideLiquidityDialog: React.FC<ProvideLiquidityDialogProps> = ({
    open, onClose, tokenSymbol, creatorTokenAddress,
}) => {
    const symbol = tokenSymbol ? sanitizeOnChainString(tokenSymbol, 16) : 'this creator token';
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                Provide Liquidity{tokenSymbol ? ` — ${sanitizeOnChainString(tokenSymbol, 16)}` : ''}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Alert severity="info">
                        Liquidity for {symbol} lives in a native Osmosis pool (seeded automatically
                        when the pool crossed its funding threshold), not in the BlueChip contract.
                        Add or remove liquidity — and collect LP rewards — directly on Osmosis, like
                        any other Osmosis pool.
                    </Alert>
                    <Typography variant="body2" color="text.secondary">
                        Find the pool paired as OSMO / {symbol}
                        {creatorTokenAddress ? (
                            <> (token denom <code style={{ wordBreak: 'break-all' }}>{creatorTokenAddress}</code>)</>
                        ) : null} in the Osmosis pools list.
                    </Typography>
                    <Button
                        variant="contained"
                        component={Link}
                        href="https://app.osmosis.zone/pools"
                        target="_blank"
                        rel="noopener"
                        endIcon={<OpenInNewIcon />}
                    >
                        Open Osmosis Pools
                    </Button>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};

export default ProvideLiquidityDialog;
