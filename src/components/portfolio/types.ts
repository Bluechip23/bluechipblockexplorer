import {
    PoolSummary,
    CommitterInfo,
    PositionResponse,
} from '../../utils/contractQueries';

export interface MyCommitment {
    pool: PoolSummary;
    commit: CommitterInfo;
}

export interface MyPosition {
    pool: PoolSummary;
    position: PositionResponse;
}

export interface TxRecord {
    pool: PoolSummary;
    type: 'commit' | 'position';
    amount: string;
    timestamp: string;
}
