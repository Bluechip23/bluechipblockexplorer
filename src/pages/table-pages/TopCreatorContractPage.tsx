import { Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { Layout } from '../../ui';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import GeneralStats from '../../navigation/GeneralStats';
import CreatorContractTable from '../../components/table-pages/CreatorContractsTable';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';


const TopCreatorContractPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} >

            <Stack direction='row' alignItems='center' justifyContent='space-around'>
                <Typography variant='h3' sx={{ marginBottom: '10px', }}>BlueChip Creator Contracts</Typography>
                <BlockExplorerNavBar />
            </Stack>
            <Grid container alignItems='center' justifyContent='center'>
                <Grid item xs={10}>
                    <GeneralStats />
                </Grid>
                <Grid item xs={10}>
                    <CreatorContractTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default TopCreatorContractPage;