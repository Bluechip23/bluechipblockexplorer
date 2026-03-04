import React, { useEffect, useState } from 'react';
import { Layout } from '../ui';
import { Card, CardContent, Chip, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { apiEndpoint } from '../components/universal/IndividualPage.const';
import { truncateAddress, formatDenom } from '../utils/formatters';
import CopyToClipboard from '../components/universal/CopyToClipboard';
import axios from 'axios';

interface IbcChannel {
    channelId: string;
    portId: string;
    state: string;
    counterpartyChannelId: string;
    counterpartyPortId: string;
    connectionHops: string[];
}

interface IbcConnection {
    connectionId: string;
    clientId: string;
    state: string;
    counterpartyConnectionId: string;
    counterpartyClientId: string;
}

const IbcPage: React.FC = () => {
    const [channels, setChannels] = useState<IbcChannel[]>([]);
    const [connections, setConnections] = useState<IbcConnection[]>([]);
    const [channelPage, setChannelPage] = useState(0);
    const [channelRowsPerPage, setChannelRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchIbcData = async () => {
            try {
                // Fetch IBC channels
                const channelsRes = await axios.get(`${apiEndpoint}/ibc/core/channel/v1/channels`).catch(() => null);
                const channelsList = channelsRes?.data?.channels || [];
                const parsedChannels: IbcChannel[] = channelsList.map((ch: any) => ({
                    channelId: ch.channel_id || '',
                    portId: ch.port_id || '',
                    state: ch.state || '',
                    counterpartyChannelId: ch.counterparty?.channel_id || '',
                    counterpartyPortId: ch.counterparty?.port_id || '',
                    connectionHops: ch.connection_hops || [],
                }));
                setChannels(parsedChannels);

                // Fetch IBC connections
                const connectionsRes = await axios.get(`${apiEndpoint}/ibc/core/connection/v1/connections`).catch(() => null);
                const connectionsList = connectionsRes?.data?.connections || [];
                const parsedConnections: IbcConnection[] = connectionsList.map((conn: any) => ({
                    connectionId: conn.id || '',
                    clientId: conn.client_id || '',
                    state: conn.state || '',
                    counterpartyConnectionId: conn.counterparty?.connection_id || '',
                    counterpartyClientId: conn.counterparty?.client_id || '',
                }));
                setConnections(parsedConnections);
            } catch (error) {
                console.error('Error fetching IBC data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchIbcData();
    }, []);

    const stateColor = (state: string) => {
        if (state === 'STATE_OPEN' || state === 'OPEN') return 'success';
        if (state === 'STATE_TRYOPEN' || state === 'STATE_INIT') return 'warning';
        return 'default';
    };

    const stateLabel = (state: string) => {
        return state.replace('STATE_', '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    };

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
                    <Typography variant='h4' gutterBottom>IBC Overview</Typography>
                    {loading && <Typography>Loading IBC data...</Typography>}
                </Grid>

                {/* IBC Connections */}
                <Grid item xs={10}>
                    <Card>
                        <CardContent>
                            <Typography variant='h6' gutterBottom>
                                Connections <Chip label={connections.length} size="small" sx={{ ml: 1 }} />
                            </Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>Connection ID</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Client ID</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>State</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Counterparty Connection</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Counterparty Client</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {connections.map((conn, i) => (
                                            <TableRow key={i}>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{conn.connectionId}</TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{conn.clientId}</TableCell>
                                                <TableCell>
                                                    <Chip label={stateLabel(conn.state)} size="small" color={stateColor(conn.state) as any} />
                                                </TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{conn.counterpartyConnectionId || '-'}</TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{conn.counterpartyClientId || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {connections.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center">No IBC connections found</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* IBC Channels */}
                <Grid item xs={10}>
                    <Card>
                        <CardContent>
                            <Typography variant='h6' gutterBottom>
                                Channels <Chip label={channels.length} size="small" sx={{ ml: 1 }} />
                            </Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>Channel ID</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Port</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>State</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Counterparty Channel</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Counterparty Port</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Connection</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {channels
                                            .slice(channelPage * channelRowsPerPage, channelPage * channelRowsPerPage + channelRowsPerPage)
                                            .map((ch, i) => (
                                                <TableRow key={i}>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>{ch.channelId}</TableCell>
                                                    <TableCell>{ch.portId}</TableCell>
                                                    <TableCell>
                                                        <Chip label={stateLabel(ch.state)} size="small" color={stateColor(ch.state) as any} />
                                                    </TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>{ch.counterpartyChannelId || '-'}</TableCell>
                                                    <TableCell>{ch.counterpartyPortId || '-'}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace' }}>{ch.connectionHops?.[0] || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                        {channels.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center">No IBC channels found</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {channels.length > 0 && (
                                <TablePagination
                                    rowsPerPageOptions={[10, 25, 50]}
                                    component="div"
                                    count={channels.length}
                                    rowsPerPage={channelRowsPerPage}
                                    page={channelPage}
                                    onPageChange={(_, p) => setChannelPage(p)}
                                    onRowsPerPageChange={(e) => { setChannelRowsPerPage(+e.target.value); setChannelPage(0); }}
                                />
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default IbcPage;
