# BlueChip Indexer

Event indexer for the BlueChip block explorer. It walks every block on the
chain (Osmosis), parses the wasm events the BlueChip contracts emit
(commits, swaps, creator claims, pool creation — plus legacy pre-Osmosis
liquidity actions when backfilling old history), stores them in SQLite,
and serves a small REST API the explorer uses for **time-series data**:
price history, volume and buy/sell pressure, commit growth, a live trade
feed, and per-transaction creator income statements.

Creator tokens are native TokenFactory denoms
(`factory/{pool}/{subdenom}`), not CW20 contracts.

The chain itself only stores *current* state (e.g. a wallet's cumulative
commit total). Everything historical lives here.

## Quick start

```bash
cd indexer
npm install
npm run build

RPC_URL=https://rpc.osmosis.zone \
FACTORY_ADDRESS=osmo1yourfactoryaddress \
npm start
```

The indexer backfills from `START_HEIGHT` to the chain tip, then tails new
blocks. Progress, the SQLite file, and the API all survive restarts — the
cursor is committed in the same transaction as each block's rows, and all
writes are idempotent, so it is always safe to stop and restart.

Point the explorer at it by setting `REACT_APP_INDEXER_URL` (defaults to
`http://localhost:4316`) before building the frontend.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `RPC_URL` | `http://localhost:26657` | Tendermint/CometBFT RPC of any Osmosis node (e.g. `https://rpc.osmosis.zone`) |
| `API_PORT` | `4316` | REST API port |
| `DB_PATH` | `./bluechip-indexer.db` | SQLite file location |
| `START_HEIGHT` | `1` | First height to index (set to the factory's deploy height to skip empty history; **must** be within your node's unpruned range) |
| `NATIVE_DENOM` | `uosmo` | Canonical native denom; used to classify swap direction (buy vs sell) |
| `FACTORY_ADDRESS` | *(unset)* | When set, only this contract can register new pools (recommended — prevents spoofed `pool_created` events from unrelated contracts) |
| `POLL_INTERVAL_MS` | `1500` | How often to check for new blocks once caught up |
| `BATCH_SIZE` | `20` | Heights ingested per batch during backfill |

## API

All endpoints are `GET`, return JSON, and allow CORS. Time parameters are
unix **seconds**; token amounts are micro-unit **strings** (6 decimals);
`price` is OSMO-per-token.

USD figures come from the `total_raised_after` attribute (micro-USD)
emitted on **funding-phase** commits — the running total the pool prices
at commit time. Other commit phases carry no USD attributes, so per-row
`amount_usd` is `NULL` on current-chain data (it is only populated for
legacy pre-Osmosis events, which carried per-commit USD amounts).

| Endpoint | Query params | Returns |
|---|---|---|
| `/health` | — | indexing cursor + row counts |
| `/pools` | — | every discovered pool with kind, creation time, creator-token denom (`token_address` field, a TokenFactory denom), threshold-crossing time |
| `/pools/:address/price-series` | `bucket` (sec), `from`, `to` | OHLC + OSMO volume per bucket |
| `/pools/:address/volume-series` | `bucket`, `from`, `to` | buys/sells counts and OSMO volume per bucket |
| `/pools/:address/commit-series` | `bucket`, `from`, `to` | commits, USD (legacy rows only — see USD note above), unique committers per bucket |
| `/pools/:address/trades` | `limit`, `before_ts`, `side`, `min_bluechip` | newest-first trade feed (swaps + post-threshold commits); `min_bluechip` is the whale filter |
| `/pools/:address/commits` | `limit`, `before_ts`, `wallet` | newest-first per-transaction commit history |
| `/pools/:address/creator-statement` | `from`, `to`, `fee_bps` (default 500) | chronological creator income lines: the creator's fee share of every commit + fee-pot/excess claim events |
| `/pools/:address/stats` | `window` (sec, default 86400) | current-vs-previous window totals (trades, buys, sells, volume, commits, USD, unique committers) |

## How it works

1. **Walk heights.** For each height: `/block` (timestamp + tx hashes) and
   `/block_results` (events per tx). Failed txs (`code != 0`) are skipped.
2. **Parse events.** Attribute keys mirror the contracts exactly — commit
   (`creator-pool/src/commit.rs`), swap (`pool-core/src/swap.rs`),
   creator claims, and the factory's pool-creation replies (the pool's
   instantiate event announces its TokenFactory denom as `token_denom`).
   Legacy pre-Osmosis events (liquidity handlers, `claim_creator_fees`,
   standard pools, CW20 `token_created_successfully`) are still parsed
   for historical backfills but never occur on current chains.
   Base64-encoded attributes (pre-0.37 Tendermint) are detected
   and decoded automatically.
3. **Store + serve.** Rows keyed by `(txhash, event_index)` so re-ingestion
   is idempotent; aggregations are plain SQL over indexed `(pool, ts)`.

Legacy post-threshold commits (which reported `tokens_received`) appear
in **both** `commits` and `trades` (side `buy`, source `commit`) —
economically they are AMM buys. Current-chain post-threshold commits
swap through the Osmosis pool and only report `swap_amount_bluechip` /
`token_out_min_amount`, so they index as commits only.

## Operational notes

- **Pruned nodes:** if your RPC node prunes history, backfill from an
  archive node first (or set `START_HEIGHT` to the oldest unpruned height
  and accept the gap).
- **Accounting precision:** aggregate sums (`volume_bluechip`, `usd`, ...)
  are computed as floats — fine for charts, not for accounting. The
  per-row micro-unit strings and the on-chain ledger are authoritative;
  `creator-statement` fee shares use integer string math.
- **`fee_bps`:** the creator-statement fee share defaults to the factory's
  standard 5% (`commit_fee_creator`). If your factory is configured
  differently, pass the matching `fee_bps`.
- **Scaling:** SQLite in WAL mode is plenty for this chain's volume. If
  you outgrow it, the storage layer is isolated in `src/db.ts` — port the
  ~15 SQL statements to Postgres and nothing else changes.

## Deployment

**Docker** (SQLite file persisted in a named volume):

```bash
docker build -t bluechip-indexer ./indexer
docker run -d --name bluechip-indexer \
  -p 4316:4316 -v bluechip-indexer-data:/data \
  -e RPC_URL=https://rpc.osmosis.zone \
  -e FACTORY_ADDRESS=osmo1yourfactory \
  -e START_HEIGHT=1 \
  bluechip-indexer
```

**systemd** (bare metal next to a node):

```ini
[Unit]
Description=BlueChip indexer
After=network-online.target

[Service]
WorkingDirectory=/opt/bluechip-indexer
Environment=RPC_URL=http://127.0.0.1:26657
Environment=FACTORY_ADDRESS=osmo1yourfactory
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`Restart=always` is the intended crash story: the cursor commits
transactionally with each block, so a restart resumes exactly where it
stopped.

**Rate limiting:** the API applies a per-IP fixed window
(`RATE_LIMIT_PER_MIN`, default 300; `/health` exempt; `0` disables).
For public deployments put it behind your usual reverse proxy / CDN and
disable the built-in limiter if the proxy already enforces one.

### Wallet commit history

`GET /wallets/:address/commits?limit&before_ts` returns one wallet's
per-transaction commit history across every pool (newest first) — the
explorer's wallet pages use it, since the chain only stores per-wallet
cumulative totals.

## Tests

```bash
npm test
```

Covers the event parsers (every action type, both attribute encodings,
buy/sell classification, threshold detection, factory filtering) and the
SQL aggregations (OHLC, volume split, commit series, whale filter,
statement fee math, window deltas) against an in-memory database.
