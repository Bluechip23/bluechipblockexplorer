import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { fetchTransaction, fetchWallet, fetchBlock } from './SearchBarLogic';
import { useNavigate } from 'react-router-dom';
import { rpcEndpoint, apiEndpoint } from '../components/universal/IndividualPage.const';
import axios from 'axios';

const GeneralStats: React.FC = () => {
    const [searchValue, setSearchValue] = useState('');
    const [recentBlock, setRecentBlock] = useState(0);
    const [totalSupply, setTotalSupply] = useState(0);
    const [totalStaked, setTotalStaked] = useState(0);
    const [transactionsInblock, setTransactionsInblock] = useState(0);
    const [error, setError] = useState('');
    const navigateTo = useNavigate();

    useEffect(() => {
        const controller = new AbortController();

        const fetchAllStats = async () => {
            const [statusResult, stakingResult, supplyResult] = await Promise.allSettled([
                axios.get(`${rpcEndpoint}/status`, { signal: controller.signal }),
                axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/pool`, { signal: controller.signal }),
                axios.get(`${apiEndpoint}/cosmos/mint/v1beta1/annual_provisions`, { signal: controller.signal }),
            ]);

            if (controller.signal.aborted) return;

            if (statusResult.status === 'fulfilled') {
                const latestHeight = statusResult.value.data.result.sync_info.latest_block_height;
                setRecentBlock(latestHeight);
                try {
                    const blockResponse = await axios.get(`${rpcEndpoint}/block?height=${latestHeight}`, { signal: controller.signal });
                    if (!controller.signal.aborted) {
                        setTransactionsInblock(blockResponse.data.result.block.data.txs.length);
                    }
                } catch {}
            }

            if (stakingResult.status === 'fulfilled') {
                setTotalStaked(stakingResult.value.data.pool.bonded_tokens);
            }

            if (supplyResult.status === 'fulfilled') {
                setTotalSupply(supplyResult.value.data.amount);
            }
        };

        fetchAllStats();
        return () => controller.abort();
    }, []);

    const handleSearch = async () => {
        setError('');
        try {
            if (isNaN(Number(searchValue))) {
                if (searchValue.length === 64) {
                    const result = await fetchTransaction(searchValue);
                    navigateTo(`/transactionpage/${result?.hash}`);
                } else {
                    const result = await fetchWallet(searchValue);
                    navigateTo(`/wallet/${result?.address}`);
                }
            } else {
                const result = await fetchBlock(Number(searchValue));
                navigateTo(`/blockpage/${result?.id}`);
            }
        } catch (err) {
            setError('Error fetching data. Please ensure the input is valid.');
        }
    };
    return (
        <Paper elevation={6} sx={{ marginBottom: '10px', padding: { xs: '8px', md: '12px' } }}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                        label='Search Wallet, Transaction Hash, or Block Height'
                        size='small'
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        sx={{ width: { xs: '100%', sm: '50%' } }}
                    />
                    <Button variant='contained' onClick={handleSearch}>
                        Search
                    </Button>
                </Stack>
                <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 4 }} flexWrap="wrap">
                        <Typography variant="body2">Blue Chip Price: $0 </Typography>
                        <Typography variant="body2">Total Supply: {totalSupply}</Typography>
                        <Typography variant="body2">Total Staked: {totalStaked}</Typography>
                        <Typography variant="body2">Annual Inflation: 17.52% </Typography>
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 4 }} flexWrap="wrap">
                        <Typography variant="body2">Block Height: {recentBlock}</Typography>
                        <Typography variant="body2">Txs in last block: {transactionsInblock}</Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    );
};

export default GeneralStats;
