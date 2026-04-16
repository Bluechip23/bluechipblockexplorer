import { SigningStargateClient, StargateClient } from '@cosmjs/stargate';
import { rpcEndpoint } from '../components/universal/IndividualPage.const';

// Reuse a single read-only client across search requests instead of opening a
// new WebSocket per call. StargateClient is enough here — search does not sign.
let clientPromise: Promise<StargateClient> | null = null;

function getClient(): Promise<StargateClient> {
    if (!clientPromise) {
        clientPromise = StargateClient.connect(rpcEndpoint).catch((err) => {
            // Reset so the next call retries instead of returning a stuck rejected promise.
            clientPromise = null;
            throw err;
        });
    }
    return clientPromise;
}

export const fetchBlock = async (blockNumber: number) => {
    try {
        const client = await getClient();
        return await client.getBlock(blockNumber);
    } catch (error) {
        console.error('Error fetching block:', error);
        throw new Error('Failed to fetch block. Please check the RPC connection.');
    }
};

export const fetchTransaction = async (txHash: string) => {
    try {
        const client = await getClient();
        return await client.getTx(txHash);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        throw new Error('Failed to fetch transaction. Please check the RPC connection.');
    }
};

export const fetchWallet = async (walletAddress: string) => {
    try {
        const client = await getClient();
        return await client.getAccount(walletAddress);
    } catch (error) {
        console.error('Error fetching wallet info:', error);
        throw new Error('Failed to fetch wallet information. Please check the RPC connection.');
    }
};

// SigningStargateClient is still exported here in case a future consumer needs
// signing capability — keep the type import so tree-shaking strips it when unused.
export type { SigningStargateClient };

