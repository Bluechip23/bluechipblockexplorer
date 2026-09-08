// Committer size tiers, in GROSS micro-OSMO committed per wallet. These
// are explorer display policy — the contracts have no notion of tiers.
// Since the oracle removal every commit ledger amount is native
// (micro-OSMO), so the cutoffs are OSMO amounts rather than USD.
export const WHALE_COMMIT_NATIVE = 10_000_000_000n;   // 10,000 OSMO
export const MID_COMMIT_NATIVE = 1_000_000_000n;      //  1,000 OSMO
