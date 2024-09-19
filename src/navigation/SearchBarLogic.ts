import { SigningStargateClient } from '@cosmjs/stargate';
import { rpcEndpoint } from '../components/universal/IndividualPage.const';

export const fetchBlock = async (blockNumber: number) => {
    try {
        const client = await SigningStargateClient.connect(rpcEndpoint);
        const block = await client.getBlock(blockNumber);
        return block;
    } catch (error) {
        console.error('Error fetching block:', error);
        throw new Error('Failed to fetch block. Please check the RPC connection.');
    }
};

export const fetchTransaction = async (txHash: string) => {
    try {
        const client = await SigningStargateClient.connect(rpcEndpoint);
        const transaction = await client.getTx(txHash);
        return transaction;
    } catch (error) {
        console.error('Error fetching transaction:', error);
        throw new Error('Failed to fetch transaction. Please check the RPC connection.');
    }
};

export const fetchWallet = async (walletAddress: string) => {
    try {
        const client = await SigningStargateClient.connect(rpcEndpoint);
        const account = await client.getAccount(walletAddress);
        return account;
    } catch (error) {
        console.error('Error fetching wallet info:', error);
        throw new Error('Failed to fetch wallet information. Please check the RPC connection.');
    }
};