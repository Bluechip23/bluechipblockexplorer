import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { fetchTransaction, fetchWallet, fetchBlock } from './SearchBarLogic';
import { useNavigate } from 'react-router-dom';

const GeneralStats: React.FC = () => {
    const [searchValue, setSearchValue] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null); // Store results
    const [error, setError] = useState('');
    const navigateTo = useNavigate();


    const handleSearch = async () => {
        setError('');
        setSearchResult(null);

        try {
            if (isNaN(Number(searchValue))) {
                if (searchValue.length === 64) {
                    const transaction = await fetchTransaction(searchValue);
                    setSearchResult(transaction);
                    navigateTo(`/transaction/${searchResult?.hash}`)
                } else {
                    const walletInfo = await fetchWallet(searchValue);
                    setSearchResult(walletInfo);
                    navigateTo(`/wallet/${searchResult?.address}`)
                }
            } else {
                const block = await fetchBlock(Number(searchValue));
                setSearchResult(block);
                navigateTo(`/block/${searchResult?.id}`)

            }
        } catch (err) {
            setError('Error fetching data. Please ensure the input is valid.');
        }
    };

    return (
        <Paper elevation={6} sx={{ marginBottom: '10px', padding: '5px' }}>
            <Stack spacing={2}>
                <Stack direction='row' spacing={2}>
                    <TextField
                        label='Search Wallet, Transaction Hash, or Block Height'
                        size='small'
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        sx={{ width: '50%' }}
                    />
                    <Button variant='contained' onClick={handleSearch}>
                        Search
                    </Button>
                </Stack>
                <Stack spacing={4}>
                    <Stack direction='row' spacing={16}>
                        <Typography>blue chip Price: 1b</Typography>
                        <Typography>Total Market Cap:</Typography>
                        <Typography>Transactions to Date:</Typography>
                        <Typography>Total Creator Pools:</Typography>
                    </Stack>
                    <Stack direction='row' spacing={10}>
                        <Typography>Current Block Height:</Typography>
                        <Typography>Medium Gas Fee:</Typography>
                        <Typography>Current Inflation Rate:</Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    );
};

export default GeneralStats;
