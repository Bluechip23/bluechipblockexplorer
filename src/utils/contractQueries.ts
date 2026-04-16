import { safeBigInt } from './bigintMath';

const MOCK_WALLET = 'bluechip1q2w3e4r5t6y7u8i9o0pzxcvbnmasdfghjkl42';


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

export interface TokenHolderEntry {
    address: string;
    balance: string;
}

export interface HolderDistribution {
    totalHolders: number;
    whales: number;      // 60,000+ tokens
    mid: number;         // 100 < balance < 60,000
    small: number;       // < 100 tokens
    topHolders: TokenHolderEntry[];
}

export interface ThresholdAnalytics {
    thresholdCrossedAt: number | null;   // unix timestamp (seconds) when threshold was hit
    poolCreatedAt: number | null;        // unix timestamp (seconds) when pool was created
    daysToThreshold: number | null;      // days from creation to threshold crossing
    totalCommittersAtThreshold: number;
    avgCommitValueUsd: string;           // micro USD average per committer
    totalRaisedUsd: string;
    walletBreakdown: {
        whaleCommitters: number;         // $5,000+ USD committed
        midCommitters: number;           // $500 – $5,000
        smallCommitters: number;         // < $500
    };
}

export interface PoolAnalytics {
    total_swap_count: number;
    total_commit_count: number;
    total_volume_0: string;
    total_volume_1: string;
    total_lp_deposit_count: number;
    total_lp_withdrawal_count: number;
    last_trade_block: number;
    last_trade_timestamp: number;
}

export interface PoolAnalyticsResponse {
    analytics: PoolAnalytics;
    current_price_0_to_1: string;
    current_price_1_to_0: string;
    total_value_locked_0: string;
    total_value_locked_1: string;
    fee_reserve_0: string;
    fee_reserve_1: string;
    threshold_status: CommitStatus;
    total_usd_raised: string;
    total_bluechip_raised: string;
    total_positions: number;
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
    createdAtBlock: number;
    thresholdCrossedAtBlock: number | null;
    // New fields from Analytics query
    totalSwapCount: number;
    totalCommitCount: number;
    totalVolume0: string;
    totalVolume1: string;
    totalLpDepositCount: number;
    totalLpWithdrawalCount: number;
    lastTradeBlock: number;
    lastTradeTimestamp: number;
    currentPrice0to1: string;
    currentPrice1to0: string;
    feeReserve0: string;
    feeReserve1: string;
    totalUsdRaised: string;
    totalBluechipRaised: string;
}


const now = Date.now();
const day = 86400000;

const MOCK_COMMITTERS: CommiterInfo[] = [
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
        createdAtBlock: 1_024_300,
        thresholdCrossedAtBlock: 1_187_650,
        totalSwapCount: 1_247,
        totalCommitCount: 42,
        totalVolume0: '89500000000000',
        totalVolume1: '178200000000000',
        totalLpDepositCount: 18,
        totalLpWithdrawalCount: 4,
        lastTradeBlock: 1_650_200,
        lastTradeTimestamp: Math.floor(now / 1000) - 3600,
        currentPrice0to1: '2.0',
        currentPrice1to0: '0.5',
        feeReserve0: '1200000000',
        feeReserve1: '800000000',
        totalUsdRaised: '25000000000',
        totalBluechipRaised: '200000000000',
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
        createdAtBlock: 1_310_800,
        thresholdCrossedAtBlock: 1_425_100,
        totalSwapCount: 583,
        totalCommitCount: 28,
        totalVolume0: '32100000000000',
        totalVolume1: '51800000000000',
        totalLpDepositCount: 9,
        totalLpWithdrawalCount: 2,
        lastTradeBlock: 1_648_900,
        lastTradeTimestamp: Math.floor(now / 1000) - 7200,
        currentPrice0to1: '1.611111',
        currentPrice1to0: '0.620689',
        feeReserve0: '650000000',
        feeReserve1: '420000000',
        totalUsdRaised: '25000000000',
        totalBluechipRaised: '200000000000',
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
        createdAtBlock: 892_150,
        thresholdCrossedAtBlock: 1_053_400,
        totalSwapCount: 312,
        totalCommitCount: 15,
        totalVolume0: '18700000000000',
        totalVolume1: '121500000000000',
        totalLpDepositCount: 5,
        totalLpWithdrawalCount: 1,
        lastTradeBlock: 1_640_100,
        lastTradeTimestamp: Math.floor(now / 1000) - 86400 * 3,
        currentPrice0to1: '6.526315',
        currentPrice1to0: '0.153225',
        feeReserve0: '300000000',
        feeReserve1: '580000000',
        totalUsdRaised: '25000000000',
        totalBluechipRaised: '200000000000',
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
        createdAtBlock: 1_502_900,
        thresholdCrossedAtBlock: null,
        totalSwapCount: 0,
        totalCommitCount: 12,
        totalVolume0: '0',
        totalVolume1: '0',
        totalLpDepositCount: 0,
        totalLpWithdrawalCount: 0,
        lastTradeBlock: 0,
        lastTradeTimestamp: 0,
        currentPrice0to1: '0',
        currentPrice1to0: '0',
        feeReserve0: '0',
        feeReserve1: '0',
        totalUsdRaised: '16800000000',
        totalBluechipRaised: '134400000000',
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
        createdAtBlock: 1_580_200,
        thresholdCrossedAtBlock: null,
        totalSwapCount: 0,
        totalCommitCount: 5,
        totalVolume0: '0',
        totalVolume1: '0',
        totalLpDepositCount: 0,
        totalLpWithdrawalCount: 0,
        lastTradeBlock: 0,
        lastTradeTimestamp: 0,
        currentPrice0to1: '0',
        currentPrice1to0: '0',
        feeReserve0: '0',
        feeReserve1: '0',
        totalUsdRaised: '3200000000',
        totalBluechipRaised: '25600000000',
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

const MOCK_DELTA_COMMITTERS: CommiterInfo[] = [
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
    {
        wallet: 'bluechip1saver2k8f5n3m7wp4xr6qt9jv0ydclhgab1u3e',
        total_paid_usd: '800000000',
        total_paid_bluechip: '6400000000',
        last_payment_usd: '800000000',
        last_payment_bluechip: '6400000000',
        last_commited: ((now - 200 * day) * 1000000).toString(),
    },
];


const MOCK_ALPHA_HOLDERS: TokenHolderEntry[] = [
    { address: 'bluechip1whale8k3jx9f7tn2m4qp6rz0sdvwcyahg5e72n', balance: '185000000000' },  // 185,000 tokens (whale)
    { address: MOCK_WALLET, balance: '92000000000' },                                            // 92,000 tokens (whale)
    { address: 'bluechip1degen9p4r6t2n7xm3k5wqv8jf0ychlsab2ue6', balance: '68000000000' },     // 68,000 tokens (whale)
    { address: 'bluechip1early4m2n7xp8wk5dv3qt6rj0yfscalh9zu8e3', balance: '45000000000' },    // 45,000 tokens (mid)
    { address: 'bluechip1saver2k8f5n3m7wp4xr6qt9jv0ydclhgab1u3e', balance: '28000000000' },    // 28,000 tokens (mid)
    { address: 'bluechip1hodl6n3m8k2f5wp4xr7qt0jv9ydclhsab3ue2', balance: '15000000000' },     // 15,000 tokens (mid)
    { address: 'bluechip1moon5r7t2n8xm3k4wqp6jf9v0ychlsab2dge1', balance: '8200000000' },      // 8,200 tokens (mid)
    { address: 'bluechip1tiny3m7k2f8n5wp4xr6qt0jv9ydclhsab1ue4', balance: '3500000000' },      // 3,500 tokens (mid)
    { address: 'bluechip1micro1a2b3c4d5e6f7g8h9i0jklmnopqrstuv', balance: '1200000000' },       // 1,200 tokens (mid)
    { address: 'bluechip1dust2b3c4d5e6f7g8h9i0jklmnopqrstuvwxy', balance: '420000000' },         // 420 tokens (mid)
    { address: 'bluechip1frag3c4d5e6f7g8h9i0jklmnopqrstuvwxyz1', balance: '75000000' },          // 75 tokens (small)
    { address: 'bluechip1atom4d5e6f7g8h9i0jklmnopqrstuvwxyz123', balance: '50000000' },           // 50 tokens (small)
    { address: 'bluechip1nano5e6f7g8h9i0jklmnopqrstuvwxyz12345', balance: '12000000' },           // 12 tokens (small)
    { address: 'bluechip1pico6f7g8h9i0jklmnopqrstuvwxyz1234567', balance: '5000000' },            // 5 tokens (small)
    { address: 'bluechip1zepto7g8h9i0jklmnopqrstuvwxyz12345678', balance: '800000' },             // 0.8 tokens (small)
];

const MOCK_DELTA_HOLDERS: TokenHolderEntry[] = [
    { address: 'bluechip1whale8k3jx9f7tn2m4qp6rz0sdvwcyahg5e72n', balance: '120000000000' },
    { address: MOCK_WALLET, balance: '65000000000' },
    { address: 'bluechip1early4m2n7xp8wk5dv3qt6rj0yfscalh9zu8e3', balance: '32000000000' },
    { address: 'bluechip1degen9p4r6t2n7xm3k5wqv8jf0ychlsab2ue6', balance: '18000000000' },
    { address: 'bluechip1saver2k8f5n3m7wp4xr6qt9jv0ydclhgab1u3e', balance: '5000000000' },
];

const MOCK_ALPHA_DISTRIBUTION: HolderDistribution = {
    totalHolders: 15,
    whales: 3,   // 60,000+
    mid: 7,      // 100 – 60,000
    small: 5,    // < 100
    topHolders: MOCK_ALPHA_HOLDERS.slice(0, 5),
};

const MOCK_DELTA_DISTRIBUTION: HolderDistribution = {
    totalHolders: 5,
    whales: 2,
    mid: 3,
    small: 0,
    topHolders: MOCK_DELTA_HOLDERS.slice(0, 5),
};

const MOCK_ALPHA_THRESHOLD: ThresholdAnalytics = {
    thresholdCrossedAt: Math.floor(now / 1000) - 86400 * 45,
    poolCreatedAt: Math.floor(now / 1000) - 86400 * 72,
    daysToThreshold: 27,
    totalCommittersAtThreshold: 8,
    avgCommitValueUsd: '3125000000',   // $3,125 avg per committer
    totalRaisedUsd: '25000000000',
    walletBreakdown: {
        whaleCommitters: 2,   // $5,000+
        midCommitters: 4,     // $500 – $5,000
        smallCommitters: 2,   // < $500
    },
};


function delay(ms: number = 300): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function findPool(address: string): PoolSummary | undefined {
    return MOCK_POOLS.find((p) => p.poolAddress === address);
}

export async function fetchPoolSummary(poolAddress: string): Promise<PoolSummary | null> {
    await delay(400);
    const pool = findPool(poolAddress) || MOCK_POOLS[0];
    // SECURITY: Sanitize all on-chain strings before they enter the render tree.
    return pool ? sanitizePoolSummary(pool) : null;
}

export async function fetchAllPoolSummaries(_factoryAddress: string): Promise<PoolSummary[]> {
    await delay(600);
    // SECURITY: Sanitize every pool summary returned from the chain query.
    return MOCK_POOLS.map(sanitizePoolSummary);
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
    if (pool === MOCK_POOLS[0]) return { positions: MOCK_POSITIONS };
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
    return pools.filter((p) => p.tokenSymbol === 'ALPHA' || p.tokenSymbol === 'DELTA');
}

export async function queryHolderDistribution(tokenAddress: string): Promise<HolderDistribution | null> {
    await delay(350);
    if (tokenAddress.includes('alpha')) return MOCK_ALPHA_DISTRIBUTION;
    if (tokenAddress.includes('delta')) return MOCK_DELTA_DISTRIBUTION;
    return MOCK_ALPHA_DISTRIBUTION;
}

export async function queryThresholdAnalytics(
    poolAddress: string,
    committers: CommiterInfo[]
): Promise<ThresholdAnalytics | null> {
    await delay(200);
    const pool = findPool(poolAddress);
    if (!pool) return null;

    if (pool.thresholdReached) {
        if (pool.tokenSymbol === 'ALPHA') return MOCK_ALPHA_THRESHOLD;
        return {
            ...MOCK_ALPHA_THRESHOLD,
            totalCommittersAtThreshold: pool.totalCommitters,
        };
    }

    const totalUsd = committers.reduce<bigint>((s, c) => s + safeBigInt(c.total_paid_usd), 0n);
    const avgUsd = committers.length > 0 ? totalUsd / BigInt(committers.length) : 0n;

    const WHALE_USD = 5_000_000_000n;  // $5,000 in micro
    const MID_USD = 500_000_000n;      // $500 in micro

    return {
        thresholdCrossedAt: null,
        poolCreatedAt: Math.floor(now / 1000) - 86400 * 90,
        daysToThreshold: null,
        totalCommittersAtThreshold: committers.length,
        avgCommitValueUsd: avgUsd.toString(),
        totalRaisedUsd: pool.raised,
        walletBreakdown: {
            whaleCommitters: committers.filter(c => safeBigInt(c.total_paid_usd) >= WHALE_USD).length,
            midCommitters: committers.filter(c => {
                const v = safeBigInt(c.total_paid_usd);
                return v >= MID_USD && v < WHALE_USD;
            }).length,
            smallCommitters: committers.filter(c => safeBigInt(c.total_paid_usd) < MID_USD).length,
        },
    };
}

export async function queryPoolAnalytics(poolAddress: string): Promise<PoolAnalyticsResponse | null> {
    await delay(250);
    const pool = findPool(poolAddress);
    if (!pool) return null;
    return {
        analytics: {
            total_swap_count: pool.totalSwapCount,
            total_commit_count: pool.totalCommitCount,
            total_volume_0: pool.totalVolume0,
            total_volume_1: pool.totalVolume1,
            total_lp_deposit_count: pool.totalLpDepositCount,
            total_lp_withdrawal_count: pool.totalLpWithdrawalCount,
            last_trade_block: pool.lastTradeBlock,
            last_trade_timestamp: pool.lastTradeTimestamp,
        },
        current_price_0_to_1: pool.currentPrice0to1,
        current_price_1_to_0: pool.currentPrice1to0,
        total_value_locked_0: pool.reserve0,
        total_value_locked_1: pool.reserve1,
        fee_reserve_0: pool.feeReserve0,
        fee_reserve_1: pool.feeReserve1,
        threshold_status: pool.thresholdReached
            ? { fully_committed: {} }
            : { in_progress: { raised: pool.raised, target: pool.target } },
        total_usd_raised: pool.totalUsdRaised,
        total_bluechip_raised: pool.totalBluechipRaised,
        total_positions: pool.totalPositions,
    };
}

export interface WalletHolding {
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    tokenDecimals: number;
    balance: string;
    poolAddress: string;
}

export async function queryWalletHoldings(
    walletAddress: string,
    pools: PoolSummary[]
): Promise<WalletHolding[]> {
    await delay(400);
    if (walletAddress !== MOCK_WALLET) return [];
    const holdings: WalletHolding[] = [];
    for (const pool of pools) {
        if (!pool.creatorTokenAddress || !pool.thresholdReached) continue;
        // Mock: the user holds tokens in ALPHA and BETA pools
        if (pool.tokenSymbol === 'ALPHA') {
            holdings.push({
                tokenAddress: pool.creatorTokenAddress,
                tokenSymbol: pool.tokenSymbol,
                tokenName: pool.tokenName,
                tokenDecimals: pool.tokenDecimals,
                balance: '15000000000', // 15,000 tokens
                poolAddress: pool.poolAddress,
            });
        } else if (pool.tokenSymbol === 'BETA') {
            holdings.push({
                tokenAddress: pool.creatorTokenAddress,
                tokenSymbol: pool.tokenSymbol,
                tokenName: pool.tokenName,
                tokenDecimals: pool.tokenDecimals,
                balance: '8500000000', // 8,500 tokens
                poolAddress: pool.poolAddress,
            });
        }
    }
    return holdings;
}

export async function queryPoolState(_: string): Promise<PoolStateResponse | null> { return null; }
export async function queryPoolInfo(_: string): Promise<PoolInfoResponse | null> { return null; }
export async function queryFeeState(_: string): Promise<PoolFeeStateResponse | null> { return null; }
export async function queryCommitStatus(_: string): Promise<CommitStatus | null> { return null; }
export async function queryTokenInfo(_: string): Promise<CW20TokenInfo | null> { return null; }
export async function queryFactoryConfig(_: string): Promise<FactoryConfig | null> { return null; }
export async function discoverPoolContracts(_: number): Promise<string[]> { return []; }
export function getCosmWasmClient(): Promise<any> { return Promise.resolve(null); }


export function getCreatorTokenAddress(assetInfos: [TokenType, TokenType]): string | null {
    const creatorToken = assetInfos.find(
        (asset): asset is { creator_token: { contract_addr: string } } =>
            asset.creator_token !== undefined
    );
    return creatorToken?.creator_token.contract_addr ?? null;
}

export { formatMicroAmount, safeBigInt, microToNumber } from './bigintMath';

export function abbreviateAddress(address: string, prefixLen: number = 12, suffixLen: number = 6): string {
    if (address.length <= prefixLen + suffixLen + 3) return address;
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

// SECURITY: Sanitizes all user-facing string fields on a PoolSummary before
// they are rendered. On-chain data (token names, symbols, contract labels)
// is untrusted — an attacker could deploy a pool with a name containing
// zero-width characters, RTL overrides, or abusively long strings that break
// layout or enable phishing. This function strips control characters and
// truncates to safe lengths. Should be called on every pool summary returned
// from a chain query before it enters the React render tree.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
function sanitizeStr(s: string, maxLen: number): string {
    const cleaned = s.replace(UNSAFE_CHARS, '');
    return cleaned.length <= maxLen ? cleaned : cleaned.slice(0, maxLen) + '\u2026';
}

export function sanitizePoolSummary(pool: PoolSummary): PoolSummary {
    return {
        ...pool,
        tokenName: sanitizeStr(pool.tokenName, 64),
        tokenSymbol: sanitizeStr(pool.tokenSymbol, 16),
    };
}
