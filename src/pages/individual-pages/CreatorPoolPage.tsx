import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';


const CreatorPoolPage: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [creator, setCreatorPool] = useState<any>(null);
    useEffect(() => {
        const fetchCreatorPool = async () => {
            try {
                const response = await fetch(`/api/validators/${id}`);
                const data = await response.json();
                setCreatorPool(data);
            } catch (error) {
                console.error("Failed to fetch pool:", error);
            }
        };
        fetchCreatorPool();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Creator Pool Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid item xs={8} sx={{ mt: '10px' }}>
                <Stack spacing={2}>
                    <BlockExplorerNavBar />
                    <GeneralStats />
                </Stack>
            </Grid>
            <Grid container>
                <Grid item xs={8}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5'>Creator:</Typography>
                            <Divider />
                            <Typography>TImestamp: </Typography>
                            <Typography>Block Hash: </Typography>
                            <Typography>Block Reward: </Typography>
                            <Typography>Block Proposer: </Typography>
                            <Typography>Transaction Fee: </Typography>
                            <Typography>Block Height: </Typography>
                            <Typography># of Transactions: </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Layout>
    )
}
export default CreatorPoolPage;