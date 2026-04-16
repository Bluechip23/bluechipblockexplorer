import React, { useEffect, useState } from 'react'
import { Avatar, Card, CardContent, CardHeader, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Layout } from '../../ui';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import ValidatorTable from '../../components/table-pages/ValidatorTable';
import { apiEndpoint } from '../../components/universal/IndividualPage.const';
import CopyableId from '../../components/universal/CopyableId';

interface ValidatorData {
    id: string;
    address: string;
    rank: number;
    commission: number;
    maxCommission: number;
}

const Validator: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [validator, setValidator] = useState<ValidatorData | null>(null);

    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        const fetchValidator = async () => {
            try {
                const response = await fetch(
                    `${apiEndpoint}/cosmos/staking/v1beta1/validators/${encodeURIComponent(id)}`,
                    { signal: controller.signal },
                );
                const data = await response.json();
                const queriedValidator = data?.validator ?? null;
                setValidator(queriedValidator);
            } catch (error) {
                if ((error as { name?: string })?.name === 'AbortError') return;
                console.error("Failed to fetch validator:", error);
            }
        };
        fetchValidator();
        return () => controller.abort();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Validator Not Found</Typography></Layout>;
    }
    if (!validator) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Validator Not Found</Typography></Layout>;
    }
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
                                    {validator.id.charAt(0).toUpperCase()}
                                </Avatar>
                            }
                            title={`Validator ${validator.id}`}

                        />
                        <Stack direction='row' spacing={8}>
                            <Typography variant='h5'>Validator Address: <CopyableId value={validator.id}>{validator.id}</CopyableId></Typography>
                            <Typography>Wallet Address: <CopyableId value={validator.address}>{validator.address}</CopyableId></Typography>
                        </Stack>
                        <CardContent>
                            <Typography>Rank: {validator.rank}</Typography>
                            <Typography>Commission: {validator.commission} </Typography>
                            <Typography>Max Commission: {validator.maxCommission}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <ValidatorTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default Validator;