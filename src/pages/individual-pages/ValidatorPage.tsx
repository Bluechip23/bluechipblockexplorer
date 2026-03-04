import React, { useEffect, useState } from 'react'
import { Avatar, Card, CardContent, CardHeader, Chip, Divider, Grid, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Layout } from '../../ui';
import { Link, useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import { apiEndpoint } from '../../components/universal/IndividualPage.const';
import { formatTokenAmount, truncateAddress } from '../../utils/formatters';
import CopyToClipboard from '../../components/universal/CopyToClipboard';
import axios from 'axios';

interface ValidatorData {
    operatorAddress: string;
    accountAddress: string;
    moniker: string;
    description: string;
    website: string;
    securityContact: string;
    commission: string;
    maxCommission: string;
    maxChangeRate: string;
    minSelfDelegation: string;
    tokens: string;
    status: string;
    jailed: boolean;
    unbondingHeight: string;
    unbondingTime: string;
}

interface DelegatorInfo {
    delegatorAddress: string;
    shares: string;
    amount: string;
}

const Validator: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [validator, setValidator] = useState<ValidatorData | null>(null);
    const [delegators, setDelegators] = useState<DelegatorInfo[]>([]);
    const [uptime, setUptime] = useState<number>(100);
    const [missedBlocks, setMissedBlocks] = useState<number>(0);
    const [delPage, setDelPage] = useState(0);
    const [delRowsPerPage, setDelRowsPerPage] = useState(10);

    useEffect(() => {
        const fetchValidatorDetails = async () => {
            try {
                const response = await axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/validators/${id}`);
                const v = response.data.validator;
                setValidator({
                    operatorAddress: v.operator_address || '',
                    accountAddress: v.delegator_address || '',
                    moniker: v.description?.moniker || '',
                    description: v.description?.details || '',
                    website: v.description?.website || '',
                    securityContact: v.description?.security_contact || '',
                    commission: v.commission?.commission_rates?.rate || '0',
                    maxCommission: v.commission?.commission_rates?.max_rate || '0',
                    maxChangeRate: v.commission?.commission_rates?.max_change_rate || '0',
                    minSelfDelegation: v.min_self_delegation || '0',
                    tokens: v.tokens || '0',
                    status: v.status || '',
                    jailed: v.jailed || false,
                    unbondingHeight: v.unbonding_height || '0',
                    unbondingTime: v.unbonding_time || '',
                });
            } catch (error) {
                console.error("Failed to fetch validator:", error);
            }
        };

        const fetchDelegators = async () => {
            try {
                const response = await axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/validators/${id}/delegations`);
                const delegationsList = response.data.delegation_responses || [];
                const parsed: DelegatorInfo[] = delegationsList.map((d: any) => ({
                    delegatorAddress: d.delegation?.delegator_address || '',
                    shares: d.delegation?.shares || '0',
                    amount: d.balance?.amount || '0',
                }));
                setDelegators(parsed);
            } catch (error) {
                console.error("Failed to fetch delegators:", error);
            }
        };

        const fetchSigningInfo = async () => {
            try {
                const response = await axios.get(`${apiEndpoint}/cosmos/slashing/v1beta1/signing_infos`);
                const infos = response.data.info || [];
                const info = infos.find((i: any) => i.address === id);
                if (info) {
                    const missed = Number(info.missed_blocks_counter || 0);
                    setMissedBlocks(missed);
                    const window = 10000;
                    setUptime(Math.max(0, ((window - missed) / window) * 100));
                }
            } catch (error) {
                console.error("Failed to fetch signing info:", error);
            }
        };

        if (id) {
            fetchValidatorDetails();
            fetchDelegators();
            fetchSigningInfo();
        }
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Validator Not Found</Typography></Layout>;
    }

    const statusLabel = validator?.status === 'BOND_STATUS_BONDED' ? 'Active' :
                        validator?.status === 'BOND_STATUS_UNBONDING' ? 'Unbonding' :
                        validator?.status === 'BOND_STATUS_UNBONDED' ? 'Unbonded' : validator?.status || 'Loading...';

    const statusColor = validator?.status === 'BOND_STATUS_BONDED' ? 'success' :
                        validator?.status === 'BOND_STATUS_UNBONDING' ? 'warning' : 'default';

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={2} justifyContent='center' alignItems='center'>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                {/* Validator Header */}
                <Grid item xs={10}>
                    <Card>
                        <CardHeader
                            avatar={
                                <Avatar sx={{ height: '64px', width: '64px', bgcolor: 'primary.main' }}>
                                    {validator?.moniker?.charAt(0)?.toUpperCase() || '?'}
                                </Avatar>
                            }
                            title={
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="h5">{validator?.moniker || id}</Typography>
                                    <Chip label={statusLabel} size="small" color={statusColor as any} />
                                    {validator?.jailed && <Chip label="Jailed" size="small" color="error" />}
                                </Stack>
                            }
                            subheader={validator?.description || 'No description provided'}
                        />
                        <CardContent>
                            <Divider sx={{ mb: 2 }} />

                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>Operator Address:</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{validator?.operatorAddress || id}</Typography>
                                <CopyToClipboard text={validator?.operatorAddress || id} />
                            </Stack>

                            {validator?.website && (
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>Website:</Typography>
                                    <Typography variant="body2">
                                        <a href={validator.website} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2' }}>
                                            {validator.website}
                                        </a>
                                    </Typography>
                                </Stack>
                            )}

                            {validator?.securityContact && (
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>Security Contact:</Typography>
                                    <Typography variant="body2">{validator.securityContact}</Typography>
                                </Stack>
                            )}

                            <Divider sx={{ my: 2 }} />

                            <Stack direction="row" spacing={4} flexWrap="wrap">
                                <Stack>
                                    <Typography variant="body2" color="text.secondary">Total Staked</Typography>
                                    <Typography variant="h6">{formatTokenAmount(validator?.tokens || '0')} BCP</Typography>
                                </Stack>
                                <Stack>
                                    <Typography variant="body2" color="text.secondary">Commission</Typography>
                                    <Typography variant="h6">{(Number(validator?.commission || 0) * 100).toFixed(2)}%</Typography>
                                </Stack>
                                <Stack>
                                    <Typography variant="body2" color="text.secondary">Max Commission</Typography>
                                    <Typography variant="h6">{(Number(validator?.maxCommission || 0) * 100).toFixed(2)}%</Typography>
                                </Stack>
                                <Stack>
                                    <Typography variant="body2" color="text.secondary">Max Change Rate</Typography>
                                    <Typography variant="h6">{(Number(validator?.maxChangeRate || 0) * 100).toFixed(2)}%</Typography>
                                </Stack>
                                <Stack>
                                    <Typography variant="body2" color="text.secondary">Min Self Delegation</Typography>
                                    <Typography variant="h6">{formatTokenAmount(validator?.minSelfDelegation || '0')}</Typography>
                                </Stack>
                            </Stack>

                            <Divider sx={{ my: 2 }} />

                            <Stack spacing={1}>
                                <Typography variant="body2" color="text.secondary">
                                    Uptime: {uptime.toFixed(2)}% (Missed: {missedBlocks} blocks)
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={uptime}
                                    color={uptime > 95 ? 'success' : uptime > 80 ? 'warning' : 'error'}
                                    sx={{ height: 8, borderRadius: 4 }}
                                />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Delegators */}
                {delegators.length > 0 && (
                    <Grid item xs={10}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>
                                    Delegators <Chip label={delegators.length} size="small" sx={{ ml: 1 }} />
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Delegator Address</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Amount (BCP)</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {delegators
                                                .slice(delPage * delRowsPerPage, delPage * delRowsPerPage + delRowsPerPage)
                                                .map((del, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>
                                                            <Link to={`/wallet/${del.delegatorAddress}`} style={{ color: '#1976d2', fontFamily: 'monospace' }}>
                                                                {truncateAddress(del.delegatorAddress, 12, 8)}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>{formatTokenAmount(del.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination
                                    rowsPerPageOptions={[10, 25, 50]}
                                    component="div"
                                    count={delegators.length}
                                    rowsPerPage={delRowsPerPage}
                                    page={delPage}
                                    onPageChange={(_, p) => setDelPage(p)}
                                    onRowsPerPageChange={(e) => { setDelRowsPerPage(+e.target.value); setDelPage(0); }}
                                />
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Layout>
    )
}
export default Validator;
