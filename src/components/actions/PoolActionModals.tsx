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
import { NATIVE_DENOM } from '../../defi/types';

// ─── Shared types ────────────────────────────────────────────────────────────

interface BaseModalProps {
    open: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenSymbol?: string;
}

type TxStage = 'input' | 'confirm' | 'executing' | 'success' | 'error';

// ─── Shared confirmation step ────────────────────────────────────────────────

const ConfirmationView: React.FC<{
    title: string;
    details: { label: string; value: string }[];
    onConfirm: () => void;
    onBack: () => void;
    executing: boolean;
}> = ({ title, details, onConfirm, onBack, executing }) => (
    <Box>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {title}
        </Typography>
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

// ─── Buy (Swap native → creator token) ──────────────────────────────────────

export const BuyModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.5');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const steps = ['Enter Amount', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount('');
        setTxHash('');
        setErrorMsg('');
        onClose();
    };

    const handleConfirm = async () => {
        if (!client || !address) return;
        setStage('executing');
        try {
            const micro = Math.floor(parseFloat(amount) * 1_000_000).toString();
            const msg = {
                simple_swap: {
                    offer_asset: { info: { bluechip: { denom: NATIVE_DENOM } }, amount: micro },
                    belief_price: null,
                    max_spread: (parseFloat(maxSpread) / 100).toString(),
                    to: null,
                    transaction_deadline: ((Date.now() + 20 * 60000) * 1000000).toString(),
                },
            };
            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Buy Token', [
                { denom: NATIVE_DENOM, amount: micro },
            ]);
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
                Buy {tokenSymbol || 'Token'}
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Amount (BLUECHIP)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            fullWidth
                            helperText="Amount of BLUECHIP to spend"
                        />
                        <TextField
                            label="Max Slippage (%)"
                            value={maxSpread}
                            onChange={(e) => setMaxSpread(e.target.value)}
                            type="number"
                            fullWidth
                        />
                        <Button
                            variant="contained"
                            onClick={() => setStage('confirm')}
                            disabled={!amount || parseFloat(amount) <= 0}
                            fullWidth
                        >
                            Review Order
                        </Button>
                    </Box>
                )}

                {(stage === 'confirm' || stage === 'executing') && (
                    <ConfirmationView
                        title={`Buy ${tokenSymbol || 'Token'}`}
                        details={[
                            { label: 'You Pay', value: `${amount} BLUECHIP` },
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

// ─── Sell (Swap creator token → native) ─────────────────────────────────────

export const SellModal: React.FC<BaseModalProps & { creatorTokenAddress?: string }> = ({
    open, onClose, poolAddress, tokenSymbol, creatorTokenAddress,
}) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
    const [maxSpread, setMaxSpread] = useState('0.5');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const steps = ['Enter Amount', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount('');
        setTxHash('');
        setErrorMsg('');
        onClose();
    };

    const handleConfirm = async () => {
        if (!client || !address || !creatorTokenAddress) return;
        setStage('executing');
        try {
            const micro = Math.floor(parseFloat(amount) * 1_000_000).toString();
            const hookMsg = {
                swap: {
                    belief_price: null,
                    max_spread: (parseFloat(maxSpread) / 100).toString(),
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
            const result = await client.execute(address, creatorTokenAddress, msg, { amount: [], gas: '500000' }, 'Sell Token', []);
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
                Sell {tokenSymbol || 'Token'}
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label={`Amount (${tokenSymbol || 'Token'})`}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            fullWidth
                            helperText={`Amount of ${tokenSymbol || 'creator token'} to sell`}
                        />
                        <TextField
                            label="Max Slippage (%)"
                            value={maxSpread}
                            onChange={(e) => setMaxSpread(e.target.value)}
                            type="number"
                            fullWidth
                        />
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => setStage('confirm')}
                            disabled={!amount || parseFloat(amount) <= 0}
                            fullWidth
                        >
                            Review Sale
                        </Button>
                    </Box>
                )}

                {(stage === 'confirm' || stage === 'executing') && (
                    <ConfirmationView
                        title={`Sell ${tokenSymbol || 'Token'}`}
                        details={[
                            { label: 'You Sell', value: `${amount} ${tokenSymbol || 'Token'}` },
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

// ─── Commit / Subscribe ─────────────────────────────────────────────────────

export const CommitModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount, setAmount] = useState('');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const steps = ['Enter Amount', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount('');
        setTxHash('');
        setErrorMsg('');
        onClose();
    };

    const handleConfirm = async () => {
        if (!client || !address) return;
        setStage('executing');
        try {
            const micro = Math.floor(parseFloat(amount) * 1_000_000).toString();
            const deadlineNs = ((Date.now() + 20 * 60000) * 1000000).toString();
            const msg = {
                commit: {
                    asset: { info: { bluechip: { denom: NATIVE_DENOM } }, amount: micro },
                    amount: micro,
                    transaction_deadline: deadlineNs,
                    belief_price: null,
                    max_spread: null,
                },
            };
            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '600000' }, 'Commit', [
                { denom: NATIVE_DENOM, amount: micro },
            ]);
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
                Commit to {tokenSymbol || 'Pool'}
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Alert severity="info" sx={{ mb: 1 }}>
                            Subscribe to this pool's pre-launch phase. Your BLUECHIP will be committed toward the funding threshold.
                        </Alert>
                        <TextField
                            label="Amount (BLUECHIP)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            fullWidth
                        />
                        <Button
                            variant="contained"
                            onClick={() => setStage('confirm')}
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
                        details={[
                            { label: 'You Commit', value: `${amount} BLUECHIP` },
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

// ─── Deposit Liquidity ──────────────────────────────────────────────────────

export const DepositLiquidityModal: React.FC<BaseModalProps & { creatorTokenAddress?: string }> = ({
    open, onClose, poolAddress, tokenSymbol, creatorTokenAddress,
}) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [amount0, setAmount0] = useState('');
    const [amount1, setAmount1] = useState('');
    const [slippage, setSlippage] = useState('1');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const steps = ['Enter Amounts', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setAmount0('');
        setAmount1('');
        setTxHash('');
        setErrorMsg('');
        onClose();
    };

    const handleConfirm = async () => {
        if (!client || !address || !creatorTokenAddress) return;
        setStage('executing');
        try {
            const a0 = Math.ceil(parseFloat(amount0) * 1_000_000).toString();
            const a1 = Math.ceil(parseFloat(amount1) * 1_000_000).toString();

            // Check/increase allowance
            const allowance = await client.queryContractSmart(creatorTokenAddress, {
                allowance: { owner: address, spender: poolAddress },
            });
            if (parseInt(allowance.allowance) < parseInt(a1)) {
                await client.execute(
                    address,
                    creatorTokenAddress,
                    { increase_allowance: { spender: poolAddress, amount: a1 } },
                    { amount: [], gas: '200000' },
                    'Approve',
                    []
                );
            }

            const slipFactor = 1 - parseFloat(slippage) / 100;
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

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Deposit Liquidity', [
                { denom: NATIVE_DENOM, amount: a0 },
            ]);
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
                            label="Amount BLUECHIP"
                            value={amount0}
                            onChange={(e) => setAmount0(e.target.value)}
                            type="number"
                            fullWidth
                        />
                        <TextField
                            label={`Amount ${tokenSymbol || 'Creator Token'}`}
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
                        />
                        <Button
                            variant="contained"
                            onClick={() => setStage('confirm')}
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
                        details={[
                            { label: 'BLUECHIP', value: amount0 },
                            { label: tokenSymbol || 'Creator Token', value: amount1 },
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

// ─── Remove Liquidity ───────────────────────────────────────────────────────

export const RemoveLiquidityModal: React.FC<BaseModalProps> = ({ open, onClose, poolAddress, tokenSymbol }) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [positionId, setPositionId] = useState('');
    const [percentage, setPercentage] = useState('100');
    const [slippage, setSlippage] = useState('1');
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const steps = ['Enter Details', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const resetAndClose = () => {
        setStage('input');
        setPositionId('');
        setPercentage('100');
        setTxHash('');
        setErrorMsg('');
        onClose();
    };

    const handleConfirm = async () => {
        if (!client || !address) return;
        setStage('executing');
        try {
            const deviationBps = Math.floor(parseFloat(slippage) * 100);
            const deadlineNs = ((Date.now() + 20 * 60000) * 1000000).toString();
            const pct = parseInt(percentage);

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

            const result = await client.execute(address, poolAddress, msg, { amount: [], gas: '500000' }, 'Remove Liquidity');
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
                        />
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => setStage('confirm')}
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
