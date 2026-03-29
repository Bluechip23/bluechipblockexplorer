// ============================================================
// MOCK MODE — All queries return fake data for UI preview.
// No chain connection required.
// ============================================================

const MOCK_WALLET = 'bluechip1q2w3e4r5t6y7u8i9o0pzxcvbnmasdfghjkl42';

// ------------------------------------------------------------------
// Types (unchanged — same interfaces as production)
// ------------------------------------------------------------------

export interface PoolStateResponseForFactory {
    pool_contract_address: string;
    nft_ownership_accepted: boolean;
    reserve0: string;
    reserve1: string;
    total_liquidity: string;
    block_time_last: number;
    price0_cumulative_last: string;
    price1_cumulative_last: string;
    assets: string[];
}

export interface AllPoolsResponse {
    pools: [string, PoolStateResponseForFactory][];
}

export interface TokenType {
    creator_token?: { contract_addr: string };
    bluechip?: { denom: string };
}

export interface PoolPairInfo {
    asset_infos: [TokenType, TokenType];
    contract_addr: string;
    pool_type: { xyk: Record<string, never> } | { stable: Record<string, never> };
}

export interface PoolStateResponse {
    nft_ownership_accepted: boolean;
    reserve0: string;
    reserve1: string;
    total_liquidity: string;
    block_time_last: number;
}

export interface PoolFeeStateResponse {
    fee_growth_global_0: string;
    fee_growth_global_1: string;
    total_fees_collected_0: string;
    total_fees_collected_1: string;
}

export interface PoolInfoResponse {
    pool_state: PoolStateResponse;
    fee_state: PoolFeeStateResponse;
    total_positions: number;
}

export interface CommitStatus {
    in_progress?: { raised: string; target: string };
    fully_committed?: Record<string, never>;
}

export interface CommiterInfo {
    wallet: string;
    last_payment_bluechip: string;
    last_payment_usd: string;
    last_commited: string;
    total_paid_usd: string;
    total_paid_bluechip: string;
}

export interface PoolCommitResponse {
    total_count: number;
    commiters: CommiterInfo[];
}

export interface CW20TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
}

export interface FactoryConfig {
    factory_admin_address: string;
    commit_amount_for_threshold_bluechip: string;
    commit_threshold_limit_usd: string;
    cw20_token_contract_id: number;
    cw721_nft_contract_id: number;
    create_pool_wasm_contract_id: number;
    bluechip_wallet_address: string;
    commit_fee_bluechip: string;
    commit_fee_creator: string;
    max_bluechip_lock_per_pool: string;
    [key: string]: unknown;
}

export interface FactoryInstantiateResponse {
    factory: FactoryConfig;
}

export interface PositionResponse {
    position_id: string;
    liquidity: string;
    owner: string;
    fee_growth_inside_0_last: string;
    fee_growth_inside_1_last: string;
    created_at: number;
    last_fee_collection: number;
    unclaimed_fees_0: string;
    unclaimed_fees_1: string;
}

export interface PositionsResponse {
    positions: PositionResponse[];
}

export interface PoolCreatorConfig {
    creator_wallet_address: string;
    bluechip_wallet_address?: string;
    commit_fee_bluechip?: string;
    commit_fee_creator?: string;
}

export interface PoolSummary {
    poolAddress: string;
    creatorTokenAddress: string | null;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimals: number;
    totalSupply: string;
    reserve0: string;
    reserve1: string;
    totalLiquidity: string;
    totalFeesCollected0: string;
    totalFeesCollected1: string;
    totalPositions: number;
    thresholdReached: boolean;
    raised: string;
    target: string;
    totalCommitters: number;
    blockTimeLast: number;
}

// ------------------------------------------------------------------
// Mock data
// ------------------------------------------------------------------

const now = Date.now();
const day = 86400000;

const MOCK_COMMITTERS: CommiterInfo[] = [
    // ── Active within last 1 month (3 wallets) ──
    {
        wallet: MOCK_WALLET,
        total_paid_usd: '5200000000',
        total_paid_bluechip: '41600000000',
        last_payment_usd: '1200000000',
        last_payment_bluechip: '9600000000',
        last_commited: ((now - 2 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1whale8k3jx9f7tn2m4qp6rz0sdvwcyahg5e72n',
        total_paid_usd: '8400000000',
        total_paid_bluechip: '67200000000',
        last_payment_usd: '3000000000',
        last_payment_bluechip: '24000000000',
        last_commited: ((now - 1 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1early4m2n7xp8wk5dv3qt6rj0yfscalh9zu8e3',
        total_paid_usd: '3100000000',
        total_paid_bluechip: '24800000000',
        last_payment_usd: '800000000',
        last_payment_bluechip: '6400000000',
        last_commited: ((now - 18 * day) * 1000000).toString(),
    },
    // ── Active between 1–3 months ago (3 wallets) ──
    {
        wallet: 'bluechip1degen9p4r6t2n7xm3k5wqv8jf0ychlsab2ue6',
        total_paid_usd: '2750000000',
        total_paid_bluechip: '22000000000',
        last_payment_usd: '2750000000',
        last_payment_bluechip: '22000000000',
        last_commited: ((now - 45 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1saver2k8f5n3m7wp4xr6qt9jv0ydclhgab1u3e',
        total_paid_usd: '1500000000',
        total_paid_bluechip: '12000000000',
        last_payment_usd: '500000000',
        last_payment_bluechip: '4000000000',
        last_commited: ((now - 60 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1hodl6n3m8k2f5wp4xr7qt0jv9ydclhsab3ue2',
        total_paid_usd: '950000000',
        total_paid_bluechip: '7600000000',
        last_payment_usd: '950000000',
        last_payment_bluechip: '7600000000',
        last_commited: ((now - 75 * day) * 1000000).toString(),
    },
    // ── Active between 3–12 months ago (2 wallets) ──
    {
        wallet: 'bluechip1moon5r7t2n8xm3k4wqp6jf9v0ychlsab2dge1',
        total_paid_usd: '680000000',
        total_paid_bluechip: '5440000000',
        last_payment_usd: '680000000',
        last_payment_bluechip: '5440000000',
        last_commited: ((now - 150 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1tiny3m7k2f8n5wp4xr6qt0jv9ydclhsab1ue4',
        total_paid_usd: '250000000',
        total_paid_bluechip: '2000000000',
        last_payment_usd: '250000000',
        last_payment_bluechip: '2000000000',
        last_commited: ((now - 300 * day) * 1000000).toString(),
    },
];

const MOCK_POOLS: PoolSummary[] = [
    {
        poolAddress: 'bluechip1pool_alpha_7k3jx9f7tn2m4qp6rz0sdvwcy5e72',
        creatorTokenAddress: 'bluechip1token_alpha_cw20_contract_addr_placeholder',
        tokenName: 'Alpha Creator Token',
        tokenSymbol: 'ALPHA',
        tokenDecimals: 6,
        totalSupply: '1000000000000',
        reserve0: '425000000000',
        reserve1: '850000000000',
        totalLiquidity: '600000000000',
        totalFeesCollected0: '12500000000',
        totalFeesCollected1: '8200000000',
        totalPositions: 14,
        thresholdReached: true,
        raised: '25000000000',
        target: '25000000000',
        totalCommitters: 8,
        blockTimeLast: Math.floor(now / 1000) - 86400 * 45,
    },
    {
        poolAddress: 'bluechip1pool_beta_4m2n7xp8wk5dv3qt6rj0yfscalh9z',
        creatorTokenAddress: 'bluechip1token_beta_cw20_contract_addr_placeholder',
        tokenName: 'Beta Stream',
        tokenSymbol: 'BETA',
        tokenDecimals: 6,
        totalSupply: '500000000000',
        reserve0: '180000000000',
        reserve1: '290000000000',
        totalLiquidity: '230000000000',
        totalFeesCollected0: '4100000000',
        totalFeesCollected1: '2800000000',
        totalPositions: 7,
        thresholdReached: true,
        raised: '25000000000',
        target: '25000000000',
        totalCommitters: 12,
        blockTimeLast: Math.floor(now / 1000) - 86400 * 30,
    },
    {
        poolAddress: 'bluechip1pool_gamma_9p4r6t2n7xm3k5wqv8jf0ychlsa',
        creatorTokenAddress: 'bluechip1token_gamma_cw20_contract_addr_placeholder',
        tokenName: 'Gamma Gaming',
        tokenSymbol: 'GAMMA',
        tokenDecimals: 6,
        totalSupply: '2000000000000',
        reserve0: '95000000000',
        reserve1: '620000000000',
        totalLiquidity: '150000000000',
        totalFeesCollected0: '1800000000',
        totalFeesCollected1: '3500000000',
        totalPositions: 4,
        thresholdReached: true,
        raised: '25000000000',
        target: '25000000000',
        totalCommitters: 6,
        blockTimeLast: Math.floor(now / 1000) - 86400 * 60,
    },
    {
        poolAddress: 'bluechip1pool_delta_2k8f5n3m7wp4xr6qt9jv0ydclhga',
        creatorTokenAddress: 'bluechip1token_delta_cw20_contract_addr_placeholder',
        tokenName: 'Delta Music',
        tokenSymbol: 'DELTA',
        tokenDecimals: 6,
        totalSupply: '750000000000',
        reserve0: '0',
        reserve1: '0',
        totalLiquidity: '0',
        totalFeesCollected0: '0',
        totalFeesCollected1: '0',
        totalPositions: 0,
        thresholdReached: false,
        raised: '16800000000',
        target: '25000000000',
        totalCommitters: 5,
        blockTimeLast: 0,
    },
    {
        poolAddress: 'bluechip1pool_epsilon_6n3m8k2f5wp4xr7qt0jv9ydclhs',
        creatorTokenAddress: 'bluechip1token_epsilon_cw20_contract_addr_placeholder',
        tokenName: 'Epsilon Art',
        tokenSymbol: 'EPS',
        tokenDecimals: 6,
        totalSupply: '300000000000',
        reserve0: '0',
        reserve1: '0',
        totalLiquidity: '0',
        totalFeesCollected0: '0',
        totalFeesCollected1: '0',
        totalPositions: 0,
        thresholdReached: false,
        raised: '3200000000',
        target: '25000000000',
        totalCommitters: 3,
        blockTimeLast: 0,
    },
];

const MOCK_POSITIONS: PositionResponse[] = [
    {
        position_id: '1',
        liquidity: '45000000000',
        owner: MOCK_WALLET,
        fee_growth_inside_0_last: '100000',
        fee_growth_inside_1_last: '80000',
        created_at: (now - 30 * day) * 1000000,
        last_fee_collection: (now - 5 * day) * 1000000,
        unclaimed_fees_0: '320000000',
        unclaimed_fees_1: '210000000',
    },
    {
        position_id: '2',
        liquidity: '18000000000',
        owner: MOCK_WALLET,
        fee_growth_inside_0_last: '50000',
        fee_growth_inside_1_last: '40000',
        created_at: (now - 15 * day) * 1000000,
        last_fee_collection: (now - 2 * day) * 1000000,
        unclaimed_fees_0: '95000000',
        unclaimed_fees_1: '72000000',
    },
    {
        position_id: '3',
        liquidity: '72000000000',
        owner: 'bluechip1whale8k3jx9f7tn2m4qp6rz0sdvwcyahg5e72n',
        fee_growth_inside_0_last: '200000',
        fee_growth_inside_1_last: '160000',
        created_at: (now - 40 * day) * 1000000,
        last_fee_collection: (now - 1 * day) * 1000000,
        unclaimed_fees_0: '580000000',
        unclaimed_fees_1: '420000000',
    },
];

// Committers for the pre-launch pool (DELTA)
const MOCK_DELTA_COMMITTERS: CommiterInfo[] = [
    // ── Active within last 1 month (2 wallets) ──
    {
        wallet: MOCK_WALLET,
        total_paid_usd: '4200000000',
        total_paid_bluechip: '33600000000',
        last_payment_usd: '1500000000',
        last_payment_bluechip: '12000000000',
        last_commited: ((now - 3 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1whale8k3jx9f7tn2m4qp6rz0sdvwcyahg5e72n',
        total_paid_usd: '6500000000',
        total_paid_bluechip: '52000000000',
        last_payment_usd: '2000000000',
        last_payment_bluechip: '16000000000',
        last_commited: ((now - 1 * day) * 1000000).toString(),
    },
    // ── Active between 1–3 months ago (2 wallets) ──
    {
        wallet: 'bluechip1early4m2n7xp8wk5dv3qt6rj0yfscalh9zu8e3',
        total_paid_usd: '3500000000',
        total_paid_bluechip: '28000000000',
        last_payment_usd: '3500000000',
        last_payment_bluechip: '28000000000',
        last_commited: ((now - 40 * day) * 1000000).toString(),
    },
    {
        wallet: 'bluechip1degen9p4r6t2n7xm3k5wqv8jf0ychlsab2ue6',
        total_paid_usd: '1800000000',
        total_paid_bluechip: '14400000000',
        last_payment_usd: '1800000000',
        last_payment_bluechip: '14400000000',
        last_commited: ((now - 55 * day) * 1000000).toString(),
    },
    // ── Active between 3–12 months ago (1 wallet) ──
    {
        wallet: 'bluechip1saver2k8f5n3m7wp4xr6qt9jv0ydclhgab1u3e',
        total_paid_usd: '800000000',
        total_paid_bluechip: '6400000000',
        last_payment_usd: '800000000',
        last_payment_bluechip: '6400000000',
        last_commited: ((now - 200 * day) * 1000000).toString(),
    },
];

// ------------------------------------------------------------------
// Mock query functions
// ------------------------------------------------------------------

function delay(ms: number = 300): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function findPool(address: string): PoolSummary | undefined {
    return MOCK_POOLS.find((p) => p.poolAddress === address);
}

export async function fetchPoolSummary(poolAddress: string): Promise<PoolSummary | null> {
    await delay(400);
    return findPool(poolAddress) || MOCK_POOLS[0];
}

export async function fetchAllPoolSummaries(_factoryAddress: string): Promise<PoolSummary[]> {
    await delay(600);
    return [...MOCK_POOLS];
}

export async function queryPoolCommits(poolAddress: string): Promise<PoolCommitResponse | null> {
    await delay(200);
    const pool = findPool(poolAddress);
    if (pool && (pool.tokenSymbol === 'DELTA' || pool.tokenSymbol === 'EPS')) {
        return { total_count: MOCK_DELTA_COMMITTERS.length, commiters: MOCK_DELTA_COMMITTERS };
    }
    return { total_count: MOCK_COMMITTERS.length, commiters: MOCK_COMMITTERS };
}

export async function queryPositions(poolAddress: string): Promise<PositionsResponse | null> {
    await delay(200);
    const pool = findPool(poolAddress);
    if (pool && !pool.thresholdReached) return { positions: [] };
    // First active pool gets positions
    if (pool === MOCK_POOLS[0]) return { positions: MOCK_POSITIONS };
    // Second pool: user has one position
    if (pool === MOCK_POOLS[1]) {
        return {
            positions: [{
                position_id: '4',
                liquidity: '28000000000',
                owner: MOCK_WALLET,
                fee_growth_inside_0_last: '75000',
                fee_growth_inside_1_last: '60000',
                created_at: (now - 20 * day) * 1000000,
                last_fee_collection: (now - 8 * day) * 1000000,
                unclaimed_fees_0: '180000000',
                unclaimed_fees_1: '140000000',
            }],
        };
    }
    return { positions: [] };
}

export async function queryPoolPair(poolAddress: string): Promise<PoolPairInfo | null> {
    await delay(100);
    const pool = findPool(poolAddress);
    return {
        asset_infos: [
            { bluechip: { denom: 'ubluechip' } },
            { creator_token: { contract_addr: pool?.creatorTokenAddress || 'bluechip1mock_token' } },
        ],
        contract_addr: poolAddress,
        pool_type: { xyk: {} },
    };
}

export async function queryPoolCreator(poolAddress: string): Promise<string | null> {
    await delay(100);
    const pool = findPool(poolAddress);
    // The mock user is the creator of ALPHA and DELTA
    if (pool && (pool.tokenSymbol === 'ALPHA' || pool.tokenSymbol === 'DELTA')) {
        return MOCK_WALLET;
    }
    return 'bluechip1othercreator_not_you_random_addr_placeholder';
}

export async function findPoolsByCreator(
    pools: PoolSummary[],
    walletAddress: string
): Promise<PoolSummary[]> {
    await delay(300);
    // Mock user created ALPHA and DELTA
    return pools.filter((p) => p.tokenSymbol === 'ALPHA' || p.tokenSymbol === 'DELTA');
}

// Unused in pages but exported for type compatibility
export async function queryPoolState(_: string): Promise<PoolStateResponse | null> { return null; }
export async function queryPoolInfo(_: string): Promise<PoolInfoResponse | null> { return null; }
export async function queryFeeState(_: string): Promise<PoolFeeStateResponse | null> { return null; }
export async function queryCommitStatus(_: string): Promise<CommitStatus | null> { return null; }
export async function queryTokenInfo(_: string): Promise<CW20TokenInfo | null> { return null; }
export async function queryFactoryConfig(_: string): Promise<FactoryConfig | null> { return null; }
export async function discoverPoolContracts(_: number): Promise<string[]> { return []; }
export function getCosmWasmClient(): Promise<any> { return Promise.resolve(null); }

// ------------------------------------------------------------------
// Helpers (unchanged from production)
// ------------------------------------------------------------------

export function getCreatorTokenAddress(assetInfos: [TokenType, TokenType]): string | null {
    const creatorToken = assetInfos.find(
        (asset): asset is { creator_token: { contract_addr: string } } =>
            asset.creator_token !== undefined
    );
    return creatorToken?.creator_token.contract_addr ?? null;
}

export function formatMicroAmount(amount: string, decimals: number = 6): string {
    const num = parseInt(amount) / Math.pow(10, decimals);
    if (isNaN(num)) return '0';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function abbreviateAddress(address: string, prefixLen: number = 12, suffixLen: number = 6): string {
    if (address.length <= prefixLen + suffixLen + 3) return address;
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}
