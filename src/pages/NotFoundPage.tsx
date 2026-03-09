import React from 'react';
import { Layout } from '../ui';
import { Button, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import { Link } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const NotFoundPage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid
                container
                justifyContent="center"
                alignItems="center"
                sx={{ minHeight: '60vh' }}
            >
                <Grid item xs={12}>
                    <Stack spacing={2} alignItems="center">
                        <BlockExplorerNavBar />
                        <ErrorOutlineIcon sx={{ fontSize: 80, color: 'grey.500', mt: 4 }} />
                        <Typography variant="h3" color="text.secondary">
                            404
                        </Typography>
                        <Typography variant="h5" color="text.secondary">
                            Page Not Found
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, textAlign: 'center' }}>
                            The page you are looking for does not exist. It may have been moved, or the URL may be incorrect.
                        </Typography>
                        <Button
                            component={Link}
                            to="/frontpage"
                            variant="contained"
                            sx={{ mt: 2 }}
                        >
                            Back to Home
                        </Button>
                    </Stack>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default NotFoundPage;
