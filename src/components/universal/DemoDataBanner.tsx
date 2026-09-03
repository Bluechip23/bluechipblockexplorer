import React, { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { getDataSource } from '../../utils/contractQueries';

/**
 * Site-wide warning shown whenever the session is serving built-in demo
 * data instead of live chain state. The fallback itself is silent (one
 * console.warn), so without this banner a failed RPC probe makes the app
 * quietly show a completely different set of pools — which reads as the
 * explorer "jumping between two sets of pools" across reloads.
 */
const DemoDataBanner: React.FC = () => {
    const [demo, setDemo] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getDataSource()
            .then((src) => { if (!cancelled) setDemo(src === 'mock'); })
            .catch(() => { /* leave hidden */ });
        return () => { cancelled = true; };
    }, []);

    if (!demo) return null;
    return (
        <Alert severity="warning" sx={{ mb: 1 }}>
            Showing built-in demo data — the chain RPC was unreachable when this
            session started (or demo mode is enabled). Pools, balances, and
            search results are not live. Reload to retry the connection.
        </Alert>
    );
};

export default DemoDataBanner;
