function envInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) throw new Error(`${name} must be an integer, got "${raw}"`);
    return n;
}

export interface Config {
    rpcUrl: string;
    apiPort: number;
    dbPath: string;
    startHeight: number;
    nativeDenom: string;
    pollIntervalMs: number;
    batchSize: number;
    // When set, only wasm events from this factory register new pools.
    // Pool-level events are always accepted for pools already discovered
    // (or for any contract when no factory filter is configured).
    factoryAddress: string | null;
}

export function loadConfig(): Config {
    return {
        rpcUrl: (process.env.RPC_URL || 'http://localhost:26657').replace(/\/+$/, ''),
        apiPort: envInt('API_PORT', 4316),
        dbPath: process.env.DB_PATH || './bluechip-indexer.db',
        startHeight: envInt('START_HEIGHT', 1),
        nativeDenom: process.env.NATIVE_DENOM || 'ubluechip',
        pollIntervalMs: envInt('POLL_INTERVAL_MS', 1500),
        batchSize: envInt('BATCH_SIZE', 20),
        factoryAddress: process.env.FACTORY_ADDRESS || null,
    };
}
