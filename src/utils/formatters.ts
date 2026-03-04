/**
 * Shared utility functions for formatting data across the explorer.
 */

/** Format a denom string to a human-readable name */
export const formatDenom = (denom: string): string => {
    if (!denom) return '';
    // IBC denom resolution
    if (denom.startsWith('ibc/')) {
        const hash = denom.slice(4, 12).toUpperCase();
        // Known IBC denoms mapping
        const knownIbcDenoms: Record<string, string> = {
            // Add known IBC denoms here as they are discovered
        };
        return knownIbcDenoms[denom] || `IBC/${hash}...`;
    }
    // Native denom formatting
    if (denom.startsWith('u')) {
        return denom.slice(1).toUpperCase();
    }
    if (denom.startsWith('factory/')) {
        const parts = denom.split('/');
        return parts[parts.length - 1] || denom;
    }
    return denom.toUpperCase();
};

/** Convert micro-denom amount to display amount (divide by 1e6) */
export const formatTokenAmount = (amount: string | number, decimals: number = 6): string => {
    const num = Number(amount) / Math.pow(10, decimals);
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(decimals);
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

/** Truncate an address or hash for display: bluechip1abc...xyz */
export const truncateAddress = (address: string, start: number = 10, end: number = 6): string => {
    if (!address) return '';
    if (address.length <= start + end) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
};

/** Format a timestamp to relative time (e.g., "5 mins ago") */
export const timeAgo = (dateString: string): string => {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();

    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

    return past.toLocaleDateString();
};

/** Decode a Cosmos SDK message type to a human-readable label */
export const decodeMsgType = (msgType: string): string => {
    if (!msgType) return 'Unknown';
    const typeMap: Record<string, string> = {
        '/cosmos.bank.v1beta1.MsgSend': 'Send',
        '/cosmos.bank.v1beta1.MsgMultiSend': 'MultiSend',
        '/cosmos.staking.v1beta1.MsgDelegate': 'Delegate',
        '/cosmos.staking.v1beta1.MsgUndelegate': 'Undelegate',
        '/cosmos.staking.v1beta1.MsgBeginRedelegate': 'Redelegate',
        '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward': 'Claim Rewards',
        '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission': 'Withdraw Commission',
        '/cosmos.gov.v1beta1.MsgVote': 'Vote',
        '/cosmos.gov.v1beta1.MsgSubmitProposal': 'Submit Proposal',
        '/cosmos.gov.v1beta1.MsgDeposit': 'Deposit',
        '/ibc.core.client.v1.MsgUpdateClient': 'IBC Update Client',
        '/ibc.core.channel.v1.MsgRecvPacket': 'IBC Recv Packet',
        '/ibc.core.channel.v1.MsgAcknowledgement': 'IBC Acknowledgement',
        '/ibc.applications.transfer.v1.MsgTransfer': 'IBC Transfer',
        '/cosmwasm.wasm.v1.MsgExecuteContract': 'Execute Contract',
        '/cosmwasm.wasm.v1.MsgInstantiateContract': 'Instantiate Contract',
        '/cosmwasm.wasm.v1.MsgStoreCode': 'Store Code',
    };
    if (typeMap[msgType]) return typeMap[msgType];
    // Fallback: extract the last part after the last dot
    const parts = msgType.split('.');
    const last = parts[parts.length - 1];
    if (last?.startsWith('Msg')) return last.slice(3);
    return last || msgType;
};

/** Convert CSV data to a downloadable blob URL */
export const exportToCsv = (filename: string, headers: string[], rows: string[][]): void => {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
