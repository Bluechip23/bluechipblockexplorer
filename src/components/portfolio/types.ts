import {
    PoolSummary,
    CommitterInfo,
} from '../../utils/contractQueries';

export interface MyCommitment {
    pool: PoolSummary;
    commit: CommitterInfo;
}
