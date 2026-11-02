import React from 'react';
import {
    Badge,
    Divider,
    ListItemIcon,
    ListItemText,
    List,
    ListItem,
    Tooltip,
    ListSubheader,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import HotTubIcon from '@mui/icons-material/HotTub';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import LinkIcon from '@mui/icons-material/Link';
import BrushIcon from '@mui/icons-material/Brush';
import PaletteIcon from '@mui/icons-material/Palette';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import { Link, useLocation } from 'react-router-dom';
import { useFeedBadge } from '../context/FeedBadgeContext';

type Item = {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    link: string;
};

const explorerItems: Item[] = [
    { title: 'Home', icon: <HomeIcon />, link: '/frontpage' },
    { title: 'Creator Pools', icon: <HotTubIcon />, link: '/topcreatorpools' },
    { title: 'Creator Tokens', icon: <MonetizationOnIcon />, link: '/toptokens' },
    { title: 'Find Creators', icon: <PersonSearchIcon />, link: '/creators' },
];

// "My Portfolio" views are always visible so holdings / subscriptions /
// performance are one click away; the pages themselves show a connect
// prompt when no wallet is linked yet.
const portfolioItems: Item[] = [
    {
        title: 'My Feed',
        subtitle: 'New links from your creators',
        icon: <DynamicFeedIcon />,
        link: '/feed',
    },
    {
        title: 'My Holdings',
        subtitle: 'Tokens, commits & positions',
        icon: <LinkIcon />,
        link: '/portfolio/holdings',
    },
    {
        title: 'Creator Portfolio',
        subtitle: 'Your pools, tokens & revenue',
        icon: <BrushIcon />,
        link: '/portfolio/creator',
    },
    {
        title: 'My Links Page',
        subtitle: 'Your public link-in-bio page',
        icon: <PaletteIcon />,
        link: '/mylinks',
    },
];

const contractItems: Item[] = [
    { title: 'Creator Economy', icon: <RocketLaunchIcon />, link: '/defi' },
    { title: 'Integration Guide', icon: <TipsAndUpdatesIcon />, link: '/integration-guide' },
];

const SidebarLink: React.FC<{ item: Item; selected?: boolean; badge?: number }> = ({ item, selected = false, badge = 0 }) => (
    <Link to={item.link} style={{ color: 'inherit', textDecoration: 'none' }}>
        <ListItem
            sx={{
                bgcolor: selected ? 'action.selected' : 'transparent',
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <Tooltip title={badge > 0 ? `${item.title} — ${badge} new` : item.title}>
                <ListItemIcon>
                    <Badge badgeContent={badge} color="primary" max={99}>{item.icon}</Badge>
                </ListItemIcon>
            </Tooltip>
            <ListItemText primary={item.title} secondary={item.subtitle} />
        </ListItem>
    </Link>
);

const BlockExpSideBar: React.FC = () => {
    const location = useLocation();
    const { newCount } = useFeedBadge();

    return (
        <List component="nav">
            {explorerItems.map((item) => (
                <SidebarLink key={item.link} item={item} selected={location.pathname === item.link} />
            ))}

            <Divider sx={{ my: 1 }} />
            <ListSubheader component="div" disableSticky sx={{ lineHeight: '32px' }}>
                My Portfolio
            </ListSubheader>
            {portfolioItems.map((item) => (
                <SidebarLink
                    key={item.link}
                    item={item}
                    selected={location.pathname === item.link}
                    badge={item.link === '/feed' ? newCount : 0}
                />
            ))}

            <Divider sx={{ my: 1 }} />
            {contractItems.map((item) => (
                <SidebarLink key={item.link} item={item} selected={location.pathname === item.link} />
            ))}
        </List>
    );
};

export default BlockExpSideBar;
