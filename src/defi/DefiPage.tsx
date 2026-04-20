import React, { useState } from 'react';
import { Grid, Stack, Typography, Tabs, Tab, Box, Card, CardContent, TextField, Button, Alert, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import CommitTracker from './CommitTracker';
import { NATIVE_DENOM, COIN_DECIMALS } from './types';
import { factoryAddress } from '../components/universal/IndividualPage.const';
import { useWallet } from '../context/WalletContext';
import {
    validateTokenAmount,
    validateBech32Address,
    validateSlippage,
    assertWalletOnExpectedChain,
    verifyFundsMatch,
    sanitizeOnChainString,
} from '../utils/security';
import { compareMicro, safeBigInt, formatMicroAmount } from '../utils/bigintMath';

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
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [isStandardPool, setIsStandardPool] = useState(false);
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const FACTORY = factoryAddress || process.env.REACT_APP_FACTORY_ADDRESS || '';
    const ORACLE = process.env.REACT_APP_ORACLE_ADDRESS || '';

    const handleCreatePool = async () => {
        if (!client || !address) { setStatus('Please connect your wallet'); return; }
        if (!FACTORY) { setStatus('Error: Factory address not configured'); return; }
        if (!tokenName || !tokenSymbol) { setStatus('Error: Enter token name and symbol'); return; }

        // SECURITY: Sanitize token name/symbol — reject control chars and special
        // characters that could be used for XSS on downstream consumers.
        if (!/^[A-Za-z0-9 _\-().]+$/.test(tokenName)) {
            setStatus('Error: Token name contains invalid characters');
            return;
        }
        if (!/^[A-Z0-9]+$/.test(tokenSymbol)) {
            setStatus('Error: Token symbol must be uppercase letters and numbers only');
            return;
        }

        // SECURITY: Validate factory address is well-formed bech32.
        const factoryCheck = validateBech32Address(FACTORY);
        if (!factoryCheck.ok) {
            setStatus(`Error: Factory address invalid — ${factoryCheck.error}`);
            return;
        }

        // SECURITY: Assert chain ID matches bluechip-3 before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setStatus(`Error: ${chainCheck.error}`);
            return;
        }

        try {
            setStatus('Creating pool...');
            setTxHash('');

            const thresholdPayout = {
                creator_reward_amount: '325000000000',
                bluechip_reward_amount: '25000000000',
                pool_seed_amount: '350000000000',
                commit_return_amount: '500000000000'
            };

            const createMsg = {
                create: {
                    pool_msg: {
                        pool_token_info: [
                            { bluechip: { denom: NATIVE_DENOM } },
                            { creator_token: { contract_addr: 'WILL_BE_CREATED_BY_FACTORY' } }
                        ],
                        cw20_token_contract_id: 1,
                        factory_to_create_pool_addr: FACTORY,
                        threshold_payout: btoa(JSON.stringify(thresholdPayout)),
                        commit_fee_info: {
                            bluechip_wallet_address: address,
                            creator_wallet_address: address,
                            commit_fee_bluechip: '0.01',
                            commit_fee_creator: '0.05'
                        },
                        creator_token_address: address,
                        commit_amount_for_threshold: '25000000000',
                        commit_limit_usd: '25000000000',
                        pyth_contract_addr_for_conversions: ORACLE || 'oracle_placeholder',
                        pyth_atom_usd_price_feed_id: 'ATOM_USD',
                        max_bluechip_lock_per_pool: '10000000000',
                        creator_excess_liquidity_lock_days: 7,
                        is_standard_pool: isStandardPool
                    },
                    token_info: {
                        name: tokenName,
                        symbol: tokenSymbol,
                        decimal: 6
                    }
                }
            };

            const result = await client.execute(address, FACTORY, createMsg, { amount: [], gas: '2000000' }, 'Create Pool');
            setTxHash(result.transactionHash);
            setStatus('Success! Pool creation submitted.');
            setTokenName('');
            setTokenSymbol('');
        } catch (err) {
            setStatus('Error: ' + (err as Error).message);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Token Name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="My Creator Token" required />
            <TextField label="Token Symbol" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())} placeholder="MCT" required inputProps={{ maxLength: 10 }} />

            <Box sx={{ p: 2, border: '1px solid', borderColor: isStandardPool ? 'primary.main' : 'divider', borderRadius: 1, cursor: 'pointer' }}
                onClick={() => setIsStandardPool(!isStandardPool)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: '4px', border: `2px solid ${isStandardPool ? '#1976d2' : '#757575'}`, backgroundColor: isStandardPool ? '#1976d2' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isStandardPool && <span style={{ color: 'white', fontSize: 14 }}>✓</span>}
                    </Box>
                    <Typography variant="subtitle2" fontWeight="bold">Create as Standard Pool</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                    Skips commit phase. Pool starts with 0 liquidity - you must deposit manually.
                </Typography>
            </Box>

            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Pool Configuration (Pre-set)</Typography>
                <Typography variant="body2">Commit Threshold: $25,000 USD</Typography>
                <Typography variant="body2">Commit Fee: 1% BlueChip, 5% Creator</Typography>
                <Typography variant="body2">Max BlueChip Lock: 10,000 tokens</Typography>
                <Typography variant="body2">Liquidity Lock: 7 days</Typography>
            </Box>

            <Button variant="contained" onClick={handleCreatePool} disabled={!client || !address || !tokenName || !tokenSymbol}>
                Create Pool
            </Button>
            {status && <Alert severity={status.includes('Success') ? 'success' : status.includes('Error') ? 'error' : 'info'}>{status}</Alert>}
            <TxHashDisplay txHash={txHash} />
        </Box>
    );
};

// =========================================================================
// SUBSCRIBE / COMMIT TAB
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

        // SECURITY: Validate pool address is a well-formed bluechip bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Validate amount using string-math to avoid floating-point drift.
        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS);
        if (!amtCheck.ok) { setStatus(`Error: ${amtCheck.error}`); return; }

        // SECURITY: Assert chain ID matches bluechip-3 before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Subscribing...');
            setTxHash('');
            const amountVal = parseFloat(amount);
            if (isNaN(amountVal) || amountVal <= 0) { setStatus('Error: Enter a valid amount'); return; }
            const micro = amtCheck.micro!;

            const thresholdStatus = await client.queryContractSmart(poolAddress, { is_fully_commited: {} });
            const isThresholdCrossed = thresholdStatus === 'fully_committed';
            const deadlineNs = deadline && parseFloat(deadline) > 0 ? ((Date.now() + parseFloat(deadline) * 60000) * 1000000).toString() : null;

            // Pool denom is configurable per-pool; read it from pair {} rather than
            // assuming NATIVE_DENOM.
            let bluechipDenom = NATIVE_DENOM;
            try {
                const pairInfo = await client.queryContractSmart(poolAddress, { pair: {} });
                const infos: any[] = pairInfo?.asset_infos ?? [];
                const found = infos.find((i) => i?.bluechip?.denom)?.bluechip?.denom;
                if (typeof found === 'string' && found.length > 0) bluechipDenom = found;
            } catch {
                // Fall back to NATIVE_DENOM.
            }

            const msg = {
                commit: {
                    asset: { info: { bluechip: { denom: bluechipDenom } }, amount: micro },
                    transaction_deadline: deadlineNs,
                    belief_price: null,
                    max_spread: (isThresholdCrossed && maxSpread) ? maxSpread : null
                }
            };

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '600000' }, 'Commit', [{ denom: bluechipDenom, amount: micro }]);
            setTxHash(result.transactionHash);
            setStatus('Success! Transaction confirmed.');
        } catch (err) {
            setStatus('Error: ' + (err as Error).message);
        }
    };

    return (
        <Box>
            <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 2 }}>
                <Tab label="Subscribe" />
                <Tab label="Progress Tracker" />
            </Tabs>
            {subTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="Pool Contract Address" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="bluechip1..." />
                    <TextField label="Amount (bluechip)" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
                    <TextField label="Max Spread" value={maxSpread} onChange={(e) => setMaxSpread(e.target.value)} helperText="e.g. 0.005 for 0.5%" />
                    <TextField label="Deadline (minutes)" value={deadline} onChange={(e) => setDeadline(e.target.value)} type="number" />
                    <Button variant="contained" onClick={handleSubscribe} disabled={!client}>Subscribe</Button>
                    {status && <Alert severity={status.includes('Success') ? 'success' : 'info'}>{status}</Alert>}
                    <TxHashDisplay txHash={txHash} />
                </Box>
            )}
            {subTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="Pool Contract Address" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="bluechip1..." />
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
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const handleSwap = async () => {
        if (!client || !address || !poolAddress) { setStatus('Connect wallet and enter pool address'); return; }

        // SECURITY: Validate pool address is a well-formed bluechip bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Validate amount using string-math to avoid floating-point drift.
        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS);
        if (!amtCheck.ok) { setStatus(`Error: ${amtCheck.error}`); return; }

        // SECURITY: Validate slippage bounds — maxSpread here is a decimal (0.005 = 0.5%).
        // Convert to percentage for our validator then convert back.
        const spreadPct = parseFloat(maxSpread) * 100;
        if (Number.isFinite(spreadPct)) {
            const slipCheck = validateSlippage(spreadPct);
            if (!slipCheck.ok) { setStatus(`Error: ${slipCheck.error}`); return; }
        }

        // SECURITY: Assert chain ID matches bluechip-3 before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Swapping...');
            setTxHash('');
            const amountVal = parseFloat(amount);
            if (isNaN(amountVal) || amountVal <= 0) { setStatus('Error: Enter a valid amount'); return; }
            const micro = amtCheck.micro!;
            const deadlineNs = deadline && parseFloat(deadline) > 0 ? (Date.now() + parseFloat(deadline) * 60000) * 1000000 : null;

            const isContract = offerAsset.length > 20 && (offerAsset.startsWith('bluechip') || offerAsset.startsWith('cosmos'));

            if (!isContract) {
                // Native swap
                const msg = {
                    simple_swap: {
                        offer_asset: { info: { bluechip: { denom: offerAsset || NATIVE_DENOM } }, amount: micro },
                        belief_price: null,
                        max_spread: maxSpread || null,
                        to: null,
                        transaction_deadline: deadlineNs ? deadlineNs.toString() : null
                    }
                };
                const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Swap', [{ denom: offerAsset || NATIVE_DENOM, amount: micro }]);
                setTxHash(result.transactionHash);
                setStatus('Success!');
            } else {
                // CW20 swap via send hook
                const hookMsg = { swap: { belief_price: null, max_spread: maxSpread || null, to: null, transaction_deadline: deadlineNs ? deadlineNs.toString() : null } };
                const msg = { send: { contract: poolAddress, amount: micro, msg: btoa(JSON.stringify(hookMsg)) } };
                const result = await client.execute(address, offerAsset, msg, { amount: [], gas: '500000' }, 'Swap CW20', []);
                setTxHash(result.transactionHash);
                setStatus('Success!');
            }
        } catch (err) {
            setStatus('Error: ' + (err as Error).message);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Pool Contract Address" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="bluechip1..." />
            <TextField label="Offer Asset (denom or CW20 address)" value={offerAsset} onChange={(e) => setOfferAsset(e.target.value)} helperText="e.g. ubluechip or a CW20 contract address" />
            <TextField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
            <TextField label="Max Spread" value={maxSpread} onChange={(e) => setMaxSpread(e.target.value)} helperText="e.g. 0.005 for 0.5%" />
            <TextField label="Deadline (minutes)" value={deadline} onChange={(e) => setDeadline(e.target.value)} type="number" />
            <Button variant="contained" color="secondary" onClick={handleSwap} disabled={!client}>Swap</Button>
            {status && <Alert severity={status.includes('Success') ? 'success' : 'info'}>{status}</Alert>}
            <TxHashDisplay txHash={txHash} />
        </Box>
    );
};

// =========================================================================
// LIQUIDITY TAB
// =========================================================================
const LiquidityTab: React.FC<{ client: SigningCosmWasmClient | null; address: string }> = ({ client, address }) => {
    const [subTab, setSubTab] = useState(0);
    const [poolAddress, setPoolAddress] = useState('');
    const [amount0, setAmount0] = useState('');
    const [amount1, setAmount1] = useState('');
    const [positionId, setPositionId] = useState('');
    const [removeAmount, setRemoveAmount] = useState('');
    const [removeMode, setRemoveMode] = useState('amount');
    const [removePercent, setRemovePercent] = useState('');
    const [slippage, setSlippage] = useState('1');
    const [deadline, setDeadline] = useState('20');
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const handleDeposit = async () => {
        if (!client || !address || !poolAddress) { setStatus('Connect wallet and set pool address'); return; }

        // SECURITY: Validate pool address is a well-formed bluechip bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Validate both deposit amounts.
        const amt0Check = validateTokenAmount(amount0, COIN_DECIMALS);
        if (!amt0Check.ok) { setStatus(`Error: Bluechip amount — ${amt0Check.error}`); return; }
        const amt1Check = validateTokenAmount(amount1, COIN_DECIMALS);
        if (!amt1Check.ok) { setStatus(`Error: Creator token amount — ${amt1Check.error}`); return; }

        // SECURITY: Validate slippage bounds.
        const slipCheck = validateSlippage(slippage);
        if (!slipCheck.ok) { setStatus(`Error: ${slipCheck.error}`); return; }

        // SECURITY: Assert chain ID matches bluechip-3 before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Depositing...');
            setTxHash('');
            const a0 = amt0Check.micro!;
            const a1 = amt1Check.micro!;

            // Get token address from pool
            const pairInfo = await client.queryContractSmart(poolAddress, { pair: {} });
            let tokenAddress = null;
            let bluechipDenom = NATIVE_DENOM;
            for (const asset of pairInfo.asset_infos) {
                if (asset.creator_token) tokenAddress = asset.creator_token.contract_addr;
                if (asset.bluechip) bluechipDenom = asset.bluechip.denom;
            }
            if (!tokenAddress) { setStatus('Error: No creator token found in pool'); return; }

            // Check/increase allowance
            const allowance = await client.queryContractSmart(tokenAddress, { allowance: { owner: address, spender: poolAddress } });
            if (compareMicro(allowance.allowance, a1) < 0) {
                setStatus('Approving tokens...');
                await client.execute(address, tokenAddress, { increase_allowance: { spender: poolAddress, amount: a1 } }, { amount: [], gas: '200000' }, 'Approve', []);
            }

            // SECURITY: slippage math done on BigInt micro-units to avoid
            // floating-point drift for large deposits. slippage is a
            // percentage string (e.g. "1" for 1%); convert to basis points
            // for integer math: min = amount * (10_000 - slippageBps) / 10_000.
            const slippageBps = BigInt(Math.round(parseFloat(slippage || '0') * 100));
            const scale = 10_000n;
            const minA0 = (safeBigInt(a0) * (scale - slippageBps)) / scale;
            const minA1 = (safeBigInt(a1) * (scale - slippageBps)) / scale;
            const deadlineNs = deadline ? (Date.now() + parseFloat(deadline) * 60000) * 1000000 : null;

            const msg = {
                deposit_liquidity: {
                    amount0: a0, amount1: a1,
                    min_amount0: minA0.toString(),
                    min_amount1: minA1.toString(),
                    transaction_deadline: deadlineNs ? deadlineNs.toString() : null
                }
            };

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Deposit Liquidity', [{ denom: bluechipDenom, amount: a0 }]);
            setTxHash(result.transactionHash);
            setStatus('Success!');
        } catch (err) { setStatus('Error: ' + (err as Error).message); }
    };

    const handleRemove = async () => {
        if (!client || !address || !poolAddress || !positionId) { setStatus('Fill in all fields'); return; }

        // SECURITY: Validate pool address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Validate slippage bounds.
        const slipCheck = validateSlippage(slippage);
        if (!slipCheck.ok) { setStatus(`Error: ${slipCheck.error}`); return; }

        // SECURITY: Assert chain ID matches bluechip-3 before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Removing...');
            setTxHash('');
            const deviationBps = slippage ? Math.floor(parseFloat(slippage) * 100) : null;
            const deadlineNs = deadline ? (Date.now() + parseFloat(deadline) * 60000) * 1000000 : null;

            let msg: any;
            if (removeMode === 'all') {
                msg = { remove_all_liquidity: { position_id: positionId, min_amount0: null, min_amount1: null, max_ratio_deviation_bps: deviationBps, transaction_deadline: deadlineNs?.toString() || null } };
            } else if (removeMode === 'percent') {
                msg = { remove_partial_liquidity_by_percent: { position_id: positionId, percentage: parseInt(removePercent, 10) || 0, min_amount0: null, min_amount1: null, max_ratio_deviation_bps: deviationBps, transaction_deadline: deadlineNs?.toString() || null } };
            } else {
                msg = { remove_partial_liquidity: { position_id: positionId, liquidity_to_remove: Math.floor(parseFloat(removeAmount)).toString(), min_amount0: null, min_amount1: null, max_ratio_deviation_bps: deviationBps, transaction_deadline: deadlineNs?.toString() || null } };
            }

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Remove Liquidity');
            setTxHash(result.transactionHash);
            setStatus('Success!');
        } catch (err) { setStatus('Error: ' + (err as Error).message); }
    };

    return (
        <Box>
            <TextField fullWidth label="Pool Contract Address" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} sx={{ mb: 2 }} />
            <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 2 }}>
                <Tab label="Provide Liquidity" />
                <Tab label="Remove Liquidity" />
            </Tabs>
            {subTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="Amount 0 (bluechip)" value={amount0} onChange={(e) => setAmount0(e.target.value)} type="number" />
                    <TextField label="Amount 1 (Creator Token)" value={amount1} onChange={(e) => setAmount1(e.target.value)} type="number" />
                    <TextField label="Slippage (%)" value={slippage} onChange={(e) => setSlippage(e.target.value)} type="number" />
                    <TextField label="Deadline (minutes)" value={deadline} onChange={(e) => setDeadline(e.target.value)} type="number" />
                    <Button variant="contained" onClick={handleDeposit} disabled={!client}>Provide Liquidity</Button>
                </Box>
            )}
            {subTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="Position ID" value={positionId} onChange={(e) => setPositionId(e.target.value)} />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant={removeMode === 'amount' ? 'contained' : 'outlined'} size="small" onClick={() => setRemoveMode('amount')}>Amount</Button>
                        <Button variant={removeMode === 'percent' ? 'contained' : 'outlined'} size="small" onClick={() => setRemoveMode('percent')}>Percentage</Button>
                        <Button variant={removeMode === 'all' ? 'contained' : 'outlined'} size="small" onClick={() => setRemoveMode('all')}>Remove All</Button>
                    </Box>
                    {removeMode === 'amount' && <TextField label="Liquidity to Remove" value={removeAmount} onChange={(e) => setRemoveAmount(e.target.value)} type="number" />}
                    {removeMode === 'percent' && <TextField label="Percentage (0-100)" value={removePercent} onChange={(e) => setRemovePercent(e.target.value)} type="number" />}
                    <TextField label="Max Deviation (%)" value={slippage} onChange={(e) => setSlippage(e.target.value)} type="number" />
                    <TextField label="Deadline (minutes)" value={deadline} onChange={(e) => setDeadline(e.target.value)} type="number" />
                    <Button variant="contained" color="error" onClick={handleRemove} disabled={!client}>Remove Liquidity</Button>
                </Box>
            )}
            {status && <Alert severity={status.includes('Success') ? 'success' : 'info'} sx={{ mt: 2 }}>{status}</Alert>}
            <TxHashDisplay txHash={txHash} />
        </Box>
    );
};

// =========================================================================
// FEES TAB
// =========================================================================
const FeesTab: React.FC<{ client: SigningCosmWasmClient | null; address: string }> = ({ client, address }) => {
    const [poolAddress, setPoolAddress] = useState('');
    const [positionId, setPositionId] = useState('');
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const handleCollect = async () => {
        if (!client || !address || !poolAddress) { setStatus('Connect wallet and enter pool address'); return; }

        // SECURITY: Validate pool address is a well-formed bluechip bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) { setStatus(`Error: Pool address invalid — ${addrCheck.error}`); return; }

        // SECURITY: Assert chain ID matches bluechip-3 before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) { setStatus(`Error: ${chainCheck.error}`); return; }

        try {
            setStatus('Verifying ownership...');
            setTxHash('');
            const pos = await client.queryContractSmart(poolAddress, { position: { position_id: positionId } });
            if (pos.owner !== address) { setStatus('Error: You do not own this position'); return; }

            setStatus('Collecting fees...');
            const result = await client.execute(address, poolAddress, { collect_fees: { position_id: positionId } }, { amount: [], gas: '400000' }, 'Collect Fees');
            setTxHash(result.transactionHash);
            setStatus('Success!');
        } catch (err) { setStatus('Error: ' + (err as Error).message); }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Pool Contract Address" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} />
            <TextField label="Position ID" value={positionId} onChange={(e) => setPositionId(e.target.value)} />
            <Button variant="contained" color="success" onClick={handleCollect} disabled={!client}>Collect Fees</Button>
            {status && <Alert severity={status.includes('Success') ? 'success' : 'info'}>{status}</Alert>}
            <TxHashDisplay txHash={txHash} />
        </Box>
    );
};

// =========================================================================
// MAIN DEFI PAGE
// =========================================================================
const DefiPage: React.FC = () => {
    const { client, address, balance } = useWallet();
    const [mainTab, setMainTab] = useState(0);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center" spacing={2}>
                <Grid item xs={12} md={10}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <BlockExplorerNavBar />
                    </Stack>
                    <GeneralStats />
                </Grid>

                <Grid item xs={12} md={10}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                <Typography variant="h5" fontWeight="bold">Creator Economy</Typography>
                                {balance && (
                                    <Typography variant="body2">
                                        {formatMicroAmount(balance.amount)} bluechip
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
                                <Tab label="Subscribe" />
                                <Tab label="Swap" />
                                <Tab label="Liquidity" />
                                <Tab label="Collect Fees" />
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
                                <LiquidityTab client={client} address={address} />
                            </TabPanel>
                            <TabPanel value={mainTab} index={4}>
                                <FeesTab client={client} address={address} />
                            </TabPanel>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default DefiPage;
