import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { sanitizeOnChainString } from '../../utils/security';
import LiquidityPanel from '../liquidity/LiquidityPanel';

export interface ProvideLiquidityDialogProps {
    open: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenSymbol?: string;
    /** The creator token's native TokenFactory denom (factory/{pool}/{sub}). */
    creatorTokenAddress?: string;
}

/**
 * Add / remove liquidity for a creator pool, in-site. Commits and
 * subscriptions go through the BlueChip creator-pool contract. When the
 * pool crosses its funding threshold, the contract opens an Osmosis trading
 * pool for the token, and liquidity is added to and removed from that pool
 * here (see LiquidityPanel).
 */
const ProvideLiquidityDialog: React.FC<ProvideLiquidityDialogProps> = ({
    open, onClose, poolAddress, tokenSymbol,
}) => {
    const symbol = tokenSymbol ? sanitizeOnChainString(tokenSymbol, 16) : '';
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                Provide Liquidity{symbol ? ` — ${symbol}` : ''}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Add OSMO and {symbol || 'the creator token'} to this pool&apos;s trading liquidity
                        and earn a share of every swap fee. When a pool reaches its funding threshold,
                        BlueChip opens its trading pool on Osmosis and locks the seed liquidity
                        permanently. Your liquidity sits next to it, and you can remove it at any time.
                    </Typography>
                    {open && <LiquidityPanel poolAddress={poolAddress} tokenSymbol={tokenSymbol} />}
                </Stack>
            </DialogContent>
        </Dialog>
    );
};

export default ProvideLiquidityDialog;
