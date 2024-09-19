import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import CreatorContractTable from '../../components/table-pages/CreatorContractsTable';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';

const CreatorContract: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [contract, setContract] = useState<any>(null);
    useEffect(() => {
        const fetchContract = async () => {
            try {
                const response = await fetch(`${rpcEndpoint}/contracts/${id}`);
                const data = await response.json();
                setContract(data);
            } catch (error) {
                console.error("Failed to fetch contract:", error);
            }
        };
        fetchContract();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Contract Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={4}>
                <Grid item xs={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={8}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5'>Creator:</Typography>
                            <Divider />
                            <Typography>Token Name: </Typography>
                            <Typography>Contract Address: </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <CreatorContractTable Creator={''} Address={''} MonthlyTransactions={0} TotalTransactions={0} CreationDate={''} />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default CreatorContract;