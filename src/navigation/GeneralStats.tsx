import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { fetchTransaction, fetchWallet, fetchBlock } from './SearchBarLogic';
import { useNavigate } from 'react-router-dom';
import { rpcEndpoint, apiEndpoint } from '../components/universal/IndividualPage.const';
import { formatTokenAmount } from '../utils/formatters';
import axios from 'axios';

const GeneralStats: React.FC = () => {
    const [searchValue, setSearchValue] = useState('');
    const [recentBlock, setRecentBlock] = useState(0);
    const [totalSupply, setTotalSupply] = useState(0);
    const [totalStaked, setTotalStaked] = useState(0);
    const [transactionsInblock, setTransactionsInblock] = useState(0);
    const [error, setError] = useState('');
    const navigateTo = useNavigate();

    const latestBlockData = async () => {
        try {
            const response = await axios.get(`${rpcEndpoint}/status`);
            const latestHeight = response.data.result.sync_info.latest_block_height;
            const blockResponse = await axios.get(`${rpcEndpoint}/block?height=${latestHeight}`);
            const numTxs = blockResponse.data.result.block.data.txs.length;
            setTransactionsInblock(numTxs);
            setRecentBlock(latestHeight);
        } catch (error) {
            console.error('Error fetching latest block:', error);
        }
    };

    const fetchStakedTokens = async () => {
        try {
            const response = await axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/pool`);
            const bondedTokens = response.data.pool.bonded_tokens;
            setTotalStaked(bondedTokens);
        } catch (error) {
            console.error('Error fetching staked tokens:', error);
        }
    };

    const fetchTotalSupply = async () => {
        try {
            const response = await axios.get(`${apiEndpoint}/cosmos/mint/v1beta1/annual_provisions`);
            const supply = response.data.amount;
            setTotalSupply(supply);
        } catch (error) {
            console.error('Error fetching total supply:', error);
        }
    };

    useEffect(() => {
        Promise.all([latestBlockData(), fetchStakedTokens(), fetchTotalSupply()]);
    }, []);

    const handleSearch = async () => {
        setError('');
        const trimmed = searchValue.trim();
        if (!trimmed) return;

        try {
            if (isNaN(Number(trimmed))) {
                if (trimmed.length === 64) {
                    await fetchTransaction(trimmed);
                    navigateTo(`/transactionpage/${trimmed}`);
                } else {
                    await fetchWallet(trimmed);
                    navigateTo(`/wallet/${trimmed}`);
                }
            } else {
                await fetchBlock(Number(trimmed));
                navigateTo(`/blockpage/${trimmed}`);
            }
        } catch (err) {
            setError('Error fetching data. Please ensure the input is valid.');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    return (
        <Paper elevation={6} sx={{ marginBottom: '10px', padding: '15px' }}>
            <Stack spacing={2}>
                <Stack direction='row' spacing={2}>
                    <TextField
                        label='Search Wallet, Transaction Hash, or Block Height'
                        size='small'
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        sx={{ width: '50%' }}
                        error={!!error}
                        helperText={error}
                    />
                    <Button variant='contained' onClick={handleSearch}>
                        Search
                    </Button>
                </Stack>
                <Stack spacing={1}>
                    <Stack direction='row' spacing={4} flexWrap='wrap'>
                        <Typography variant='body2'>BCP Price: $0.00</Typography>
                        <Typography variant='body2'>Total Supply: {formatTokenAmount(totalSupply)}</Typography>
                        <Typography variant='body2'>Total Staked: {formatTokenAmount(totalStaked)}</Typography>
                        <Typography variant='body2'>Inflation Rate: 17.52%</Typography>
                    </Stack>
                    <Stack direction='row' spacing={4} flexWrap='wrap'>
                        <Typography variant='body2'>Block Height: {Number(recentBlock).toLocaleString()}</Typography>
                        <Typography variant='body2'>Txns in Last Block: {transactionsInblock}</Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    );
};

export default GeneralStats;
