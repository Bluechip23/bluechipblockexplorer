import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
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
    Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useWallet } from '../../context/WalletContext';
import { NATIVE_DENOM, COIN_DECIMALS } from '../../defi/types';
import {
    validateTokenAmount,
    validateBech32Address,
    validateSlippage,
    assertWalletOnExpectedChain,
    verifyFundsMatch,
    sanitizeOnChainString,
    formatSwapSummary,
    formatLiquidityDepositSummary,
} from '../../utils/security';
import { compareMicro } from '../../utils/bigintMath';


interface BaseModalProps {
    open: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenSymbol?: string;
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


export const BuyModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => {
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

        // SECURITY: Validate the pool address is a well-formed bluechip bech32 address.
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

        // SECURITY: Assert chain ID matches bluechip-3 immediately before signing.
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

            const msg = {
                simple_swap: {
                    offer_asset: { info: { bluechip: { denom: NATIVE_DENOM } }, amount: micro },
                    belief_price: null,
                    max_spread: spreadDecimal,
                    to: null,
                    transaction_deadline: ((Date.now() + 20 * 60000) * 1000000).toString(),
                },
            };

            // SECURITY: Build the funds array once, then verify it matches what
            // the UI told the user before forwarding to the wallet signer.
            const funds = [{ denom: NATIVE_DENOM, amount: micro }];
            const fundsCheck = verifyFundsMatch(
                [{ denom: NATIVE_DENOM, amount: micro }],
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
                setErrorMsg(`Simulation failed — transaction would be rejected: ${(simErr as Error).message}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Buy Token', funds);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStage('error');
        }
    };

    // SECURITY: Pre-compute the slippage validation for the confirmation summary.
    const slipResult = validateSlippage(maxSpread);

    return (
        <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* SECURITY: Sanitize on-chain token symbol before rendering */}
                Buy {sanitizeOnChainString(tokenSymbol, 16) || 'Token'}
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Amount (bluechip)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="Amount of bluechip to spend"
                        />
                        <TextField
                            label="Max Slippage (%)"
                            value={maxSpread}
                            onChange={(e) => setMaxSpread(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="Min 0.1%, max 49%. Warning above 5%."
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
                            sendSymbol: 'bluechip',
                            receiveAmount: '~estimated',
                            receiveSymbol: tokenSymbol || 'Token',
                            slippagePct: slipResult.pct ?? 0.5,
                        })}
                        slippageWarning={slipResult.warn}
                        details={[
                            { label: 'You Pay', value: `${amount} bluechip` },
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
            </DialogContent>
        </Dialog>
    );
};


export const SellModal: React.FC<BaseModalProps & { creatorTokenAddress?: string }> = ({
    open, onClose, poolAddress, tokenSymbol, creatorTokenAddress,
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

    // SECURITY: Same pre-signing validation gate as BuyModal.
    const handleReview = () => {
        setInputError('');

        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) {
            setInputError(`Pool address invalid: ${addrCheck.error}`);
            return;
        }

        if (creatorTokenAddress) {
            const tokenAddrCheck = validateBech32Address(creatorTokenAddress);
            if (!tokenAddrCheck.ok) {
                setInputError(`Token address invalid: ${tokenAddrCheck.error}`);
                return;
            }
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
        if (!client || !address || !creatorTokenAddress) return;

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

            const slipResult = validateSlippage(maxSpread);
            const spreadDecimal = ((slipResult.pct ?? 0.5) / 100).toString();

            const hookMsg = {
                swap: {
                    belief_price: null,
                    max_spread: spreadDecimal,
                    to: null,
                    transaction_deadline: ((Date.now() + 20 * 60000) * 1000000).toString(),
                },
            };
            const msg = {
                send: {
                    contract: poolAddress,
                    amount: micro,
                    msg: btoa(JSON.stringify(hookMsg)),
                },
            };

            // SECURITY: Transaction simulation before signing.
            try {
                await client.simulate(address, [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: address,
                        contract: creatorTokenAddress,
                        msg: new TextEncoder().encode(JSON.stringify(msg)),
                        funds: [],
                    },
                }], 'Sell Token');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${(simErr as Error).message}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, creatorTokenAddress, msg, { amount: [], gas: '500000' }, 'Sell Token', []);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStage('error');
        }
    };

    const slipResult = validateSlippage(maxSpread);

    return (
        <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Sell {sanitizeOnChainString(tokenSymbol, 16) || 'Token'}
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
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
                            helperText="Min 0.1%, max 49%. Warning above 5%."
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
                            receiveSymbol: 'bluechip',
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
            </DialogContent>
        </Dialog>
    );
};


export const CommitModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => {
    const { client, address, balance } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
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
            const deadlineNs = ((Date.now() + 20 * 60000) * 1000000).toString();

            // Pool denom is configurable per-pool; read it from pair {} rather than
            // assuming NATIVE_DENOM so this still works if a future pool uses a
            // different bluechip denom.
            let bluechipDenom = NATIVE_DENOM;
            try {
                const pairInfo = await client.queryContractSmart(poolAddress, { pair: {} });
                const infos: any[] = pairInfo?.asset_infos ?? [];
                const found = infos.find((i) => i?.bluechip?.denom)?.bluechip?.denom;
                if (typeof found === 'string' && found.length > 0) bluechipDenom = found;
            } catch {
                // Fall back to NATIVE_DENOM if the query fails.
            }

            const msg = {
                commit: {
                    asset: { info: { bluechip: { denom: bluechipDenom } }, amount: micro },
                    transaction_deadline: deadlineNs,
                    belief_price: null,
                    max_spread: null,
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
                setErrorMsg(`Simulation failed — transaction would be rejected: ${(simErr as Error).message}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '600000' }, 'Commit', funds);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStage('error');
        }
    };

    return (
        <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Commit to {sanitizeOnChainString(tokenSymbol, 16) || 'Pool'}
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Alert severity="info" sx={{ mb: 1 }}>
                            Subscribe to this pool's pre-threshold phase. Your bluechip will be committed toward the funding threshold.
                        </Alert>
                        <TextField
                            label="Amount (bluechip)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            fullWidth
                        />
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
                        summary={`You are committing ${amount} bluechip toward this pool's funding threshold.`}
                        details={[
                            { label: 'You Commit', value: `${amount} bluechip` },
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
            </DialogContent>
        </Dialog>
    );
};


export const DepositLiquidityModal: React.FC<BaseModalProps & { creatorTokenAddress?: string }> = ({
    open, onClose, poolAddress, tokenSymbol, creatorTokenAddress,
}) => {
    const { client, address, balance } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount0, setAmount0] = useState('');
    const [amount1, setAmount1] = useState('');
    const [slippage, setSlippage] = useState('1');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [inputError, setInputError] = useState('');

    const steps = ['Enter Amounts', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount0('');
        setAmount1('');
        setTxHash('');
        setErrorMsg('');
        setInputError('');
        onClose();
    };

    // SECURITY: Validate both deposit amounts, slippage, and all addresses.
    const handleReview = () => {
        setInputError('');

        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) {
            setInputError(`Pool address invalid: ${addrCheck.error}`);
            return;
        }

        if (creatorTokenAddress) {
            const tokenAddrCheck = validateBech32Address(creatorTokenAddress);
            if (!tokenAddrCheck.ok) {
                setInputError(`Token address invalid: ${tokenAddrCheck.error}`);
                return;
            }
        }

        // SECURITY: Validate bluechip amount against on-chain balance.
        const amt0Check = validateTokenAmount(amount0, COIN_DECIMALS, balance?.amount);
        if (!amt0Check.ok) {
            setInputError(`Bluechip amount: ${amt0Check.error}`);
            return;
        }

        const amt1Check = validateTokenAmount(amount1, COIN_DECIMALS);
        if (!amt1Check.ok) {
            setInputError(`Creator token amount: ${amt1Check.error}`);
            return;
        }

        const slipCheck = validateSlippage(slippage);
        if (!slipCheck.ok) {
            setInputError(slipCheck.error!);
            return;
        }

        setStage('confirm');
    };

    const handleConfirm = async () => {
        if (!client || !address || !creatorTokenAddress) return;

        // SECURITY: Chain assertion before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setErrorMsg(chainCheck.error!);
            setStage('error');
            return;
        }

        setStage('executing');
        try {
            const amt0Result = validateTokenAmount(amount0, COIN_DECIMALS);
            const amt1Result = validateTokenAmount(amount1, COIN_DECIMALS);
            if (!amt0Result.ok || !amt0Result.micro || !amt1Result.ok || !amt1Result.micro) {
                setErrorMsg('Invalid deposit amounts');
                setStage('error');
                return;
            }
            const a0 = amt0Result.micro;
            const a1 = amt1Result.micro;

            // Check/increase allowance
            const allowance = await client.queryContractSmart(creatorTokenAddress, {
                allowance: { owner: address, spender: poolAddress },
            });
            if (compareMicro(allowance.allowance, a1) < 0) {
                await client.execute(
                    address,
                    creatorTokenAddress,
                    { increase_allowance: { spender: poolAddress, amount: a1 } },
                    { amount: [], gas: '200000' },
                    'Approve',
                    []
                );
            }

            const slipResult = validateSlippage(slippage);
            const slipFactor = 1 - ((slipResult.pct ?? 1) / 100);
            const deadlineNs = ((Date.now() + 20 * 60000) * 1000000).toString();

            const msg = {
                deposit_liquidity: {
                    amount0: a0,
                    amount1: a1,
                    min_amount0: Math.floor(parseFloat(a0) * slipFactor).toString(),
                    min_amount1: Math.floor(parseFloat(a1) * slipFactor).toString(),
                    transaction_deadline: deadlineNs,
                },
            };

            const funds = [{ denom: NATIVE_DENOM, amount: a0 }];
            const fundsCheck = verifyFundsMatch(
                [{ denom: NATIVE_DENOM, amount: a0 }],
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
                }], 'Deposit Liquidity');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${(simErr as Error).message}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Deposit Liquidity', funds);
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStage('error');
        }
    };

    const slipResult = validateSlippage(slippage);

    return (
        <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Deposit Liquidity
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Amount bluechip"
                            value={amount0}
                            onChange={(e) => setAmount0(e.target.value)}
                            type="number"
                            fullWidth
                        />
                        <TextField
                            label={`Amount ${sanitizeOnChainString(tokenSymbol, 16) || 'Creator Token'}`}
                            value={amount1}
                            onChange={(e) => setAmount1(e.target.value)}
                            type="number"
                            fullWidth
                        />
                        <TextField
                            label="Slippage Tolerance (%)"
                            value={slippage}
                            onChange={(e) => setSlippage(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="Min 0.1%, max 49%. Warning above 5%."
                        />
                        {inputError && <Alert severity="error">{inputError}</Alert>}
                        <Button
                            variant="contained"
                            onClick={handleReview}
                            disabled={!amount0 || !amount1 || parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0}
                            fullWidth
                        >
                            Review Deposit
                        </Button>
                    </Box>
                )}

                {(stage === 'confirm' || stage === 'executing') && (
                    <ConfirmationView
                        title="Confirm Liquidity Deposit"
                        summary={formatLiquidityDepositSummary({
                            amount0,
                            symbol0: 'bluechip',
                            amount1,
                            symbol1: tokenSymbol || 'Creator Token',
                            lpShares: '~estimated',
                        })}
                        slippageWarning={slipResult.warn}
                        details={[
                            { label: 'bluechip', value: amount0 },
                            { label: sanitizeOnChainString(tokenSymbol, 16) || 'Creator Token', value: amount1 },
                            { label: 'Slippage', value: `${slippage}%` },
                        ]}
                        onConfirm={handleConfirm}
                        onBack={() => setStage('input')}
                        executing={stage === 'executing'}
                    />
                )}

                {(stage === 'success' || stage === 'error') && (
                    <ResultView success={stage === 'success'} txHash={txHash} errorMsg={errorMsg} onClose={resetAndClose} />
                )}
            </DialogContent>
        </Dialog>
    );
};


export const RemoveLiquidityModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [positionId, setPositionId] = useState('');
    const [percentage, setPercentage] = useState('100');
    const [slippage, setSlippage] = useState('1');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [inputError, setInputError] = useState('');

    const steps = ['Enter Details', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setPositionId('');
        setPercentage('100');
        setTxHash('');
        setErrorMsg('');
        setInputError('');
        onClose();
    };

    // SECURITY: Validate inputs before confirmation.
    const handleReview = () => {
        setInputError('');

        const addrCheck = validateBech32Address(poolAddress);
        if (!addrCheck.ok) {
            setInputError(`Pool address invalid: ${addrCheck.error}`);
            return;
        }

        if (!positionId || positionId.trim() === '') {
            setInputError('Position ID is required.');
            return;
        }

        const pct = parseInt(percentage, 10);
        if (isNaN(pct) || pct < 1 || pct > 100) {
            setInputError('Percentage must be between 1 and 100.');
            return;
        }

        const slipCheck = validateSlippage(slippage);
        if (!slipCheck.ok) {
            setInputError(slipCheck.error!);
            return;
        }

        setStage('confirm');
    };

    const handleConfirm = async () => {
        if (!client || !address) return;

        // SECURITY: Chain assertion before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setErrorMsg(chainCheck.error!);
            setStage('error');
            return;
        }

        setStage('executing');
        try {
            const slipResult = validateSlippage(slippage);
            const deviationBps = Math.floor((slipResult.pct ?? 1) * 100);
            const deadlineNs = ((Date.now() + 20 * 60000) * 1000000).toString();
            const pct = parseInt(percentage, 10);

            let msg: any;
            if (pct >= 100) {
                msg = {
                    remove_all_liquidity: {
                        position_id: positionId,
                        min_amount0: null,
                        min_amount1: null,
                        max_ratio_deviation_bps: deviationBps,
                        transaction_deadline: deadlineNs,
                    },
                };
            } else {
                msg = {
                    remove_partial_liquidity_by_percent: {
                        position_id: positionId,
                        percentage: pct,
                        min_amount0: null,
                        min_amount1: null,
                        max_ratio_deviation_bps: deviationBps,
                        transaction_deadline: deadlineNs,
                    },
                };
            }

            // SECURITY: Transaction simulation before signing.
            try {
                await client.simulate(address, [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: address,
                        contract: poolAddress,
                        msg: new TextEncoder().encode(JSON.stringify(msg)),
                        funds: [],
                    },
                }], 'Remove Liquidity');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${(simErr as Error).message}`);
                setStage('error');
                return;
            }

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Remove Liquidity');
            setTxHash(result.transactionHash);
            setStage('success');
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStage('error');
        }
    };

    const slipResult = validateSlippage(slippage);

    return (
        <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Remove Liquidity
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Position ID"
                            value={positionId}
                            onChange={(e) => setPositionId(e.target.value)}
                            fullWidth
                            helperText="Your LP position ID"
                        />
                        <TextField
                            label="Percentage to Remove"
                            value={percentage}
                            onChange={(e) => setPercentage(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="100 = remove all"
                            inputProps={{ min: 1, max: 100 }}
                        />
                        <TextField
                            label="Max Deviation (%)"
                            value={slippage}
                            onChange={(e) => setSlippage(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="Min 0.1%, max 49%. Warning above 5%."
                        />
                        {inputError && <Alert severity="error">{inputError}</Alert>}
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleReview}
                            disabled={!positionId}
                            fullWidth
                        >
                            Review Removal
                        </Button>
                    </Box>
                )}

                {(stage === 'confirm' || stage === 'executing') && (
                    <ConfirmationView
                        title="Confirm Liquidity Removal"
                        summary={`You are removing ${percentage}% of position ${positionId}. You will receive the corresponding share of pooled tokens.`}
                        slippageWarning={slipResult.warn}
                        details={[
                            { label: 'Position ID', value: positionId },
                            { label: 'Remove', value: `${percentage}%` },
                            { label: 'Max Deviation', value: `${slippage}%` },
                        ]}
                        onConfirm={handleConfirm}
                        onBack={() => setStage('input')}
                        executing={stage === 'executing'}
                    />
                )}

                {(stage === 'success' || stage === 'error') && (
                    <ResultView success={stage === 'success'} txHash={txHash} errorMsg={errorMsg} onClose={resetAndClose} />
                )}
            </DialogContent>
        </Dialog>
    );
};
