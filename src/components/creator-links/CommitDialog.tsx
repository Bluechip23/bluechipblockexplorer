import React, { useEffect, useState } from 'react';
import { Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CommitPanel } from '../actions/PoolActionModals';
import { sanitizeOnChainString } from '../../utils/security';
import { formatTierPrice, Tier } from '../../utils/profilesApi';
import { microToOsmoInput } from '../../utils/tierFormat';
import { SUBSCRIPTION_PERIOD_DAYS } from '../../utils/subscriptions';

export interface CommitDialogProps {
    open: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenSymbol?: string;
    /** Post-threshold commits swap through the AMM (slippage applies). */
    thresholdReached?: boolean;
    /** The creator's tiers on THIS pool; picking one pre-fills its price. */
    tiers?: Tier[];
    /** Tier to pre-select when the dialog opens (e.g. from a locked link). */
    initialTierId?: number | null;
}

/**
 * Commit / Subscribe dialog for the creator links page. Reuses the audited
 * CommitPanel state machine (input → confirm → executing → result) so the
 * links page gets the exact same validation + simulation gates as the pool
 * pages. Committing creates the on-chain subscription record that unlocks
 * a creator's gated links; the commit's size decides which tiers it covers.
 */
const CommitDialog: React.FC<CommitDialogProps> = ({
    open, onClose, poolAddress, tokenSymbol, thresholdReached = false, tiers = [], initialTierId = null,
}) => {
    const [selected, setSelected] = useState<number | null>(initialTierId);
    useEffect(() => {
        if (open) setSelected(initialTierId);
    }, [open, initialTierId]);
    const selectedTier = tiers.find((t) => t.id === selected);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                Subscribe to {sanitizeOnChainString(tokenSymbol, 16) || 'Creator'}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                {tiers.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.75 }}>
                            Pick a tier
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {tiers.map((t) => (
                                <Chip
                                    key={t.id}
                                    label={`${sanitizeOnChainString(t.name, 40)} · ${formatTierPrice(t.price_native)}`}
                                    color={selected === t.id ? 'primary' : 'default'}
                                    variant={selected === t.id ? 'filled' : 'outlined'}
                                    onClick={() => setSelected(selected === t.id ? null : t.id)}
                                />
                            ))}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                            Commit at least a tier's price in one commit to unlock its links for {SUBSCRIPTION_PERIOD_DAYS} days.
                            A bigger commit covers every cheaper tier, and your latest commit sets your tier.
                        </Typography>
                    </Box>
                )}
                {/* Re-mount on tier change so the amount field takes the new price. */}
                <CommitPanel
                    key={selectedTier?.id ?? 'custom'}
                    poolAddress={poolAddress}
                    tokenSymbol={tokenSymbol}
                    thresholdReached={thresholdReached}
                    initialAmount={selectedTier ? microToOsmoInput(selectedTier.price_native) : undefined}
                    onClose={onClose}
                />
            </DialogContent>
        </Dialog>
    );
};

export default CommitDialog;
