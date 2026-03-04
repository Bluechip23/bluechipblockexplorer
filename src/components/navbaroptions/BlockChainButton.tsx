import React from 'react';
import { Button, MenuItem, Menu, MenuProps, Link } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const StyledMenu = (props: MenuProps) => (
    <Menu {...props} />
);

type Dropdown = {
    name: string;
    link: string;
};

const dropdownItem: Dropdown[] = [
    { name: 'Transactions', link: '/recenttransactions' },
    { name: 'Blocks', link: '/recentblocks' },
    { name: 'Top Accounts', link: '/topwallets' },
    { name: 'Network Parameters', link: '/networkparams' },
    { name: 'Charts & Stats', link: '/charts' },
    { name: 'IBC Transfers', link: '/ibc' },
];

const BlockChainMenuButton: React.FC = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    return (
        <>
            <Button
                onClick={(e) => setAnchorEl(e.currentTarget)}
                endIcon={<KeyboardArrowDownIcon />}
            >
                Blockchain
            </Button>
            <StyledMenu open={open} onClose={() => setAnchorEl(null)} anchorEl={anchorEl}>
                {dropdownItem.map((item) => (
                    <MenuItem key={item.name} onClick={() => setAnchorEl(null)} disableRipple>
                        <Link href={item.link} underline='hover' color='inherit'>{item.name}</Link>
                    </MenuItem>
                ))}
            </StyledMenu>
        </>
    );
};

export default BlockChainMenuButton;
