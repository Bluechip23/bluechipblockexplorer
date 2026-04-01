import React, { useState } from 'react';
import { Grid, Paper, Table, TableBody, TableContainer, Typography } from '@mui/material';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import DisplayCoinsTableHeader from './DisplayCoinsTableHeader';
import DisplayCoinsRows from './DisplayCoinsRows';

interface TokenData {
    denom: string;
    amount: string;
    price: number;
}

const DisplayCoinsPage: React.FC = () => {
    const [walletBalances] = useState<TokenData[]>([]);

    return (
        <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center">
                <Grid item xs={8}>
                    <Typography variant="h6">Balances for </Typography>
                    <Paper sx={{ width: '100%', overflow: 'auto' }}>
                        <TableContainer sx={{ maxHeight: 440 }}>
                            <Table stickyHeader aria-label="sticky table">
                                <DisplayCoinsTableHeader />
                                <TableBody>
                                    {walletBalances.map((coin, index) => (
                                        <DisplayCoinsRows
                                            key={index}
                                            denom={coin.denom}
                                            amountOwned={coin.amount}
                                            price={coin.price}
                                            totalValue={coin.price * Number(coin.amount)}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default DisplayCoinsPage;
