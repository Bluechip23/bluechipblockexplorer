import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { rpcEndpoint, apiEndpoint } from '../components/universal/IndividualPage.const';

// Singleton client
let clientPromise: Promise<CosmWasmClient> | null = null;

export function getCosmWasmClient(): Promise<CosmWasmClient> {
    if (!clientPromise) {
        clientPromise = CosmWasmClient.connect(rpcEndpoint).catch((err) => {
            clientPromise = null;
            throw err;
        });
    }
    return clientPromise;
}

// ------------------------------------------------------------------
// Types mirroring the on-chain contract responses
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

// ------------------------------------------------------------------
// Query helpers
// ------------------------------------------------------------------

/**
 * Discover all pool contract addresses by querying CosmWasm for contracts
 * instantiated from the pool code ID.
 */
export async function discoverPoolContracts(poolCodeId: number): Promise<string[]> {
    try {
        const response = await fetch(
            `${apiEndpoint}/cosmwasm/wasm/v1/code/${poolCodeId}/contracts?pagination.limit=100`
        );
        const data = await response.json();
        return data.contracts || [];
    } catch (err) {
        console.error('Error discovering pool contracts:', err);
        return [];
    }
}

/** Query the factory contract config */
export async function queryFactoryConfig(factoryAddress: string): Promise<FactoryConfig | null> {
    try {
        const client = await getCosmWasmClient();
        const result: FactoryInstantiateResponse = await client.queryContractSmart(
            factoryAddress,
            { factory: {} }
        );
        return result.factory;
    } catch (err) {
        console.error('Error querying factory config:', err);
        return null;
    }
}

/** Query a pool contract's pair info (asset_infos, contract_addr, pool_type) */
export async function queryPoolPair(poolAddress: string): Promise<PoolPairInfo | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(poolAddress, { pair: {} });
    } catch (err) {
        console.error(`Error querying pool pair for ${poolAddress}:`, err);
        return null;
    }
}

/** Query pool state (reserves, liquidity) */
export async function queryPoolState(poolAddress: string): Promise<PoolStateResponse | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(poolAddress, { pool_state: {} });
    } catch (err) {
        console.error(`Error querying pool state for ${poolAddress}:`, err);
        return null;
    }
}

/** Query pool info (state + fees + positions count) */
export async function queryPoolInfo(poolAddress: string): Promise<PoolInfoResponse | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(poolAddress, { pool_info: {} });
    } catch (err) {
        console.error(`Error querying pool info for ${poolAddress}:`, err);
        return null;
    }
}

/** Query pool fee state */
export async function queryFeeState(poolAddress: string): Promise<PoolFeeStateResponse | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(poolAddress, { fee_state: {} });
    } catch (err) {
        console.error(`Error querying fee state for ${poolAddress}:`, err);
        return null;
    }
}

/** Query whether a pool's commit threshold is reached */
export async function queryCommitStatus(poolAddress: string): Promise<CommitStatus | null> {
    try {
        const client = await getCosmWasmClient();
        const result = await client.queryContractSmart(poolAddress, { is_fully_commited: {} });
        // The response can be either "fully_committed" (string) or { in_progress: { raised, target } }
        if (result === 'fully_committed' || result === 'FullyCommitted') {
            return { fully_committed: {} };
        }
        if (typeof result === 'object' && (result.in_progress || result.InProgress)) {
            const progress = result.in_progress || result.InProgress;
            return { in_progress: { raised: progress.raised, target: progress.target } };
        }
        return result;
    } catch (err) {
        console.error(`Error querying commit status for ${poolAddress}:`, err);
        return null;
    }
}

/** Query pool commits */
export async function queryPoolCommits(
    poolAddress: string,
    limit?: number
): Promise<PoolCommitResponse | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(poolAddress, {
            pool_commits: {
                pool_contract_address: poolAddress,
                limit: limit || 100,
            },
        });
    } catch (err) {
        console.error(`Error querying pool commits for ${poolAddress}:`, err);
        return null;
    }
}

/** Query CW20 token info */
export async function queryTokenInfo(tokenAddress: string): Promise<CW20TokenInfo | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(tokenAddress, { token_info: {} });
    } catch (err) {
        console.error(`Error querying token info for ${tokenAddress}:`, err);
        return null;
    }
}

/** Query positions for a pool */
export async function queryPositions(
    poolAddress: string,
    limit?: number
): Promise<PositionsResponse | null> {
    try {
        const client = await getCosmWasmClient();
        return await client.queryContractSmart(poolAddress, {
            positions: { limit: limit || 30 },
        });
    } catch (err) {
        console.error(`Error querying positions for ${poolAddress}:`, err);
        return null;
    }
}

// ------------------------------------------------------------------
// Higher-level helpers
// ------------------------------------------------------------------

export function getCreatorTokenAddress(assetInfos: [TokenType, TokenType]): string | null {
    const creatorToken = assetInfos.find(
        (asset): asset is { creator_token: { contract_addr: string } } =>
            asset.creator_token !== undefined
    );
    return creatorToken?.creator_token.contract_addr ?? null;
}

/** Format micro amounts (6 decimals) to human-readable */
export function formatMicroAmount(amount: string, decimals: number = 6): string {
    const num = parseInt(amount) / Math.pow(10, decimals);
    if (isNaN(num)) return '0';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Abbreviate an address: bluechip1abc...xyz */
export function abbreviateAddress(address: string, prefixLen: number = 12, suffixLen: number = 6): string {
    if (address.length <= prefixLen + suffixLen + 3) return address;
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
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
}

/**
 * Fetch a full summary for a single pool contract.
 */
export async function fetchPoolSummary(poolAddress: string): Promise<PoolSummary | null> {
    try {
        const [pair, poolInfo, commitStatus, commits] = await Promise.all([
            queryPoolPair(poolAddress),
            queryPoolInfo(poolAddress),
            queryCommitStatus(poolAddress),
            queryPoolCommits(poolAddress),
        ]);

        if (!pair || !poolInfo) return null;

        const creatorTokenAddr = getCreatorTokenAddress(pair.asset_infos);
        let tokenInfo: CW20TokenInfo = { name: 'Unknown', symbol: '???', decimals: 6, total_supply: '0' };
        if (creatorTokenAddr) {
            const ti = await queryTokenInfo(creatorTokenAddr);
            if (ti) tokenInfo = ti;
        }

        const thresholdReached = commitStatus
            ? commitStatus.fully_committed !== undefined
            : false;

        const raised = commitStatus?.in_progress?.raised || '0';
        const target = commitStatus?.in_progress?.target || '25000000000'; // default $25k in micro

        return {
            poolAddress,
            creatorTokenAddress: creatorTokenAddr,
            tokenName: tokenInfo.name,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            totalSupply: tokenInfo.total_supply,
            reserve0: poolInfo.pool_state.reserve0,
            reserve1: poolInfo.pool_state.reserve1,
            totalLiquidity: poolInfo.pool_state.total_liquidity,
            totalFeesCollected0: poolInfo.fee_state.total_fees_collected_0,
            totalFeesCollected1: poolInfo.fee_state.total_fees_collected_1,
            totalPositions: poolInfo.total_positions,
            thresholdReached,
            raised,
            target,
            totalCommitters: commits?.total_count || 0,
        };
    } catch (err) {
        console.error(`Error fetching pool summary for ${poolAddress}:`, err);
        return null;
    }
}

/**
 * Discover all pools via the factory and fetch summaries for each.
 */
export async function fetchAllPoolSummaries(factoryAddress: string): Promise<PoolSummary[]> {
    const config = await queryFactoryConfig(factoryAddress);
    if (!config) return [];

    const poolAddresses = await discoverPoolContracts(config.create_pool_wasm_contract_id);
    if (poolAddresses.length === 0) return [];

    const summaries = await Promise.all(poolAddresses.map(fetchPoolSummary));
    return summaries.filter((s): s is PoolSummary => s !== null);
}
