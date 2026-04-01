import React from 'react';
import NavMenuButton from './NavMenuButton';

const items = [
    { name: 'APIs', link: '/comingsoonpage' },
    { name: 'Smart Contract Explorer', link: '/contract-explorer' },
];

const DeveloperResourcesMenuButton: React.FC = () => (
    <NavMenuButton label="Developer Tools" items={items} />
);

export default DeveloperResourcesMenuButton;
