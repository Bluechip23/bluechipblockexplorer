import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    FormGroup,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LaunchIcon from '@mui/icons-material/Launch';
import LockIcon from '@mui/icons-material/Lock';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PageShell from '../components/universal/PageShell';
import { useWallet } from '../context/WalletContext';
import { NotConnectedView } from '../components/universal/PortfolioShared';
import { factoryAddress } from '../components/universal/IndividualPage.const';
import { sanitizeOnChainString, validateTokenAmount } from '../utils/security';
import {
    abbreviateAddress,
    fetchAllPoolSummaries,
    findPoolsByCreator,
    PoolSummary,
} from '../utils/contractQueries';
import {
    addLink,
    addTier,
    CreatorLink,
    deleteLink,
    deleteTier,
    describeGate,
    formatTierPrice,
    getProfile,
    isProfilesDemoMode,
    linksOnlyGatedBy,
    MAX_PINNED_LINKS,
    MAX_TIERS,
    pinnedLinks,
    postLinks,
    ProfileWithLinks,
    saveProfile,
    Tier,
    updateLink,
    updateTier,
} from '../utils/profilesApi';
import { SUBSCRIPTION_PERIOD_DAYS } from '../utils/subscriptions';
import { microToOsmoInput } from '../utils/tierFormat';
import { isSafeHttpUrl } from '../components/creator-links/LinkCard';
import EmbedSnippetCard from '../components/creator-links/EmbedSnippetCard';

const NAME_PATTERN = /^[a-zA-Z0-9 _.-]{3,32}$/;
const TIER_NAME_MAX = 40;

// Client-side mirror of the server's field rules so users get instant
// feedback; the server re-validates everything.
function checkProfileInput(name: string, bio: string): string {
    if (!NAME_PATTERN.test(name.trim())) {
        return 'Display name must be 3-32 characters of letters, digits, spaces, "_", "." or "-".';
    }
    if (bio.trim().length > 280) return 'Bio must be at most 280 characters.';
    return '';
}

// "12.5" OSMO → micro-OSMO via the audited string-math validator (never
// floats for money).
function priceToMicro(osmo: string): { micro?: string; error?: string } {
    const res = validateTokenAmount(osmo.trim(), 6);
    return res.ok ? { micro: res.micro } : { error: res.error };
}

function checkTierInput(name: string, price: string): { micro?: string; error?: string } {
    if (!name.trim() || name.trim().length > TIER_NAME_MAX) {
        return { error: `Tier name must be 1-${TIER_NAME_MAX} characters.` };
    }
    const p = priceToMicro(price);
    return p.micro ? p : { error: p.error ? `Price: ${p.error}` : 'Enter a valid OSMO price.' };
}

interface TierPickerProps {
    tiers: Tier[];
    /** Without a profile pool, "any subscriber" has no pool to check. */
    hasProfilePool: boolean;
    selected: number[];
    onToggle: (id: number) => void;
    label: (t: Tier) => string;
    disabled?: boolean;
}

// Tier checkboxes shared by the add and edit link forms. No box checked =
// any active subscriber; checked boxes restrict the link to those tiers.
const TierPicker: React.FC<TierPickerProps> = ({ tiers, hasProfilePool, selected, onToggle, label, disabled }) => {
    const ownerOnly = !hasProfilePool && selected.length === 0;
    const ownerOnlyNote = ownerOnly && (
        <Alert severity="warning" sx={{ mt: 0.5 }}>
            With no creator pool set and no tier picked, only you can open this link. Set a creator pool
            above{tiers.length > 0 ? ' or pick a tier' : ''}.
        </Alert>
    );
    if (tiers.length === 0) {
        return ownerOnlyNote || (
            <Typography variant="caption" color="text.secondary">
                Any active subscriber can open this link. Add subscription tiers above to price it higher.
            </Typography>
        );
    }
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">
                Who can open it — leave every tier unchecked for any active subscriber:
            </Typography>
            <FormGroup>
                {tiers.map((t) => (
                    <FormControlLabel
                        key={t.id}
                        control={(
                            <Checkbox
                                size="small"
                                checked={selected.includes(t.id)}
                                onChange={() => onToggle(t.id)}
                                disabled={disabled}
                            />
                        )}
                        label={<Typography variant="body2">{label(t)}</Typography>}
                    />
                ))}
            </FormGroup>
            {selected.length > 1 && (
                <Typography variant="caption" color="text.secondary">
                    Any checked tier unlocks it, so the cheapest checked tier on each pool sets its price.
                </Typography>
            )}
            {ownerOnlyNote}
        </Box>
    );
};

const toggleId = (list: number[], id: number): number[] =>
    (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function checkLinkInput(title: string, url: string): string {
    if (!title.trim() || title.trim().length > 80) return 'Title must be 1-80 characters.';
    if (url.length > 2048 || !isSafeHttpUrl(url)) return 'URL must be a valid http(s) address.';
    return '';
}

interface LinkRowProps {
    link: CreatorLink;
    /** describeGate() for gated links. */
    gateLabel: string;
    divider: boolean;
    busy: boolean;
    /** Pin slots are full, so an unpinned row can't be pinned. */
    pinDisabled?: boolean;
    onToggleGated: () => void;
    onTogglePinned: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

// One row of the link manager. Pinned rows get up/down ordering; posts are
// chronological so they only get pin / gate / edit / delete.
const LinkRow: React.FC<LinkRowProps> = ({
    link, gateLabel, divider, busy, pinDisabled = false,
    onToggleGated, onTogglePinned, onMoveUp, onMoveDown, onEdit, onDelete,
}) => (
    <ListItem
        divider={divider}
        secondaryAction={
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Subscribers only">
                    <Switch size="small" checked={link.gated} onChange={onToggleGated} disabled={busy} />
                </Tooltip>
                <Tooltip title={link.pinned ? 'Unpin (becomes a post)' : pinDisabled ? 'All pin slots are used' : 'Pin to top'}>
                    <span>
                        <IconButton size="small" onClick={onTogglePinned} disabled={busy || (!link.pinned && pinDisabled)}>
                            {link.pinned ? <PushPinIcon fontSize="small" color="primary" /> : <PushPinOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>
                {link.pinned && (
                    <>
                        <IconButton size="small" onClick={onMoveUp} disabled={busy || !onMoveUp}>
                            <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={onMoveDown} disabled={busy || !onMoveDown}>
                            <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                    </>
                )}
                <IconButton size="small" onClick={onEdit} disabled={busy}>
                    <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={onDelete} disabled={busy}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Stack>
        }
    >
        <ListItemText
            sx={{ pr: 26 }}
            primary={
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    {link.gated && <LockIcon sx={{ fontSize: 14 }} color="disabled" />}
                    <span>{sanitizeOnChainString(link.title, 80)}</span>
                    {link.gated && (
                        <Chip size="small" variant="outlined" label={sanitizeOnChainString(gateLabel, 120)} sx={{ height: 20 }} />
                    )}
                </Stack>
            }
            secondary={link.url
                ? sanitizeOnChainString(link.url, 96)
                : 'URL hidden (subscribers only)'}
        />
    </ListItem>
);

/**
 * Wallet-gated manage page (/mylinks): set display name + bio + pool, and
 * curate the public links list. Every mutation is an ADR-36-signed profiles
 * API call (nonce → signArbitrary → request), then the page refetches.
 */
const ManageLinksPage: React.FC = () => {
    const { address, walletName } = useWallet();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [loadKey, setLoadKey] = useState(0);
    const [profileData, setProfileData] = useState<ProfileWithLinks | null>(null);
    const [myPools, setMyPools] = useState<PoolSummary[]>([]);
    const [demoMode, setDemoMode] = useState(false);

    // Profile form
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [poolChoice, setPoolChoice] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSaved, setProfileSaved] = useState(false);

    // Link manager
    const [newTitle, setNewTitle] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newGated, setNewGated] = useState(false);
    const [newPinned, setNewPinned] = useState(false);
    const [newTierIds, setNewTierIds] = useState<number[]>([]);
    const [editTierIds, setEditTierIds] = useState<number[]>([]);

    // Tier manager
    const [tierPool, setTierPool] = useState('');
    const [tierName, setTierName] = useState('');
    const [tierPrice, setTierPrice] = useState('');
    const [tierBusy, setTierBusy] = useState(false);
    const [tierError, setTierError] = useState('');
    const [editingTier, setEditingTier] = useState<Tier | null>(null);
    const [editTierName, setEditTierName] = useState('');
    const [editTierPrice, setEditTierPrice] = useState('');
    const [deletingTier, setDeletingTier] = useState<Tier | null>(null);
    const [linkBusy, setLinkBusy] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [editing, setEditing] = useState<CreatorLink | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [editGated, setEditGated] = useState(false);
    const [editPinned, setEditPinned] = useState(false);

    useEffect(() => {
        if (!address) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const [prof, demo] = await Promise.all([
                    getProfile(address),
                    isProfilesDemoMode(),
                ]);
                if (cancelled) return;
                setDemoMode(demo);
                setProfileData(prof);
                if (prof) {
                    setName(prof.profile.name);
                    setBio(prof.profile.bio ?? '');
                    setPoolChoice(prof.profile.pool_address ?? '');
                }
                if (factoryAddress) {
                    const pools = await fetchAllPoolSummaries(factoryAddress);
                    if (cancelled) return;
                    const mine = await findPoolsByCreator(pools, address);
                    if (!cancelled) {
                        setMyPools(mine);
                        // Default new tiers to the profile pool, else the first owned pool.
                        setTierPool((cur) => cur || prof?.profile.pool_address || mine[0]?.poolAddress || '');
                    }
                }
            } catch (err) {
                console.error('Error loading manage links page:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [address, loadKey]);

    const refetch = () => setLoadKey((k) => k + 1);
    // Pinned links (the bio set) keep the creator's order; everything else
    // is a post and lists newest first, exactly as the public page shows it.
    const pinned = profileData ? pinnedLinks(profileData.links) : [];
    const posts = profileData ? postLinks(profileData.links) : [];
    const linkCount = profileData?.links.length ?? 0;
    const pinSlotsFull = pinned.length >= MAX_PINNED_LINKS;
    const selectedPool = poolChoice;
    const tiers = useMemo(() => profileData?.tiers ?? [], [profileData]);
    const tierPools = useMemo(() => [...new Set(tiers.map((t) => t.pool_address))], [tiers]);
    const symbolForPool = (pool: string): string => {
        const match = myPools.find((p) => p.poolAddress === pool);
        return match ? sanitizeOnChainString(match.tokenSymbol, 16) : abbreviateAddress(pool);
    };
    const tierLabel = (t: Tier): string =>
        `${sanitizeOnChainString(t.name, 40)} · ${symbolForPool(t.pool_address)} · ${formatTierPrice(t.price_native)}`;
    // The saved pool may predate the on-chain ownership check (or the pool
    // list failed to load) — keep it selectable rather than silently
    // dropping it. New pools can only be chosen from the wallet's own.
    const knownPoolAddresses = myPools.map((p) => p.poolAddress);
    const savedUnknownPool = profileData?.profile.pool_address
        && !knownPoolAddresses.includes(profileData.profile.pool_address)
        ? profileData.profile.pool_address
        : null;

    const handleSaveProfile = async () => {
        if (!address) return;
        setProfileError('');
        setProfileSaved(false);
        const validation = checkProfileInput(name, bio);
        if (validation) {
            setProfileError(validation);
            return;
        }
        setSavingProfile(true);
        try {
            const res = await saveProfile(address, walletName, {
                name: name.trim(),
                pool_address: selectedPool || null,
                bio: bio.trim() || null,
            });
            if (res.ok) {
                setProfileSaved(true);
                refetch();
            } else {
                setProfileError(res.error);
            }
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAddLink = async () => {
        if (!address) return;
        setLinkError('');
        const validation = checkLinkInput(newTitle, newUrl.trim());
        if (validation) {
            setLinkError(validation);
            return;
        }
        setLinkBusy(true);
        try {
            const res = await addLink(address, walletName, {
                title: newTitle.trim(),
                url: newUrl.trim(),
                gated: newGated,
                tier_ids: newGated ? newTierIds : [],
                pinned: newPinned,
            });
            if (res.ok) {
                setNewTitle('');
                setNewUrl('');
                setNewGated(false);
                setNewTierIds([]);
                setNewPinned(false);
                refetch();
            } else {
                setLinkError(res.error);
            }
        } finally {
            setLinkBusy(false);
        }
    };

    const handleToggleGated = async (link: CreatorLink) => {
        if (!address) return;
        setLinkError('');
        setLinkBusy(true);
        try {
            const res = await updateLink(address, walletName, link.id, { gated: !link.gated });
            if (res.ok) refetch();
            else setLinkError(res.error);
        } finally {
            setLinkBusy(false);
        }
    };

    const handleTogglePinned = async (link: CreatorLink) => {
        if (!address) return;
        setLinkError('');
        setLinkBusy(true);
        try {
            // Newly pinned links go to the end of the pinned set.
            const nextPos = pinned.reduce((m, l) => Math.max(m, l.position), -1) + 1;
            const res = await updateLink(address, walletName, link.id, {
                pinned: !link.pinned,
                ...(link.pinned ? {} : { position: nextPos }),
            });
            if (res.ok) refetch();
            else setLinkError(res.error);
        } finally {
            setLinkBusy(false);
        }
    };

    // Up/down reordering within the pinned set: swap the two neighbors'
    // position values (fall back to their list indices when positions
    // collide). Two signed updates. Posts are chronological, so they have
    // no manual order.
    const handleMove = async (index: number, direction: -1 | 1) => {
        if (!address) return;
        const target = index + direction;
        if (target < 0 || target >= pinned.length) return;
        const a = pinned[index];
        const b = pinned[target];
        const posA = a.position !== b.position ? b.position : target;
        const posB = a.position !== b.position ? a.position : index;
        setLinkError('');
        setLinkBusy(true);
        try {
            const resA = await updateLink(address, walletName, a.id, { position: posA });
            if (!resA.ok) {
                setLinkError(resA.error);
                return;
            }
            const resB = await updateLink(address, walletName, b.id, { position: posB });
            if (!resB.ok) setLinkError(resB.error);
            refetch();
        } finally {
            setLinkBusy(false);
        }
    };

    const handleDeleteLink = async (link: CreatorLink) => {
        if (!address) return;
        setLinkError('');
        setLinkBusy(true);
        try {
            const res = await deleteLink(address, walletName, link.id);
            if (res.ok) refetch();
            else setLinkError(res.error);
        } finally {
            setLinkBusy(false);
        }
    };

    const openEdit = (link: CreatorLink) => {
        setEditing(link);
        setEditTitle(link.title);
        setEditUrl(link.url ?? '');
        setEditGated(link.gated);
        setEditTierIds(link.tier_ids ?? []);
        setEditPinned(link.pinned);
    };

    const handleSaveEdit = async () => {
        if (!address || !editing) return;
        setLinkError('');
        // Public reads hide gated URLs, so an empty URL field here means
        // "keep the stored URL" rather than "clear it".
        const urlPatch = editUrl.trim() ? editUrl.trim() : undefined;
        const validation = checkLinkInput(editTitle, urlPatch ?? 'https://placeholder.invalid');
        if (validation) {
            setLinkError(validation);
            return;
        }
        setLinkBusy(true);
        try {
            const res = await updateLink(address, walletName, editing.id, {
                title: editTitle.trim(),
                url: urlPatch,
                gated: editGated,
                tier_ids: editGated ? editTierIds : [],
                pinned: editPinned,
            });
            if (res.ok) {
                setEditing(null);
                refetch();
            } else {
                setLinkError(res.error);
            }
        } finally {
            setLinkBusy(false);
        }
    };

    // ---- Tiers ----------------------------------------------------------

    const handleAddTier = async () => {
        if (!address) return;
        setTierError('');
        if (!tierPool) {
            setTierError('Choose which of your pools this tier is on.');
            return;
        }
        const check = checkTierInput(tierName, tierPrice);
        if (!check.micro) {
            setTierError(check.error!);
            return;
        }
        setTierBusy(true);
        try {
            const res = await addTier(address, walletName, {
                pool_address: tierPool,
                name: tierName.trim(),
                price_native: check.micro,
            });
            if (res.ok) {
                setTierName('');
                setTierPrice('');
                refetch();
            } else {
                setTierError(res.error);
            }
        } finally {
            setTierBusy(false);
        }
    };

    const openEditTier = (t: Tier) => {
        setEditingTier(t);
        setEditTierName(t.name);
        setEditTierPrice(microToOsmoInput(t.price_native));
        setTierError('');
    };

    const handleSaveTier = async () => {
        if (!address || !editingTier) return;
        setTierError('');
        const check = checkTierInput(editTierName, editTierPrice);
        if (!check.micro) {
            setTierError(check.error!);
            return;
        }
        setTierBusy(true);
        try {
            const res = await updateTier(address, walletName, editingTier.id, {
                name: editTierName.trim(),
                price_native: check.micro,
            });
            if (res.ok) {
                setEditingTier(null);
                refetch();
            } else {
                setTierError(res.error);
            }
        } finally {
            setTierBusy(false);
        }
    };

    const handleDeleteTier = async (t: Tier) => {
        if (!address) return;
        setTierError('');
        setTierBusy(true);
        try {
            const res = await deleteTier(address, walletName, t.id);
            if (res.ok) {
                setDeletingTier(null);
                refetch();
            } else {
                setTierError(res.error);
            }
        } finally {
            setTierBusy(false);
        }
    };

    const deletingOrphans = deletingTier && profileData
        ? linksOnlyGatedBy(profileData.links, deletingTier.id)
        : [];
    const linksUsingTier = (id: number) => profileData?.links.filter((l) => l.tier_ids?.includes(id)).length ?? 0;

    const publicPageKey = profileData?.profile.name || address;

    return (
        <PageShell>
            <Grid item xs={12} md={10}>
                {!address ? (
                    <NotConnectedView description="Connect your wallet to set up your creator links page: display name, bio, and subscriber-only links." />
                ) : loading ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                        <CircularProgress />
                        <Typography variant="body2" sx={{ mt: 1 }}>Loading your links page...</Typography>
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        {demoMode && (
                            <Alert severity="info">
                                Demo mode — your profile is stored locally in this browser
                                (no signatures required, nothing published).
                            </Alert>
                        )}

                        {/* Profile form */}
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                    <Box>
                                        <Typography variant="h5" fontWeight="bold">My Links Page</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                            {address}
                                        </Typography>
                                    </Box>
                                    {profileData && (
                                        <Button
                                            variant="outlined"
                                            startIcon={<LaunchIcon />}
                                            onClick={() => navigate(`/creator/${encodeURIComponent(publicPageKey!)}`)}
                                        >
                                            View my public page
                                        </Button>
                                    )}
                                </Box>
                                <Divider sx={{ my: 2 }} />
                                <Stack spacing={2}>
                                    <TextField
                                        label="Display name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        fullWidth
                                        helperText='3-32 characters: letters, digits, spaces, "_", "." or "-"'
                                    />
                                    <TextField
                                        label="Bio (optional)"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        helperText={`${bio.trim().length}/280 characters`}
                                    />
                                    <TextField
                                        select
                                        label="Creator pool"
                                        value={poolChoice}
                                        onChange={(e) => setPoolChoice(e.target.value)}
                                        fullWidth
                                        helperText="Its subscribers see your posts in their feed and can open your subscriber-only links. Only pools your wallet created."
                                    >
                                        <MenuItem value="">None</MenuItem>
                                        {myPools.map((p) => (
                                            <MenuItem key={p.poolAddress} value={p.poolAddress}>
                                                {p.tokenSymbol} — {abbreviateAddress(p.poolAddress)}
                                            </MenuItem>
                                        ))}
                                        {savedUnknownPool && (
                                            <MenuItem value={savedUnknownPool}>
                                                {abbreviateAddress(savedUnknownPool)} (saved)
                                            </MenuItem>
                                        )}
                                    </TextField>
                                    {profileError && <Alert severity="error">{profileError}</Alert>}
                                    {profileSaved && !profileError && (
                                        <Alert severity="success" onClose={() => setProfileSaved(false)}>
                                            Profile saved.
                                        </Alert>
                                    )}
                                    <Button
                                        variant="contained"
                                        onClick={handleSaveProfile}
                                        disabled={savingProfile || !name.trim()}
                                        startIcon={savingProfile ? <CircularProgress size={16} color="inherit" /> : null}
                                    >
                                        {savingProfile ? 'Saving...' : profileData ? 'Update Profile' : 'Create Profile'}
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Subscription tiers */}
                        {profileData && (
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                                        Subscription tiers ({tiers.length}/{MAX_TIERS})
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                        Named OSMO prices on pools you created. A subscriber whose latest commit paid at
                                        least a tier's price can open the links you put in that tier for
                                        {' '}{SUBSCRIPTION_PERIOD_DAYS} days. A bigger commit covers every cheaper tier.
                                    </Typography>
                                    {tierError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setTierError('')}>{tierError}</Alert>}

                                    {tiers.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                            No tiers yet. Without tiers, any active subscriber can open your subscriber-only links.
                                        </Typography>
                                    ) : (
                                        <Stack spacing={1.5} sx={{ mb: 1 }}>
                                            {tierPools.map((pool) => (
                                                <Box key={pool}>
                                                    <Chip size="small" label={symbolForPool(pool)} sx={{ mb: 0.5 }} />
                                                    <List dense disablePadding>
                                                        {tiers.filter((t) => t.pool_address === pool).map((t) => {
                                                            const used = linksUsingTier(t.id);
                                                            return (
                                                                <ListItem
                                                                    key={t.id}
                                                                    disableGutters
                                                                    secondaryAction={(
                                                                        <Stack direction="row" spacing={0.5}>
                                                                            <IconButton size="small" onClick={() => openEditTier(t)} disabled={tierBusy}>
                                                                                <EditIcon fontSize="small" />
                                                                            </IconButton>
                                                                            <IconButton size="small" onClick={() => setDeletingTier(t)} disabled={tierBusy}>
                                                                                <DeleteIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Stack>
                                                                    )}
                                                                >
                                                                    <ListItemText
                                                                        sx={{ pr: 10 }}
                                                                        primary={sanitizeOnChainString(t.name, 40)}
                                                                        secondary={`${formatTierPrice(t.price_native)} per ${SUBSCRIPTION_PERIOD_DAYS} days · ${used} link${used === 1 ? '' : 's'}`}
                                                                    />
                                                                </ListItem>
                                                            );
                                                        })}
                                                    </List>
                                                </Box>
                                            ))}
                                        </Stack>
                                    )}

                                    <Divider sx={{ my: 1.5 }} />
                                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Add a tier</Typography>
                                    {tiers.length >= MAX_TIERS ? (
                                        <Alert severity="info">
                                            You've reached the maximum of {MAX_TIERS} tiers. Delete one to add another.
                                        </Alert>
                                    ) : myPools.length === 0 ? (
                                        <Alert severity="info">
                                            Tiers live on a pool your wallet created. Create a creator pool first.
                                        </Alert>
                                    ) : (
                                        <Stack spacing={1.5}>
                                            {myPools.length > 1 && (
                                                <TextField
                                                    select
                                                    label="Pool"
                                                    size="small"
                                                    value={tierPool}
                                                    onChange={(e) => setTierPool(e.target.value)}
                                                    fullWidth
                                                >
                                                    {myPools.map((p) => (
                                                        <MenuItem key={p.poolAddress} value={p.poolAddress}>
                                                            {sanitizeOnChainString(p.tokenSymbol, 16)} — {abbreviateAddress(p.poolAddress)}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            )}
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                                <TextField
                                                    label="Tier name"
                                                    size="small"
                                                    value={tierName}
                                                    onChange={(e) => setTierName(e.target.value)}
                                                    fullWidth
                                                    placeholder="e.g. Gold"
                                                />
                                                <TextField
                                                    label="Price per commit"
                                                    size="small"
                                                    value={tierPrice}
                                                    onChange={(e) => setTierPrice(e.target.value)}
                                                    fullWidth
                                                    placeholder="25"
                                                    inputProps={{ inputMode: 'decimal' }}
                                                    InputProps={{ endAdornment: <Typography variant="body2" color="text.secondary">OSMO</Typography> }}
                                                />
                                            </Stack>
                                            <Box>
                                                <Button
                                                    variant="contained"
                                                    startIcon={<AddCircleIcon />}
                                                    onClick={handleAddTier}
                                                    disabled={tierBusy || !tierName.trim() || !tierPrice.trim() || !tierPool}
                                                >
                                                    {tierBusy ? 'Saving...' : 'Add Tier'}
                                                </Button>
                                            </Box>
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Link manager */}
                        {profileData ? (
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                                        Links ({linkCount})
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Pinned links are your bio — up to {MAX_PINNED_LINKS}, shown at the top of your page in
                                        the order you set. Everything else is a post: subscribers see it in their feed and
                                        your page lists it newest first. There is no limit on posts.
                                    </Typography>
                                    {linkError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setLinkError('')}>{linkError}</Alert>}
                                    {linkCount === 0 ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                            No links yet — add your first one below.
                                        </Typography>
                                    ) : (
                                        <>
                                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
                                                Pinned ({pinned.length}/{MAX_PINNED_LINKS})
                                            </Typography>
                                            {pinned.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                    Nothing pinned — pin your site, store, or socials so they always sit at the top.
                                                </Typography>
                                            ) : (
                                                <List dense>
                                                    {pinned.map((link, i) => (
                                                        <LinkRow
                                                            key={link.id}
                                                            link={link}
                                                            gateLabel={describeGate(link, tiers)}
                                                            divider={i < pinned.length - 1}
                                                            busy={linkBusy}
                                                            onToggleGated={() => handleToggleGated(link)}
                                                            onTogglePinned={() => handleTogglePinned(link)}
                                                            onMoveUp={i > 0 ? () => handleMove(i, -1) : undefined}
                                                            onMoveDown={i < pinned.length - 1 ? () => handleMove(i, 1) : undefined}
                                                            onEdit={() => openEdit(link)}
                                                            onDelete={() => handleDeleteLink(link)}
                                                        />
                                                    ))}
                                                </List>
                                            )}
                                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
                                                Posts ({posts.length})
                                            </Typography>
                                            {posts.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                    No posts yet — every unpinned link you add shows up in your subscribers' feeds.
                                                </Typography>
                                            ) : (
                                                <List dense>
                                                    {posts.map((link, i) => (
                                                        <LinkRow
                                                            key={link.id}
                                                            link={link}
                                                            gateLabel={describeGate(link, tiers)}
                                                            divider={i < posts.length - 1}
                                                            busy={linkBusy}
                                                            pinDisabled={pinSlotsFull}
                                                            onToggleGated={() => handleToggleGated(link)}
                                                            onTogglePinned={() => handleTogglePinned(link)}
                                                            onEdit={() => openEdit(link)}
                                                            onDelete={() => handleDeleteLink(link)}
                                                        />
                                                    ))}
                                                </List>
                                            )}
                                        </>
                                    )}

                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Add a link</Typography>
                                    <Stack spacing={1.5}>
                                        <TextField
                                            label="Title"
                                            size="small"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            fullWidth
                                        />
                                        <TextField
                                            label="URL"
                                            size="small"
                                            value={newUrl}
                                            onChange={(e) => setNewUrl(e.target.value)}
                                            fullWidth
                                            placeholder="https://..."
                                        />
                                        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                                            <FormControlLabel
                                                control={<Switch checked={newGated} onChange={(e) => setNewGated(e.target.checked)} />}
                                                label="Subscribers only"
                                            />
                                            <Tooltip title={pinSlotsFull ? `All ${MAX_PINNED_LINKS} pin slots are used` : 'Keep this link at the top of your page'}>
                                                <FormControlLabel
                                                    control={(
                                                        <Switch
                                                            checked={newPinned && !pinSlotsFull}
                                                            onChange={(e) => setNewPinned(e.target.checked)}
                                                            disabled={pinSlotsFull}
                                                        />
                                                    )}
                                                    label="Pin to top"
                                                />
                                            </Tooltip>
                                            <Button
                                                variant="contained"
                                                startIcon={<AddCircleIcon />}
                                                onClick={handleAddLink}
                                                disabled={linkBusy || !newTitle.trim() || !newUrl.trim()}
                                            >
                                                {newPinned && !pinSlotsFull ? 'Add Pinned Link' : 'Post Link'}
                                            </Button>
                                        </Stack>
                                        {newGated && (
                                            <TierPicker
                                                tiers={tiers}
                                                hasProfilePool={!!profileData.profile.pool_address}
                                                selected={newTierIds}
                                                onToggle={(id) => setNewTierIds((ids) => toggleId(ids, id))}
                                                label={tierLabel}
                                                disabled={linkBusy}
                                            />
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        ) : (
                            <Alert severity="info">
                                Create your profile above to start adding links.
                            </Alert>
                        )}

                        {/* Widget embed snippet */}
                        {profileData?.profile.pool_address && (
                            <EmbedSnippetCard poolAddress={profileData.profile.pool_address} />
                        )}
                    </Stack>
                )}

                {/* Edit link dialog */}
                <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit link</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                label="Title"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="URL"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                fullWidth
                                placeholder="https://..."
                                helperText={editing && !editing.url
                                    ? 'Leave blank to keep the current (hidden) URL'
                                    : undefined}
                            />
                            <FormControlLabel
                                control={<Switch checked={editGated} onChange={(e) => setEditGated(e.target.checked)} />}
                                label="Subscribers only"
                            />
                            {editGated && (
                                <TierPicker
                                    tiers={tiers}
                                    hasProfilePool={!!profileData?.profile.pool_address}
                                    selected={editTierIds}
                                    onToggle={(id) => setEditTierIds((ids) => toggleId(ids, id))}
                                    label={tierLabel}
                                    disabled={linkBusy}
                                />
                            )}
                            <FormControlLabel
                                control={(
                                    <Switch
                                        checked={editPinned}
                                        onChange={(e) => setEditPinned(e.target.checked)}
                                        disabled={!editPinned && pinSlotsFull}
                                    />
                                )}
                                label={!editPinned && pinSlotsFull ? `Pin to top (all ${MAX_PINNED_LINKS} slots used)` : 'Pin to top'}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditing(null)} disabled={linkBusy}>Cancel</Button>
                        <Button variant="contained" onClick={handleSaveEdit} disabled={linkBusy}>
                            {linkBusy ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Edit tier dialog */}
                <Dialog open={!!editingTier} onClose={() => setEditingTier(null)} maxWidth="xs" fullWidth>
                    <DialogTitle>Edit tier</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            {tierError && <Alert severity="error">{tierError}</Alert>}
                            <TextField
                                label="Tier name"
                                value={editTierName}
                                onChange={(e) => setEditTierName(e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="Price per commit"
                                value={editTierPrice}
                                onChange={(e) => setEditTierPrice(e.target.value)}
                                fullWidth
                                inputProps={{ inputMode: 'decimal' }}
                                InputProps={{ endAdornment: <Typography variant="body2" color="text.secondary">OSMO</Typography> }}
                                helperText="A new price applies right away, including to current subscribers."
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditingTier(null)} disabled={tierBusy}>Cancel</Button>
                        <Button variant="contained" onClick={handleSaveTier} disabled={tierBusy}>
                            {tierBusy ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete tier confirmation */}
                <Dialog open={!!deletingTier} onClose={() => setDeletingTier(null)} maxWidth="xs" fullWidth>
                    <DialogTitle>Delete tier?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">
                            "{sanitizeOnChainString(deletingTier?.name, 40)}" is removed from every link it gates.
                        </Typography>
                        {deletingOrphans.length > 0 && (
                            <Alert severity="warning" sx={{ mt: 1.5 }}>
                                {deletingOrphans.length} link{deletingOrphans.length === 1 ? ' is' : 's are'} gated only by this
                                tier and will open to any active subscriber. Edit {deletingOrphans.length === 1 ? 'it' : 'them'} first
                                to keep a higher price.
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeletingTier(null)} disabled={tierBusy}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={() => deletingTier && handleDeleteTier(deletingTier)} disabled={tierBusy}>
                            {tierBusy ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Grid>
        </PageShell>
    );
};

export default ManageLinksPage;
