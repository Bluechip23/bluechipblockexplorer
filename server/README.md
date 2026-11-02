# BlueChip profiles service

Creator display names + link-in-bio pages for the block explorer. Backs the
`/creator/:idOrName` public links page, the `/mylinks` manage page, and the
`/feed` subscriber feed (the newest links across every creator a wallet is
committed to — the platform hosts links only, so this is where subscribers
catch up without visiting each creator's site).

Reads are public. Writes are authenticated with **ADR-36** signatures
(Keplr/Leap `signArbitrary`) verified fully server-side — no session, no
password, the wallet key is the identity. Links can be marked *gated*
(subscribers-only): the public API never returns a gated link's URL; the
signed `/links/unlock` endpoint checks the caller's `committing_info`
record on the creator's pool contract (via RPC) before revealing them.

## Run

```bash
cd server
npm install
npm run dev          # tsc && node dist/index.js
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
| GET    | `/profiles/:idOrName`  | —      | Profile + links. `:idOrName` = wallet address, profile name, or pool address. Gated links come **without** `url` |
| GET    | `/search?q=`           | —      | `{ results: [{ name, wallet_address, pool_address }] }` — name substring (case-insensitive) or exact wallet/pool address, limit 20 |
| PUT    | `/profiles`            | signed | Upsert caller's profile `{ name, pool_address?, bio? }`. `409` on name conflict           |
| POST   | `/links`               | signed | Add link `{ title, url, gated, pinned?, position? }`. No cap on links; at most 10 pinned   |
| PUT    | `/links/:id`           | signed | Update own link `{ id, title?, url?, gated?, pinned?, position? }`                        |
| DELETE | `/links/:id`           | signed | Delete own link (payload `{ id }`)                                                        |
| POST   | `/links/unlock`        | signed | Payload `{ owner }` (wallet, name, or pool). Returns gated links **with** URLs when the caller has an **active** subscription on the owner's pool (a `committing_info` record whose `last_committed` is within `PROFILES_SUBSCRIPTION_DAYS`) — or is the owner. `403` with "expired" when the window has lapsed |
| POST   | `/feed`                | —      | Body `{ pools: [osmo1...], limit? }` (≤ 200 pools, ≤ 500 links). Subscriber feed: `{ creators, links }` — every link of every profile whose pool is listed, newest first, each with its `creator` inline. Gated links come **without** `url`. POST (not GET) only because a long pool list does not fit in a query string |
| POST   | `/feed/unlock`         | signed | Payload `{ pools }`. One signature unlocks the whole feed: checks the caller's `committing_info` on each pool (same access window as `/links/unlock`) and returns the gated links **with** URLs for every verified pool (or the caller's own profile), plus `verified_pools`, `expired_pools` (renew) and `failed_pools` (RPC errors — retry, not "unsubscribed") |

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
(`put_profile`, `add_link`, `update_link`, `delete_link`, `unlock_links`,
`unlock_feed`).
The server verifies: nonce exists/fresh and is consumed on use (replay-proof),
the pubkey hashes to the claimed `osmo1` address
(`bech32(ripemd160(sha256(pubkey)))`), and the secp256k1 signature verifies
over the ADR-36 SignDoc (`chain_id ""`, `sign/MsgSignData`).

### Validation rules

- `name`: 3–32 chars of `[a-zA-Z0-9 _.-]`, stored trimmed, unique case-insensitively
- `bio`: optional, ≤ 280 chars
- `pool_address`: optional, must be bech32 `osmo1...`
- `title`: ≤ 80 chars; `url`: ≤ 2048 chars, must parse as `http(s)` URL
- `pinned`: boolean; at most 10 pinned links per profile (no cap on links overall)
