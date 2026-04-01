import { Chip, Grid, Stack } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import GeneralStats from '../navigation/GeneralStats';
import RecentBlocksTable from '../components/table-pages/RecentBlocksTable';
import RecentTransactionsTable from '../components/table-pages/RecentTransactionsTable';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import { rpcEndpoint } from '../components/universal/IndividualPage.const';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const FrontPage: React.FC = () => {
    const [wsConnected, setWsConnected] = useState(false);
    const [latestBlockWs, setLatestBlockWs] = useState<string | null>(null);

    useEffect(() => {
        const wsUrl = rpcEndpoint.replace('https://', 'wss://').replace('http://', 'ws://') + '/websocket';
        let ws: WebSocket | null = null;

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setWsConnected(true);
                ws?.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'subscribe',
                    id: '1',
                    params: { query: "tm.event='NewBlock'" }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const height = data?.result?.data?.value?.block?.header?.height;
                    if (height) {
                        setLatestBlockWs(height);
                    }
                } catch {
                    // ignore parse errors
                }
            };

            ws.onclose = () => setWsConnected(false);
            ws.onerror = () => setWsConnected(false);
        } catch {}

        return () => {
            ws?.close();
        };
    }, []);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} >
            <Stack direction='row' alignItems='center' justifyContent='space-between'>
                <BlockExplorerNavBar />
                <Chip
                    icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
                    label={wsConnected ? `Live${latestBlockWs ? ` #${latestBlockWs}` : ''}` : 'Connecting...'}
                    color={wsConnected ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                />
            </Stack>
            <Grid container alignItems='center' justifyContent='center' spacing={2}>
                <Grid item xs={12} md={10}>
                    <GeneralStats />
                </Grid>
                <Grid item xs={12} md={6}>
                    <RecentBlocksTable />
                </Grid>
                <Grid item xs={12} md={6}>
                    <RecentTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default FrontPage;