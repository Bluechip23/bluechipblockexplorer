import React from 'react';
import NavMenuButton from './NavMenuButton';

const items = [
    { name: 'Top Creator Pools', link: '/topcreatorpools' },
    { name: 'Creator Contracts', link: '/topcreatorcontracts' },
];

const PoolsMenuButton: React.FC = () => (
    <NavMenuButton label="Pools" items={items} />
);

export default PoolsMenuButton;
