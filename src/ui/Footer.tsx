import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import ForumIcon from '@mui/icons-material/Forum';

// Discord (and other community) destinations. The Discord URL is the
// canonical invite; override via `REACT_APP_DISCORD_URL` at build time
// if the invite ever rolls.
const DISCORD_URL =
    process.env.REACT_APP_DISCORD_URL || 'https://discord.gg/bluechip';
const GITHUB_URL =
    process.env.REACT_APP_GITHUB_URL || 'https://github.com/bluechip23';
const WEBSITE_URL =
    process.env.REACT_APP_WEBSITE_URL || 'https://bluechipsblockexplorer.com';

interface FooterLink {
    label: string;
    href: string;
    icon: React.ReactElement;
}

const links: FooterLink[] = [
    {
        label: 'Discord',
        href: DISCORD_URL,
        // MUI doesn't ship a Discord-branded icon by default; ForumIcon
        // reads as "community chat" without pulling a third-party pack.
        icon: <ForumIcon fontSize="small" />,
    },
    {
        label: 'GitHub',
        href: GITHUB_URL,
        icon: <GitHubIcon fontSize="small" />,
    },
    {
        label: 'Website',
        href: WEBSITE_URL,
        icon: <LanguageIcon fontSize="small" />,
    },
];

const Footer: React.FC = () => (
    <Box
        component="footer"
        sx={{
            mt: 'auto',
            py: 2,
            px: 3,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
                theme.palette.mode === 'light'
                    ? theme.palette.grey[200]
                    : theme.palette.grey[800],
        }}
    >
        <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
        >
            <Typography variant="body2" color="text.secondary">
                BlueChip Block Explorer
            </Typography>
            <Stack
                direction="row"
                spacing={2}
                divider={<Divider orientation="vertical" flexItem />}
                alignItems="center"
            >
                {links.map((l) => (
                    <Link
                        key={l.label}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        color="text.secondary"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                    >
                        {l.icon}
                        <Typography variant="body2" component="span">
                            {l.label}
                        </Typography>
                    </Link>
                ))}
            </Stack>
        </Stack>
    </Box>
);

export default Footer;
