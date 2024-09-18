import React from 'react';
import { Divider, Button, MenuItem, Menu, MenuProps, Link } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
const StyledMenu = (props: MenuProps) => (
    <Menu
        {...props}
    />
);

type Dropdown = {

    name: string,
    link: string,
}
const dropdownItem: Dropdown[] = [
    {
        name: 'Transactions',
        link: '/recentTransactions',
    },
    {
        name: 'Blocks',
        link: '/recentblocks',
    },
    {
        name: 'Top Accounts',
        link: '/topwallets',
    },
    {
        name: 'Recent Gas Fees',
        link: '/home',
    },
    {
        name: 'Growth/Inflation',
        link: '/home',
    },


]

const BlockChainMenuButton: React.FC = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    return (
        <>
            <Button
                onClick={handleClick}
                endIcon={<KeyboardArrowDownIcon />}
            >
                Blockchain
            </Button>
            <StyledMenu open={open} onClose={handleClose} anchorEl={anchorEl}>
                {dropdownItem.map((item: Dropdown) => (
                    <MenuItem onClick={handleClose} disableRipple>
                        <Link href={item.link} underline='hover' color='inherit'>{item.name}</Link>
                    </MenuItem>
                ))}
            </StyledMenu>

        </>
    );
};
export default BlockChainMenuButton;
