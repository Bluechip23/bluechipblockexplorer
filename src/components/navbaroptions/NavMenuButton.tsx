import React from 'react';
import { Button, MenuItem, Menu, MenuProps, Link } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const StyledMenu = (props: MenuProps) => (
    <Menu {...props} />
);

interface DropdownItem {
    name: string;
    link: string;
}

interface NavMenuButtonProps {
    label: string;
    items: DropdownItem[];
}

const NavMenuButton: React.FC<NavMenuButtonProps> = ({ label, items }) => {
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
            <Button onClick={handleClick} endIcon={<KeyboardArrowDownIcon />}>
                {label}
            </Button>
            <StyledMenu open={open} onClose={handleClose} anchorEl={anchorEl}>
                {items.map((item) => (
                    <MenuItem key={item.link} onClick={handleClose} disableRipple>
                        <Link href={item.link} underline="hover" color="inherit">{item.name}</Link>
                    </MenuItem>
                ))}
            </StyledMenu>
        </>
    );
};

export default NavMenuButton;
