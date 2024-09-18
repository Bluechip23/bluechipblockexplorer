import { TableCell, TableHead, TableRow } from '@mui/material';
import React from 'react'

interface Column {
    id: 'token' | 'price' | 'amount' | 'totalValue';
    label: string;
    minWidth?: number;
}

const columns: readonly Column[] = [
    { id: 'token', label: 'Creator', minWidth: 170 },
    { id: 'price', label: 'Price', minWidth: 100 },
    {
        id: 'amount',
        label: 'Amount',
        minWidth: 170,
    },
      {
        id: 'totalValue',
        label: 'Total Value',
        minWidth: 170,
    },

];

const DisplayCoinsTableHeader: React.FC = () => {

    return (
        <TableHead>
            <TableRow>
                {columns.map((column) => (
                    <TableCell
                        key={column.id}
                        style={{ minWidth: column.minWidth }}
                    >
                        {column.label}
                    </TableCell>
                ))}
            </TableRow>
        </TableHead>
    )
}

export default DisplayCoinsTableHeader;
