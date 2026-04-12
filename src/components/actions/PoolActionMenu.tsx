import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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
}

const PoolActionMenu: React.FC<PoolActionMenuProps> = ({
    poolAddress,
    tokenSymbol,
    creatorTokenAddress,
    thresholdReached = true,
}) => {
    const { address } = useWallet();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [openModal, setOpenModal] = useState<'buy' | 'sell' | 'commit' | 'deposit' | 'remove' | null>(null);

    if (!address) return null;

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const openAction = (action: typeof openModal) => {
        setOpenModal(action);
        handleClose();
    };

    return (
        <>
            <IconButton onClick={handleOpen} size="small" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}>
                <MoreHorizIcon />
            </IconButton>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                {thresholdReached && (
                    <MenuItem onClick={() => openAction('buy')}>
                        <ListItemIcon><ShoppingCartIcon fontSize="small" /></ListItemIcon>
                        {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                        <ListItemText>Buy {sanitizeOnChainString(tokenSymbol, 16) || 'Token'}</ListItemText>
                    </MenuItem>
                )}
                {thresholdReached && (
                    <MenuItem onClick={() => openAction('sell')}>
                        <ListItemIcon><SellIcon fontSize="small" /></ListItemIcon>
                        {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                        <ListItemText>Sell {sanitizeOnChainString(tokenSymbol, 16) || 'Token'}</ListItemText>
                    </MenuItem>
                )}
                {!thresholdReached && (
                    <MenuItem onClick={() => openAction('commit')}>
                        <ListItemIcon><VolunteerActivismIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Commit / Subscribe</ListItemText>
                    </MenuItem>
                )}
                {thresholdReached && (
                    <MenuItem onClick={() => openAction('deposit')}>
                        <ListItemIcon><AddCircleIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Deposit Liquidity</ListItemText>
                    </MenuItem>
                )}
                {thresholdReached && (
                    <MenuItem onClick={() => openAction('remove')}>
                        <ListItemIcon><RemoveCircleIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Remove Liquidity</ListItemText>
                    </MenuItem>
                )}
            </Menu>

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
