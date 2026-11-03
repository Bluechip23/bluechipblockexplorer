# BlueChip profiles service

Creator display names + link-in-bio pages for the block explorer. Backs the
`/creator/:idOrName` public links page, the `/mylinks` manage page, and the
`/feed` subscriber feed (the newest links across every creator a wallet is
committed to — the platform hosts links only, so this is where subscribers
catch up without visiting each creator's site).

Reads are public. Writes are authenticated with **ADR-36** signatures
(Keplr/Leap `signArbitrary`) verified fully server-side — no session, no
password, the wallet key is the identity. Links can be marked *gated*
(subscribers-only), optionally behind priced **subscription tiers**: the
public API never returns a gated link's URL; the signed `/links/unlock`
endpoint checks the caller's `committing_info` record on the creator's pool
contracts (via RPC) and reveals only the links that record pays for.

## Run

```bash
cd server
npm install
npm run dev          # tsc && node dist/index.js
npm test             # gate math, storage, and signed HTTP flows (stubbed chain)
```

Docker:

```bash
docker build -t bluechip-profiles .
docker run -p 4317:4317 -v profiles-data:/data bluechip-profiles
```

## Environment

| Variable             | Default                              | Purpose                                        |
| -------------------- | ------------------------------------ | ---------------------------------------------- |
| `PROFILES_PORT`      | `4317`                               | HTTP listen port                               |
| `PROFILES_DB`        | `./profiles.db`                      | SQLite file path                               |
| `PROFILES_RPC`       | `https://rpc.osmotest5.osmosis.zone` | RPC used for `committing_info` checks          |
| `RATE_LIMIT_PER_MIN` | `300`                                | Per-IP request budget; `0` disables            |
| `PROFILES_SUBSCRIPTION_DAYS` | `30`                         | Days of access one commit buys (from `last_committed`) |

## API

CORS is open (public read API). Bodies are JSON, limited to 64 KB.

| Method | Path                   | Auth   | Description                                                                              |
| ------ | ---------------------- | ------ | ---------------------------------------------------------------------------------------- |
| GET    | `/health`              | —      | `{ ok: true, subscription_days }`                                                         |
| GET    | `/auth/nonce?address=` | —      | Issues a one-shot nonce (random 32-hex, 5-minute TTL) for the address                     |
| GET    | `/profiles/:idOrName`  | —      | `{ profile, links, tiers }`. `:idOrName` = wallet address, profile name, or pool address. Gated links come **without** `url`; every link carries `tier_ids` |
| GET    | `/search?q=`           | —      | `{ results: [{ name, wallet_address, pool_address }] }` — name substring (case-insensitive) or exact wallet/pool address, limit 20 |
| PUT    | `/profiles`            | signed | Upsert caller's profile `{ name, pool_address?, bio? }`. `409` on name conflict. A new `pool_address` must be a pool the caller created on-chain (`403` otherwise, `502` if the check fails) |
| POST   | `/links`               | signed | Add link `{ title, url, gated, tier_ids?, pinned?, position? }`. Non-empty `tier_ids` makes it gated. No cap on links; at most 10 pinned |
| PUT    | `/links/:id`           | signed | Update own link `{ id, title?, url?, gated?, tier_ids?, pinned?, position? }`. `tier_ids` replaces the set; `gated: false` clears it |
| DELETE | `/links/:id`           | signed | Delete own link (payload `{ id }`)                                                        |
| POST   | `/tiers`               | signed | Add tier `{ pool_address, name, price_native }` on a pool the caller created on-chain. At most 5 per creator |
| PUT    | `/tiers/:id`           | signed | Rename / re-price own tier `{ id, name?, price_native? }`. The pool is fixed             |
| DELETE | `/tiers/:id`           | signed | Delete own tier (payload `{ id }`); it is removed from every link it gated               |
| POST   | `/links/unlock`        | signed | Payload `{ owner }` (wallet, name, or pool). Returns `{ links, subscriptions, subscription_days }`: the gated links (**with** URLs) the caller's subscription pays for (see below), or all of them for the owner, plus the caller's standing on each pool involved (`status` `active` / `expired` / `none`, `last_payment_native`, `expires_at`). `502` when any on-chain check fails |
| POST   | `/feed`                | —      | Body `{ pools: [osmo1...], limit? }` (≤ 200 pools, ≤ 500 links). Subscriber feed: `{ creators, links, tiers }` — every link of every profile whose pool is listed, newest first, each with its `creator` inline. Gated links come **without** `url`. POST (not GET) only because a long pool list does not fit in a query string |
| POST   | `/feed/unlock`         | signed | Payload `{ pools }`. One signature unlocks the whole feed: checks the caller's `committing_info` on each pool (same access window as `/links/unlock`) and returns the gated links **with** URLs that the caller's subscriptions pay for (same per-link tier rule), plus `verified_pools`, `expired_pools` (renew), `failed_pools` (RPC errors — retry, not "unsubscribed") and `tier_locked` (links of verified creators that need a higher tier) |

Every link in a response carries `created_at` / `updated_at` (unix seconds),
which is what the explorer's feed page uses to flag links added since the
viewer's last visit, and `pinned`. Pinned links are the creator's bio set
(at most 10, shown at the top of the links page in `position` order);
everything else is a post, listed newest first and surfaced in subscribers'
feeds. There is no cap on posts.

### Subscriptions last 30 days

A commit is a subscription payment: it buys `PROFILES_SUBSCRIPTION_DAYS`
(default 30) days of access, counted from the wallet's `last_committed`
on the creator's pool, and committing again renews it. The chain never
expires the record — the window is platform policy, enforced here on both
unlock endpoints and mirrored by the explorer and the embeddable widget.

### Subscription tiers (priced in OSMO)

A creator can define up to 5 named tiers, each on one pool their wallet
created (checked on-chain with the pool's `fee_info` query) and priced in
`price_native` (micro-OSMO integer string). A tier is "commit at least this
much per access window": the caller's record on that pool qualifies when its
`last_committed` is inside the window **and** its `last_payment_native`
(gross micro-OSMO of the most recent commit) is at least the price. So a
bigger commit covers every cheaper tier, and the latest commit sets the
caller's tier until it is renewed.

A gated link opens for the caller when it meets **any** of the link's gates:

- **Tiered link** — one gate per pool, priced at the cheapest attached tier
  on that pool. Satisfying any one pool unlocks it.
- **Gated link with no tiers** — any active subscription to the creator's
  profile pool unlocks it (the original "subscribers only" switch). With no
  profile pool set, only the owner can open it.

Deleting a tier removes it from its links; a link left with no tiers falls
back to "any active subscriber". The explorer warns about that before
deleting.

### Signed request format

Every write body is:

```json
{
  "address":   "osmo1...",
  "pub_key":   "<base64 compressed secp256k1>",
  "signature": "<base64 64-byte r||s>",
  "nonce":     "<from /auth/nonce>",
  "payload":   { "intent": "<endpoint intent>", ... }
}
```

The wallet signs (ADR-36 / `signArbitrary`) the string:

```
bluechip-profiles:<nonce>:<sha256hex of canonical JSON payload>
```

Canonical JSON = recursively key-sorted `JSON.stringify` with `undefined`
fields dropped. `payload.intent` binds the signature to one endpoint
(`put_profile`, `add_link`, `update_link`, `delete_link`, `add_tier`,
`update_tier`, `delete_tier`, `unlock_links`, `unlock_feed`).
The server verifies: nonce exists/fresh and is consumed on use (replay-proof),
the pubkey hashes to the claimed `osmo1` address
(`bech32(ripemd160(sha256(pubkey)))`), and the secp256k1 signature verifies
over the ADR-36 SignDoc (`chain_id ""`, `sign/MsgSignData`).

### Validation rules

- `name`: 3–32 chars of `[a-zA-Z0-9 _.-]`, stored trimmed, unique case-insensitively
- `bio`: optional, ≤ 280 chars
- `pool_address`: optional, must be bech32 `osmo1...` and created by the signer (checked on change)
- `title`: ≤ 80 chars; `url`: ≤ 2048 chars, must parse as `http(s)` URL
- `pinned`: boolean; at most 10 pinned links per profile (no cap on links overall)
- tier `name`: 1–40 chars, no control / zero-width / bidi-override characters
- `price_native`: positive integer micro-OSMO string, ≤ 1,000,000,000 OSMO
- `tier_ids`: at most 5, each a tier the signer owns
