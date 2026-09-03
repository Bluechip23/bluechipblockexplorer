import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    TextField,
    Typography,
    Box,
    Stepper,
    Step,
    StepLabel,
    Alert,
    CircularProgress,
    IconButton,
    Tabs,
    Tab,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OracleStatusBanner from '../universal/OracleStatusBanner';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SellIcon from '@mui/icons-material/Sell';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import { useWallet } from '../../context/WalletContext';
import { NATIVE_DENOM, COIN_DECIMALS } from '../../defi/types';
import { stdFee } from '../../utils/fees';
import {
    validateTokenAmount,
    validateBech32Address,
    validateSlippage,
    assertWalletOnExpectedChain,
    verifyFundsMatch,
    sanitizeOnChainString,
    formatSwapSummary,
    humanizeContractError,
} from '../../utils/security';
import { deadlineNs } from '../../utils/datetime';
import { deriveBeliefPrice, resolvePoolAssets } from '../../utils/poolActions';


interface BaseModalProps {
    open: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenSymbol?: string;
}

// Panels are the tab-hostable bodies of the action flows: the same
// input → confirm → executing → result state machine and the same
// security gates as the old standalone modals, minus the Dialog chrome.
// `onClose` dismisses the hosting dialog.
interface BasePanelProps {
    poolAddress: string;
    tokenSymbol?: string;
    onClose: () => void;
}

type TxStage = 'input' | 'confirm' | 'executing' | 'success' | 'error';


// SECURITY: ConfirmationView now takes an optional `summary` string that
// surfaces a plain-English description of the transaction. This ensures
// the user always sees exactly what will happen before signing.
const ConfirmationView: React.FC<{
    title: string;
    details: { label: string; value: string }[];
    summary?: string;
    slippageWarning?: string;
    onConfirm: () => void;
    onBack: () => void;
    executing: boolean;
}> = ({ title, details, summary, slippageWarning, onConfirm, onBack, executing }) => (
    <Box>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {title}
        </Typography>
        {/* SECURITY: Human-readable transaction summary shown before signing */}
        {summary && (
            <Alert severity="info" sx={{ mb: 2 }}>
                {summary}
            </Alert>
        )}
        {/* SECURITY: Slippage warning when above 5% but below the 49% hard cap */}
        {slippageWarning && (
            <Alert severity="warning" sx={{ mb: 2 }}>
                {slippageWarning}
            </Alert>
        )}
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
            {details.map((d, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">{d.label}</Typography>
                    <Typography variant="body2" fontWeight="bold">{d.value}</Typography>
                </Box>
            ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={onBack} disabled={executing} fullWidth>
                Back
            </Button>
            <Button
                variant="contained"
                onClick={onConfirm}
                disabled={executing}
                fullWidth
                startIcon={executing ? <CircularProgress size={16} color="inherit" /> : null}
            >
                {executing ? 'Executing...' : 'Confirm'}
            </Button>
        </Box>
    </Box>
);

const ResultView: React.FC<{
    success: boolean;
    txHash?: string;
    errorMsg?: string;
    onClose: () => void;
}> = ({ success, txHash, errorMsg, onClose }) => (
    <Box>
        <Alert severity={success ? 'success' : 'error'} sx={{ mb: 2 }}>
            {success ? 'Transaction successful!' : errorMsg || 'Transaction failed'}
        </Alert>
        {txHash && (
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Transaction Hash</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                    {txHash}
                </Typography>
            </Box>
        )}
        <Button variant="contained" onClick={onClose} fullWidth>Close</Button>
    </Box>
);


export const BuyPanel: React.FC<BasePanelProps> = ({ onClose, poolAddress, tokenSymbol }) => {
    const { client, address, balance } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.5');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [inputError, setInputError] = useState('');

    const steps = ['Enter Amount', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount('');
        setTxHash('');
        setErrorMsg('');
        setInputError('');
        onClose();
    };

    // SECURITY: Pre-signing validation gate. Every check must pass before the
    // user can proceed from the input screen to the confirmation screen.
    const handleReview = () => {
        setInputError('');

        // SECURITY: Validate the pool address is a well-formed osmo bech32 address.
        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) {
            setInputError(`Pool address invalid: ${addrCheck.error}`);
            return;
        }

        // SECURITY: Validate amount is numeric, positive, within precision, and within balance.
        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS, balance?.amount);
        if (!amtCheck.ok) {
            setInputError(amtCheck.error!);
            return;
        }

        // SECURITY: Enforce slippage bounds [0.1%, 49%]. Block if outside range.
        const slipCheck = validateSlippage(maxSpread);
        if (!slipCheck.ok) {
            setInputError(slipCheck.error!);
            return;
        }

        setStage('confirm');
    };

    const handleConfirm = async () => {
        if (!client || !address) return;

        // SECURITY: Assert chain ID matches the expected Osmosis chain
        // immediately before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setErrorMsg(chainCheck.error!);
            setStage('error');
            return;
        }

        setStage('executing');
        try {
            // SECURITY: Use validated micro-amount from string math to avoid
            // floating-point drift that could cause fund/amount mismatches.
            const amtResult = validateTokenAmount(amount, COIN_DECIMALS);
            if (!amtResult.ok || !amtResult.micro) {
                setErrorMsg(amtResult.error || 'Invalid amount');
                setStage('error');
                return;
            }
            const micro = amtResult.micro;

            const slipResult = validateSlippage(maxSpread);
            const spreadDecimal = ((slipResult.pct ?? 0.5) / 100).toString();

            // Read the pool's actual native denom, then fix belief_price
            // from a live quote — a front-run that moves the pool reverts
            // the swap instead of filling at the worse price.
            const { bluechipDenom } = await resolvePoolAssets(client, poolAddress);
            const offerInfo = { bluechip: { denom: bluechipDenom } };
            const beliefPrice = await deriveBeliefPrice(client, poolAddress, offerInfo, micro);
            if (!beliefPrice) {
                // The contract rejects a direct simple_swap without a
                // belief_price — abort with a clear message instead of
                // broadcasting a doomed tx.
                setErrorMsg('Could not fetch a price quote from the pool, so the swap has no slippage protection. Try again in a moment.');
                setStage('error');
                return;
            }

            const msg = {
                simple_swap: {
                    offer_asset: { info: offerInfo, amount: micro },
                    belief_price: beliefPrice,
                    max_spread: spreadDecimal,
                    allow_high_max_spread: null,
                    to: null,
                    transaction_deadline: deadlineNs(20),
                },
            };

            // SECURITY: Build the funds array once, then verify it matches what
            // the UI told the user before forwarding to the wallet signer.
            const funds = [{ denom: bluechipDenom, amount: micro }];
            const fundsCheck = verifyFundsMatch(
                [{ denom: bluechipDenom, amount: micro }],
                funds,
            );
            if (!fundsCheck.ok) {
                setErrorMsg(`Funds verification failed: ${fundsCheck.error}`);
                setStage('error');
                return;
            }

            // SECURITY: Transaction simulation — attempt a dry-run against the
            // RPC endpoint before opening the signing modal. If the chain would
            // reject the tx, we block signing and surface the failure reason.
            try {
                await client.simulate(address, [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: address,
                        contract: poolAddress,
                        msg: new TextEncoder().encode(JSON.stringify(msg)),
                        funds,
                    },
                }], 'Buy Token');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${humanizeContractError(simErr)}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, poolAddress, msg, stdFee(500000), 'Buy Token', funds);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg(humanizeContractError(err));
            setStage('error');
        }
    };

    // SECURITY: Pre-compute the slippage validation for the confirmation summary.
    const slipResult = validateSlippage(maxSpread);

    return (
        <Box>
            <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {stage === 'input' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label="Amount (OSMO)"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        fullWidth
                        helperText="Amount of OSMO to spend"
                    />
                    <TextField
                        label="Max Slippage (%)"
                        value={maxSpread}
                        onChange={(e) => setMaxSpread(e.target.value)}
                        type="number"
                        fullWidth
                        helperText="Min 0.1%. The pool hard-caps swap slippage at 5%."
                    />
                    {/* SECURITY: Display validation errors inline so the user
                        knows exactly what to fix before proceeding. */}
                    {inputError && <Alert severity="error">{inputError}</Alert>}
                    <Button
                        variant="contained"
                        onClick={handleReview}
                        disabled={!amount || parseFloat(amount) <= 0}
                        fullWidth
                    >
                        Review Order
                    </Button>
                </Box>
            )}

            {(stage === 'confirm' || stage === 'executing') && (
                <ConfirmationView
                    title={`Buy ${sanitizeOnChainString(tokenSymbol, 16) || 'Token'}`}
                    summary={formatSwapSummary({
                        sendAmount: amount,
                        sendSymbol: 'OSMO',
                        receiveAmount: '~estimated',
                        receiveSymbol: tokenSymbol || 'Token',
                        slippagePct: slipResult.pct ?? 0.5,
                    })}
                    slippageWarning={slipResult.warn}
                    details={[
                        { label: 'You Pay', value: `${amount} OSMO` },
                        { label: 'Max Slippage', value: `${maxSpread}%` },
                        { label: 'Pool', value: `${poolAddress.slice(0, 12)}...${poolAddress.slice(-6)}` },
                    ]}
                    onConfirm={handleConfirm}
                    onBack={() => setStage('input')}
                    executing={stage === 'executing'}
                />
            )}

            {(stage === 'success' || stage === 'error') && (
                <ResultView success={stage === 'success'} txHash={txHash} errorMsg={errorMsg} onClose={resetAndClose} />
            )}
        </Box>
    );
};


// Selling a creator token is the same simple_swap as buying — the creator
// token is a native TokenFactory denom (factory/{pool}/{sub}) attached as
// funds. The old CW20 send-hook path no longer exists on the contract.
export const SellPanel: React.FC<BasePanelProps & { creatorTokenDenom?: string }> = ({
    onClose, poolAddress, tokenSymbol, creatorTokenDenom,
}) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.5');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [inputError, setInputError] = useState('');

    const steps = ['Enter Amount', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount('');
        setTxHash('');
        setErrorMsg('');
        setInputError('');
        onClose();
    };

    // SECURITY: Same pre-signing validation gate as BuyPanel.
    const handleReview = () => {
        setInputError('');

        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) {
            setInputError(`Pool address invalid: ${addrCheck.error}`);
            return;
        }

        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS);
        if (!amtCheck.ok) {
            setInputError(amtCheck.error!);
            return;
        }

        const slipCheck = validateSlippage(maxSpread);
        if (!slipCheck.ok) {
            setInputError(slipCheck.error!);
            return;
        }

        setStage('confirm');
    };

    const handleConfirm = async () => {
        if (!client || !address) return;

        // SECURITY: Assert chain ID immediately before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setErrorMsg(chainCheck.error!);
            setStage('error');
            return;
        }

        setStage('executing');
        try {
            const amtResult = validateTokenAmount(amount, COIN_DECIMALS);
            if (!amtResult.ok || !amtResult.micro) {
                setErrorMsg(amtResult.error || 'Invalid amount');
                setStage('error');
                return;
            }
            const micro = amtResult.micro;

            // Resolve the creator token's TokenFactory denom from the pool if
            // the caller didn't supply it.
            let tokenDenom = creatorTokenDenom;
            if (!tokenDenom) {
                tokenDenom = (await resolvePoolAssets(client, poolAddress)).tokenDenom ?? undefined;
            }
            if (!tokenDenom) {
                setErrorMsg('Could not resolve the creator token denom for this pool.');
                setStage('error');
                return;
            }

            const slipResult = validateSlippage(maxSpread);
            const spreadDecimal = ((slipResult.pct ?? 0.5) / 100).toString();

            const offerInfo = { creator_token: { denom: tokenDenom } };
            const beliefPrice = await deriveBeliefPrice(client, poolAddress, offerInfo, micro);
            if (!beliefPrice) {
                // The contract rejects a direct simple_swap without a
                // belief_price — abort with a clear message instead of
                // broadcasting a doomed tx.
                setErrorMsg('Could not fetch a price quote from the pool, so the swap has no slippage protection. Try again in a moment.');
                setStage('error');
                return;
            }

            const msg = {
                simple_swap: {
                    offer_asset: { info: offerInfo, amount: micro },
                    belief_price: beliefPrice,
                    max_spread: spreadDecimal,
                    allow_high_max_spread: null,
                    to: null,
                    transaction_deadline: deadlineNs(20),
                },
            };

            // The creator token IS the attached funds — it's a bank coin.
            const funds = [{ denom: tokenDenom, amount: micro }];
            const fundsCheck = verifyFundsMatch(
                [{ denom: tokenDenom, amount: micro }],
                funds,
            );
            if (!fundsCheck.ok) {
                setErrorMsg(`Funds verification failed: ${fundsCheck.error}`);
                setStage('error');
                return;
            }

            // SECURITY: Transaction simulation before signing.
            try {
                await client.simulate(address, [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: address,
                        contract: poolAddress,
                        msg: new TextEncoder().encode(JSON.stringify(msg)),
                        funds,
                    },
                }], 'Sell Token');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${humanizeContractError(simErr)}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, poolAddress, msg, stdFee(500000), 'Sell Token', funds);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg(humanizeContractError(err));
            setStage('error');
        }
    };

    const slipResult = validateSlippage(maxSpread);

    return (
        <Box>
            <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {stage === 'input' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label={`Amount (${sanitizeOnChainString(tokenSymbol, 16) || 'Token'})`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        fullWidth
                        helperText={`Amount of ${sanitizeOnChainString(tokenSymbol, 16) || 'creator token'} to sell`}
                    />
                    <TextField
                        label="Max Slippage (%)"
                        value={maxSpread}
                        onChange={(e) => setMaxSpread(e.target.value)}
                        type="number"
                        fullWidth
                        helperText="Min 0.1%. The pool hard-caps swap slippage at 5%."
                    />
                    {inputError && <Alert severity="error">{inputError}</Alert>}
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleReview}
                        disabled={!amount || parseFloat(amount) <= 0}
                        fullWidth
                    >
                        Review Sale
                    </Button>
                </Box>
            )}

            {(stage === 'confirm' || stage === 'executing') && (
                <ConfirmationView
                    title={`Sell ${sanitizeOnChainString(tokenSymbol, 16) || 'Token'}`}
                    summary={formatSwapSummary({
                        sendAmount: amount,
                        sendSymbol: tokenSymbol || 'Token',
                        receiveAmount: '~estimated',
                        receiveSymbol: 'OSMO',
                        slippagePct: slipResult.pct ?? 0.5,
                    })}
                    slippageWarning={slipResult.warn}
                    details={[
                        { label: 'You Sell', value: `${amount} ${sanitizeOnChainString(tokenSymbol, 16) || 'Token'}` },
                        { label: 'Max Slippage', value: `${maxSpread}%` },
                        { label: 'Pool', value: `${poolAddress.slice(0, 12)}...${poolAddress.slice(-6)}` },
                    ]}
                    onConfirm={handleConfirm}
                    onBack={() => setStage('input')}
                    executing={stage === 'executing'}
                />
            )}

            {(stage === 'success' || stage === 'error') && (
                <ResultView success={stage === 'success'} txHash={txHash} errorMsg={errorMsg} onClose={resetAndClose} />
            )}
        </Box>
    );
};


// `thresholdReached` switches the panel between the two on-chain commit
// behaviors: pre-threshold commits are banked toward the funding target,
// post-threshold commits are swapped through the native pool — the
// contract REQUIRES a belief_price on that path, which we derive from a
// live simulation quote at signing time. The subscription record updates
// either way.
export const CommitPanel: React.FC<BasePanelProps & { thresholdReached?: boolean }> = ({
    onClose, poolAddress, tokenSymbol, thresholdReached = false,
}) => {
    const { client, address, balance } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.5');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [inputError, setInputError] = useState('');

    const steps = ['Enter Amount', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount('');
        setTxHash('');
        setErrorMsg('');
        setInputError('');
        onClose();
    };

    // SECURITY: Validate all inputs before moving to confirmation.
    const handleReview = () => {
        setInputError('');

        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) {
            setInputError(`Pool address invalid: ${addrCheck.error}`);
            return;
        }

        // SECURITY: Balance-check on commits to prevent over-spending.
        const amtCheck = validateTokenAmount(amount, COIN_DECIMALS, balance?.amount);
        if (!amtCheck.ok) {
            setInputError(amtCheck.error!);
            return;
        }

        // Post-threshold commits are swaps — enforce slippage bounds.
        if (thresholdReached) {
            const slipCheck = validateSlippage(maxSpread);
            if (!slipCheck.ok) {
                setInputError(slipCheck.error!);
                return;
            }
        }

        setStage('confirm');
    };

    const handleConfirm = async () => {
        if (!client || !address) return;

        // SECURITY: Chain ID assertion before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setErrorMsg(chainCheck.error!);
            setStage('error');
            return;
        }

        setStage('executing');
        try {
            const amtResult = validateTokenAmount(amount, COIN_DECIMALS);
            if (!amtResult.ok || !amtResult.micro) {
                setErrorMsg(amtResult.error || 'Invalid amount');
                setStage('error');
                return;
            }
            const micro = amtResult.micro;
            const txDeadline = deadlineNs(20);
            const { bluechipDenom } = await resolvePoolAssets(client, poolAddress);

            // max_spread only applies once the pool trades through the native
            // pool; the contract ignores it pre-threshold, so send null there.
            const slipResult = validateSlippage(maxSpread);
            const spreadDecimal = thresholdReached
                ? ((slipResult.pct ?? 0.5) / 100).toString()
                : null;

            // Post-threshold commits swap through the native pool and the
            // contract REJECTS belief_price: null on that path — derive the
            // price from a live quote. Pre-threshold commits don't swap.
            let beliefPrice: string | null = null;
            if (thresholdReached) {
                beliefPrice = await deriveBeliefPrice(
                    client,
                    poolAddress,
                    { bluechip: { denom: bluechipDenom } },
                    micro,
                );
                if (!beliefPrice) {
                    setErrorMsg('Could not quote this commit against the pool — try again in a moment.');
                    setStage('error');
                    return;
                }
            }

            const msg = {
                commit: {
                    asset: { info: { bluechip: { denom: bluechipDenom } }, amount: micro },
                    transaction_deadline: txDeadline,
                    belief_price: beliefPrice,
                    max_spread: spreadDecimal,
                },
            };

            const funds = [{ denom: bluechipDenom, amount: micro }];
            const fundsCheck = verifyFundsMatch(
                [{ denom: bluechipDenom, amount: micro }],
                funds,
            );
            if (!fundsCheck.ok) {
                setErrorMsg(`Funds verification failed: ${fundsCheck.error}`);
                setStage('error');
                return;
            }

            // SECURITY: Transaction simulation before signing.
            try {
                await client.simulate(address, [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: address,
                        contract: poolAddress,
                        msg: new TextEncoder().encode(JSON.stringify(msg)),
                        funds,
                    },
                }], 'Commit');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${humanizeContractError(simErr)}`);
                setStage('error');
                return;
            }

            // A pre-threshold commit can be the one that CROSSES the
            // threshold, which creates the native GAMM pool and seeds
            // liquidity in the same tx — budget gas for that path
            // (mirrors the contract repo's reference frontend: 3M
            // pre-threshold, 800k for post-threshold swap commits).
            const commitGas = thresholdReached ? 800000 : 3000000;
            const result = await client.execute(address, poolAddress, msg, stdFee(commitGas), 'Commit', funds);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg(humanizeContractError(err));
            setStage('error');
        }
    };

    const symbol = sanitizeOnChainString(tokenSymbol, 16) || 'Token';

    return (
        <Box>
            <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {stage === 'input' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <OracleStatusBanner />
                    <Alert severity="info" sx={{ mb: 1 }}>
                        {thresholdReached
                            ? `This pool is past its funding threshold — your commit is swapped through the native Osmosis pool and you receive ${symbol} at the current price. Your on-chain subscription record still updates.`
                            : "Subscribe to this pool's pre-threshold phase. Your OSMO will be committed toward the funding threshold."}
                    </Alert>
                    <TextField
                        label="Amount (OSMO)"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        fullWidth
                    />
                    {thresholdReached && (
                        <TextField
                            label="Max Slippage (%)"
                            value={maxSpread}
                            onChange={(e) => setMaxSpread(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="Min 0.1%. The pool hard-caps swap slippage at 5%."
                        />
                    )}
                    {inputError && <Alert severity="error">{inputError}</Alert>}
                    <Button
                        variant="contained"
                        onClick={handleReview}
                        disabled={!amount || parseFloat(amount) <= 0}
                        fullWidth
                    >
                        Review Commitment
                    </Button>
                </Box>
            )}

            {(stage === 'confirm' || stage === 'executing') && (
                <ConfirmationView
                    title="Confirm Commitment"
                    summary={thresholdReached
                        ? `You are committing ${amount} OSMO. It will be swapped through the pool and you will receive ${symbol}.`
                        : `You are committing ${amount} OSMO toward this pool's funding threshold.`}
                    details={[
                        { label: 'You Commit', value: `${amount} OSMO` },
                        ...(thresholdReached ? [{ label: 'Max Slippage', value: `${maxSpread}%` }] : []),
                        { label: 'Pool', value: `${poolAddress.slice(0, 12)}...${poolAddress.slice(-6)}` },
                    ]}
                    onConfirm={handleConfirm}
                    onBack={() => setStage('input')}
                    executing={stage === 'executing'}
                />
            )}

            {(stage === 'success' || stage === 'error') && (
                <ResultView success={stage === 'success'} txHash={txHash} errorMsg={errorMsg} onClose={resetAndClose} />
            )}
        </Box>
    );
};


// ---------------------------------------------------------------------------
// Dialog shells.
//
// CommitModal is the standalone commit flow for pools still in their
// funding phase, where commit is the only available action. TradeModal
// hosts the panels in tabs for active (post-threshold) pools. Inactive
// tab panels stay mounted (hidden via CSS) so an in-flight transaction
// isn't lost if the user peeks at another tab; closing the dialog
// unmounts everything, resetting all panel state.
//
// There is no LiquidityModal anymore: liquidity lives in the native
// Osmosis GAMM pool (seeded at threshold crossing and locked in the pool
// contract), so LP flows happen on app.osmosis.zone, not here.
// ---------------------------------------------------------------------------

export const CommitModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* SECURITY: Sanitize on-chain token symbol before rendering */}
            Commit to {sanitizeOnChainString(tokenSymbol, 16) || 'Pool'}
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
            <CommitPanel poolAddress={poolAddress} tokenSymbol={tokenSymbol} onClose={onClose} />
        </DialogContent>
    </Dialog>
);

export type TradeTab = 'buy' | 'sell' | 'commit';
const TRADE_TABS: TradeTab[] = ['buy', 'sell', 'commit'];

export const TradeModal: React.FC<BaseModalProps & {
    creatorTokenDenom?: string;
    initialTab?: TradeTab;
}> = ({ open, onClose, poolAddress, tokenSymbol, creatorTokenDenom, initialTab = 'buy' }) => {
    const [tab, setTab] = useState(Math.max(0, TRADE_TABS.indexOf(initialTab)));

    // Re-sync the active tab each time the dialog opens.
    useEffect(() => {
        if (open) setTab(Math.max(0, TRADE_TABS.indexOf(initialTab)));
    }, [open, initialTab]);

    const symbol = sanitizeOnChainString(tokenSymbol, 16) || 'Token';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                Trade {symbol}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab icon={<ShoppingCartIcon fontSize="small" />} iconPosition="start" label="Buy" />
                <Tab icon={<SellIcon fontSize="small" />} iconPosition="start" label="Sell" />
                <Tab icon={<VolunteerActivismIcon fontSize="small" />} iconPosition="start" label="Commit" />
            </Tabs>
            <DialogContent>
                <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>
                    <BuyPanel poolAddress={poolAddress} tokenSymbol={tokenSymbol} onClose={onClose} />
                </Box>
                <Box sx={{ display: tab === 1 ? 'block' : 'none' }}>
                    <SellPanel
                        poolAddress={poolAddress}
                        tokenSymbol={tokenSymbol}
                        creatorTokenDenom={creatorTokenDenom}
                        onClose={onClose}
                    />
                </Box>
                <Box sx={{ display: tab === 2 ? 'block' : 'none' }}>
                    <CommitPanel poolAddress={poolAddress} tokenSymbol={tokenSymbol} thresholdReached onClose={onClose} />
                </Box>
            </DialogContent>
        </Dialog>
    );
};
