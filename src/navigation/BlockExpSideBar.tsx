import React, { useState } from 'react';
import {
    Divider,
    ListItemIcon,
    ListItemText,
    List,
    ListItem,
    Tooltip,
    Popover,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import GavelIcon from '@mui/icons-material/Gavel';
import HotTubIcon from '@mui/icons-material/HotTub';
import TokenIcon from '@mui/icons-material/Token';
import ReceiptIcon from '@mui/icons-material/Receipt';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CodeIcon from '@mui/icons-material/Code';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import LinkIcon from '@mui/icons-material/Link';
import BrushIcon from '@mui/icons-material/Brush';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

type Item = {
    title: string;
    icon: React.ReactNode;
    link: string;
};

const sidebarItems: Item[] = [
    { title: 'Home', icon: <HomeIcon />, link: '/frontpage' },
    { title: 'Transactions', icon: <ReceiptIcon />, link: '/recenttransactions' },
    { title: 'Blocks', icon: <TokenIcon />, link: '/recentblocks' },
    { title: 'Creator Pools', icon: <HotTubIcon />, link: '/topcreatorpools' },
    { title: 'Validators', icon: <GavelIcon />, link: '/topvalidators' },
    { title: 'Creator Tokens', icon: <MonetizationOnIcon />, link: '/toptokens' },
];

const newSidebarItems: Item[] = [
    { title: 'Creator Economy', icon: <RocketLaunchIcon />, link: '/defi' },
    { title: 'Governance', icon: <HowToVoteIcon />, link: '/governance' },
    { title: 'Staking', icon: <AccountBalanceIcon />, link: '/staking' },
    { title: 'IBC Transfers', icon: <SwapHorizIcon />, link: '/ibc' },
    { title: 'Contract Explorer', icon: <CodeIcon />, link: '/contract-explorer' },
    { title: 'Integration Guide', icon: <TipsAndUpdatesIcon />, link: '/integration-guide' },
];

const SidebarLink: React.FC<{ item: Item }> = ({ item }) => (
    <Link to={item.link} style={{ color: 'inherit', textDecoration: 'none' }}>
        <ListItem>
            <Tooltip title={item.title}>
                <ListItemIcon>{item.icon}</ListItemIcon>
            </Tooltip>
            <ListItemText primary={item.title} />
        </ListItem>
    </Link>
);

const BlockExpSideBar: React.FC = () => {
    const { address } = useWallet();
    const navigate = useNavigate();
    const location = useLocation();
    const isPortfolioActive = location.pathname.startsWith('/portfolio');
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const handlePortfolioClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNavigate = (path: string) => {
        handleClose();
        navigate(path);
    };

    return (
        <List component="nav">
            {sidebarItems.map((item, index) => (
                <SidebarLink key={index} item={item} />
            ))}
            <Divider sx={{ my: 1 }} />

            {address && (
                <>
                    <ListItem
                        onClick={handlePortfolioClick}
                        sx={{
                            bgcolor: isPortfolioActive ? 'action.selected' : 'transparent',
                            borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                        }}
                    >
                        <Tooltip title="My Portfolio">
                            <ListItemIcon><AccountBoxIcon /></ListItemIcon>
                        </Tooltip>
                        <ListItemText primary="My Portfolio" />
                    </ListItem>

                    <Popover
                        open={Boolean(anchorEl)}
                        anchorEl={anchorEl}
                        onClose={handleClose}
                        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
                        slotProps={{
                            paper: {
                                sx: { ml: 1, minWidth: 220, borderRadius: 2 },
                            },
                        }}
                    >
                        <List dense>
                            <ListItem
                                onClick={() => handleNavigate('/portfolio/creator')}
                                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <ListItemIcon><BrushIcon fontSize="small" /></ListItemIcon>
                                <ListItemText
                                    primary="Creator Portfolio"
                                    secondary="Your pools, tokens & revenue"
                                />
                            </ListItem>
                            <ListItem
                                onClick={() => handleNavigate('/portfolio/chain')}
                                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                                <ListItemText
                                    primary="Chain Portfolio"
                                    secondary="Commits, positions & fees"
                                />
                            </ListItem>
                        </List>
                    </Popover>
                </>
            )}

            {newSidebarItems.map((item, index) => (
                <SidebarLink key={`new-${index}`} item={item} />
            ))}
        </List>
    );
};

export default BlockExpSideBar;
