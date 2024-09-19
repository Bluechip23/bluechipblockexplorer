import { Grid, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { Layout } from '../../ui';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import GeneralStats from '../../navigation/GeneralStats';
import RecentBlocksTable from '../../components/table-pages/RecentBlocksTable';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';


const RecentBlocksPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar/>} >

            <Stack direction='row' alignItems='center' justifyContent='space-around'>
                <Typography variant='h3' sx={{ marginBottom: '10px', }}>BlueChip Recent Blocks</Typography>
                <BlockExplorerNavBar />
            </Stack>
            <Grid container alignItems='center' justifyContent='center'>
                <Grid item xs={10}>
                    <GeneralStats />
                </Grid>
                <Grid item xs={10}>
                    <RecentBlocksTable block={''} age={''} txn={0} feeRecipient={''} gasUsed={0} reward={0} />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default RecentBlocksPage;