import React from 'react';
import {
    Divider,
    ListItemIcon,
    ListItemText,
    List,
    ListItem,
    Tooltip,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
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
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

type Item = {
    title: string;
    icon: React.ReactNode;
    link: string;
};

const sidebarItems: Item[] = [
    {
        title: 'Home',
        icon: <HomeIcon />,
        link: '/frontpage',
    },
    {
        title: 'Transactions',
        icon: <ReceiptIcon />,
        link: '/recenttransactions',
    },
    {
        title: 'Blocks',
        icon: <TokenIcon />,
        link: '/recentblocks',
    },
    {
        title: 'Creator Contracts',
        icon: <ReceiptLongIcon />,
        link: '/topcreatorcontracts',
    },
    {
        title: 'Creator Pools',
        icon: <HotTubIcon />,
        link: '/topcreatorpools',
    },
    {
        title: 'Validators',
        icon: <GavelIcon />,
        link: '/topvalidators',
    },
    {
        title: 'Creator Tokens',
        icon: <MonetizationOnIcon />,
        link: '/toptokens',
    },
];

const newSidebarItems: Item[] = [
    {
        title: 'Creator Economy',
        icon: <RocketLaunchIcon />,
        link: '/defi',
    },
    {
        title: 'Governance',
        icon: <HowToVoteIcon />,
        link: '/governance',
    },
    {
        title: 'Staking',
        icon: <AccountBalanceIcon />,
        link: '/staking',
    },
    {
        title: 'IBC Transfers',
        icon: <SwapHorizIcon />,
        link: '/ibc',
    },
    {
        title: 'Contract Explorer',
        icon: <CodeIcon />,
        link: '/contract-explorer',
    },
    {
        title: 'Integration Guide',
        icon: <TipsAndUpdatesIcon />,
        link: '/integration-guide',
    },
];

const SidebarLink: React.FC<{ item: Item; highlight?: boolean }> = ({ item, highlight }) => (
    <Link to={item.link} style={{ color: 'inherit', textDecoration: 'none' }}>
        <ListItem sx={highlight ? { bgcolor: 'action.selected', borderRadius: 1 } : undefined}>
            <Tooltip title={item.title}>
                <ListItemIcon>{item.icon}</ListItemIcon>
            </Tooltip>
            <ListItemText primary={item.title} />
        </ListItem>
    </Link>
);

const BlockExpSideBar: React.FC = () => {
    const { address } = useWallet();

    return (
        <List component="nav">
            {sidebarItems.map((item: Item, index: number) => (
                <SidebarLink key={index} item={item} />
            ))}
            <Divider sx={{ my: 1 }} />
            {address && (
                <SidebarLink
                    item={{
                        title: 'My Portfolio',
                        icon: <AccountBoxIcon />,
                        link: '/portfolio',
                    }}
                    highlight
                />
            )}
            {newSidebarItems.map((item: Item, index: number) => (
                <SidebarLink key={`new-${index}`} item={item} />
            ))}
        </List>
    );
};

export default BlockExpSideBar;
