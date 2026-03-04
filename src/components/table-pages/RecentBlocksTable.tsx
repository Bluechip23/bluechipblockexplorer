import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Button, Stack, Tooltip, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { rpcEndpoint } from '../universal/IndividualPage.const';
import { timeAgo, truncateAddress, exportToCsv } from '../../utils/formatters';
import CopyToClipboard from '../universal/CopyToClipboard';
import { useEffect, useState } from 'react';
import DownloadIcon from '@mui/icons-material/Download';

interface Column {
    id: 'block' | 'age' | 'txn' | 'feeRecipient' | 'gasUsed' | 'reward';
    label: string;
}

const columns: readonly Column[] = [
    { id: 'block', label: 'Block' },
    { id: 'age', label: 'Age' },
    { id: 'txn', label: 'Txns' },
    { id: 'feeRecipient', label: 'Proposer' },
    { id: 'gasUsed', label: 'Gas' },
    { id: 'reward', label: 'Reward' },
];

interface RecentBlocksRow {
    block: string;
    age: string;
    txn: number;
    feeRecipient: string;
    gasUsed: number;
    reward: number;
}

const RecentBlocksTable: React.FC = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [rows, setRows] = useState<RecentBlocksRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [latestBlock, setLatestBlock] = useState(0);

    const fetchLatestBlock = async () => {
        try {
            const rpc = await axios.get(`${rpcEndpoint}/status`);
            const latestHeight = rpc.data.result.sync_info.latest_block_height;
            setLatestBlock(latestHeight);
        } catch (error) {
            console.error('Error fetching latest block:', error);
        }
    };

    const loadBlocks = async () => {
        if (latestBlock === 0) return;
        try {
            const response = await axios.get(`${rpcEndpoint}/blockchain?minHeight=1&maxHeight=${latestBlock}`);
            const blocks = response.data.result.block_metas;
            const blockRows = blocks.map((block: any) => ({
                block: block.header.height,
                age: block.header.time,
                txn: block.header.num_txs || 0,
                feeRecipient: block.header.proposer_address || block.block_id?.hash || '',
                gasUsed: block.header.gas_used || 0,
                reward: block.header.total_reward || 0,
            }));
            setRows(blockRows);
        } catch (error) {
            console.error('Error loading blocks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLatestBlock(); }, []);
    useEffect(() => { if (latestBlock > 0) loadBlocks(); }, [latestBlock]);

    const handleExportCsv = () => {
        const headers = ['Block', 'Time', 'Txns', 'Proposer', 'Gas', 'Reward'];
        const csvRows = rows.map(r => [r.block, r.age, String(r.txn), r.feeRecipient, String(r.gasUsed), String(r.reward)]);
        exportToCsv('recent_blocks.csv', headers, csvRows);
    };

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant='h5'>Recent Blocks</Typography>
                    <Tooltip title="Export to CSV">
                        <Button size="small" startIcon={<DownloadIcon />} onClick={handleExportCsv}>CSV</Button>
                    </Tooltip>
                </Stack>
                <Table stickyHeader aria-label="recent blocks table" size="small">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id} sx={{ fontWeight: 600 }}>
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => (
                                <TableRow key={row.block} hover>
                                    <TableCell>
                                        <Link to={`/blockpage/${row.block}`}>{row.block}</Link>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={new Date(row.age).toLocaleString()}>
                                            <span>{timeAgo(row.age)}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>{row.txn}</TableCell>
                                    <TableCell>
                                        <Tooltip title={row.feeRecipient}>
                                            <span>{truncateAddress(row.feeRecipient, 8, 6)}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>{row.gasUsed}</TableCell>
                                    <TableCell>{row.reward}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[10, 25, 100]}
                component="div"
                count={rows.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
            />
        </Paper>
    );
};

export default RecentBlocksTable;
