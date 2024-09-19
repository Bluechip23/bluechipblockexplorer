import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { rpcEndpoint } from '../universal/IndividualPage.const';
import { useEffect, useState } from 'react';

interface Column {
    id: 'block' | 'age' | 'txn' | 'feeRecipient' | 'gasUsed' | 'reward';
    label: string;
    minWidth?: number;
    align?: 'right';
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'block', label: 'Block', },
    { id: 'age', label: 'Age', },
    {
        id: 'txn',
        label: 'Transactions',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'feeRecipient',
        label: 'Fee Recipient',
    },
    {
        id: 'gasUsed',
        label: 'Gas',
        format: (value: number) => value.toFixed(2),
    },
    {
        id: 'reward',
        label: 'Reward',
        format: (value: number) => value.toFixed(2),
    },
];

interface RecentBlocksTableProps {
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
    const [rows, setRows] = useState<RecentBlocksTableProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [latestBlock, setLatestBlock] = useState(0);

    const fetchLatestBlock = async () => {
        try {
            const response = await axios.get(`${rpcEndpoint}/status`);
            const latestHeight = response.data.result.sync_info.latest_block_height;
            setLatestBlock(latestHeight);
        } catch (error) {
            console.error('Error fetching latest block:', error);
        }
    };

    const loadBlocks = async () => {
        if (latestBlock === 0) return; // Only load when latestBlock is fetched

        try {
            const response = await axios.get(`${rpcEndpoint}/blockchain?minHeight=1&maxHeight=${latestBlock}`);
            const blocks = response.data.result.block_metas;

            const blockRows = blocks.map((block: any) => ({
                block: block.header.height,
                age: block.header.time,
                txn: block.header.num_txs,
                feeRecipient: block.block_id.hash, 
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

    useEffect(() => {
        fetchLatestBlock();
    }, []); 

    useEffect(() => {
        if (latestBlock > 0) {
            loadBlocks();
        }
    }, [latestBlock]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    if (loading) {
        return <Typography variant="h6">Loading...</Typography>;
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
                <Typography variant='h5'>Recent Blocks</Typography>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id}>
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => (
                                <TableRow key={row.block}>
                                    <TableCell>
                                        <Link to={`/blockpage/${row.block}`}>{row.block}</Link>
                                    </TableCell>
                                    <TableCell>{row.age}</TableCell>
                                    <TableCell>{row.txn}</TableCell>
                                    <TableCell><Link to=''>{row.feeRecipient}</Link></TableCell>
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
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </Paper>
    );
};

export default RecentBlocksTable;
