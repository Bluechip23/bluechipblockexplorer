import React, { useEffect, useState } from 'react';
import { Layout } from '../ui';
import { Card, CardContent, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { apiEndpoint } from '../components/universal/IndividualPage.const';
import axios from 'axios';

interface ParamSection {
    title: string;
    params: { key: string; value: string }[];
}

const NetworkParamsPage: React.FC = () => {
    const [sections, setSections] = useState<ParamSection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchParams = async () => {
            const results: ParamSection[] = [];

            // Staking params
            try {
                const res = await axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/params`);
                const p = res.data.params;
                results.push({
                    title: 'Staking',
                    params: [
                        { key: 'Unbonding Time', value: `${Number(p.unbonding_time?.replace('s', '') || 0) / 86400} days` },
                        { key: 'Max Validators', value: String(p.max_validators || '') },
                        { key: 'Max Entries', value: String(p.max_entries || '') },
                        { key: 'Historical Entries', value: String(p.historical_entries || '') },
                        { key: 'Bond Denom', value: p.bond_denom || '' },
                    ],
                });
            } catch { /* param not available */ }

            // Slashing params
            try {
                const res = await axios.get(`${apiEndpoint}/cosmos/slashing/v1beta1/params`);
                const p = res.data.params;
                results.push({
                    title: 'Slashing',
                    params: [
                        { key: 'Signed Blocks Window', value: String(p.signed_blocks_window || '') },
                        { key: 'Min Signed Per Window', value: p.min_signed_per_window || '' },
                        { key: 'Downtime Jail Duration', value: p.downtime_jail_duration || '' },
                        { key: 'Slash Fraction Double Sign', value: p.slash_fraction_double_sign || '' },
                        { key: 'Slash Fraction Downtime', value: p.slash_fraction_downtime || '' },
                    ],
                });
            } catch { /* param not available */ }

            // Governance params
            try {
                const res = await axios.get(`${apiEndpoint}/cosmos/gov/v1beta1/params/voting`);
                const p = res.data.voting_params;
                results.push({
                    title: 'Governance (Voting)',
                    params: [
                        { key: 'Voting Period', value: p.voting_period || '' },
                    ],
                });
            } catch { /* param not available */ }

            try {
                const res = await axios.get(`${apiEndpoint}/cosmos/gov/v1beta1/params/deposit`);
                const p = res.data.deposit_params;
                results.push({
                    title: 'Governance (Deposit)',
                    params: [
                        { key: 'Min Deposit', value: p.min_deposit?.map((d: any) => `${d.amount} ${d.denom}`).join(', ') || '' },
                        { key: 'Max Deposit Period', value: p.max_deposit_period || '' },
                    ],
                });
            } catch { /* param not available */ }

            // Distribution params
            try {
                const res = await axios.get(`${apiEndpoint}/cosmos/distribution/v1beta1/params`);
                const p = res.data.params;
                results.push({
                    title: 'Distribution',
                    params: [
                        { key: 'Community Tax', value: p.community_tax || '' },
                        { key: 'Base Proposer Reward', value: p.base_proposer_reward || '' },
                        { key: 'Bonus Proposer Reward', value: p.bonus_proposer_reward || '' },
                        { key: 'Withdraw Address Enabled', value: String(p.withdraw_addr_enabled ?? '') },
                    ],
                });
            } catch { /* param not available */ }

            // Mint params
            try {
                const res = await axios.get(`${apiEndpoint}/cosmos/mint/v1beta1/params`);
                const p = res.data.params;
                results.push({
                    title: 'Minting',
                    params: [
                        { key: 'Mint Denom', value: p.mint_denom || '' },
                        { key: 'Inflation Rate Change', value: p.inflation_rate_change || '' },
                        { key: 'Inflation Max', value: p.inflation_max || '' },
                        { key: 'Inflation Min', value: p.inflation_min || '' },
                        { key: 'Goal Bonded', value: p.goal_bonded || '' },
                        { key: 'Blocks Per Year', value: String(p.blocks_per_year || '') },
                    ],
                });
            } catch { /* param not available */ }

            setSections(results);
            setLoading(false);
        };

        fetchParams();
    }, []);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={2}>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={10}>
                    <Typography variant='h4' gutterBottom>Network Parameters</Typography>
                    {loading && <Typography>Loading parameters...</Typography>}
                    {sections.map((section, i) => (
                        <Card key={i} sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>{section.title}</Typography>
                                <Divider sx={{ mb: 1 }} />
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Parameter</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {section.params.map((param, j) => (
                                                <TableRow key={j}>
                                                    <TableCell>{param.key}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>{param.value}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    ))}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default NetworkParamsPage;
