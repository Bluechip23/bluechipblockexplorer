import React, { useEffect, useState } from 'react'
import { Avatar, Card, CardContent, CardHeader, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Layout } from '../../ui';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import ValidatorTable from '../../components/table-pages/ValidatorTable';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';

interface ValidatorData {
    id: string;
    address: string;
    rank: number;
    commission: number;
    maxCommission: number;
}

const Validator: React.FC = () => {
    const id = useParams<{ id: string }>();
    const [validator, setValidator] = useState<ValidatorData | null>(null);

    useEffect(() => {
        const fetchValidator = async () => {
            try {
                const response = await fetch(`${rpcEndpoint}/validators/${id}`);
                const data = await response.json();
                setValidator(data);
            } catch (error) {
                console.error("Failed to fetch validator:", error);
            }
        };
        fetchValidator();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Validator Not Found</Typography></Layout>;
    }
    /*if (!validator) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Validator Not Found</Typography></Layout>;
    }*/
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} >

            <Grid container spacing={2} justifyContent='center' alignItems='center'>
                <Grid item xs={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={8}>
                    <Card>
                        <CardHeader
                            avatar={
                                <Avatar aria-label="recipe" sx={{ height: '75px', width: '75px' }}>
                                    R
                                </Avatar>
                            }
                            title="Shrimp and Chorizo Paella"

                        />
                        <Stack direction='row' spacing={8}>
                            <Typography variant='h5'>Validator Address: {validator?.id} </Typography>
                            <Typography>Wallet Address: {validator?.address}</Typography>
                        </Stack>
                        <CardContent>
                            <Typography>Rank: {validator?.rank}</Typography>
                            <Typography>Commission: {validator?.commission} </Typography>
                            <Typography>Max Commission: {validator?.maxCommission}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <ValidatorTable validator={''} commision={0} maxCommision={0} totalStaked={0} delegated={0} valId={''}/>
                </Grid>
            </Grid>
        </Layout>
    )
}
export default Validator;