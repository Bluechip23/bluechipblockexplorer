import React, { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { queryBluechipOraclePrice } from '../../utils/contractQueries';

// Pool-side commit gate: commits are rejected with InvalidOraclePrice
// once the factory oracle reading is older than this
// (MAX_ORACLE_STALENESS_SECONDS in creator-pool/src/swap_helper.rs).
const ORACLE_STALE_SECONDS = 120;
// Show a heads-up before the hard gate trips (oracle keeper updates
// land roughly every 60s, so >90s means an update is overdue).
const ORACLE_WARN_SECONDS = 90;

// Surfaces factory-oracle freshness wherever a commit can be signed, so
// users see "the oracle is stale, wait a moment" instead of a cryptic
// on-chain rejection. Renders nothing while the oracle is healthy.
const OracleStatusBanner: React.FC = () => {
    const [ageSec, setAgeSec] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function probe() {
            const info = await queryBluechipOraclePrice();
            if (cancelled || !info) return;
            setAgeSec(Math.max(0, Math.floor(Date.now() / 1000) - info.timestamp));
        }
        probe();
        const interval = setInterval(probe, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    if (ageSec === null || ageSec <= ORACLE_WARN_SECONDS) return null;

    if (ageSec > ORACLE_STALE_SECONDS) {
        return (
            <Alert severity="error" sx={{ mb: 1 }}>
                The bluechip/USD price oracle was last updated {ageSec} seconds ago. Commits are
                rejected on-chain once the reading is older than {ORACLE_STALE_SECONDS}s — wait for
                the next oracle update (usually under a minute) and try again.
            </Alert>
        );
    }
    return (
        <Alert severity="warning" sx={{ mb: 1 }}>
            The price oracle reading is {ageSec} seconds old and an update is due. If your commit is
            rejected with an oracle error, retry after the next update lands.
        </Alert>
    );
};

export default OracleStatusBanner;
