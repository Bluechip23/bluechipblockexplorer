import React from 'react';
import NavMenuButton from './NavMenuButton';

const items = [
    { name: 'Top Tokens', link: '/toptokens' },
    { name: 'The blue chip', link: '/bluechiptransactions' },
];

const TokensMenuButton: React.FC = () => (
    <NavMenuButton label="Tokens" items={items} />
);

export default TokensMenuButton;
