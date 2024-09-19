import { Grid, Stack, Typography } from '@mui/material';
import { Layout } from '../../ui';
import React from 'react';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import GeneralStats from '../../navigation/GeneralStats';
import RecentTransactionsTable from '../../components/table-pages/RecentTransactionsTable';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';


const RecentTransactionsPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar/>} >

            <Stack direction='row' alignItems='center' justifyContent='space-around'>
                <Typography variant='h3' sx={{ marginBottom: '10px', }}>BlueChip Recent Transactions</Typography>
                <BlockExplorerNavBar />
            </Stack>
            <Grid container alignItems='center' justifyContent='center'>
                <Grid item xs={10}>
                    <GeneralStats />
                </Grid>
                <Grid item xs={10}>
                    <RecentTransactionsTable hash={''} method={''} block={''} sender={''} recipient={''} value={0} fee={0} />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default RecentTransactionsPage;