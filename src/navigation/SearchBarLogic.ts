import { SigningStargateClient } from '@cosmjs/stargate';

const rpcEndpoint = 'https://bluechip.rpc.bluechip.link';

export const fetchBlock = async (blockNumber: number) => {
    const client = await SigningStargateClient.connect(rpcEndpoint);
    const block = await client.getBlock(blockNumber);
    return block;
};

export const fetchTransaction = async (txHash: string) => {
    const client = await SigningStargateClient.connect(rpcEndpoint);
    const transaction = await client.getTx(txHash);
    return transaction;
};

export const fetchWallet = async (walletAddress: string) => {
    const client = await SigningStargateClient.connect(rpcEndpoint);
    const account = await client.getAccount(walletAddress);
    return account;
};