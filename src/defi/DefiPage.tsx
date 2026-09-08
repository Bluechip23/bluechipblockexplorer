import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Grid, Stack, Typography, Tabs, Tab, Box, Card, CardContent, TextField, Button, Alert, IconButton, Tooltip, Link } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import PageShell from '../components/universal/PageShell';
import PoolPickerField from '../components/universal/PoolPickerField';
import CommitTracker from './CommitTracker';
import NativePriceBanner from '../components/universal/NativePriceBanner';
import CrossTokenSwapTab from './CrossTokenSwapTab';
import { NATIVE_DENOM, COIN_DECIMALS } from './types';
import { factoryAddress } from '../components/universal/IndividualPage.const';
import { useWallet } from '../context/WalletContext';
import {
    validateTokenAmount,
    validateBech32Address,
    validateSlippage,
    assertWalletOnExpectedChain,
    humanizeContractError,
} from '../utils/security';
import { formatMicroAmount } from '../utils/bigintMath';
import { isFullyCommitted } from '../utils/contractQueries';
import { deadlineNs } from '../utils/datetime';
import { stdFee } from '../utils/fees';
import { deriveBeliefPrice, resolvePoolAssets } from '../utils/poolActions';
import { chainQueryNativePoolId, NativePoolIdResponse } from '../utils/chainQueries';

// Sentinel the factory's commit-pool create handler requires in the
// CreatorToken slot of pool_token_info. The pool mints its own native
// TokenFactory denom (factory/{pool_addr}/{subdenom}) at instantiate and
// rewrites this slot with the real denom.
const CREATOR_TOKEN_SENTINEL = 'WILL_BE_CREATED_BY_FACTORY';

const TabPanel: React.FC<{ children?: React.ReactNode; value: number; index: number }> = ({ children, value, index }) => (
    <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
);

const TxHashDisplay: React.FC<{ txHash: string }> = ({ txHash }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(txHash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    if (!txHash) return null;
    return (
        <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, border: '1px solid', borderColor: 'success.main', mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Transaction Hash:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, fontSize: '0.85rem' }}>
                    {txHash}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                    <IconButton size="small" onClick={handleCopy} color={copied ? 'success' : 'primary'}>
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
};

// =========================================================================
// CREATE POOL TAB
// =========================================================================
const CreatePoolTab: React.FC<{ client: SigningCosmWasmClient | null; address: string }> = ({ client, address }) => {
    // Commit-pool inputs. (Standard pools were removed from the factory —
    // the only creation path is the commit / creator pool.)
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');

    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const FACTORY = factoryAddress || process.env.REACT_APP_FACTORY_ADDRESS || '';

    const handleCreate = async () => {
        if (!client || !address) { setStatus('Please connect your wallet'); return; }
        if (!FACTORY) { setStatus('Error: Factory address not configured'); return; }

        // SECURITY: Validate factory address is well-formed bech32.
        const factoryCheck = validateBech32Address(FACTORY);
        if (!factoryCheck.ok) {
            setStatus(`Error: Factory address invalid — ${factoryCheck.error}`);
            return;
        }

        // SECURITY: Assert chain ID matches the expected Osmosis chain before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setStatus(`Error: ${chainCheck.error}`);
            return;
        }

        try {
            setTxHash('');

            if (!tokenName || !tokenSymbol) { setStatus('Error: Enter token name and symbol'); return; }

            // Mirror the contract's validate_creator_token_info bounds.
            if (tokenName.length < 3 || tokenName.length > 50 || !/^[\x20-\x7E]+$/.test(tokenName)) {
                setStatus('Error: Token name must be 3-50 printable ASCII characters');
                return;
            }
            if (!/^[A-Z0-9]{3,12}$/.test(tokenSymbol) || !/[A-Z]/.test(tokenSymbol)) {
                setStatus('Error: Token symbol must be 3-12 chars (A-Z, 0-9) with at least one letter');
                return;
            }

            setStatus('Creating commit pool...');

            // The factory charges a flat OSMO creation fee — read the live
            // value from factory config and attach exactly that. Zero fee
            // means attach nothing (the handler rejects funds in that case).
            const factoryConfig = await client.queryContractSmart(FACTORY, { factory: {} });
            const creationFee: string = factoryConfig?.factory?.pool_creation_fee ?? '0';
            const feeDenom: string = factoryConfig?.factory?.bluechip_denom ?? NATIVE_DENOM;
            const funds = creationFee !== '0'
                ? [{ denom: feeDenom, amount: creationFee }]
                : [];

            // The factory's CreatePool carries only pool_token_info; every
            // other dial (commit_fee_info, threshold_payout, lock caps,
            // pricing config) is sourced from the factory's stored config
            // and silently overwritten if the caller tries to supply it.
            const createMsg = {
                create: {
                    pool_msg: {
                        pool_token_info: [
                            { bluechip: { denom: feeDenom } },
                            { creator_token: { denom: CREATOR_TOKEN_SENTINEL } },
                        ],
                    },
                    token_info: {
                        name: tokenName,
                        symbol: tokenSymbol,
                        decimal: 6,
                    },
                },
            };

            const result = await client.execute(address, FACTORY, createMsg, stdFee(3000000), 'Create Commit Pool', funds);
            setTxHash(result.transactionHash);
            setStatus('Success! Commit pool creation submitted.');
            setTokenName('');
            setTokenSymbol('');
        } catch (err) {
            setStatus('Error: ' + (err as Error).message);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Token Name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="My Creator Token" required helperText="3-50 printable ASCII characters" />
            <TextField label="Token Symbol" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())} placeholder="MCT" required inputProps={{ maxLength: 12 }} helperText="3-12 chars, A-Z + 0-9, at least one letter" />
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Pool Configuration</Typography>
                <Typography variant="body2">
                    All commit-phase economics (OSMO commit threshold, fees, lock caps, fee-swap pool) are read from the
                    factory's stored config — the create payload only carries the token pair. Your token is
                    minted as a native Osmosis TokenFactory denom, and the flat OSMO creation fee is read
                    live from the factory and attached automatically (surplus is refunded on-chain).
                </Typography>
            </Box>

            <Button variant="contained" onClick={handleCreate} disabled={!client || !address}>
                Create Commit Pool
            </Button>
            {status && <Alert severity={status.includes('Success') ? 'success' : status.includes('Error') ? 'error' : 'info'}>{status}</Alert>}
            <TxHashDisplay txHash={txHash} />
        </Box>
    );
};

// =========================================================================
// SUBSCRIBE / COMMIT TAB (creator-pool only)
// =========================================================================
const CommitTab: React.FC<{ client: SigningCosmWasmClient | null; address: string }> = ({ client, address }) => {
    const [subTab, setSubTab] = useState(0);
    const [poolAddress, setPoolAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.005');
    const [deadline, setDeadline] = useState('20');
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const handleSubscribe = async () => {
        if (!client || !address || !poolAddress) { setStatus('Connect wallet and enter pool address'); return; }

        // SECURITY: Validate pool address is a well-formed osmo bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Validate amount using string-math to avoid floating-point drift.
        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS);
        if (!amtCheck.ok) { setStatus(`Error: ${amtCheck.error}`); return; }

        // SECURITY: Assert chain ID matches the expected Osmosis chain before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Subscribing...');
            setTxHash('');
            const micro = amtCheck.micro!;

            const thresholdStatus = await client.queryContractSmart(poolAddress, { is_fully_commited: {} });
            const isThresholdCrossed = isFullyCommitted(thresholdStatus);
            const txDeadline = deadlineNs(deadline);
            const { bluechipDenom } = await resolvePoolAssets(client, poolAddress);

            // Post-threshold commits swap through the native pool and the
            // contract REQUIRES a belief_price on that path — derive it
            // from a live quote so a front-run reverts instead of filling
            // at a worse price. Pre-threshold commits don't swap.
            let beliefPrice: string | null = null;
            if (isThresholdCrossed) {
                beliefPrice = await deriveBeliefPrice(
                    client,
                    poolAddress,
                    { bluechip: { denom: bluechipDenom } },
                    micro,
                );
                if (!beliefPrice) {
                    setStatus('Error: Could not quote this commit against the pool — try again in a moment.');
                    return;
                }
            }

            const msg = {
                commit: {
                    asset: { info: { bluechip: { denom: bluechipDenom } }, amount: micro },
                    transaction_deadline: txDeadline,
                    belief_price: beliefPrice,
                    max_spread: (isThresholdCrossed && maxSpread) ? maxSpread : null,
                },
            };

            // Pre-threshold budget covers the crossing case (native GAMM
            // pool creation + seeding in the same tx); post-threshold
            // commits are single swaps.
            const commitGas = isThresholdCrossed ? 800000 : 3000000;
            const result = await client.execute(address, poolAddress, msg, stdFee(commitGas), 'Commit', [{ denom: bluechipDenom, amount: micro }]);
            setTxHash(result.transactionHash);
            setStatus('Success! Transaction confirmed.');
        } catch (err) {
            setStatus('Error: ' + humanizeContractError(err));
        }
    };

    return (
        <Box>
            <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 2 }}>
                <Tab label="Commit" />
                <Tab label="Progress Tracker" />
            </Tabs>
            {subTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <NativePriceBanner />
                    <PoolPickerField value={poolAddress} onChange={setPoolAddress} label="Pool" />
                    <TextField label="Amount (OSMO)" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
                    <TextField label="Max Spread" value={maxSpread} onChange={(e) => setMaxSpread(e.target.value)} helperText="e.g. 0.005 for 0.5% (applies post-threshold)" />
                    <TextField label="Deadline (minutes)" value={deadline} onChange={(e) => setDeadline(e.target.value)} type="number" />
                    <Button variant="contained" onClick={handleSubscribe} disabled={!client}>Commit</Button>
                    {status && <Alert severity={status.includes('Success') ? 'success' : 'info'}>{status}</Alert>}
                    <TxHashDisplay txHash={txHash} />
                </Box>
            )}
            {subTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <PoolPickerField value={poolAddress} onChange={setPoolAddress} label="Pool" />
                    {poolAddress && <CommitTracker client={client} contractAddress={poolAddress} />}
                </Box>
            )}
        </Box>
    );
};

// =========================================================================
// SWAP TAB
// =========================================================================
const SwapTab: React.FC<{ client: SigningCosmWasmClient | null; address: string }> = ({ client, address }) => {
    const [poolAddress, setPoolAddress] = useState('');
    const [offerAsset, setOfferAsset] = useState('');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.005');
    const [deadline, setDeadline] = useState('20');
    const [allowHighSpread, setAllowHighSpread] = useState(false);
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const handleSwap = async () => {
        if (!client || !address || !poolAddress) { setStatus('Connect wallet and enter pool address'); return; }

        // SECURITY: Validate pool address is a well-formed osmo bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Validate amount using string-math to avoid floating-point drift.
        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS);
        if (!amtCheck.ok) { setStatus(`Error: ${amtCheck.error}`); return; }

        // SECURITY: Validate slippage bounds (maxSpread is a decimal string).
        const spreadPct = parseFloat(maxSpread) * 100;
        if (Number.isFinite(spreadPct)) {
            const slipCheck = validateSlippage(spreadPct);
            if (!slipCheck.ok) { setStatus(`Error: ${slipCheck.error}`); return; }
        }

        // SECURITY: Assert chain ID matches the expected Osmosis chain before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Swapping...');
            setTxHash('');
            const micro = amtCheck.micro!;
            const txDeadline = deadlineNs(deadline);

            // Both sides of every pool are native bank denoms now: OSMO
            // (uosmo) and the creator token's TokenFactory denom
            // (factory/{pool}/{sub}). Either direction is the same
            // simple_swap with the offered denom attached as funds — the
            // old CW20 send-hook path no longer exists.
            const offerDenom = offerAsset.trim() || NATIVE_DENOM;
            const isCreatorToken = offerDenom.startsWith('factory/');
            const offerInfo = isCreatorToken
                ? { creator_token: { denom: offerDenom } }
                : { bluechip: { denom: offerDenom } };

            // Fix belief_price from a live quote — a front-run that moves
            // the pool reverts the swap instead of filling at a worse price.
            // The contract rejects a direct simple_swap without one, so a
            // failed quote aborts here rather than broadcasting a doomed tx.
            const beliefPrice = await deriveBeliefPrice(client, poolAddress, offerInfo, micro);
            if (!beliefPrice) {
                setStatus('Error: could not fetch a price quote from the pool — try again in a moment.');
                return;
            }

            const msg = {
                simple_swap: {
                    offer_asset: { info: offerInfo, amount: micro },
                    belief_price: beliefPrice,
                    max_spread: maxSpread || null,
                    allow_high_max_spread: allowHighSpread ? true : null,
                    to: null,
                    transaction_deadline: txDeadline,
                },
            };
            const result = await client.execute(
                address,
                poolAddress,
                msg,
                stdFee(500000),
                'Swap',
                [{ denom: offerDenom, amount: micro }],
            );
            setTxHash(result.transactionHash);
            setStatus('Success!');
        } catch (err) {
            setStatus('Error: ' + humanizeContractError(err));
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PoolPickerField value={poolAddress} onChange={setPoolAddress} label="Pool" />
            <TextField label="Offer Denom" value={offerAsset} onChange={(e) => setOfferAsset(e.target.value)} helperText="uosmo to buy, or the creator token's factory/... denom to sell" />
            <TextField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
            <TextField label="Max Spread" value={maxSpread} onChange={(e) => setMaxSpread(e.target.value)} helperText="e.g. 0.005 for 0.5%" />
            <TextField label="Deadline (minutes)" value={deadline} onChange={(e) => setDeadline(e.target.value)} type="number" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, cursor: 'pointer' }}
                onClick={() => setAllowHighSpread(!allowHighSpread)}>
                <Box sx={{ width: 18, height: 18, borderRadius: '4px', border: `2px solid ${allowHighSpread ? '#1976d2' : '#757575'}`, backgroundColor: allowHighSpread ? '#1976d2' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {allowHighSpread && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
                </Box>
                <Typography variant="body2">Allow max_spread above the safety cap</Typography>
            </Box>
            <Button variant="contained" color="secondary" onClick={handleSwap} disabled={!client}>Swap</Button>
            {status && <Alert severity={status.includes('Success') ? 'success' : 'info'}>{status}</Alert>}
            <TxHashDisplay txHash={txHash} />
        </Box>
    );
};

// =========================================================================
// LIQUIDITY TAB — informational + native-pool lookup.
//
// The creator pool has no deposit/remove-liquidity or collect-fees entry
// points anymore: at threshold crossing it creates and seeds a NATIVE
// Osmosis GAMM pool and holds the LP shares itself. Anyone who wants to
// LP does it directly on Osmosis, and LP fees accrue per GAMM rules.
// The `native_pool_id` query resolves which GAMM pool that is, so we can
// deep-link straight to it instead of sending users to search the pool
// list by hand.
// =========================================================================
const LiquidityInfoTab: React.FC = () => {
    const [poolAddress, setPoolAddress] = useState('');
    const [lookupStatus, setLookupStatus] = useState('');
    const [nativePool, setNativePool] = useState<NativePoolIdResponse | null>(null);

    const handleLookup = async () => {
        setNativePool(null);
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setLookupStatus(`Error: ${addrCheck.error}`); return; }
        try {
            setLookupStatus('Looking up the native pool...');
            const res = await chainQueryNativePoolId(poolAddress);
            setNativePool(res);
            setLookupStatus(res.pool_id === null
                ? 'This pool has not crossed its threshold yet — no native Osmosis pool exists for it.'
                : '');
        } catch (err) {
            setLookupStatus('Error: ' + humanizeContractError(err));
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
                Liquidity lives on Osmosis now. When a creator pool crosses its funding threshold,
                the contract creates and seeds a native Osmosis GAMM pool (the seed is locked in the
                pool contract and belongs to no one). There are no liquidity or fee-collection
                actions on the BlueChip contracts.
            </Alert>
            <Typography variant="body2">
                To provide or remove liquidity for a creator token — or to collect your LP
                rewards — use the Osmosis app directly:{' '}
                <Link href="https://app.osmosis.zone/pools" target="_blank" rel="noopener">
                    app.osmosis.zone/pools
                </Link>
                . Pick a creator pool below to jump straight to its Osmosis pool.
            </Typography>
            <PoolPickerField value={poolAddress} onChange={setPoolAddress} label="Creator Pool" />
            <Button variant="contained" onClick={handleLookup} disabled={!poolAddress}>
                Find Native Osmosis Pool
            </Button>
            {nativePool?.pool_id !== null && nativePool?.pool_id !== undefined && (
                <Alert severity="success">
                    Native GAMM pool #{nativePool.pool_id} —{' '}
                    <Link
                        href={`https://app.osmosis.zone/pool/${nativePool.pool_id}`}
                        target="_blank"
                        rel="noopener"
                    >
                        open it on Osmosis
                    </Link>
                    {nativePool.lp_share_denom && (
                        <> · LP share denom: <code>{nativePool.lp_share_denom}</code></>
                    )}
                </Alert>
            )}
            {lookupStatus && (
                <Alert severity={lookupStatus.startsWith('Error') ? 'error' : 'info'}>{lookupStatus}</Alert>
            )}
        </Box>
    );
};

// =========================================================================
// MAIN DEFI PAGE
// =========================================================================
const DefiPage: React.FC = () => {
    const { client, address, balance } = useWallet();
    const location = useLocation();
    const [mainTab, setMainTab] = useState(0);

    // Allow deep-linking to a specific tab via ?tab=<name>. The "Commit"
    // shortcut in the top bar relies on this to drop the user straight on
    // the commit form when they land on /defi. Legacy 'liquidity' / 'fees'
    // links land on the informational Liquidity tab.
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        const map: Record<string, number> = { create: 0, commit: 1, swap: 2, crosstoken: 3, liquidity: 4, fees: 4 };
        if (tab && tab in map) setMainTab(map[tab]);
    }, [location.search]);

    return (
        <PageShell>
                <Grid item xs={12} md={10}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                <Typography variant="h5" fontWeight="bold">Creator Economy</Typography>
                                {balance && (
                                    <Typography variant="body2">
                                        {formatMicroAmount(balance.amount)} OSMO
                                    </Typography>
                                )}
                            </Stack>

                            <Tabs
                                value={mainTab}
                                onChange={(_, v) => setMainTab(v)}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
                            >
                                <Tab label="Create Pool" />
                                <Tab label="Commit" />
                                <Tab label="Swap" />
                                <Tab label="Cross-Token" />
                                <Tab label="Liquidity" />
                            </Tabs>

                            <TabPanel value={mainTab} index={0}>
                                <CreatePoolTab client={client} address={address} />
                            </TabPanel>
                            <TabPanel value={mainTab} index={1}>
                                <CommitTab client={client} address={address} />
                            </TabPanel>
                            <TabPanel value={mainTab} index={2}>
                                <SwapTab client={client} address={address} />
                            </TabPanel>
                            <TabPanel value={mainTab} index={3}>
                                <CrossTokenSwapTab client={client} address={address} />
                            </TabPanel>
                            <TabPanel value={mainTab} index={4}>
                                <LiquidityInfoTab />
                            </TabPanel>
                        </CardContent>
                    </Card>
                </Grid>
        </PageShell>
    );
};

export default DefiPage;
