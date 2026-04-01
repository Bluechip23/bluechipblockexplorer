import React from 'react';
import NavMenuButton from './NavMenuButton';

const items = [
    { name: 'Top Validators', link: '/topvalidators' },
    { name: 'Staking', link: '/staking' },
    { name: 'Governance', link: '/governance' },
];

const ValidatorsMenuButton: React.FC = () => (
    <NavMenuButton label="Validators" items={items} />
);

export default ValidatorsMenuButton;
