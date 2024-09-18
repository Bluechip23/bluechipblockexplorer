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
        name: 'Top Creator Pools',
        link: '/topcreatorpools',
    },
    {
        name: 'Creator Contracts',
        link: '/topcreatorcontracts',
    },

]
const PoolsMenuButton: React.FC = () => {
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
                Pools
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

export default PoolsMenuButton;
