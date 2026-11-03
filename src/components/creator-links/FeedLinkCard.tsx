import React from 'react';
import { Box, Card, CardActionArea, Chip, Stack, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Link as RouterLink } from 'react-router-dom';
import { sanitizeOnChainString } from '../../utils/security';
import { FeedLink } from '../../utils/profilesApi';
import { isSafeHttpUrl } from './LinkCard';

/** Unix seconds → "3h ago" for recent links, a plain date beyond a month. */
export function formatFeedTime(unixSeconds: number | undefined): string {
    if (!unixSeconds) return '';
    const secondsAgo = Math.floor(Date.now() / 1000) - unixSeconds;
    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    if (secondsAgo < 30 * 86400) return `${Math.floor(secondsAgo / 86400)}d ago`;
    return new Date(unixSeconds * 1000).toLocaleDateString();
}

function hostOf(url: string | undefined): string {
    if (!isSafeHttpUrl(url)) return '';
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

export interface FeedLinkCardProps {
    link: FeedLink;
    /** URL revealed by unlockFeed() (gated links only). */
    unlockedUrl?: string;
    /** Flagged "New" when created after the viewer's previous visit. */
    isNew: boolean;
    /** Invoked when a still-locked gated link is clicked. */
    onLockedClick?: () => void;
    /** What unlocks this gated link (see describeGate). */
    gateLabel?: string;
}

/**
 * One row of the subscriber feed: the link itself plus who posted it and
 * when. Opens in a new tab; gated links stay locked until the viewer's
 * subscriptions have been verified.
 */
const FeedLinkCard: React.FC<FeedLinkCardProps> = ({ link, unlockedUrl, isNew, onLockedClick, gateLabel }) => {
    const title = sanitizeOnChainString(link.title, 80);
    const creatorName = sanitizeOnChainString(link.creator.name, 32);
    const url = link.gated ? unlockedUrl : link.url;
    const locked = !isSafeHttpUrl(url);
    const host = hostOf(url);
    const when = formatFeedTime(link.created_at);

    const meta = (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            <Typography
                variant="caption"
                component={RouterLink}
                to={`/creator/${encodeURIComponent(link.creator.name)}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 'bold', '&:hover': { textDecoration: 'underline' } }}
            >
                {creatorName}
            </Typography>
            {host && <Typography variant="caption" color="text.secondary">{host}</Typography>}
            {when && <Typography variant="caption" color="text.secondary">· {when}</Typography>}
            {link.gated && (
                <Typography variant="caption" color="text.secondary">
                    · {locked ? sanitizeOnChainString(gateLabel || 'Subscribers only', 120) : 'Subscriber link'}
                </Typography>
            )}
        </Stack>
    );

    const body = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
            {locked
                ? <LockIcon fontSize="small" color="disabled" />
                : link.gated
                    ? <LockOpenIcon fontSize="small" color="success" />
                    : <LinkIcon fontSize="small" color="action" />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                        variant="subtitle1"
                        fontWeight="bold"
                        color={locked ? 'text.secondary' : 'text.primary'}
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        {title}
                    </Typography>
                    {isNew && <Chip size="small" color="primary" label="New" sx={{ height: 20 }} />}
                </Stack>
                {meta}
            </Box>
            {!locked && <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
        </Box>
    );

    if (locked) {
        return (
            <Card variant="outlined" sx={{ opacity: 0.8, borderStyle: 'dashed' }}>
                <CardActionArea onClick={onLockedClick} disabled={!onLockedClick}>
                    {body}
                </CardActionArea>
            </Card>
        );
    }

    return (
        <Card variant="outlined">
            <CardActionArea component="a" href={url} target="_blank" rel="noopener noreferrer">
                {body}
            </CardActionArea>
        </Card>
    );
};

export default FeedLinkCard;
