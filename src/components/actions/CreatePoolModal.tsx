import React, { useState } from 'react';
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
    Checkbox,
    FormControlLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useWallet } from '../../context/WalletContext';
import { NATIVE_DENOM } from '../../defi/types';
import { factoryAddress } from '../universal/IndividualPage.const';
import {
    validateBech32Address,
    assertWalletOnExpectedChain,
    sanitizeOnChainString,
} from '../../utils/security';

interface CreatePoolModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type TxStage = 'input' | 'confirm' | 'executing' | 'success' | 'error';

// SECURITY: Strict allowlist for token name/symbol characters.
// On-chain, these strings are stored as contract metadata and later
// rendered by every frontend that reads the pool — a malicious name
// containing HTML, control chars, or zero-width chars could attack
// other explorers or break layout. We sanitize at the point of
// creation so bad data never reaches the chain.
const TOKEN_NAME_RE = /^[A-Za-z0-9 _\-().]+$/;
const TOKEN_SYMBOL_RE = /^[A-Z0-9]+$/;
const TOKEN_NAME_MAX = 64;
const TOKEN_SYMBOL_MAX = 10;

const CreatePoolModal: React.FC<CreatePoolModalProps> = ({ open, onClose, onSuccess }) => {
    const { client, address } = useWallet();
    const [stage, setStage] = useState<TxStage>('input');
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [isStandardPool, setIsStandardPool] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [inputError, setInputError] = useState('');

    const steps = ['Token Details', 'Confirm', 'Result'];
    const activeStep = stage === 'input' ? 0 : stage === 'confirm' || stage === 'executing' ? 1 : 2;

    const FACTORY = factoryAddress || process.env.REACT_APP_FACTORY_ADDRESS || '';
    const ORACLE = process.env.REACT_APP_ORACLE_ADDRESS || '';

    const resetAndClose = () => {
        setStage('input');
        setTokenName('');
        setTokenSymbol('');
        setIsStandardPool(false);
        setTxHash('');
        setErrorMsg('');
        setInputError('');
        onClose();
    };

    // SECURITY: Validate all user-supplied inputs before showing the confirm screen.
    const handleReview = () => {
        setInputError('');

        if (!tokenName.trim()) {
            setInputError('Token name is required.');
            return;
        }
        if (tokenName.length > TOKEN_NAME_MAX) {
            setInputError(`Token name cannot exceed ${TOKEN_NAME_MAX} characters.`);
            return;
        }
        // SECURITY: Reject names with special/control characters that could
        // be used for XSS or layout attacks on downstream consumers.
        if (!TOKEN_NAME_RE.test(tokenName)) {
            setInputError('Token name contains invalid characters. Use letters, numbers, spaces, hyphens, underscores, or parentheses.');
            return;
        }

        if (!tokenSymbol.trim()) {
            setInputError('Token symbol is required.');
            return;
        }
        if (tokenSymbol.length > TOKEN_SYMBOL_MAX) {
            setInputError(`Token symbol cannot exceed ${TOKEN_SYMBOL_MAX} characters.`);
            return;
        }
        if (!TOKEN_SYMBOL_RE.test(tokenSymbol)) {
            setInputError('Token symbol must be uppercase letters and numbers only.');
            return;
        }

        // SECURITY: Validate factory address is well-formed bech32.
        if (FACTORY) {
            const factoryCheck = validateBech32Address(FACTORY);
            if (!factoryCheck.ok) {
                setInputError(`Factory address invalid: ${factoryCheck.error}`);
                return;
            }
        }

        setStage('confirm');
    };

    const handleConfirm = async () => {
        if (!client || !address) return;
        if (!FACTORY) {
            setErrorMsg('Factory address not configured');
            setStage('error');
            return;
        }

        // SECURITY: Assert chain ID matches bluechip-3 immediately before signing.
        const chainCheck = await assertWalletOnExpectedChain(client);
        if (!chainCheck.ok) {
            setErrorMsg(chainCheck.error!);
            setStage('error');
            return;
        }

        setStage('executing');
        try {
            const thresholdPayout = {
                creator_reward_amount: '325000000000',
                bluechip_reward_amount: '25000000000',
                pool_seed_amount: '350000000000',
                commit_return_amount: '500000000000',
            };

            const createMsg = {
                create: {
                    pool_msg: {
                        pool_token_info: [
                            { bluechip: { denom: NATIVE_DENOM } },
                            { creator_token: { contract_addr: 'WILL_BE_CREATED_BY_FACTORY' } },
                        ],
                        cw20_token_contract_id: 1,
                        factory_to_create_pool_addr: FACTORY,
                        threshold_payout: btoa(JSON.stringify(thresholdPayout)),
                        commit_fee_info: {
                            bluechip_wallet_address: address,
                            creator_wallet_address: address,
                            commit_fee_bluechip: '0.01',
                            commit_fee_creator: '0.05',
                        },
                        creator_token_address: address,
                        commit_amount_for_threshold: '25000000000',
                        commit_limit_usd: '25000000000',
                        pyth_contract_addr_for_conversions: ORACLE || 'oracle_placeholder',
                        pyth_atom_usd_price_feed_id: 'ATOM_USD',
                        max_bluechip_lock_per_pool: '10000000000',
                        creator_excess_liquidity_lock_days: 7,
                        is_standard_pool: isStandardPool,
                    },
                    token_info: {
                        name: tokenName,
                        symbol: tokenSymbol,
                        decimal: 6,
                    },
                },
            };

            // SECURITY: Transaction simulation before signing — if the chain
            // would reject the pool creation, block signing and show the error.
            try {
                await client.simulate(address, [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: address,
                        contract: FACTORY,
                        msg: new TextEncoder().encode(JSON.stringify(createMsg)),
                        funds: [],
                    },
                }], 'Create Pool');
            } catch (simErr) {
                setErrorMsg(`Simulation failed — transaction would be rejected: ${(simErr as Error).message}`);
                setStage('error');
                return;
            }

            const result = await client.execute(
                address,
                FACTORY,
                createMsg,
                { amount: [], gas: '2000000' },
                'Create Pool'
            );
            setTxHash(result.transactionHash);
            setStage('success');
            onSuccess?.();
        } catch (err) {
            setErrorMsg((err as Error).message);
            setStage('error');
        }
    };

    return (
        <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Create a Creator Pool
                <IconButton onClick={resetAndClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {stage === 'input' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Create your own creator token and liquidity pool. Subscribers will commit bluechip
                            to fund your pool. Once the $25,000 threshold is reached, trading goes live.
                        </Typography>
                        <TextField
                            label="Token Name"
                            value={tokenName}
                            onChange={(e) => setTokenName(e.target.value)}
                            placeholder="My Creator Token"
                            fullWidth
                            required
                            inputProps={{ maxLength: TOKEN_NAME_MAX }}
                            helperText="Letters, numbers, spaces, hyphens, underscores, parentheses only."
                        />
                        <TextField
                            label="Token Symbol"
                            value={tokenSymbol}
                            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                            placeholder="MCT"
                            fullWidth
                            required
                            inputProps={{ maxLength: TOKEN_SYMBOL_MAX }}
                            helperText="Uppercase letters and numbers only."
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isStandardPool}
                                    onChange={(e) => setIsStandardPool(e.target.checked)}
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body2" fontWeight="bold">
                                        Standard Pool (skip commit phase)
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Pool starts with 0 liquidity - you must deposit manually.
                                    </Typography>
                                </Box>
                            }
                        />
                        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                                Pool Configuration
                            </Typography>
                            <Typography variant="body2">Commit Threshold: $25,000 USD</Typography>
                            <Typography variant="body2">Commit Fee: 1% BlueChip, 5% Creator</Typography>
                            <Typography variant="body2">Max BlueChip Lock: 10,000 tokens</Typography>
                            <Typography variant="body2">Liquidity Lock: 7 days</Typography>
                        </Box>
                        {/* SECURITY: Display input validation errors inline. */}
                        {inputError && <Alert severity="error">{inputError}</Alert>}
                        <Button
                            variant="contained"
                            onClick={handleReview}
                            disabled={!tokenName || !tokenSymbol}
                            fullWidth
                        >
                            Review Pool
                        </Button>
                    </Box>
                )}

                {(stage === 'confirm' || stage === 'executing') && (
                    <Box>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                            Confirm Pool Creation
                        </Typography>
                        {/* SECURITY: Human-readable creation summary. */}
                        <Alert severity="info" sx={{ mb: 2 }}>
                            You are creating a new pool with token &quot;{sanitizeOnChainString(tokenSymbol, TOKEN_SYMBOL_MAX)}&quot; ({sanitizeOnChainString(tokenName, TOKEN_NAME_MAX)}).
                            {isStandardPool
                                ? ' This is a standard pool — you must deposit liquidity manually.'
                                : ' Subscribers will commit bluechip toward the $25,000 threshold before trading goes live.'}
                        </Alert>
                        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
                            {[
                                { label: 'Token Name', value: sanitizeOnChainString(tokenName, TOKEN_NAME_MAX) },
                                { label: 'Token Symbol', value: sanitizeOnChainString(tokenSymbol, TOKEN_SYMBOL_MAX) },
                                { label: 'Pool Type', value: isStandardPool ? 'Standard (no commit phase)' : 'Commit-based ($25k threshold)' },
                                { label: 'Creator Wallet', value: `${address.slice(0, 12)}...${address.slice(-6)}` },
                                { label: 'Commit Fee (Creator)', value: '5%' },
                                { label: 'Commit Fee (BlueChip)', value: '1%' },
                            ].map((d, i) => (
                                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">{d.label}</Typography>
                                    <Typography variant="body2" fontWeight="bold">{d.value}</Typography>
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button variant="outlined" onClick={() => setStage('input')} disabled={stage === 'executing'} fullWidth>
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleConfirm}
                                disabled={stage === 'executing'}
                                fullWidth
                                startIcon={stage === 'executing' ? <CircularProgress size={16} color="inherit" /> : null}
                            >
                                {stage === 'executing' ? 'Creating Pool...' : 'Create Pool'}
                            </Button>
                        </Box>
                    </Box>
                )}

                {stage === 'success' && (
                    <Box>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Pool created successfully! Your token &quot;{sanitizeOnChainString(tokenSymbol, TOKEN_SYMBOL_MAX)}&quot; is now live.
                        </Alert>
                        {txHash && (
                            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
                                <Typography variant="caption" color="text.secondary">Transaction Hash</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                                    {txHash}
                                </Typography>
                            </Box>
                        )}
                        <Button variant="contained" onClick={resetAndClose} fullWidth>Close</Button>
                    </Box>
                )}

                {stage === 'error' && (
                    <Box>
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errorMsg || 'Pool creation failed'}
                        </Alert>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button variant="outlined" onClick={() => setStage('input')} fullWidth>Try Again</Button>
                            <Button variant="contained" onClick={resetAndClose} fullWidth>Close</Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CreatePoolModal;
