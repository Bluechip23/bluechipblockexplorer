import * as React from 'react';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';


interface DisplayCoinsTableProps {
    denom: string;
    amountOwned: string;
    price: number;
    totalValue: number;

}
const DisplayCoinsRows: React.FC<DisplayCoinsTableProps> = (props) => {

    return (
        <TableRow>
            <TableCell >
                {props.denom}
            </TableCell>
            <TableCell  >
                {props.price}
            </TableCell>
            <TableCell  >
                {props.amountOwned}
            </TableCell>
            <TableCell  >
                {props.amountOwned}
            </TableCell>
        </TableRow>
    )
}

export default DisplayCoinsRows;