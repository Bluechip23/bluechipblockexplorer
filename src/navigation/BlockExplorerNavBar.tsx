import React from 'react';
import { Stack, } from '@mui/material';
import BlockChainMenuButton from '../components/navbaroptions/BlockChainButton';
import TokensMenuButton from '../components/navbaroptions/TokensMenuButton';
import PoolsMenuButton from '../components/navbaroptions/PoolsMenuButton';
import DeveloperResourcesMenuButton from '../components/navbaroptions/DeveloperResourcesMenuButton';
import ValidatorsMenuButton from '../components/navbaroptions/ValidatorsMenuButton';

const BlockExplorerNavBar: React.FC = () => {
    return (
            <Stack direction="row" spacing={1}>
                <BlockChainMenuButton />
                <TokensMenuButton/>
                <PoolsMenuButton/>
                <DeveloperResourcesMenuButton/>
                <ValidatorsMenuButton/>
            </Stack>
    );
};

export default BlockExplorerNavBar;
