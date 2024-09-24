import React from 'react'
import { Layout } from '../../ui';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Grid, Typography } from '@mui/material';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';

const ComingSoonPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center'>
                <Grid item sx={{ mt: '20px' }}>
                <BlockExplorerNavBar />
                <Typography variant='h4' >
                    This data is not available yet. It will be coming soon!
                </Typography>
            </Grid>
            </Grid>
        </Layout>
    );
}

export default ComingSoonPage;
