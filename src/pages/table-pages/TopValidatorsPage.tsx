import { Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { Layout } from '../../ui';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import GeneralStats from '../../navigation/GeneralStats';
import ValidatorTable from '../../components/table-pages/ValidatorTable';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';


const TopValidatorsPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar/>} >
            <Stack direction='row' alignItems='center' justifyContent='space-around'>
                <Typography variant='h3' sx={{ marginBottom: '10px', }}>BlueChip Top Validator</Typography>
                <BlockExplorerNavBar />
            </Stack>
            <Grid container alignItems='center' justifyContent='center'>
                <Grid item xs={10}>
                    <GeneralStats />
                </Grid>
                <Grid item xs={10}>
                    <ValidatorTable/>
                </Grid>
            </Grid>
        </Layout>
    )
}
export default TopValidatorsPage;