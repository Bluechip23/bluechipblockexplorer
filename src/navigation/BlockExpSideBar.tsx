import React from 'react';
import {
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
import { Link } from 'react-router-dom';
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
        link: '/comingsoonpage'//'/topcreatorcontracts',
    },
    {
        title: 'Creator Pools',
        icon: <HotTubIcon />,
        link: '/comingsoonpage'//'/topcreatorpools',
    },
    {
        title: 'Validators',
        icon: <GavelIcon />,
        link: '/topvalidators',
    },
    {
        title: 'Creator Tokens',
        icon: <MonetizationOnIcon/>,
        link: '/toptokens',
    },
];

const BlockExpSideBar: React.FC = () => {
    return (
        <List component="nav">
            {sidebarItems.map((item: Item, index: number) => (
                <Link
                    to={item.link}
                    key={index.toString()}
                    style={{ color: 'black', textDecoration: 'none' }}
                >
                        <ListItem key={item.title}>
                            <Tooltip title={item.title}>
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            </Tooltip>
                            <ListItemText primary={item.title} />
                        </ListItem>
                </Link>
            ))}
        </List>
    );
};

export default BlockExpSideBar;
