import { Grid, Stack } from '@mui/material';
import React from 'react';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import GeneralStats from '../navigation/GeneralStats';
import RecentBlocksTable from '../components/table-pages/RecentBlocksTable';
import RecentTransactionsTable from '../components/table-pages/RecentTransactionsTable';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';


const FrontPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} >
            <Stack direction='row' alignItems='center' justifyContent='space-around'>
                <BlockExplorerNavBar />
            </Stack>
            <Grid container alignItems='center' justifyContent='center'>
                <Grid item xs={10}>
                    <GeneralStats />
                </Grid>
                <Stack direction='row' spacing={2}>
                    <Grid item xs={6}>
                        <RecentBlocksTable />
                    </Grid>
                    <Grid item xs={6}>
                        <RecentTransactionsTable />
                    </Grid>
                </Stack>
            </Grid>
        </Layout>
    )
}
export default FrontPage;