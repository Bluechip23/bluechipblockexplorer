import { formatMicroAmount } from './bigintMath';

const MESSAGE_TYPE_MAP: Record<string, string> = {
    '/cosmos.bank.v1beta1.MsgSend': 'Send',
    '/cosmos.staking.v1beta1.MsgDelegate': 'Delegate',
    '/cosmos.staking.v1beta1.MsgUndelegate': 'Undelegate',
    '/cosmos.staking.v1beta1.MsgBeginRedelegate': 'Redelegate',
    '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward': 'Claim Rewards',
    '/cosmos.gov.v1beta1.MsgVote': 'Vote',
    '/cosmos.gov.v1beta1.MsgSubmitProposal': 'Submit Proposal',
    '/cosmos.gov.v1beta1.MsgDeposit': 'Deposit',
    '/ibc.core.client.v1.MsgUpdateClient': 'IBC Update Client',
    '/ibc.core.channel.v1.MsgRecvPacket': 'IBC Receive',
    '/ibc.core.channel.v1.MsgAcknowledgement': 'IBC Acknowledge',
    '/ibc.core.channel.v1.MsgTimeout': 'IBC Timeout',
    '/ibc.applications.transfer.v1.MsgTransfer': 'IBC Transfer',
    '/cosmwasm.wasm.v1.MsgExecuteContract': 'Execute Contract',
    '/cosmwasm.wasm.v1.MsgInstantiateContract': 'Instantiate Contract',
    '/cosmwasm.wasm.v1.MsgStoreCode': 'Store Code',
    '/cosmwasm.wasm.v1.MsgMigrateContract': 'Migrate Contract',
};

export function decodeMessageType(typeUrl: string): string {
    if (!typeUrl) return 'Unknown';
    return MESSAGE_TYPE_MAP[typeUrl] || typeUrl.split('.').pop()?.replace('Msg', '') || typeUrl;
}

export function isIBCTransfer(typeUrl: string): boolean {
    return typeUrl?.startsWith('/ibc.') || false;
}

export function formatDenom(denom: string): string {
    if (!denom) return '';
    if (denom.startsWith('u')) {
        return denom.slice(1).toUpperCase();
    }
    if (denom.startsWith('ibc/')) {
        return `IBC/${denom.slice(4, 10)}...`;
    }
    return denom.toUpperCase();
}

export function formatAmount(amount: string | number, denom?: string): string {
    // u-prefixed denoms (e.g. ubluechip, uatom) are micro-units with 6 decimals.
    if (denom?.startsWith('u')) {
        return formatMicroAmount(amount, 6, 6);
    }
    const num = typeof amount === 'string' ? Number(amount) : amount;
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString();
}
