import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { fetchTransaction, fetchWallet, fetchBlock } from './SearchBarLogic';
import { useNavigate } from 'react-router-dom';
import { denom, rpcEndpoint, apiEndpoint } from '../components/universal/IndividualPage.const';
import axios from 'axios';

const GeneralStats: React.FC = () => {
    const [searchValue, setSearchValue] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null); // Store results
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
            console.log(response.data)
        } catch (error) {
            console.error('Error fetching latest block:', error);

        }
    };
    const fetchStakedTokens = async () => {
        try {
            const response = await axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/pool`);
            const bondedTokens = response.data.pool.bonded_tokens;
            setTotalStaked(bondedTokens);
            console.log(response.data)
        } catch (error) {
            console.error('Error fetching staked tokens:', error);
        }
    };
    const fetchTotalSupply = async () => {
        try {
            const response = await axios.get(`${apiEndpoint}/cosmos/mint/v1beta1/annual_provisions`);
            const supply = response.data.amount;
            setTotalSupply(supply);
            console.log(response.data)
        } catch (error) {
            console.error('Error fetching total supply:', error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            await latestBlockData();
            await fetchStakedTokens();
            await fetchTotalSupply();
        };
        fetchData();
    }, []);

    const handleSearch = async () => {
        setError('');
        setSearchResult(null);
        try {
            let result;
            if (isNaN(Number(searchValue))) {
                if (searchValue.length === 64) {
                    result = await fetchTransaction(searchValue);
                    setSearchResult(result);
                    navigateTo(`/transaction/${searchResult?.hash}`)
                } else {
                    result = await fetchWallet(searchValue);
                    setSearchResult(result);
                    navigateTo(`/wallet/${searchResult?.address}`)
                }
            } else {
                result = await fetchBlock(Number(searchValue));
                setSearchResult(result);
                navigateTo(`/block/${searchResult?.id}`)
            }
        } catch (err) {
            setError('Error fetching data. Please ensure the input is valid.');
            console.log(error)
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
