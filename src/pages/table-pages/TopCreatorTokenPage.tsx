import { Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { Layout } from '../../ui';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import GeneralStats from '../../navigation/GeneralStats';
import CreatorTokenTable from '../../components/table-pages/CreatorTokenTable';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';


const TopCreatorTokensPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar/>} >

            <Stack direction='row' alignItems='center' justifyContent='space-around'>
                <Typography variant='h3' sx={{ marginBottom: '10px', }}>BlueChip Creator Tokens</Typography>
                <BlockExplorerNavBar />
            </Stack>
            <Grid container alignItems='center' justifyContent='center'>
                <Grid item xs={10}>
                    <GeneralStats />
                </Grid>
                <Grid item xs={10}>
                    <CreatorTokenTable creator={''} price={0} change={0} holders={0} twentyfourH={0} tokenAddress={''}/>
                </Grid>
            </Grid>
        </Layout>
    )
}
export default TopCreatorTokensPage;