import React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Container from '@mui/material/Container';
import MenuIcon from '@mui/icons-material/Menu';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Sidebar from './Sidebar';

const drawerWidth = 240;

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

interface LayoutProps {
    NavBar: JSX.Element;
    SideBar: JSX.Element;
}

export const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = (props) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [sidebarOpen, setSidebarOpen] = React.useState(!isMobile);

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="absolute">
                <Toolbar
                    sx={{
                        pr: '24px',
                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}
                >
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="toggle sidebar"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        sx={{ mr: 1 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    {props.NavBar}
                </Toolbar>
            </AppBar>
            {sidebarOpen && (
                <Sidebar>
                    {props.SideBar}
                </Sidebar>
            )}
            <Box
                component="main"
                sx={{
                    backgroundColor: (theme) =>
                        theme.palette.mode === 'light'
                            ? theme.palette.grey[100]
                            : theme.palette.grey[900],
                    flexGrow: 1,
                    height: '100vh',
                    overflow: 'auto',
                }}
            >
                <Toolbar />
                <Container
                    maxWidth={false}
                    sx={{
                        px: isMobile ? 1 : 3,
                        py: 1,
                    }}
                >
                    {props.children}
                </Container>
            </Box>
        </Box>
    );
};
