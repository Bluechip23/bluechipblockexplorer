// Add / remove liquidity on a creator pool's Osmosis trading pool, signed
// by the connected wallet without leaving the explorer.
//
// When a creator pool crosses its funding threshold, the BlueChip contract
// creates a standard Osmosis GAMM pool for its token and locks the seed
// liquidity in it. Anyone can add liquidity alongside that seed: adding is a
// native MsgJoinPool, removing is MsgExitPool (see utils/osmosisGamm.ts).
// The contract only tells us which GAMM pool it created (`native_pool_id`).
// A user's position is their bank balance of the `gamm/pool/{id}` denom.
//
// Every transaction is simulated before the wallet opens, so a tx the chain
// would reject never reaches the signing prompt.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Divider,
    Link,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useWallet } from '../../context/WalletContext';
import { COIN_DECIMALS, NATIVE_DENOM } from '../../defi/types';
import {
    assertWalletOnExpectedChain,
    humanizeContractError,
    sanitizeOnChainString,
    validateSlippage,
    validateTokenAmount,
} from '../../utils/security';
import { formatMicroAmount, safeBigInt } from '../../utils/bigintMath';
import { stdFee } from '../../utils/fees';
import { resolvePoolAssets } from '../../utils/poolActions';
import { chainQueryNativePoolId } from '../../utils/chainQueries';
import {
    buildExitMsg,
    buildJoinMsg,
    fetchGammPool,
    quoteExit,
    quoteJoinByOsmo,
} from '../../utils/osmosisGamm';

export interface LiquidityPanelProps {
    poolAddress: string;
    tokenSymbol?: string;
}

interface LoadedPool {
    poolId: string;
    shareDenom: string;
    osmoDenom: string;
    creatorDenom: string;
    resOsmo: bigint;
    resCreator: bigint;
    totalShares: bigint;
    userShares: bigint;
    userOsmo: bigint;
    userCreator: bigint;
}

type LoadState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'not-crossed' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; pool: LoadedPool };

type TxState =
    | { kind: 'idle' }
    | { kind: 'working'; message: string }
    | { kind: 'success'; message: string; txHash: string }
    | { kind: 'error'; message: string };

// Left in the wallet on "Max" so the user can still pay gas.
const GAS_RESERVE_UOSMO = 500_000n; // 0.5 OSMO
const REMOVE_PRESETS = [25, 50, 75, 100];

function microToInput(micro: bigint): string {
    if (micro <= 0n) return '';
    const base = 10n ** BigInt(COIN_DECIMALS);
    const whole = micro / base;
    const frac = (micro % base).toString().padStart(COIN_DECIMALS, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
}

// factory/{pool}/u{symbol} -> SYMBOL (display fallback when no symbol is passed).
function symbolFromDenom(denom: string): string {
    const sub = denom.split('/').pop() ?? '';
    const bare = sub.startsWith('u') && sub.length > 1 ? sub.slice(1) : sub;
    return sanitizeOnChainString(bare.toUpperCase(), 16);
}

function pctOf(part: bigint, total: bigint): string {
    if (total <= 0n) return '0';
    const bps = (part * 1_000_000n) / total; // 4 decimal places of a percent
    const n = Number(bps) / 10_000;
    if (n > 0 && n < 0.0001) return '<0.0001';
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const LiquidityPanel: React.FC<LiquidityPanelProps> = ({ poolAddress, tokenSymbol }) => {
    const { client, address, walletName, connect } = useWallet();
    const [denomSymbol, setDenomSymbol] = useState('');
    const symbol = sanitizeOnChainString(tokenSymbol, 16) || denomSymbol || 'TOKEN';

    const [load, setLoad] = useState<LoadState>({ kind: 'idle' });
    const [tab, setTab] = useState(0);
    const [osmoAmount, setOsmoAmount] = useState('');
    const [removePct, setRemovePct] = useState('100');
    const [slippage, setSlippage] = useState('1');
    const [tx, setTx] = useState<TxState>({ kind: 'idle' });

    // `quiet` keeps the current view on screen while re-reading (used after
    // a transaction so the success message stays visible).
    const refresh = useCallback(async (quiet = false) => {
        if (!client || !address || !poolAddress) return;
        if (!quiet) setLoad({ kind: 'loading' });
        try {
            const native = await chainQueryNativePoolId(poolAddress);
            if (native.pool_id === null || native.pool_id === undefined) {
                setLoad({ kind: 'not-crossed' });
                return;
            }
            const [gamm, assets] = await Promise.all([
                fetchGammPool(native.pool_id),
                resolvePoolAssets(client, poolAddress),
            ]);
            const osmoDenom = assets.bluechipDenom || NATIVE_DENOM;
            const creatorDenom = assets.tokenDenom;
            if (!creatorDenom) throw new Error('Could not read the creator token denom from the pool.');
            setDenomSymbol(symbolFromDenom(creatorDenom));

            // SECURITY: the GAMM pool must hold exactly this pair, and its
            // share denom must match what the contract reports. Anything
            // else means we're about to sign against the wrong pool.
            const denoms = Object.keys(gamm.reserves);
            if (denoms.length !== 2 || !(osmoDenom in gamm.reserves) || !(creatorDenom in gamm.reserves)) {
                throw new Error(`Osmosis pool #${gamm.poolId} does not hold this creator pool's OSMO / token pair.`);
            }
            if (native.lp_share_denom && native.lp_share_denom !== gamm.shareDenom) {
                throw new Error('The pool contract and Osmosis disagree on the LP share denom.');
            }

            const [shareBal, osmoBal, creatorBal] = await Promise.all([
                client.getBalance(address, gamm.shareDenom),
                client.getBalance(address, osmoDenom),
                client.getBalance(address, creatorDenom),
            ]);
            setLoad({
                kind: 'ready',
                pool: {
                    poolId: gamm.poolId,
                    shareDenom: gamm.shareDenom,
                    osmoDenom,
                    creatorDenom,
                    resOsmo: gamm.reserves[osmoDenom],
                    resCreator: gamm.reserves[creatorDenom],
                    totalShares: gamm.totalShares,
                    userShares: safeBigInt(shareBal.amount),
                    userOsmo: safeBigInt(osmoBal.amount),
                    userCreator: safeBigInt(creatorBal.amount),
                },
            });
        } catch (err) {
            setLoad({ kind: 'error', message: humanizeContractError(err) });
        }
    }, [client, address, poolAddress]);

    useEffect(() => {
        setTx({ kind: 'idle' });
        setOsmoAmount('');
        refresh();
    }, [refresh]);

    const slip = validateSlippage(slippage);
    const slippageBps = slip.ok && slip.pct !== undefined ? BigInt(Math.round(slip.pct * 100)) : null;
    const pool = load.kind === 'ready' ? load.pool : null;

    // ---- Add quote ----------------------------------------------------------
    const addQuote = useMemo(() => {
        if (!pool || !osmoAmount || slippageBps === null) return null;
        const amt = validateTokenAmount(osmoAmount, COIN_DECIMALS);
        if (!amt.ok || !amt.micro) return { error: amt.error ?? 'Invalid amount' };
        try {
            const q = quoteJoinByOsmo(BigInt(amt.micro), pool.totalShares, pool.resOsmo, pool.resCreator, slippageBps);
            if (q.maxIn.osmo > pool.userOsmo) {
                return { quote: q, error: `You have ${formatMicroAmount(pool.userOsmo)} OSMO.` };
            }
            if (q.maxIn.creator > pool.userCreator) {
                return {
                    quote: q,
                    error: `This needs ${formatMicroAmount(q.maxIn.creator)} ${symbol}; you have ${formatMicroAmount(pool.userCreator)}.`,
                };
            }
            return { quote: q };
        } catch (err) {
            return { error: (err as Error).message };
        }
    }, [pool, osmoAmount, slippageBps, symbol]);

    const maxOsmo = useMemo(() => {
        if (!pool || pool.resCreator <= 0n) return 0n;
        const byOsmo = pool.userOsmo > GAS_RESERVE_UOSMO ? pool.userOsmo - GAS_RESERVE_UOSMO : 0n;
        // Largest OSMO whose matching creator amount fits the balance.
        const byCreator = (pool.userCreator * pool.resOsmo) / pool.resCreator;
        return byOsmo < byCreator ? byOsmo : byCreator;
    }, [pool]);

    // ---- Remove quote -------------------------------------------------------
    const removeQuote = useMemo(() => {
        if (!pool || slippageBps === null) return null;
        const pct = Number(removePct);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { error: 'Enter a percent between 0 and 100.' };
        const shareIn = pct === 100
            ? pool.userShares
            : (pool.userShares * BigInt(Math.round(pct * 100))) / 10_000n;
        try {
            return { shareIn, quote: quoteExit(shareIn, pool.totalShares, pool.resOsmo, pool.resCreator, slippageBps) };
        } catch (err) {
            return { error: (err as Error).message };
        }
    }, [pool, removePct, slippageBps]);

    // ---- Sign ---------------------------------------------------------------
    const send = async (
        msg: { typeUrl: string; value: unknown },
        memo: string,
        successMessage: string,
    ) => {
        if (!client || !address) return;
        try {
            setTx({ kind: 'working', message: 'Checking the transaction…' });
            // SECURITY: never sign on the wrong network.
            const chain = await assertWalletOnExpectedChain(client);
            if (!chain.ok) throw new Error(chain.error ?? 'Wallet is on the wrong chain.');

            // SECURITY: dry-run first; a tx the chain would reject never
            // reaches the signing prompt.
            let gas: number;
            try {
                gas = await client.simulate(address, [msg], memo);
            } catch (simErr) {
                throw new Error(`Simulation failed — the transaction would be rejected: ${humanizeContractError(simErr)}`);
            }

            setTx({ kind: 'working', message: 'Confirm in your wallet…' });
            const res = await client.signAndBroadcast(address, [msg], stdFee(Math.ceil(gas * 1.4)), memo);
            if (res.code !== 0) throw new Error(res.rawLog || `Transaction failed with code ${res.code}`);
            setTx({ kind: 'success', message: successMessage, txHash: res.transactionHash });
            setOsmoAmount('');
            await refresh(true);
        } catch (err) {
            setTx({ kind: 'error', message: humanizeContractError(err) });
        }
    };

    const handleAdd = () => {
        if (!pool || !addQuote?.quote || addQuote.error) return;
        const q = addQuote.quote;
        send(
            buildJoinMsg(address, pool.poolId, q, pool.osmoDenom, pool.creatorDenom),
            'Add liquidity',
            `Added up to ${formatMicroAmount(q.maxIn.osmo)} OSMO + ${formatMicroAmount(q.maxIn.creator)} ${symbol}.`,
        );
    };

    const handleRemove = () => {
        if (!pool || !removeQuote?.quote || removeQuote.error || !removeQuote.shareIn) return;
        const q = removeQuote.quote;
        send(
            buildExitMsg(address, pool.poolId, removeQuote.shareIn, q, pool.osmoDenom, pool.creatorDenom),
            'Remove liquidity',
            `Removed about ${formatMicroAmount(q.expected.osmo)} OSMO + ${formatMicroAmount(q.expected.creator)} ${symbol}.`,
        );
    };

    // ---- Render -------------------------------------------------------------
    if (!address || (!client && walletName !== 'Demo')) {
        return (
            <Stack spacing={2}>
                <Typography variant="body2">Connect a wallet to add or remove liquidity.</Typography>
                <Button variant="contained" onClick={() => connect()}>Connect Wallet</Button>
            </Stack>
        );
    }
    if (!client) {
        return <Alert severity="info">Liquidity actions need a real wallet. They aren&apos;t available in demo mode.</Alert>;
    }
    if (load.kind === 'idle' || load.kind === 'loading') {
        return (
            <Box sx={{ textAlign: 'center', py: 3 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading pool…</Typography>
            </Box>
        );
    }
    if (load.kind === 'not-crossed') {
        return (
            <Alert severity="info">
                This pool is still in its funding phase. Its trading pool, and liquidity with it,
                opens once commits reach the funding threshold. Until then, commit to support it.
            </Alert>
        );
    }
    if (load.kind === 'error') {
        return (
            <Stack spacing={2}>
                <Alert severity="error">{load.message}</Alert>
                <Button variant="outlined" onClick={() => refresh()}>Retry</Button>
            </Stack>
        );
    }

    const p = load.pool;
    const busy = tx.kind === 'working';

    return (
        <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover', fontSize: '0.85rem' }}>
                <Typography variant="body2">
                    Pool reserves: <strong>{formatMicroAmount(p.resOsmo)} OSMO</strong> /{' '}
                    <strong>{formatMicroAmount(p.resCreator)} {symbol}</strong>
                </Typography>
                <Typography variant="body2">
                    Your position: <strong>{pctOf(p.userShares, p.totalShares)}%</strong> of the pool
                    {p.userShares > 0n && p.totalShares > 0n && (
                        <> (≈ {formatMicroAmount((p.resOsmo * p.userShares) / p.totalShares)} OSMO +{' '}
                            {formatMicroAmount((p.resCreator * p.userShares) / p.totalShares)} {symbol})</>
                    )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Wallet: {formatMicroAmount(p.userOsmo)} OSMO · {formatMicroAmount(p.userCreator)} {symbol}
                </Typography>
            </Box>

            <Tabs value={tab} onChange={(_, v) => { setTab(v); setTx({ kind: 'idle' }); }}>
                <Tab label="Add" />
                <Tab label="Remove" disabled={p.userShares === 0n && tab !== 1} />
            </Tabs>

            {tab === 0 && (
                <Stack spacing={2}>
                    <TextField
                        label="OSMO to add"
                        value={osmoAmount}
                        onChange={(e) => setOsmoAmount(e.target.value)}
                        inputMode="decimal"
                        fullWidth
                        disabled={busy}
                        InputProps={{
                            endAdornment: (
                                <Button size="small" onClick={() => setOsmoAmount(microToInput(maxOsmo))} disabled={busy || maxOsmo <= 0n}>
                                    Max
                                </Button>
                            ),
                        }}
                        helperText={`Liquidity goes in both sides at the pool's current ratio, so you also need ${symbol}.`}
                    />
                    {addQuote?.quote && (
                        <Alert severity={addQuote.error ? 'warning' : 'info'} icon={false}>
                            <Typography variant="body2">
                                Deposits up to <strong>{formatMicroAmount(addQuote.quote.maxIn.osmo)} OSMO</strong> +{' '}
                                <strong>{formatMicroAmount(addQuote.quote.maxIn.creator)} {symbol}</strong>
                            </Typography>
                            <Typography variant="body2">
                                You&apos;d own about {pctOf(p.userShares + addQuote.quote.expectedShares, p.totalShares + addQuote.quote.expectedShares)}% of the pool.
                            </Typography>
                            {addQuote.error && <Typography variant="body2" sx={{ mt: 0.5 }}>{addQuote.error}</Typography>}
                        </Alert>
                    )}
                    {!addQuote?.quote && addQuote?.error && <Alert severity="warning">{addQuote.error}</Alert>}
                </Stack>
            )}

            {tab === 1 && (
                <Stack spacing={2}>
                    <ButtonGroup size="small" disabled={busy}>
                        {REMOVE_PRESETS.map((n) => (
                            <Button
                                key={n}
                                variant={removePct === String(n) ? 'contained' : 'outlined'}
                                onClick={() => setRemovePct(String(n))}
                            >
                                {n}%
                            </Button>
                        ))}
                    </ButtonGroup>
                    <TextField
                        label="Percent of your position to remove"
                        value={removePct}
                        onChange={(e) => setRemovePct(e.target.value)}
                        inputMode="decimal"
                        disabled={busy}
                        fullWidth
                    />
                    {removeQuote?.quote && (
                        <Alert severity="info" icon={false}>
                            <Typography variant="body2">
                                You receive about <strong>{formatMicroAmount(removeQuote.quote.expected.osmo)} OSMO</strong> +{' '}
                                <strong>{formatMicroAmount(removeQuote.quote.expected.creator)} {symbol}</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                At least {formatMicroAmount(removeQuote.quote.minOut.osmo)} OSMO +{' '}
                                {formatMicroAmount(removeQuote.quote.minOut.creator)} {symbol}, or it reverts.
                            </Typography>
                        </Alert>
                    )}
                    {removeQuote?.error && <Alert severity="warning">{removeQuote.error}</Alert>}
                </Stack>
            )}

            <TextField
                label="Max slippage %"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                size="small"
                disabled={busy}
                error={!slip.ok}
                helperText={slip.error ?? slip.warn ?? 'If the price moves more than this before your transaction lands, it reverts.'}
                sx={{ maxWidth: 260 }}
            />

            {tab === 0 ? (
                <Button
                    variant="contained"
                    onClick={handleAdd}
                    disabled={busy || !addQuote?.quote || !!addQuote.error || slippageBps === null}
                >
                    {busy ? <CircularProgress size={20} color="inherit" /> : 'Add Liquidity'}
                </Button>
            ) : (
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleRemove}
                    disabled={busy || !removeQuote?.quote || !!removeQuote.error || slippageBps === null}
                >
                    {busy ? <CircularProgress size={20} color="inherit" /> : 'Remove Liquidity'}
                </Button>
            )}

            {tx.kind === 'working' && <Alert severity="info">{tx.message}</Alert>}
            {tx.kind === 'error' && <Alert severity="error">{tx.message}</Alert>}
            {tx.kind === 'success' && (
                <Alert severity="success">
                    {tx.message}
                    <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}>
                        tx: {tx.txHash}
                    </Typography>
                </Alert>
            )}

            <Divider />
            <Typography variant="caption" color="text.secondary">
                Swap fees from every trade are added to the pool, so your share grows with volume.
                You collect them when you remove liquidity. This is Osmosis pool #{p.poolId} (LP share
                denom <code style={{ wordBreak: 'break-all' }}>{p.shareDenom}</code>), so your position also
                shows up on{' '}
                <Link href={`https://app.osmosis.zone/pool/${p.poolId}`} target="_blank" rel="noopener noreferrer">
                    Osmosis <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                </Link>
                .
            </Typography>
        </Stack>
    );
};

export default LiquidityPanel;
